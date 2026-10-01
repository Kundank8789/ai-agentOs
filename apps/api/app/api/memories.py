from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.memory import Memory
from app.models.user import User
from app.services.memory import get_memories, save_memory


router = APIRouter(
    prefix="/memories",
    tags=["Memories"],
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


async def get_memory_for_user(
    db: AsyncSession,
    memory_id: UUID,
    user: User,
) -> Memory:
    result = await db.execute(
        select(Memory).where(
            Memory.id == memory_id,
            Memory.organization_id == user.organization_id,
            Memory.user_id == user.id,
        )
    )

    memory = result.scalar_one_or_none()

    if memory is None:
        raise HTTPException(
            status_code=404,
            detail="Memory not found",
        )

    return memory


@router.get("/", response_model=list[MemoryResponse])
async def list_memories(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    memories = await get_memories(
        db=db,
        organization_id=user.organization_id,
        user_id=user.id,
    )

    return memories


@router.post("/", response_model=MemoryResponse)
async def create_memory(
    memory_data: MemoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    memory = await save_memory(
        db=db,
        organization_id=user.organization_id,
        user_id=user.id,
        agent_id=memory_data.agent_id,
        type=memory_data.type,
        key=memory_data.key,
        value=memory_data.value,
    )

    await db.commit()
    await db.refresh(memory)

    return memory


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_memory_for_user(
        db=db,
        memory_id=memory_id,
        user=user,
    )


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    memory = await get_memory_for_user(
        db=db,
        memory_id=memory_id,
        user=user,
    )

    await db.delete(memory)
    await db.commit()

    return {
        "success": True,
        "message": "Memory deleted",
    }
