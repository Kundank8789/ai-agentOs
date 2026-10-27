from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.agent.exceptions import TaskCancellationRequested
from app.agent.runtime import AgentRuntime
from app.models.tool_call import ToolCall


class FakeResult:
    def __init__(self, items=None):
        self.items = items or []

    def scalars(self):
        return self

    def all(self):
        return self.items


class FakeDB:
    def __init__(self):
        self.tool_calls = []
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        return FakeResult(list(self.tool_calls))

    def add(self, instance):
        if isinstance(instance, ToolCall):
            self.tool_calls.append(instance)

    async def flush(self):
        # Simulate the UUID assigned by the database.
        for call in self.tool_calls:
            if call.id is None:
                call.id = uuid4()

    async def commit(self):
        pass

    async def refresh(self, instance):
        pass


class FakeTool:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.received_kwargs = None

    async def execute(self, **kwargs):
        self.received_kwargs = kwargs

        if self.error:
            raise RuntimeError(self.error)

        return self.result


class FakeRegistry:
    def __init__(self, tool):
        self.tool = tool

    def get(self, name):
        if name != "test_tool":
            raise KeyError(name)
        return self.tool


def make_step():
    return SimpleNamespace(
        id=uuid4(),
        task_id=uuid4(),
        status="running",
        output=None,
        error=None,
    )


@pytest.mark.asyncio
async def test_execute_step_records_successful_tool_call(monkeypatch):
    db = FakeDB()
    step = make_step()

    expected_output = {
        "success": True,
        "message": "Operation completed",
    }
    tool = FakeTool(result=expected_output)

    runtime = AgentRuntime()
    runtime.registry = FakeRegistry(tool)

    audit_events = []

    async def fake_log_audit(db_arg, **kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(
        "app.agent.runtime.log_audit",
        fake_log_audit,
    )

    result = await runtime._execute_step(
        step=step,
        tool_name="test_tool",
        context={"customers": [{"id": "customer-1"}]},
        db=db,
    )

    assert result == expected_output
    assert step.status == "completed"
    assert step.output == expected_output

    assert len(db.tool_calls) == 1
    tool_call = db.tool_calls[0]

    assert tool_call.tool_name == "test_tool"
    assert tool_call.call_number == 1
    assert tool_call.status == "success"
    assert tool_call.input_data["customers_count"] == 1
    assert tool_call.output_data == expected_output
    assert tool_call.started_at is not None
    assert tool_call.completed_at is not None
    assert tool_call.id is not None

    assert len(audit_events) == 1
    assert audit_events[0]["event_type"] == "step.completed"
    assert audit_events[0]["tool_call_id"] == tool_call.id


@pytest.mark.asyncio
async def test_execute_step_records_failed_tool_call(monkeypatch):
    db = FakeDB()
    step = make_step()

    tool = FakeTool(
        result={
            "success": False,
            "message": "External service unavailable",
        }
    )

    runtime = AgentRuntime()
    runtime.registry = FakeRegistry(tool)

    audit_events = []

    async def fake_log_audit(db_arg, **kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(
        "app.agent.runtime.log_audit",
        fake_log_audit,
    )

    result = await runtime._execute_step(
        step=step,
        tool_name="test_tool",
        context={},
        db=db,
    )

    assert step.status == "failed"
    assert "External service unavailable" in result["error"]
    assert step.error == result["error"]

    assert len(db.tool_calls) == 1
    tool_call = db.tool_calls[0]

    assert tool_call.status == "failed"
    assert tool_call.error == result["error"]
    assert tool_call.completed_at is not None
    assert tool_call.output_data is None

    assert len(audit_events) == 1
    assert audit_events[0]["event_type"] == "step.failed"
    assert audit_events[0]["tool_call_id"] == tool_call.id


@pytest.mark.asyncio
async def test_execute_step_records_raised_tool_exception(monkeypatch):
    db = FakeDB()
    step = make_step()

    tool = FakeTool(error="Connection timed out")

    runtime = AgentRuntime()
    runtime.registry = FakeRegistry(tool)

    audit_events = []

    async def fake_log_audit(db_arg, **kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(
        "app.agent.runtime.log_audit",
        fake_log_audit,
    )

    result = await runtime._execute_step(
        step=step,
        tool_name="test_tool",
        db=db,
    )

    assert step.status == "failed"
    assert result["error"] == "Connection timed out"
    assert len(db.tool_calls) == 1
    assert db.tool_calls[0].status == "failed"
    assert db.tool_calls[0].error == "Connection timed out"
    assert audit_events[0]["event_type"] == "step.failed"


class RetryFakeRegistry:
    def __init__(self, tool):
        self.tool = tool

    def get(self, name):
        return self.tool


class SequenceTool:
    def __init__(self, errors, result=None):
        self.errors = list(errors)
        self.result = result or {"success": True}
        self.calls = 0

    async def execute(self, **kwargs):
        self.calls += 1
        if self.errors:
            error = self.errors.pop(0)
            raise error
        return self.result


@pytest.mark.asyncio
async def test_safe_retry_recovers_after_transient_error(monkeypatch):
    db = FakeDB()
    step = make_step()
    expected = {"success": True, "message": "Recovered"}
    tool = SequenceTool([ConnectionError("temporary network failure")], expected)

    runtime = AgentRuntime()
    runtime.registry = RetryFakeRegistry(tool)

    events = []

    async def fake_log_audit(db_arg, **kwargs):
        events.append(kwargs)

    async def fake_sleep(seconds):
        pass

    monkeypatch.setattr("app.agent.runtime.log_audit", fake_log_audit)
    monkeypatch.setattr("app.agent.runtime.asyncio.sleep", fake_sleep)

    result = await runtime._execute_step(
        step=step,
        tool_name="web_search",
        context={},
        db=db,
    )

    assert result == expected
    assert step.status == "completed"
    assert tool.calls == 2
    assert any(e["event_type"] == "tool.retry" for e in events)
    assert any(e["event_type"] == "step.completed" for e in events)


@pytest.mark.asyncio
async def test_safe_retry_stops_after_three_attempts(monkeypatch):
    db = FakeDB()
    step = make_step()
    tool = SequenceTool([
        TimeoutError("timeout 1"),
        ConnectionError("connection 2"),
        OSError("network 3"),
    ])

    runtime = AgentRuntime()
    runtime.registry = RetryFakeRegistry(tool)

    events = []

    async def fake_log_audit(db_arg, **kwargs):
        events.append(kwargs)

    async def fake_sleep(seconds):
        pass

    monkeypatch.setattr("app.agent.runtime.log_audit", fake_log_audit)
    monkeypatch.setattr("app.agent.runtime.asyncio.sleep", fake_sleep)

    result = await runtime._execute_step(
        step=step,
        tool_name="web_search",
        context={},
        db=db,
    )

    assert step.status == "failed"
    assert tool.calls == 3
    assert "network 3" in result["error"]
    assert sum(e["event_type"] == "tool.retry" for e in events) == 2
    assert any(e["event_type"] == "step.failed" for e in events)


@pytest.mark.asyncio
async def test_gmail_is_not_retried_on_transient_error(monkeypatch):
    db = FakeDB()
    step = make_step()
    tool = SequenceTool([ConnectionError("temporary mail failure")])

    runtime = AgentRuntime()
    runtime.registry = RetryFakeRegistry(tool)

    events = []

    async def fake_log_audit(db_arg, **kwargs):
        events.append(kwargs)

    monkeypatch.setattr("app.agent.runtime.log_audit", fake_log_audit)

    result = await runtime._execute_step(
        step=step,
        tool_name="gmail",
        context={},
        db=db,
    )

    assert step.status == "failed"
    assert tool.calls == 1
    assert "temporary mail failure" in result["error"]
    assert not any(e["event_type"] == "tool.retry" for e in events)


class SlowTool:
    def __init__(self):
        self.calls = 0

    async def execute(self, **kwargs):
        import asyncio
        self.calls += 1
        await asyncio.sleep(2)
        return {"success": True}


@pytest.mark.asyncio
async def test_tool_timeout_marks_step_failed(monkeypatch):
    import app.agent.runtime as runtime_module

    db = FakeDB()
    step = make_step()
    tool = SlowTool()

    runtime = AgentRuntime()
    runtime.registry = RetryFakeRegistry(tool)

    audit_events = []

    async def fake_log_audit(db_arg, **kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(runtime_module, "TOOL_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(runtime_module, "log_audit", fake_log_audit)

    result = await runtime._execute_step(
        step=step,
        tool_name="gmail",
        operation="send email",
        context={},
        db=db,
    )

    assert step.status == "failed"
    assert tool.calls == 1
    assert result == {"error": ""}
    assert db.tool_calls[0].status == "failed"
    assert any(e["event_type"] == "step.failed" for e in audit_events)


@pytest.mark.asyncio
async def test_runtime_cancellation_request_at_final_boundary(monkeypatch):
    import asyncio

    import app.agent.runtime as runtime_module

    task = SimpleNamespace(
        id=uuid4(),
        status="running",
        title="Cancellation boundary test",
        description="Test cancellation safely",
        organization_id=uuid4(),
        user_id=uuid4(),
        agent_id=uuid4(),
    )

    class ResultWithTask(FakeResult):
        def scalar_one_or_none(self):
            return task

    class CancellationDB(FakeDB):
        def __init__(self):
            super().__init__()
            self.status_refreshes = 0

        async def execute(self, statement):
            self.statements.append(statement)
            return ResultWithTask([])

        async def refresh(self, instance, attribute_names=None):
            if attribute_names == ["status"]:
                self.status_refreshes += 1
                # Simulate the API recording cancellation in the database
                # just before the runtime's final status decision.
                instance.status = "cancellation_requested"

    db = CancellationDB()
    events = []

    async def fake_log_audit(db_arg, **kwargs):
        events.append(kwargs)

    async def fake_get_memories(**kwargs):
        return []

    async def fake_generate_plan(**kwargs):
        return SimpleNamespace(goal="test", steps=[])

    async def fake_save_task_memory(**kwargs):
        pass

    monkeypatch.setattr(runtime_module, "log_audit", fake_log_audit)
    monkeypatch.setattr(runtime_module, "get_memories", fake_get_memories)
    monkeypatch.setattr(runtime_module, "generate_plan", fake_generate_plan)
    monkeypatch.setattr(
        runtime_module, "save_task_memory", fake_save_task_memory
    )

    runtime = AgentRuntime()

    with pytest.raises(TaskCancellationRequested):
        await runtime.run(task_id=task.id, db=db)

    assert task.status == "cancelled"
    assert db.status_refreshes >= 1
    assert any(
        event["event_type"] == "task.cancelled"
        for event in events
    )


@pytest.mark.asyncio
async def test_runtime_cancellation_requested_while_tool_is_running(monkeypatch):
    import asyncio

    import app.agent.runtime as runtime_module

    task = SimpleNamespace(
        id=uuid4(),
        status="running",
        title="Mid-execution cancellation test",
        description="Test cancellation during tool execution",
        organization_id=uuid4(),
        user_id=uuid4(),
        agent_id=uuid4(),
    )

    step_data = SimpleNamespace(
        step_number=1,
        name="Run test tool",
        description="Simulated slow tool",
        tool="test_tool",
        requires_approval=False,
    )

    class TaskResult(FakeResult):
        def scalar_one_or_none(self):
            return task

    class RunningCancellationDB(FakeDB):
        def __init__(self):
            super().__init__()
            self.status_refreshes = 0

        async def execute(self, statement):
            self.statements.append(statement)
            # The first query loads the task. Later queries return
            # an empty result for existing tool calls and task steps.
            return TaskResult([])

        async def refresh(self, instance, attribute_names=None):
            if attribute_names == ["status"]:
                self.status_refreshes += 1
                if self.status_refreshes >= 2:
                    instance.status = "cancellation_requested"

    tool_started = asyncio.Event()
    allow_tool_to_finish = asyncio.Event()
    audit_events = []

    class WaitingTool:
        async def execute(self, **kwargs):
            tool_started.set()
            await allow_tool_to_finish.wait()
            return {"success": True, "message": "Tool finished"}

    async def fake_log_audit(db_arg, **kwargs):
        audit_events.append(kwargs)

    async def fake_get_memories(**kwargs):
        return []

    async def fake_generate_plan(**kwargs):
        return SimpleNamespace(goal="test", steps=[step_data])

    async def fake_save_task_memory(**kwargs):
        pass

    monkeypatch.setattr(runtime_module, "log_audit", fake_log_audit)
    monkeypatch.setattr(runtime_module, "get_memories", fake_get_memories)
    monkeypatch.setattr(runtime_module, "generate_plan", fake_generate_plan)
    monkeypatch.setattr(runtime_module, "save_task_memory", fake_save_task_memory)

    db = RunningCancellationDB()
    runtime = AgentRuntime()
    runtime.registry = FakeRegistry(WaitingTool())

    run_task = asyncio.create_task(runtime.run(task_id=task.id, db=db))

    try:
        await asyncio.wait_for(tool_started.wait(), timeout=2)
        # Simulate the API requesting cancellation while the tool is running.
        task.status = "cancellation_requested"
    finally:
        allow_tool_to_finish.set()

    with pytest.raises(TaskCancellationRequested):
        await asyncio.wait_for(run_task, timeout=3)

    assert task.status == "cancelled"
    assert any(
        event["event_type"] == "task.cancelled"
        for event in audit_events
    )