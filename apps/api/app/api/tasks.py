from uuid import UUID

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.services.audit import log_audit
from app.config import settings
from app.models.agent import Agent
from app.models.organization import Organization
from app.models.user import User
from app.models.task import Task
from app.models.task_step import TaskStep
from app.models.audit_log import AuditLog
from app.schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskStepResponse,
)
from app.schemas.audit import AuditLogResponse


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


@router.get(
    "/{task_id}/steps",
    response_model=list[TaskStepResponse],
)
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

    # "queued" is intentionally NOT rejected: if the previous
    # enqueue attempt failed or the worker died, we want to
    # allow re-enqueueing. The worker's atomic claim
    # (queued -> running) prevents duplicate execution.
    if task.status in {
        "running",
        "waiting_approval",
        "completed",
    }:
        raise HTTPException(
            status_code=409,
            detail=f"Task cannot be queued while status is '{task.status}'.",
        )

    # Persist the queued state before sending the job.
    previous_status = task.status
    task.status = "queued"
    await db.commit()
    await db.refresh(task)

    pool = None

    try:
        pool = await create_pool(
            RedisSettings.from_dsn(settings.redis_url)
        )

        await pool.enqueue_job(
            "run_task",
            str(task_id),
            _job_id=f"task:{task_id}",
        )

    except Exception as exc:
        # Revert status so the task can be retried.
        task.status = previous_status
        await db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to enqueue task: {str(exc)}",
        )

    finally:
        if pool is not None:
            await pool.close()

    await db.refresh(task)

    return task

# CANCEL_TASK_ENDPOINT_V1
@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel a task or request cancellation at the next safe boundary."""
    task = await get_task_for_user(db=db, task_id=task_id, user=user)

    if task.status == "cancellation_requested":
        return task

    if task.status in {"completed", "failed", "cancelled"}:
        raise HTTPException(
            status_code=409,
            detail=f"Task cannot be cancelled while status is '{task.status}'.",
        )

    current_status = task.status
    if current_status == "running":
        new_status = "cancellation_requested"
        event_type = "task.cancellation_requested"
        message = "Cancellation requested; waiting for a safe execution boundary."
    elif current_status in {"pending", "queued", "waiting_approval"}:
        new_status = "cancelled"
        event_type = "task.cancelled"
        message = "Task cancelled before execution could continue."
    else:
        raise HTTPException(
            status_code=409,
            detail=f"Task cannot be cancelled while status is '{current_status}'.",
        )

    # Compare-and-set prevents racing the worker's queued -> running claim.
    changed = await db.execute(
        update(Task)
        .where(Task.id == task.id, Task.status == current_status)
        .values(status=new_status)
    )

    if changed.rowcount != 1:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Task status changed concurrently. Refresh and try again.",
        )

    task.status = new_status

    await log_audit(
        db,
        task_id=task.id,
        event_type=event_type,
        actor_type="user",
        action="cancel_task",
        message=message,
        metadata={"previous_status": current_status, "new_status": new_status},
    )
    await db.commit()
    await db.refresh(task)
    return task
