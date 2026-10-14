
from types import SimpleNamespace
from uuid import uuid4

import pytest

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
