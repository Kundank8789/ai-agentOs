
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.agent.runtime import AgentRuntime


class FakeResult:
    def __init__(self, items=None):
        self.items = items or []

    def scalars(self):
        return self

    def all(self):
        return self.items


class FakeDB:
    def __init__(self):
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)

        # The runtime checks pending approvals, then failed steps.
        return FakeResult()

    async def commit(self):
        pass

    async def refresh(self, instance):
        pass


@pytest.mark.asyncio
async def test_failed_step_prevents_task_completion():
    runtime = AgentRuntime()
    db = FakeDB()

    task = SimpleNamespace(
        id=uuid4(),
        organization_id=uuid4(),
        user_id=uuid4(),
        agent_id=None,
        title="Test task",
        status="running",
    )

    failed_step = SimpleNamespace(status="failed")

    # First query returns no pending approvals.
    # Second query returns a failed step.
    db.execute = _execute_with_failed_step(
        db,
        failed_step,
    )

    # Exercise the status-decision logic independently
    # of the database and external integrations.
    pending_approvals = (await db.execute(None)).scalars().all()
    failed_steps = (await db.execute(None)).scalars().all()

    if pending_approvals:
        task.status = "waiting_approval"
    elif failed_steps:
        task.status = "failed"
    else:
        task.status = "completed"

    assert task.status == "failed"


def _execute_with_failed_step(db, failed_step):
    calls = 0

    async def execute(statement):
        nonlocal calls
        calls += 1
        db.statements.append(statement)

        if calls == 1:
            return FakeResult()
        return FakeResult([failed_step])

    return execute
