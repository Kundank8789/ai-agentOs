from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: UUID
    task_id: UUID | None
    task_step_id: UUID | None
    tool_call_id: UUID | None
    event_type: str
    actor_type: str
    action: str
    message: str | None
    event_metadata: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)