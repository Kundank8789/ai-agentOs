import asyncio
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agent.exceptions import TaskCancellationRequested

from app.agent.llm import generate_plan
from app.models.approval import Approval
from app.models.task import Task
from app.models.task_step import TaskStep
from app.models.tool_call import ToolCall
from app.services.audit import log_audit
from app.services.memory import (
    filter_relevant_memories,
    get_memories,
)
from app.services.memory_extractor import save_task_memory
from app.tools.google_sheets import GoogleSheetsTool
from app.tools.gmail import GmailTool
from app.tools.crm import CRMTool
from app.tools.web_search import WebSearchTool
from app.tools.reasoning import ReasoningTool
from app.tools.registry import ToolRegistry

TOOL_TIMEOUT_SECONDS = 60


class AgentRuntime:
    """
    Core execution engine for AgentOS.
    """

    def __init__(self) -> None:
        self.registry = ToolRegistry()

        self.registry.register(GoogleSheetsTool())
        self.registry.register(GmailTool())
        self.registry.register(CRMTool())
        self.registry.register(WebSearchTool())
        self.registry.register(ReasoningTool())

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

        if task.status == "cancelled":
            return task

        if task.status == "cancellation_requested":
            task.status = "cancelled"
            await log_audit(
                db,
                task_id=task.id,
                event_type="task.cancelled",
                actor_type="system",
                action="cancel_task",
                message="Task cancelled before runtime execution began.",
                metadata={"reason": "cancellation_requested"},
            )
            await db.commit()
            await db.refresh(task)
            return task

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
            # -----------------------------------------
            # 1. Load relevant memories
            # -----------------------------------------
            memories = await get_memories(
                db=db,
                organization_id=task.organization_id,
                user_id=task.user_id,
                agent_id=task.agent_id,
            )

            relevant_memories = filter_relevant_memories(
                memories=memories,
                task_title=task.title,
                task_description=task.description,
            )

            memory_context = [
                {
                    "type": memory.type,
                    "key": memory.key,
                    "value": memory.value,
                }
                for memory in relevant_memories
            ]

            # -----------------------------------------
            # 2. Generate execution plan
            # -----------------------------------------
            plan = await generate_plan(
                task_title=task.title,
                task_description=task.description,
                memory_context=memory_context,
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
                    "memory_count": len(memory_context),
                    "total_memory_count": len(memories),
                },
            )

            # Data produced by previous steps
            context: dict = {}

            # -----------------------------------------
            # 3. Execute planned steps
            # -----------------------------------------
            for step_data in plan.steps:
                # CANCEL_BOUNDARY_CHECK_V1
                await db.refresh(task, attribute_names=["status"])
                if task.status in {"cancelled", "cancellation_requested"}:
                    raise TaskCancellationRequested()

                step = TaskStep(
                    task_id=task.id,
                    step_number=step_data.step_number,
                    name=step_data.name,
                    description=step_data.description,
                    status="planned",
                    input={
                        "tool": step_data.tool,
                        "requires_approval": step_data.requires_approval,
                        "operation": step_data.name,
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
                        "operation": step_data.name,
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
                # Safety check: reject steps with no tool
                # -----------------------------------------
                if not step_data.tool:
                    step.status = "failed"
                    step.output = {
                        "error": "Execution plan step is missing a tool."
                    }

                    await log_audit(
                        db,
                        task_id=task.id,
                        task_step_id=step.id,
                        event_type="step.failed",
                        actor_type="agent",
                        action="validate_plan_step",
                        message="Execution plan step is missing a tool.",
                        metadata={
                            "step_number": step_data.step_number,
                            "step_name": step_data.name,
                        },
                    )

                    continue

                # -----------------------------------------
                # Execute non-approval step
                # -----------------------------------------
                result = await self._execute_step(
                    step=step,
                    tool_name=step_data.tool,
                    operation=step_data.name,
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
            # 4. Determine task state
            # -----------------------------------------
            await db.refresh(task, attribute_names=["status"])
            if task.status in {"cancelled", "cancellation_requested"}:
                raise TaskCancellationRequested()

            pending_result = await db.execute(
                select(Approval).where(
                    Approval.task_id == task.id,
                    Approval.status == "pending",
                )
            )

            pending_approvals = pending_result.scalars().all()

            failed_result = await db.execute(
                select(TaskStep).where(
                    TaskStep.task_id == task.id,
                    TaskStep.status == "failed",
                )
            )

            failed_steps = failed_result.scalars().all()

            if pending_approvals:
                task.status = "waiting_approval"

                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.waiting_approval",
                    actor_type="system",
                    action="pause_for_approval",
                    message=(
                        f"Task paused — {len(pending_approvals)} "
                        "approval(s) pending."
                    ),
                    metadata={
                        "pending_count": len(pending_approvals),
                        "failed_step_count": len(failed_steps),
                    },
                )

            elif failed_steps:
                task.status = "failed"

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

                await save_task_memory(
                    db=db,
                    organization_id=task.organization_id,
                    user_id=task.user_id,
                    agent_id=task.agent_id,
                    memory_type="workflow",
                    key="last_completed_task",
                    value=task.title,
                )

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

        except (TaskCancellationRequested, asyncio.CancelledError):
            task.status = "cancelled"
            try:
                await log_audit(
                    db,
                    task_id=task.id,
                    event_type="task.cancelled",
                    actor_type="system",
                    action="cancel_task",
                    message="Task execution was cancelled.",
                    metadata={"reason": "execution_cancelled"},
                )
                await db.commit()
            except Exception:
                await db.rollback()
            raise

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
        operation: str | None = None,
        context: dict | None = None,
        db: AsyncSession | None = None,
    ) -> dict:

        context = context or {}

        # -----------------------------------------
        # Resolve the tool
        # -----------------------------------------
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

        # -----------------------------------------
        # Determine operation mode (Gmail only)
        # -----------------------------------------
        mode = None

        if tool_name == "gmail":
            operation_text = (operation or "").lower()

            if "draft" in operation_text:
                mode = "draft"
            elif "send" in operation_text:
                mode = "send"

        customers = context.get("customers", [])

        # -----------------------------------------
        # Create a ToolCall record for this invocation
        # -----------------------------------------
        tool_call: ToolCall | None = None

        if db is not None:
            existing_result = await db.execute(
                select(ToolCall).where(
                    ToolCall.task_step_id == step.id
                )
            )

            existing_calls = existing_result.scalars().all()

            call_number = len(existing_calls) + 1

            tool_call = ToolCall(
                task_step_id=step.id,
                tool_name=tool_name,
                call_number=call_number,
                status="running",
                input_data={
                    "customers_count": len(customers),
                    "mode": mode,
                },
                started_at=datetime.now(timezone.utc),
            )

            db.add(tool_call)
            await db.flush()

        # -----------------------------------------
        # Execute the tool with bounded safe retries
        # SAFE_RETRY_PATCH_V1
        # -----------------------------------------
        retry_safe_tools = {"google_sheets", "web_search", "reasoning"}
        max_attempts = 3 if tool_name in retry_safe_tools else 1
        transient_errors = (TimeoutError, ConnectionError, OSError)
        attempts_used = 0

        try:
            for attempt in range(1, max_attempts + 1):
                attempts_used = attempt
                try:
                    if tool_name == "gmail":
                        result = await asyncio.wait_for(
                            tool.execute(
                                customers=customers,
                                mode=mode or "send",
                            ),
                            timeout=TOOL_TIMEOUT_SECONDS,
                        )
                    else:
                        result = await asyncio.wait_for(
                            tool.execute(customers=customers),
                            timeout=TOOL_TIMEOUT_SECONDS,
                        )
                    break
                except transient_errors as exc:
                    if tool_name not in retry_safe_tools or attempt >= max_attempts:
                        raise

                    if db is not None:
                        await log_audit(
                            db,
                            task_id=step.task_id,
                            task_step_id=step.id,
                            tool_call_id=tool_call.id if tool_call is not None else None,
                            event_type="tool.retry",
                            actor_type="agent",
                            action=tool_name,
                            message=f"Transient failure on attempt {attempt}/{max_attempts}; retrying: {exc}",
                            metadata={
                                "tool": tool_name,
                                "attempt": attempt,
                                "next_attempt": attempt + 1,
                                "max_attempts": max_attempts,
                                "error": str(exc),
                            },
                        )

                    await asyncio.sleep(0.25 * attempt)

            # Treat {"success": False} as failure
            if isinstance(result, dict) and result.get("success") is False:
                raise RuntimeError(
                    result.get("error")
                    or result.get("message")
                    or "Tool reported failure."
                )

            step.status = "completed"
            step.output = result

            if tool_call is not None:
                tool_call.status = "success"
                tool_call.output_data = result
                tool_call.completed_at = datetime.now(timezone.utc)

            if db is not None:
                await log_audit(
                    db,
                    task_id=step.task_id,
                    task_step_id=step.id,
                    tool_call_id=(
                        tool_call.id if tool_call is not None else None
                    ),
                    event_type="step.completed",
                    actor_type="agent",
                    action=tool_name,
                    message=(
                        f"Tool '{tool_name}' completed successfully."
                    ),
                    metadata={
                        "tool": tool_name,
                        "mode": mode,
                    },
                )

            return result

        except Exception as exc:
            step.status = "failed"
            step.output = {"error": str(exc)}
            step.error = str(exc)

            if tool_call is not None:
                tool_call.status = "failed"
                tool_call.error = str(exc)
                tool_call.completed_at = datetime.now(timezone.utc)

            if db is not None:
                await log_audit(
                    db,
                    task_id=step.task_id,
                    task_step_id=step.id,
                    tool_call_id=(
                        tool_call.id if tool_call is not None else None
                    ),
                    event_type="step.failed",
                    actor_type="agent",
                    action=tool_name,
                    message=f"Tool '{tool_name}' failed: {str(exc)}",
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

        operation = requested_data.get("step_name", "")

        step.status = "running"
        task.status = "running"

        await db.commit()

        # -----------------------------------------
        # Execute the approved tool through the shared
        # runtime path. This records ToolCall details
        # and handles tool failures consistently.
        # -----------------------------------------
        await self._execute_step(
            step=step,
            tool_name=tool_name,
            operation=operation,
            context={"customers": customers},
            db=db,
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
                # Save task completion memory
                # -----------------------------------------
                await save_task_memory(
                    db=db,
                    organization_id=task.organization_id,
                    user_id=task.user_id,
                    agent_id=task.agent_id,
                    memory_type="workflow",
                    key="last_completed_task",
                    value=task.title,
                )

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