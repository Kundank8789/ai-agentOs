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

    query = select(Memory).where(
        Memory.organization_id == organization_id,
        Memory.type == type,
        Memory.key == key,
    )

    if user_id is not None:
        query = query.where(Memory.user_id == user_id)
    else:
        query = query.where(Memory.user_id.is_(None))

    if agent_id is not None:
        query = query.where(Memory.agent_id == agent_id)
    else:
        query = query.where(Memory.agent_id.is_(None))

    result = await db.execute(query)

    memory = result.scalar_one_or_none()

    if memory:
        memory.value = value
    else:
        memory = Memory(
            organization_id=organization_id,
            user_id=user_id,
            agent_id=agent_id,
            type=type,
            key=key,
            value=value,
        )
        db.add(memory)

    await db.flush()

    return memory


def filter_relevant_memories(
    memories: list[Memory],
    task_title: str,
    task_description: str | None = None,
) -> list[Memory]:
    text = f"{task_title} {task_description or ''}".lower()

    stop_words = {
        "a",
        "an",
        "and",
        "about",
        "are",
        "be",
        "by",
        "for",
        "from",
        "in",
        "is",
        "of",
        "on",
        "send",
        "the",
        "to",
        "with",
        "memory",
        "test",
        "task",
        "last",
        "completed",
    }

    task_words = {
        word.strip(".,!?;:")
        for word in text.split()
        if len(word.strip(".,!?;:")) >= 4
    }

    task_words -= stop_words

    relevant: list[Memory] = []

    for memory in memories:
        memory_text = (
            f"{memory.type} {memory.key} {memory.value}"
        ).lower()

        memory_words = {
            word.strip(".,!?;:")
            for word in memory_text.split()
            if len(word.strip(".,!?;:")) >= 4
        }

        memory_words -= stop_words

        if task_words & memory_words:
            relevant.append(memory)

    return relevant