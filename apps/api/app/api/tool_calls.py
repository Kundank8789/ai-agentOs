
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.task import Task
from app.models.task_step import TaskStep
from app.models.tool_call import ToolCall
from app.models.user import User

router = APIRouter(prefix="/tasks", tags=["Tool Calls"])


@router.get("/{task_id}/tool-calls")
async def list_task_tool_calls(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task_result = await db.execute(
        select(Task.id).where(
            Task.id == task_id,
            Task.organization_id == user.organization_id,
        )
    )

    if task_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Task not found.")

    result = await db.execute(
        select(ToolCall)
        .join(TaskStep, ToolCall.task_step_id == TaskStep.id)
        .where(TaskStep.task_id == task_id)
        .order_by(ToolCall.created_at.asc(), ToolCall.call_number.asc())
    )

    calls = result.scalars().all()

    return [
        {
            "id": str(call.id),
            "task_step_id": str(call.task_step_id),
            "tool_name": call.tool_name,
            "call_number": call.call_number,
            "status": call.status,
            "input_data": call.input_data,
            "output_data": call.output_data,
            "error": call.error,
            "started_at": call.started_at,
            "completed_at": call.completed_at,
            "created_at": call.created_at,
        }
        for call in calls
    ]
