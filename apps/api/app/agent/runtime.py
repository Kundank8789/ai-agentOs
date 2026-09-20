from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import generate_plan
from app.models.approval import Approval
from app.models.task import Task
from app.models.task_step import TaskStep
from app.tools.google_sheets import GoogleSheetsTool
from app.tools.registry import ToolRegistry


class AgentRuntime:
    """
    Core execution engine for AgentOS.
    """

    def __init__(self) -> None:
        self.registry = ToolRegistry()

        # Register currently available tools.
        self.registry.register(GoogleSheetsTool())

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
            # 1. Ask Groq to create the execution plan.
            plan = await generate_plan(
                task_title=task.title,
                task_description=task.description,
            )

            # 2. Process each planned step.
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
                await db.flush()

                # 3. Don't execute actions requiring approval.
                if step_data.requires_approval:
                    step.status = "waiting_approval"

                    approval = Approval(
                        task_id=task.id,
                        task_step_id=step.id,
                        action=step_data.tool,
                        description=step_data.description,
                        requested_data={
                            "tool": step_data.tool,
                            "step_number": step_data.step_number,
                            "step_name": step_data.name,
                        },
                        status="pending",
                    )

                    db.add(approval)

                    print(
                        f"APPROVAL CREATED: "
                        f"tool={approval.action}, "
                        f"task_id={approval.task_id}, "
                        f"step_id={approval.task_step_id}"
                    )

                    continue

                # 4. Check whether the requested tool exists.
                try:
                    tool = self.registry.get(step_data.tool)
                except KeyError:
                    step.status = "failed"
                    step.output = {
                        "error": (
                            f"Tool '{step_data.tool}' "
                            "is not registered."
                        )
                    }
                    continue

                # 5. Execute the registered tool.
                try:
                    result = await tool.execute()

                    step.status = "completed"
                    step.output = result

                except Exception as exc:
                    step.status = "failed"
                    step.output = {
                        "error": str(exc),
                    }

            # The task is waiting if any step requires approval.
            if any(
                step_data.requires_approval
                for step_data in plan.steps
            ):
                task.status = "waiting_approval"
            else:
                task.status = "completed"

            await db.commit()
            await db.refresh(task)

            return task

        except Exception:
            task.status = "failed"
            await db.commit()
            raise