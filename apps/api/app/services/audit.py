from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_audit(
    db: AsyncSession,
    *,
    event_type: str,
    actor_type: str,
    action: str,
    message: str | None = None,
    task_id: UUID | None = None,
    task_step_id: UUID | None = None,
    tool_call_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:

    audit = AuditLog(
        task_id=task_id,
        task_step_id=task_step_id,
        tool_call_id=tool_call_id,
        event_type=event_type,
        actor_type=actor_type,
        action=action,
        message=message,
        event_metadata=metadata,
    )

    db.add(audit)

    await db.flush()

    return audit