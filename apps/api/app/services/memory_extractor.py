from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.memory import save_memory


async def save_task_memory(
    db: AsyncSession,
    organization_id: UUID,
    user_id: UUID | None,
    agent_id: UUID | None,
    memory_type: str,
    key: str,
    value: str,
):
    return await save_memory(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        agent_id=agent_id,
        type=memory_type,
        key=key,
        value=value,
    )
