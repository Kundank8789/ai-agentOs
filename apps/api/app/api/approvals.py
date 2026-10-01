from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.runtime import AgentRuntime
from app.auth import get_current_user, get_db
from app.models.approval import Approval
from app.models.task import Task
from app.models.user import User
from app.services.audit import log_audit


router = APIRouter(
    prefix="/approvals",
    tags=["Approvals"],
)


async def get_approval_for_user(
    db: AsyncSession,
    approval_id: UUID,
    user: User,
) -> Approval:
    result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .where(
            Approval.id == approval_id,
            Task.organization_id == user.organization_id,
            Task.user_id == user.id,
        )
    )

    approval = result.scalar_one_or_none()

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval not found",
        )

    return approval


@router.get("/")
async def list_approvals(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .where(
            Task.organization_id == user.organization_id,
            Task.user_id == user.id,
        )
        .order_by(Approval.created_at.desc())
    )

    return result.scalars().all()


@router.post("/{approval_id}/approve")
async def approve_approval(
    approval_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    approval = await get_approval_for_user(
        db=db,
        approval_id=approval_id,
        user=user,
    )

    if approval.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Approval is already {approval.status}",
        )

    approval.status = "approved"
    approval.decided_at = datetime.now(timezone.utc)

    await log_audit(
        db,
        task_id=approval.task_id,
        task_step_id=approval.task_step_id,
        event_type="approval.approved",
        actor_type="user",
        action=approval.action,
        message=f"Approval granted for {approval.action}.",
        metadata={
            "approval_id": str(approval.id),
        },
    )

    await db.commit()

    runtime = AgentRuntime()

    try:
        task = await runtime.resume_after_approval(
            approval_id=approval_id,
            db=db,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Approved action failed: {str(exc)}",
        )

    await db.refresh(approval)

    return {
        "approval": approval,
        "task": task,
    }


@router.post("/{approval_id}/reject")
async def reject_approval(
    approval_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    approval = await get_approval_for_user(
        db=db,
        approval_id=approval_id,
        user=user,
    )

    if approval.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Approval is already {approval.status}",
        )

    approval.status = "rejected"
    approval.decided_at = datetime.now(timezone.utc)

    task = await db.get(Task, approval.task_id)

    if task is not None:
        task.status = "failed"

    await log_audit(
        db,
        task_id=approval.task_id,
        task_step_id=approval.task_step_id,
        event_type="approval.rejected",
        actor_type="user",
        action=approval.action,
        message=f"Approval rejected for {approval.action}.",
        metadata={
            "approval_id": str(approval.id),
        },
    )

    await db.commit()
    await db.refresh(approval)

    return approval
