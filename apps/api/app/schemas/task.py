from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    title: str
    description: str | None = None


class TaskResponse(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID | None
    agent_id: UUID | None
    title: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)