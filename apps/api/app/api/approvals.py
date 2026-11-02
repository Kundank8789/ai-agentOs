from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.agent.runtime import AgentRuntime, ApprovalAlreadyClaimed
from app.auth import get_current_user, get_db
from app.models.approval import Approval
from app.models.audit_log import AuditLog
from app.models.task import Task
from app.models.task_step import TaskStep
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


@router.get("/reconciliation/preview")
async def preview_approval_reconciliation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Read-only preview of historical approvals eligible for reconciliation.

    No external tools are executed.
    No database records are modified.
    """

    result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .where(
            Task.organization_id == current_user.organization_id,
            Approval.status == "approved",
        )
        .order_by(Approval.created_at.desc())
    )

    approvals = result.scalars().all()

    eligible = []
    needs_review = []

    for approval in approvals:
        if approval.task_step_id is None:
            needs_review.append({
                "approval_id": str(approval.id),
                "reason": "Missing task step.",
            })
            continue

        step = await db.get(TaskStep, approval.task_step_id)

        if (
            step is None
            or step.task_id != approval.task_id
            or step.status != "completed"
        ):
            needs_review.append({
                "approval_id": str(approval.id),
                "task_id": str(approval.task_id),
                "action": approval.action,
                "task_step_id": str(approval.task_step_id),
                "step_status": step.status if step else None,
                "step_exists": step is not None,
                "step_belongs_to_task": (
                    step.task_id == approval.task_id if step else False
                ),
                "reason": "Task step is missing, belongs to another task, or is not completed.",
            })
            continue

        eligible.append({
            "approval_id": str(approval.id),
            "task_id": str(approval.task_id),
            "action": approval.action,
            "task_step_id": str(step.id),
            "step_status": step.status,
            "suggested_status": "executed",
        })

    return {
        "total_approved": len(approvals),
        "eligible_count": len(eligible),
        "needs_review_count": len(needs_review),
        "eligible": eligible,
        "needs_review": needs_review,
    }


@router.post("/reconciliation/apply")
async def apply_approval_reconciliation(
    confirm: bool = Query(
        False,
        description="Must be true to apply historical reconciliation.",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reconcile verified historical approvals.

    - Only approved records are considered.
    - Task steps must belong to the same task and be completed.
    - approval.approved must precede step.completed in the audit log.
    - No external tools are executed.
    - Repeated calls are idempotent.
    """

    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to apply reconciliation.",
        )

    approval_event = aliased(AuditLog)
    completion_event = aliased(AuditLog)

    completion_exists = exists(
        select(completion_event.id).where(
            completion_event.task_id == approval_event.task_id,
            completion_event.task_step_id == approval_event.task_step_id,
            completion_event.event_type == "step.completed",
            completion_event.created_at > approval_event.created_at,
        )
    )

    approval_sequence_exists = exists(
        select(approval_event.id).where(
            approval_event.task_id == Approval.task_id,
            approval_event.task_step_id == Approval.task_step_id,
            approval_event.event_type == "approval.approved",
            completion_exists,
        )
    )

    # Find verified candidates:
    # - owned by current org
    # - still "approved"
    # - step exists, belongs to same task, is completed
    # - audit trail proves approval.approved happened before step.completed
    candidates_result = await db.execute(
        select(Approval)
        .join(Task, Approval.task_id == Task.id)
        .join(TaskStep, Approval.task_step_id == TaskStep.id)
        .where(
            Task.organization_id == current_user.organization_id,
            Approval.status == "approved",
            Approval.task_step_id.is_not(None),
            TaskStep.task_id == Approval.task_id,
            TaskStep.status == "completed",
            approval_sequence_exists,
        )
    )

    candidates = candidates_result.scalars().all()

    if not candidates:
        return {
            "updated": 0,
            "approval_ids": [],
            "message": "No eligible approvals found.",
        }

    candidate_ids = [c.id for c in candidates]
    candidate_map = {c.id: c for c in candidates}

    # Atomic update — WHERE status='approved' makes repeated calls idempotent
    update_result = await db.execute(
        update(Approval)
        .where(
            Approval.id.in_(candidate_ids),
            Approval.status == "approved",
        )
        .values(status="executed")
        .returning(Approval.id)
    )

    updated_ids = update_result.scalars().all()

    # Audit each transition
    for approval_id in updated_ids:
        approval = candidate_map[approval_id]

        await log_audit(
            db,
            task_id=approval.task_id,
            task_step_id=approval.task_step_id,
            event_type="approval.reconciled",
            actor_type="system",
            action="reconcile_approval",
            message=(
                "Historical approval reconciled to 'executed' "
                "based on audit-verified step completion."
            ),
            metadata={
                "approval_id": str(approval.id),
                "reconciled_by_user_id": str(current_user.id),
                "organization_id": str(current_user.organization_id),
            },
        )

    await db.commit()

    skipped = len(candidate_ids) - len(updated_ids)

    return {
        "updated": len(updated_ids),
        "skipped": skipped,
        "approval_ids": [str(i) for i in updated_ids],
        "message": (
            f"Reconciled {len(updated_ids)} approval(s) to 'executed'."
            + (
                f" {skipped} skipped (no longer approved)."
                if skipped
                else ""
            )
        ),
    }