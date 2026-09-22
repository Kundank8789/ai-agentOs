from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.runtime import AgentRuntime
from app.database import AsyncSessionLocal
from app.models.approval import Approval
from app.models.task import Task
from app.services.audit import log_audit


router = APIRouter(
    prefix="/approvals",
    tags=["Approvals"],
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/")
async def list_approvals(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Approval)
        .order_by(Approval.created_at.desc())
    )

    return result.scalars().all()


@router.post("/{approval_id}/approve")
async def approve_approval(
    approval_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    approval = await db.get(Approval, approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval not found",
        )

    if approval.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Approval is already {approval.status}",
        )

    approval.status = "approved"
    approval.decided_at = datetime.now(timezone.utc)

    # -----------------------------------------
    # Audit: approval.approved (human decision)
    # -----------------------------------------
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
):
    approval = await db.get(Approval, approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval not found",
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

    # -----------------------------------------
    # Audit: approval.rejected (human decision)
    # -----------------------------------------
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