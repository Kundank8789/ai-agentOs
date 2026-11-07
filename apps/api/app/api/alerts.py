from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, func, case, exists
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.agent_alert import AgentAlert
from app.models.alert_read import AlertRead
from app.models.organization import Organization
from app.models.user import User


router = APIRouter(
    prefix="/alerts",
    tags=["Agent Alerts"],
)


class AlertSettingsUpdate(BaseModel):
    warning_threshold: float = Field(gt=0, le=99)
    critical_threshold: float = Field(gt=0, le=100)
    min_completed_tasks: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.warning_threshold >= self.critical_threshold:
            raise ValueError(
                "Warning threshold must be lower than critical threshold"
            )
        return self


def serialize_alert(alert: AgentAlert) -> dict:
    return {
        "id": str(alert.id),
        "organization_id": str(alert.organization_id),
        "agent_id": str(alert.agent_id),
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "status": alert.status,
        "failure_rate": alert.failure_rate,
        "threshold": alert.threshold,
        "metadata": alert.alert_metadata,
        "acknowledged_by": (
            str(alert.acknowledged_by)
            if alert.acknowledged_by else None
        ),
        "acknowledged_at": alert.acknowledged_at,
        "resolved_at": alert.resolved_at,
        "created_at": alert.created_at,
    }


@router.get("/")
async def list_alerts(
    status: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(AgentAlert).where(
        AgentAlert.organization_id == current_user.organization_id
    )

    if status:
        if status not in {"active", "acknowledged", "resolved"}:
            raise HTTPException(
                status_code=422,
                detail="Invalid alert status",
            )
        query = query.where(AgentAlert.status == status)

    if severity:
        if severity not in {"warning", "critical"}:
            raise HTTPException(
                status_code=422,
                detail="Invalid alert severity",
            )
        query = query.where(AgentAlert.severity == severity)

    query = query.outerjoin(
        AlertRead,
        (AlertRead.alert_id == AgentAlert.id)
        & (AlertRead.user_id == current_user.id),
    ).add_columns(AlertRead.alert_id.label("read_alert_id"))

    result = await db.execute(
        query.order_by(AgentAlert.created_at.desc())
    )

    return [
        {
            **serialize_alert(alert),
            "is_read": read_alert_id is not None,
        }
        for alert, read_alert_id in result.all()
    ]


@router.get("/summary")
async def get_alert_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            func.count(AgentAlert.id).label("total"),
            func.count(
                case((AgentAlert.status == "active", AgentAlert.id))
            ).label("active"),
            func.count(
                case(
                    (AgentAlert.status == "acknowledged", AgentAlert.id)
                )
            ).label("acknowledged"),
            func.count(
                case((AgentAlert.status == "resolved", AgentAlert.id))
            ).label("resolved"),
            func.count(
                case(
                    (
                        (AgentAlert.status == "active")
                        & (AgentAlert.severity == "critical"),
                        AgentAlert.id,
                    )
                )
            ).label("critical_active"),
            func.count(
                case(
                    (
                        (AgentAlert.status == "active")
                        & (AgentAlert.severity == "warning"),
                        AgentAlert.id,
                    )
                )
            ).label("warning_active"),
        ).where(
            AgentAlert.organization_id == current_user.organization_id
        )
    )

    summary = result.one()

    return {
        "total": summary.total or 0,
        "active": summary.active or 0,
        "acknowledged": summary.acknowledged or 0,
        "resolved": summary.resolved or 0,
        "critical_active": summary.critical_active or 0,
        "warning_active": summary.warning_active or 0,
    }


@router.get("/settings")
async def get_alert_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Organization).where(
            Organization.id == current_user.organization_id
        )
    )

    organization = result.scalar_one_or_none()

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    defaults = {
        "warning_threshold": 20.0,
        "critical_threshold": 40.0,
        "min_completed_tasks": 4,
    }

    return {
        **defaults,
        **(organization.alert_settings or {}),
    }


@router.put("/settings")
async def update_alert_settings(
    settings: AlertSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=403,
            detail="Only organization owners and admins can update alert settings",
        )

    result = await db.execute(
        select(Organization).where(
            Organization.id == current_user.organization_id
        )
    )

    organization = result.scalar_one_or_none()

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    organization.alert_settings = settings.model_dump()

    await db.commit()
    await db.refresh(organization)

    return {
        "message": "Alert settings updated successfully",
        "settings": organization.alert_settings,
    }


# ============================================================================
# Notification (read-state) endpoints — Phase 4.10 Step 11
# ============================================================================


@router.post("/{alert_id}/read")
async def mark_alert_read(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AgentAlert.id).where(
            AgentAlert.id == alert_id,
            AgentAlert.organization_id == current_user.organization_id,
        )
    )

    alert = result.scalar_one_or_none()

    if alert is None:
        raise HTTPException(
            status_code=404,
            detail="Alert not found",
        )

    statement = (
        insert(AlertRead)
        .values(
            user_id=current_user.id,
            alert_id=alert_id,
        )
        .on_conflict_do_nothing(
            index_elements=["user_id", "alert_id"]
        )
    )

    await db.execute(statement)
    await db.commit()

    return {
        "message": "Notification marked as read",
        "alert_id": str(alert_id),
    }


@router.post("/read-all")
async def mark_all_alerts_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        insert(AlertRead)
        .from_select(
            ["user_id", "alert_id"],
            select(
                current_user.id,
                AgentAlert.id,
            ).where(
                AgentAlert.organization_id == current_user.organization_id,
                ~exists(
                    select(1).where(
                        AlertRead.user_id == current_user.id,
                        AlertRead.alert_id == AgentAlert.id,
                    )
                ),
            ),
        )
        .on_conflict_do_nothing(
            index_elements=["user_id", "alert_id"]
        )
    )

    await db.execute(statement)
    await db.commit()

    return {"message": "All alerts marked as read"}


@router.get("/notifications")
async def get_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_read_expr = exists(
        select(1).where(
            AlertRead.user_id == current_user.id,
            AlertRead.alert_id == AgentAlert.id,
        )
    ).label("is_read")

    result = await db.execute(
        select(AgentAlert, is_read_expr)
        .where(
            AgentAlert.organization_id == current_user.organization_id
        )
        .order_by(AgentAlert.created_at.desc())
        .limit(limit)
    )

    rows = result.all()

    notifications = []
    for alert, is_read in rows:
        data = serialize_alert(alert)
        data["is_read"] = bool(is_read)
        notifications.append(data)

    return notifications


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AgentAlert).where(
            AgentAlert.id == alert_id,
            AgentAlert.organization_id == current_user.organization_id,
        )
    )

    alert = result.scalar_one_or_none()

    if alert is None:
        raise HTTPException(
            status_code=404,
            detail="Alert not found",
        )

    if alert.status != "active":
        raise HTTPException(
            status_code=409,
            detail="Only active alerts can be acknowledged",
        )

    alert.status = "acknowledged"
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(alert)

    return serialize_alert(alert)