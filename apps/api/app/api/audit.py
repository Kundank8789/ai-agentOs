from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.audit_log import AuditLog
from app.models.task import Task
from app.models.user import User
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("/", response_model=list[AuditLogResponse])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AuditLog)
        .join(Task, AuditLog.task_id == Task.id, isouter=True)
        .where(
            (AuditLog.task_id.is_(None))
            | (Task.organization_id == user.organization_id)
        )
        .order_by(AuditLog.created_at.desc())
        .limit(200)
    )

    return result.scalars().all()
