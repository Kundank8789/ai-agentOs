from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import generate_plan
from app.models.approval import Approval
from app.models.task import Task
from app.models.task_step import TaskStep
from app.tools.google_sheets import GoogleSheetsTool
from app.tools.gmail import GmailTool
from app.tools.crm import CRMTool
from app.tools.registry import ToolRegistry


class AgentRuntime:
    """
    Core execution engine for AgentOS.
    """

    def __init__(self) -> None:
        self.registry = ToolRegistry()

        # Register available tools.
        self.registry.register(GoogleSheetsTool())
        self.registry.register(GmailTool())
        self.registry.register(CRMTool())

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
            # 1. Generate execution plan.
            plan = await generate_plan(
                task_title=task.title,
                task_description=task.description,
            )

            # 2. Process planned steps.
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

                # 3. Approval required.
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

                # 4. Execute non-approval tool.
                await self._execute_step(
                    step=step,
                    tool_name=step_data.tool,
                )

            # 5. Determine task state.
            pending_approvals = await db.execute(
                select(Approval).where(
                    Approval.task_id == task.id,
                    Approval.status == "pending",
                )
            )

            approvals = pending_approvals.scalars().all()

            if approvals:
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

    async def _execute_step(
        self,
        step: TaskStep,
        tool_name: str,
    ) -> None:

        try:
            tool = self.registry.get(tool_name)

        except KeyError:
            step.status = "failed"
            step.output = {
                "error": f"Tool '{tool_name}' is not registered."
            }
            return

        try:
            result = await tool.execute()

            step.status = "completed"
            step.output = result

        except Exception as exc:
            step.status = "failed"
            step.output = {
                "error": str(exc),
            }

    async def resume_after_approval(
        self,
        approval_id: UUID,
        db: AsyncSession,
    ) -> Task:

        # Find approval.
        result = await db.execute(
            select(Approval).where(
                Approval.id == approval_id
            )
        )

        approval = result.scalar_one_or_none()

        if approval is None:
            raise ValueError("Approval not found")

        # Find associated task.
        task = await db.get(Task, approval.task_id)

        if task is None:
            raise ValueError("Task not found")

        # Find associated step.
        step = await db.get(
            TaskStep,
            approval.task_step_id,
        )

        if step is None:
            raise ValueError("Task step not found")

        # Execute approved tool.
        tool_name = approval.action

        step.status = "running"
        task.status = "running"

        await db.commit()

        await self._execute_step(
            step=step,
            tool_name=tool_name,
        )

        # Check whether any other approvals remain.
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
            # Check whether any task steps failed.
            failed_result = await db.execute(
                select(TaskStep).where(
                    TaskStep.task_id == task.id,
                    TaskStep.status == "failed",
                )
            )

            failed_steps = failed_result.scalars().all()

            if failed_steps:
                task.status = "failed"
            else:
                task.status = "completed"

        await db.commit()
        await db.refresh(task)

        return task