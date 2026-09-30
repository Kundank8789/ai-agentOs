from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.services.memory import get_memories, save_memory


router = APIRouter(
    prefix="/memories",
    tags=["Memories"],
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


DEV_ORGANIZATION_ID = UUID(
    "e09104e9-90d3-4c89-a10d-dcb690a925c0"
)

DEV_USER_ID = UUID(
    "55bb0f3e-3a77-4b19-b1e3-fbb3cb008085"
)


class MemoryCreate(BaseModel):
    type: str
    key: str
    value: str
    agent_id: UUID | None = None


class MemoryResponse(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID | None
    agent_id: UUID | None
    type: str
    key: str
    value: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[MemoryResponse])
async def list_memories(
    db: AsyncSession = Depends(get_db),
):
    memories = await get_memories(
        db=db,
        organization_id=DEV_ORGANIZATION_ID,
        user_id=DEV_USER_ID,
    )

    return memories


@router.post("/", response_model=MemoryResponse)
async def create_memory(
    memory_data: MemoryCreate,
    db: AsyncSession = Depends(get_db),
):
    memory = await save_memory(
        db=db,
        organization_id=DEV_ORGANIZATION_ID,
        user_id=DEV_USER_ID,
        agent_id=memory_data.agent_id,
        type=memory_data.type,
        key=memory_data.key,
        value=memory_data.value,
    )

    return memory


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from app.models.memory import Memory

    memory = await db.get(Memory, memory_id)

    if memory is None:
        raise HTTPException(
            status_code=404,
            detail="Memory not found",
        )

    return memory


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from app.models.memory import Memory

    memory = await db.get(Memory, memory_id)

    if memory is None:
        raise HTTPException(
            status_code=404,
            detail="Memory not found",
        )

    await db.delete(memory)
    await db.commit()

    return {
        "success": True,
        "message": "Memory deleted",
    }
