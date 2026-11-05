
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_alert import AgentAlert
from app.models.organization import Organization
from app.models.task import Task


DEFAULT_SETTINGS = {
    "warning_threshold": 20.0,
    "critical_threshold": 40.0,
    "min_completed_tasks": 4,
}


def get_alert_settings(organization: Organization) -> dict:
    settings = {
        **DEFAULT_SETTINGS,
        **(organization.alert_settings or {}),
    }

    warning = float(settings["warning_threshold"])
    critical = float(settings["critical_threshold"])
    minimum = int(settings["min_completed_tasks"])

    if not (0 < warning < critical <= 100):
        raise ValueError(
            "Alert thresholds must satisfy 0 < warning < critical <= 100"
        )

    if minimum < 1:
        raise ValueError("Minimum completed tasks must be at least 1")

    return {
        "warning_threshold": warning,
        "critical_threshold": critical,
        "min_completed_tasks": minimum,
    }


async def evaluate_agent_health(
    db: AsyncSession,
    agent_id,
    organization_id,
):
    organization_result = await db.execute(
        select(Organization).where(
            Organization.id == organization_id
        )
    )
    organization = organization_result.scalar_one_or_none()

    if organization is None:
        return

    settings = get_alert_settings(organization)

    agent_result = await db.execute(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == organization_id,
        )
    )
    agent = agent_result.scalar_one_or_none()

    if agent is None:
        return

    task_result = await db.execute(
        select(
            func.count(Task.id).label("total"),
            func.count(Task.id)
            .filter(Task.status == "failed")
            .label("failed"),
            func.count(Task.id)
            .filter(Task.status == "completed")
            .label("completed"),
        ).where(
            Task.agent_id == agent_id,
            Task.organization_id == organization_id,
            Task.status.in_(["completed", "failed"]),
        )
    )

    stats = task_result.one()
    finished_tasks = stats.completed + stats.failed

    existing_result = await db.execute(
        select(AgentAlert).where(
            AgentAlert.agent_id == agent_id,
            AgentAlert.organization_id == organization_id,
            AgentAlert.alert_type == "high_failure_rate",
            AgentAlert.status.in_(["active", "acknowledged"]),
        ).order_by(AgentAlert.created_at.desc())
    )

    existing_alert = existing_result.scalars().first()

    # Insufficient history is not evidence of recovery.
    if finished_tasks < settings["min_completed_tasks"]:
        return

    failure_rate = round(
        stats.failed / finished_tasks * 100,
        2,
    )

    if failure_rate >= settings["critical_threshold"]:
        severity = "critical"
        threshold = settings["critical_threshold"]
    elif failure_rate >= settings["warning_threshold"]:
        severity = "warning"
        threshold = settings["warning_threshold"]
    else:
        severity = None
        threshold = None

    if severity is None:
        if existing_alert is not None:
            existing_alert.status = "resolved"
            existing_alert.resolved_at = datetime.now(timezone.utc)

        return

    message = (
        f"Agent {agent.name} has a failure rate of "
        f"{failure_rate}% across {finished_tasks} finished tasks."
    )

    metadata = {
        "finished_tasks": finished_tasks,
        "failed_tasks": stats.failed,
        "completed_tasks": stats.completed,
    }

    if existing_alert is not None:
        existing_alert.severity = severity
        existing_alert.failure_rate = failure_rate
        existing_alert.threshold = threshold
        existing_alert.message = message
        existing_alert.alert_metadata = metadata
        return

    db.add(
        AgentAlert(
            organization_id=organization_id,
            agent_id=agent_id,
            alert_type="high_failure_rate",
            severity=severity,
            title=(
                "Critical agent failure rate"
                if severity == "critical"
                else "Elevated agent failure rate"
            ),
            message=message,
            status="active",
            failure_rate=failure_rate,
            threshold=threshold,
            alert_metadata=metadata,
        )
    )
