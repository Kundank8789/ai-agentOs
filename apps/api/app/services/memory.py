from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import Memory


async def get_memories(
    db: AsyncSession,
    organization_id: UUID,
    user_id: UUID | None = None,
    agent_id: UUID | None = None,
    memory_type: str | None = None,
    limit: int = 20,
) -> list[Memory]:

    query = select(Memory).where(
        Memory.organization_id == organization_id
    )

    if user_id is not None:
        query = query.where(Memory.user_id == user_id)

    if agent_id is not None:
        query = query.where(Memory.agent_id == agent_id)

    if memory_type is not None:
        query = query.where(Memory.type == memory_type)

    query = (
        query
        .order_by(Memory.updated_at.desc())
        .limit(limit)
    )

    result = await db.execute(query)

    return list(result.scalars().all())


async def save_memory(
    db: AsyncSession,
    organization_id: UUID,
    type: str,
    key: str,
    value: str,
    user_id: UUID | None = None,
    agent_id: UUID | None = None,
) -> Memory:

    memory = Memory(
        organization_id=organization_id,
        user_id=user_id,
        agent_id=agent_id,
        type=type,
        key=key,
        value=value,
    )

    db.add(memory)

    await db.commit()
    await db.refresh(memory)

    return memory
