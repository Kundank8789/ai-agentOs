from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.approval import Approval
from app.models.task import Task
from app.models.task_step import TaskStep
from app.tools.registry import ToolRegistry
from app.tools.google_sheets import GoogleSheetsTool
from app.tools.gmail import GmailTool
from app.tools.crm import CRMTool


router = APIRouter(
    prefix="/approvals",
    tags=["Approvals"],
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def create_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()

    registry.register(GoogleSheetsTool())
    registry.register(GmailTool())
    registry.register(CRMTool())

    return registry


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

    # Find the task step associated with this approval
    step = await db.get(
        TaskStep,
        approval.task_step_id,
    )

    if step is None:
        raise HTTPException(
            status_code=404,
            detail="Task step not found",
        )

    # Find the task
    task = await db.get(
        Task,
        approval.task_id,
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    # Mark approval as approved
    approval.status = "approved"
    approval.decided_at = datetime.now(timezone.utc)

    # Execute the approved tool
    registry = create_tool_registry()

    try:
        tool = registry.get(approval.action)
    except KeyError:
        step.status = "failed"
        step.output = {
            "error": f"Tool '{approval.action}' is not registered."
        }

        task.status = "failed"

        await db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Tool '{approval.action}' is not registered.",
        )

    try:
        result = await tool.execute()

        step.status = "completed"
        step.output = result

    except Exception as exc:
        step.status = "failed"
        step.output = {
            "error": str(exc),
        }

        task.status = "failed"

        await db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Tool execution failed: {str(exc)}",
        )

    # Check whether other approvals are still pending
    pending_result = await db.execute(
        select(Approval).where(
            Approval.task_id == task.id,
            Approval.status == "pending",
        )
    )

    pending_approvals = pending_result.scalars().all()

    if pending_approvals:
        task.status = "waiting_approval"
    else:
        task.status = "completed"

    await db.commit()
    await db.refresh(approval)

    return approval


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

    step = await db.get(
        TaskStep,
        approval.task_step_id,
    )

    task = await db.get(
        Task,
        approval.task_id,
    )

    approval.status = "rejected"
    approval.decided_at = datetime.now(timezone.utc)

    if step is not None:
        step.status = "rejected"

    if task is not None:
        task.status = "rejected"

    await db.commit()
    await db.refresh(approval)

    return approval