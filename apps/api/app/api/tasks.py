from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.organization import Organization
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def get_dev_context(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.email == "dev@agentos.local"
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=500,
            detail="Development user not found. Run python -m app.seed",
        )

    organization = await db.get(
        Organization,
        user.organization_id,
    )

    if organization is None:
        raise HTTPException(
            status_code=500,
            detail="Development organization not found.",
        )

    return user, organization


@router.post("/", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    context=Depends(get_dev_context),
):
    user, organization = context

    task = Task(
        organization_id=organization.id,
        user_id=user.id,
        title=task_data.title,
        description=task_data.description,
        status="pending",
    )

    db.add(task)

    await db.commit()
    await db.refresh(task)

    return task


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    context=Depends(get_dev_context),
):
    _, organization = context

    result = await db.execute(
        select(Task)
        .where(Task.organization_id == organization.id)
        .order_by(Task.created_at.desc())
    )

    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    context=Depends(get_dev_context),
):
    _, organization = context

    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.organization_id == organization.id,
        )
    )

    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task