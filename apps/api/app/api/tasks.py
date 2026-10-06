from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.agent import Agent
from app.models.organization import Organization
from app.models.user import User
from app.models.task import Task
from app.models.task_step import TaskStep
from app.models.audit_log import AuditLog
from app.schemas.task import TaskCreate, TaskResponse
from app.schemas.audit import AuditLogResponse
from app.agent.runtime import AgentRuntime


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


async def get_user_organization(
    db: AsyncSession,
    user: User,
) -> Organization:
    organization = await db.get(
        Organization,
        user.organization_id,
    )

    if organization is None:
        raise HTTPException(
            status_code=500,
            detail="User organization not found.",
        )

    return organization


async def get_task_for_user(
    db: AsyncSession,
    task_id: UUID,
    user: User,
) -> Task:
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.organization_id == user.organization_id,
            Task.user_id == user.id,
        )
    )

    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


@router.post("/", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    organization = await get_user_organization(db, user)

    # -----------------------------------------
    # Validate selected agent (if provided)
    # -----------------------------------------
    if task_data.agent_id is not None:
        agent_result = await db.execute(
            select(Agent).where(
                Agent.id == task_data.agent_id,
                Agent.organization_id == organization.id,
            )
        )

        agent = agent_result.scalar_one_or_none()

        if agent is None:
            raise HTTPException(
                status_code=404,
                detail="Selected agent not found in your organization.",
            )

        if agent.status != "active":
            raise HTTPException(
                status_code=409,
                detail="Selected agent is not active.",
            )

    # -----------------------------------------
    # Create task
    # -----------------------------------------
    task = Task(
        organization_id=organization.id,
        user_id=user.id,
        agent_id=task_data.agent_id,
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
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .where(
            Task.organization_id == user.organization_id,
            Task.user_id == user.id,
        )
        .order_by(Task.created_at.desc())
    )

    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_task_for_user(
        db=db,
        task_id=task_id,
        user=user,
    )


@router.get("/{task_id}/steps")
async def list_task_steps(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await get_task_for_user(
        db=db,
        task_id=task_id,
        user=user,
    )

    result = await db.execute(
        select(TaskStep)
        .where(TaskStep.task_id == task_id)
        .order_by(TaskStep.step_number.asc())
    )

    return result.scalars().all()


@router.get(
    "/{task_id}/audit",
    response_model=list[AuditLogResponse],
)
async def list_task_audit_logs(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await get_task_for_user(
        db=db,
        task_id=task_id,
        user=user,
    )

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.task_id == task_id)
        .order_by(AuditLog.created_at.asc())
    )

    return result.scalars().all()


@router.post("/{task_id}/run", response_model=TaskResponse)
async def run_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await get_task_for_user(
        db=db,
        task_id=task_id,
        user=user,
    )

    if task.status == "running":
        raise HTTPException(
            status_code=409,
            detail="Task is already running",
        )

    runtime = AgentRuntime()

    try:
        task = await runtime.run(
            task_id=task_id,
            db=db,
        )

        return task

    except Exception as exc:
        task.status = "failed"
        await db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Task execution failed: {str(exc)}",
        )