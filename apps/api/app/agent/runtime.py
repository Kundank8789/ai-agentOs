from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.task_step import TaskStep


class AgentRuntime:
    """
    Core execution engine for AgentOS.

    For now this runtime executes a deterministic plan.
    Later the planner will be powered by an LLM.
    """

    async def run(
        self,
        task_id: UUID,
        db: AsyncSession,
    ) -> Task:

        result = await db.execute(
            select(Task).where(Task.id == task_id)
        )

        task = result.scalar_one_or_none()

        if task is None:
            raise ValueError("Task not found")

        task.status = "running"

        await db.commit()

        steps = [
            {
                "name": "Understand task",
                "description": "Analyze the user's request and determine what needs to be done.",
            },
            {
                "name": "Plan execution",
                "description": "Create an execution plan for completing the task.",
            },
            {
                "name": "Execute actions",
                "description": "Execute the required business operations.",
            },
            {
                "name": "Prepare result",
                "description": "Prepare the final result for the user.",
            },
        ]

        for index, step_data in enumerate(steps, start=1):

            step = TaskStep(
                task_id=task.id,
                step_number=index,
                name=step_data["name"],
                description=step_data["description"],
                status="completed",
                input={},
                output={
                    "message": f"Step '{step_data['name']}' completed."
                },
            )

            db.add(step)

        task.status = "completed"

        await db.commit()
        await db.refresh(task)

        return task