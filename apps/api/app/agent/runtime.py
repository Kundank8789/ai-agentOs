from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import generate_plan
from app.models.task import Task
from app.models.task_step import TaskStep


class AgentRuntime:
    """
    Core execution engine for AgentOS.

    The runtime asks the LLM to create an execution plan,
    then stores that plan as TaskStep records.
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

        try:
            # Ask Groq to create the execution plan.
            plan = await generate_plan(
                task_title=task.title,
                task_description=task.description,
            )

            # Store the generated plan as TaskStep records.
            for step_data in plan.steps:

                step = TaskStep(
                    task_id=task.id,
                    step_number=step_data.step_number,
                    name=step_data.name,
                    description=step_data.description,
                    status="planned",
                    input={
                        "tool": step_data.tool,
                        "requires_approval": step_data.requires_approval,
                    },
                    output=None,
                )

                db.add(step)

            task.status = "planned"

            await db.commit()
            await db.refresh(task)

            return task

        except Exception:
            task.status = "failed"
            await db.commit()
            raise