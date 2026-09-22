from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import generate_plan
from app.models.approval import Approval
from app.models.task import Task
from app.models.task_step import TaskStep
from app.services.audit import log_audit
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

        # -----------------------------------------
        # Audit: task.started
        # -----------------------------------------
        await log_audit(
            db,
            task_id=task.id,
            event_type="task.started",
            actor_type="agent",
            action="start_task",
            message=f"Started task: {task.title}",
        )

        try:
            # 1. Generate execution plan
            plan = await generate_plan(
                task_title=task.title,
                task_description=task.description,
            )

            # -----------------------------------------
            # Audit: plan.generated
            # -----------------------------------------
            await log_audit(
                db,
                task_id=task.id,
                event_type="plan.generated",
                actor_type="agent",
                action="generate_plan",
                message=(
                    f"Generated execution plan with "
                    f"{len(plan.steps)} steps."
                ),
                metadata={
                    "step_count": len(plan.steps),
                    "goal": plan.goal,
                },
            )

            # Data produced by previous steps
            context: dict = {}

            # 2. Execute planned steps
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

                # -----------------------------------------
                # Approval-required step
                # -----------------------------------------
                if step_data.requires_approval:

                    step.status = "waiting_approval"

                    requested_data = {
                        "tool": step_data.tool,
                        "step_number": step_data.step_number,
                        "step_name": step_data.name,
                    }

                    # Pass delayed customers to Gmail / CRM
                    if "customers" in context:
                        requested_data["customers"] = context["customers"]

                    approval = Approval(
                        task_id=task.id,
                        task_step_id=step.id,
                        action=step_data.tool,
                        description=step_data.description,
                        requested_data=requested_data,
                        status="pending",
                    )

                    db.add(approval)

                    print(
                        f"APPROVAL CREATED: "
                        f"tool={approval.action}, "
                        f"task_id={approval.task_id}, "
                        f"step_id={approval.task_step_id}"
                    )

                    await db.flush()

                    # -----------------------------------------
                    # Audit: approval.requested
                    # -----------------------------------------
                    await log_audit(
                        db,
                        task_id=task.id,
                        task_step_id=step.id,
                        event_type="approval.requested",
                        actor_type="agent",
                        action=step_data.tool,
                        message=(
                            f"Approval requested for "
                            f"{step_data.tool}."
                        ),
                        metadata={
                            "approval_id": str(approval.id),
                            "step_number": step_data.step_number,
                            "customers_count": len(
                                requested_data.get("customers", [])
                            ),
                        },
                    )

                    continue

                # -----------------------------------------
                # Execute non-approval step
                # -----------------------------------------
                result = await self._execute_step(
                    step=step,
                    tool_name=step_data.tool,
                    context=context,
                    db=db,
                )

                if result and step_data.tool == "google_sheets":
                    orders = result.get("orders", [])

                    delayed_customers = [
                        {
                            "order_id": order.get("order_id"),
                            "customer_name": order.get("customer_name"),
                            "customer_email": order.get("customer_email"),
                        }
                        for order in orders
                        if order.get("status") == "Delayed"
                    ]

                    context["customers"] = delayed_customers

                    step.output = {
                        **result,
                        "delayed_customers": delayed_customers,
                        "delayed_count": len(delayed_customers),
                    }

            # -----------------------------------------
            # Determine task state
            # -----------------------------------------
            pending_result = await db.execute(
                select(Approval).where(
                    Approval.task_id == task.id,
                    Approval.status == "pending",
                )
            )

            pending_approvals = pending_result.scalars().all()

            if pending_approvals:
                task.status = "waiting_approval"

                # -----------------------------------------
                # Audit: task.waiting_approval
                # -----------------------------------------
                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.waiting_approval",
                    actor_type="system",
                    action="pause_for_approval",
                    message=(
                        f"Task paused — "
                        f"{len(pending_approvals)} approval(s) pending."
                    ),
                    metadata={
                        "pending_count": len(pending_approvals),
                    },
                )

            else:
                task.status = "completed"

                # -----------------------------------------
                # Audit: task.completed
                # -----------------------------------------
                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.completed",
                    actor_type="agent",
                    action="complete_task",
                    message="Task completed successfully.",
                )

            await db.commit()
            await db.refresh(task)

            return task

        except Exception as exc:
            task.status = "failed"

            # -----------------------------------------
            # Audit: task.failed
            # -----------------------------------------
            try:
                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.failed",
                    actor_type="system",
                    action="fail_task",
                    message=f"Task failed: {str(exc)}",
                    metadata={"error": str(exc)},
                )

                await db.commit()

            except Exception:
                await db.rollback()

            raise

    async def _execute_step(
        self,
        step: TaskStep,
        tool_name: str,
        context: dict | None = None,
        db: AsyncSession | None = None,
    ) -> dict:

        context = context or {}

        try:
            tool = self.registry.get(tool_name)

        except KeyError:
            step.status = "failed"

            step.output = {
                "error": f"Tool '{tool_name}' is not registered."
            }

            if db is not None:
                await log_audit(
                    db,
                    task_id=step.task_id,
                    task_step_id=step.id,
                    event_type="step.failed",
                    actor_type="agent",
                    action=tool_name,
                    message=(
                        f"Tool '{tool_name}' is not registered."
                    ),
                    metadata={
                        "tool": tool_name,
                        "error": "not_registered",
                    },
                )

            return step.output

        try:
            # Pass context to tools
            result = await tool.execute(
                customers=context.get("customers", [])
            )

            step.status = "completed"
            step.output = result

            # -----------------------------------------
            # Audit: step.completed
            # -----------------------------------------
            if db is not None:
                await log_audit(
                    db,
                    task_id=step.task_id,
                    task_step_id=step.id,
                    event_type="step.completed",
                    actor_type="agent",
                    action=tool_name,
                    message=(
                        f"Tool '{tool_name}' completed "
                        f"successfully."
                    ),
                    metadata={
                        "tool": tool_name,
                    },
                )

            return result

        except Exception as exc:

            step.status = "failed"

            step.output = {
                "error": str(exc),
            }

            # -----------------------------------------
            # Audit: step.failed
            # -----------------------------------------
            if db is not None:
                await log_audit(
                    db,
                    task_id=step.task_id,
                    task_step_id=step.id,
                    event_type="step.failed",
                    actor_type="agent",
                    action=tool_name,
                    message=(
                        f"Tool '{tool_name}' failed: {str(exc)}"
                    ),
                    metadata={
                        "tool": tool_name,
                        "error": str(exc),
                    },
                )

            return step.output

    async def resume_after_approval(
        self,
        approval_id: UUID,
        db: AsyncSession,
    ) -> Task:

        # Find approval
        result = await db.execute(
            select(Approval).where(
                Approval.id == approval_id
            )
        )

        approval = result.scalar_one_or_none()

        if approval is None:
            raise ValueError("Approval not found")

        if approval.status != "approved":
            raise ValueError(
                f"Approval is not approved. Current status: {approval.status}"
            )

        # Find task
        task = await db.get(
            Task,
            approval.task_id,
        )

        if task is None:
            raise ValueError("Task not found")

        # Find task step
        step = await db.get(
            TaskStep,
            approval.task_step_id,
        )

        if step is None:
            raise ValueError("Task step not found")

        # Get data saved when approval was created
        requested_data = approval.requested_data or {}

        customers = requested_data.get(
            "customers",
            [],
        )

        tool_name = approval.action

        step.status = "running"
        task.status = "running"

        await db.commit()

        # -----------------------------------------
        # Audit: approval.approved
        # -----------------------------------------
        await log_audit(
            db,
            task_id=task.id,
            task_step_id=step.id,
            event_type="approval.approved",
            actor_type="user",
            action=tool_name,
            message=f"Approval granted for {tool_name}.",
            metadata={
                "approval_id": str(approval.id),
                "customers_count": len(customers),
            },
        )

        # Execute approved tool with customer data
        try:

            tool = self.registry.get(tool_name)

            result = await tool.execute(
                customers=customers
            )

            step.status = "completed"

            step.output = result

            # -----------------------------------------
            # Audit: step.completed (post-approval)
            # -----------------------------------------
            await log_audit(
                db,
                task_id=task.id,
                task_step_id=step.id,
                event_type="step.completed",
                actor_type="agent",
                action=tool_name,
                message=(
                    f"Tool '{tool_name}' completed "
                    f"after approval."
                ),
                metadata={
                    "tool": tool_name,
                },
            )

        except Exception as exc:

            step.status = "failed"

            step.output = {
                "error": str(exc)
            }

            # -----------------------------------------
            # Audit: step.failed (post-approval)
            # -----------------------------------------
            await log_audit(
                db,
                task_id=task.id,
                task_step_id=step.id,
                event_type="step.failed",
                actor_type="agent",
                action=tool_name,
                message=(
                    f"Tool '{tool_name}' failed after "
                    f"approval: {str(exc)}"
                ),
                metadata={
                    "tool": tool_name,
                    "error": str(exc),
                },
            )

        # Check remaining approvals
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

            failed_result = await db.execute(
                select(TaskStep).where(
                    TaskStep.task_id == task.id,
                    TaskStep.status == "failed",
                )
            )

            failed_steps = failed_result.scalars().all()

            if failed_steps:
                task.status = "failed"

                # -----------------------------------------
                # Audit: task.failed (post-approval)
                # -----------------------------------------
                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.failed",
                    actor_type="system",
                    action="fail_task",
                    message=(
                        "Task failed — one or more steps "
                        "did not complete successfully."
                    ),
                    metadata={
                        "failed_step_count": len(failed_steps),
                    },
                )

            else:
                task.status = "completed"

                # -----------------------------------------
                # Audit: task.completed
                # -----------------------------------------
                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.completed",
                    actor_type="agent",
                    action="complete_task",
                    message=(
                        "Task completed successfully "
                        "after approval."
                    ),
                )

        await db.commit()
        await db.refresh(task)

        return task