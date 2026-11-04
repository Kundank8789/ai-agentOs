
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.user import User
from app.models.task import Task
from app.models.agent import Agent
from app.models.task_step import TaskStep
from app.models.tool_call import ToolCall


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


def get_date_cutoff(days: Literal[7, 30] | None):
    """Return the UTC cutoff for the selected analytics period."""
    if days is None:
        return None

    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("/overview")
async def get_analytics_overview(
    days: Literal[7, 30] | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization_id = current_user.organization_id
    cutoff = get_date_cutoff(days)

    task_filters = [Task.organization_id == organization_id]

    if cutoff is not None:
        task_filters.append(Task.created_at >= cutoff)

    result = await db.execute(
        select(
            func.count(Task.id).label("total_tasks"),
            func.count(
                case((Task.status == "completed", 1))
            ).label("completed_tasks"),
            func.count(
                case((Task.status == "failed", 1))
            ).label("failed_tasks"),
            func.count(
                case(
                    (
                        Task.status.in_(
                            ["pending", "running", "waiting_approval"]
                        ),
                        1,
                    )
                )
            ).label("active_tasks"),
        ).where(*task_filters)
    )

    overview = result.one()

    finished_tasks = (
        overview.completed_tasks + overview.failed_tasks
    )

    success_rate = (
        round(
            overview.completed_tasks / finished_tasks * 100,
            2,
        )
        if finished_tasks
        else 0
    )

    duration_result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    Task.updated_at - Task.created_at,
                )
            )
        ).where(
            *task_filters,
            Task.status.in_(["completed", "failed"]),
        )
    )

    average_duration = duration_result.scalar()

    return {
        "total_tasks": overview.total_tasks,
        "completed_tasks": overview.completed_tasks,
        "failed_tasks": overview.failed_tasks,
        "active_tasks": overview.active_tasks,
        "success_rate": success_rate,
        "average_execution_seconds": (
            round(float(average_duration), 2)
            if average_duration is not None
            else 0
        ),
    }


@router.get("/agents")
async def get_agent_performance(
    days: Literal[7, 30] | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization_id = current_user.organization_id
    cutoff = get_date_cutoff(days)

    task_join_conditions = [
        Task.agent_id == Agent.id,
        Task.organization_id == organization_id,
    ]

    if cutoff is not None:
        task_join_conditions.append(Task.created_at >= cutoff)

    result = await db.execute(
        select(
            Agent.id,
            Agent.name,
            Agent.status,
            func.count(Task.id).label("total_tasks"),
            func.count(
                case((Task.status == "completed", 1))
            ).label("completed_tasks"),
            func.count(
                case((Task.status == "failed", 1))
            ).label("failed_tasks"),
        )
        .outerjoin(Task, *task_join_conditions)
        .where(Agent.organization_id == organization_id)
        .group_by(Agent.id, Agent.name, Agent.status)
        .order_by(func.count(Task.id).desc())
    )

    agents = result.all()

    return [
        {
            "agent_id": str(agent.id),
            "name": agent.name,
            "status": agent.status,
            "total_tasks": agent.total_tasks,
            "completed_tasks": agent.completed_tasks,
            "failed_tasks": agent.failed_tasks,
            "success_rate": (
                round(
                    agent.completed_tasks
                    / (agent.completed_tasks + agent.failed_tasks)
                    * 100,
                    2,
                )
                if agent.completed_tasks + agent.failed_tasks
                else 0
            ),
        }
        for agent in agents
    ]


@router.get("/tools")
async def get_tool_analytics(
    days: Literal[7, 30] | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization_id = current_user.organization_id
    cutoff = get_date_cutoff(days)

    task_filters = [Task.organization_id == organization_id]

    if cutoff is not None:
        task_filters.append(Task.created_at >= cutoff)

    result = await db.execute(
        select(
            ToolCall.tool_name,
            func.count(ToolCall.id).label("total_calls"),
            func.count(
                case((ToolCall.status == "completed", 1))
            ).label("successful_calls"),
            func.count(
                case((ToolCall.status == "failed", 1))
            ).label("failed_calls"),
        )
        .join(TaskStep, ToolCall.task_step_id == TaskStep.id)
        .join(Task, TaskStep.task_id == Task.id)
        .where(*task_filters)
        .group_by(ToolCall.tool_name)
        .order_by(func.count(ToolCall.id).desc())
    )

    return [
        {
            "tool_name": row.tool_name,
            "total_calls": row.total_calls,
            "successful_calls": row.successful_calls,
            "failed_calls": row.failed_calls,
        }
        for row in result.all()
    ]


@router.get("/recent-tasks")
async def get_recent_tasks(
    limit: int = 10,
    days: Literal[7, 30] | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization_id = current_user.organization_id
    cutoff = get_date_cutoff(days)
    safe_limit = max(1, min(limit, 50))

    task_filters = [Task.organization_id == organization_id]

    if cutoff is not None:
        task_filters.append(Task.created_at >= cutoff)

    result = await db.execute(
        select(
            Task.id,
            Task.title,
            Task.status,
            Task.created_at,
            Task.updated_at,
            Agent.name.label("agent_name"),
        )
        .outerjoin(Agent, Task.agent_id == Agent.id)
        .where(*task_filters)
        .order_by(Task.created_at.desc())
        .limit(safe_limit)
    )

    return [
        {
            "task_id": str(row.id),
            "title": row.title,
            "status": row.status,
            "agent_name": row.agent_name,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        for row in result.all()
    ]
