
import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.jobs.worker as worker


class FakeClaimResult:
    def __init__(self, rowcount):
        self.rowcount = rowcount


class FakeSession:
    def __init__(self, rowcount=1):
        self.rowcount = rowcount
        self.commits = 0
        self.closed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        self.closed = True

    async def execute(self, statement):
        return FakeClaimResult(self.rowcount)

    async def commit(self):
        self.commits += 1


@pytest.mark.asyncio
async def test_worker_skips_task_that_was_not_queued(monkeypatch):
    task_id = str(uuid4())
    db = FakeSession(rowcount=0)
    runtime_called = False

    class Runtime:
        async def run(self, **kwargs):
            nonlocal runtime_called
            runtime_called = True

    monkeypatch.setattr(worker, "AsyncSessionLocal", lambda: db)
    monkeypatch.setattr(worker, "AgentRuntime", Runtime)

    result = await worker.run_task({}, task_id)

    assert result["status"] == "skipped"
    assert result["task_id"] == task_id
    assert runtime_called is False
    assert db.closed is True


@pytest.mark.asyncio
async def test_worker_returns_runtime_status(monkeypatch):
    task_id = str(uuid4())
    db = FakeSession(rowcount=1)

    class Runtime:
        async def run(self, **kwargs):
            return SimpleNamespace(status="completed")

    monkeypatch.setattr(worker, "AsyncSessionLocal", lambda: db)
    monkeypatch.setattr(worker, "AgentRuntime", Runtime)

    result = await worker.run_task({}, task_id)

    assert result == {"status": "completed", "task_id": task_id}
    assert db.commits == 1
    assert db.closed is True


@pytest.mark.asyncio
async def test_worker_propagates_runtime_cancellation(monkeypatch):
    task_id = str(uuid4())
    db = FakeSession(rowcount=1)

    class Runtime:
        async def run(self, **kwargs):
            raise asyncio.CancelledError()

    monkeypatch.setattr(worker, "AsyncSessionLocal", lambda: db)
    monkeypatch.setattr(worker, "AgentRuntime", Runtime)

    with pytest.raises(asyncio.CancelledError):
        await worker.run_task({}, task_id)

    assert db.closed is True
