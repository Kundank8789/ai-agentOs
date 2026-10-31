from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.runtime import AgentRuntime, ApprovalAlreadyClaimed
from app.auth import get_current_user, get_db
from app.models.approval import Approval
from app.models.task import Task
from app.models.user import User
from app.services.audit import log_audit


router = APIRouter(
    prefix="/approvals",
    tags=["Approvals"],
)


@router.get("/")
async def list_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return approvals belonging only to the authenticated user's organization.
    """

    result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .where(Task.organization_id == current_user.organization_id)
        .order_by(Approval.created_at.desc())
    )

    return result.scalars().all()


@router.post("/{approval_id}/approve")
async def approve_approval(
    approval_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve an action only if it belongs to the current user's organization.
    """

    result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .where(
            Approval.id == approval_id,
            Task.organization_id == current_user.organization_id,
        )
    )

    approval = result.scalar_one_or_none()

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval not found",
        )

    now = datetime.now(timezone.utc)

    # Atomically approve only if the approval is still pending
    claim_result = await db.execute(
        update(Approval)
        .where(
            Approval.id == approval_id,
            Approval.status == "pending",
            Approval.task_id.in_(
                select(Task.id).where(
                    Task.organization_id == current_user.organization_id
                )
            ),
        )
        .values(
            status="approved",
            decided_at=now,
        )
        .returning(Approval.id)
    )

    updated_id = claim_result.scalar_one_or_none()

    if updated_id is None:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Approval is no longer pending.",
        )

    approval.status = "approved"
    approval.decided_at = now

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
            "user_id": str(current_user.id),
            "organization_id": str(current_user.organization_id),
        },
    )

    await db.commit()

    runtime = AgentRuntime()

    try:
        task = await runtime.resume_after_approval(
            approval_id=approval_id,
            db=db,
        )
    except ApprovalAlreadyClaimed as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
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
    current_user: User = Depends(get_current_user),
):
    """
    Reject an action only if it belongs to the current user's organization.
    """

    result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .where(
            Approval.id == approval_id,
            Task.organization_id == current_user.organization_id,
        )
    )

    approval = result.scalar_one_or_none()

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval not found",
        )

    now = datetime.now(timezone.utc)

    # Atomically reject only if the approval is still pending
    reject_result = await db.execute(
        update(Approval)
        .where(
            Approval.id == approval_id,
            Approval.status == "pending",
            Approval.task_id.in_(
                select(Task.id).where(
                    Task.organization_id == current_user.organization_id
                )
            ),
        )
        .values(
            status="rejected",
            decided_at=now,
        )
        .returning(Approval.id)
    )

    rejected_id = reject_result.scalar_one_or_none()

    if rejected_id is None:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Approval is no longer pending.",
        )

    approval.status = "rejected"
    approval.decided_at = now

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
            "user_id": str(current_user.id),
            "organization_id": str(current_user.organization_id),
        },
    )

    await db.commit()
    await db.refresh(approval)

    return approval