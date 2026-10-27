import asyncio
from uuid import UUID

from arq.connections import RedisSettings
from sqlalchemy import update

from app.agent.exceptions import TaskCancellationRequested
from app.agent.runtime import AgentRuntime
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.task import Task


async def run_task(ctx: dict, task_id: str) -> dict:
    """Claim a queued task and execute it in the background."""
    try:
        parsed_task_id = UUID(task_id)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid task ID") from exc

    async with AsyncSessionLocal() as db:
        # Atomic claim: only one worker can change queued -> running.
        claim = await db.execute(
            update(Task)
            .where(
                Task.id == parsed_task_id,
                Task.status == "queued",
            )
            .values(status="running")
        )
        await db.commit()

        if claim.rowcount != 1:
            return {
                "status": "skipped",
                "task_id": task_id,
                "reason": "Task is not queued or was already claimed",
            }

        # AgentRuntime.run manages the execution and final task status.
        try:
            result = await AgentRuntime().run(
                task_id=parsed_task_id,
                db=db,
            )
        except TaskCancellationRequested:
            return {
                "status": "cancelled",
                "task_id": task_id,
            }

        return {
            "status": result.status,
            "task_id": task_id,
        }


class WorkerSettings:
    functions = [run_task]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_tries = 1