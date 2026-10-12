from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.api.tasks import get_task_for_user
from app.api.audit import list_audit_logs

client = TestClient(app)


def test_audit_logs_requires_authentication():
    assert client.get("/audit-logs/").status_code == 401


def test_tasks_require_authentication():
    assert client.get("/tasks/").status_code == 401


def test_agents_require_authentication():
    assert client.get("/agents/").status_code == 401


def test_approvals_require_authentication():
    assert client.get("/approvals/").status_code == 401


def test_memories_require_authentication():
    assert client.get("/memories/").status_code == 401


class FakeResult:
    def scalar_one_or_none(self):
        return None

    def scalars(self):
        return self

    def all(self):
        return []


class FakeDB:
    def __init__(self):
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return FakeResult()


@pytest.mark.asyncio
async def test_task_access_checks_organization_and_user():
    db = FakeDB()
    user = SimpleNamespace(
        id=uuid4(),
        organization_id=uuid4(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_task_for_user(
            db=db,
            task_id=uuid4(),
            user=user,
        )

    assert exc_info.value.status_code == 404
    assert db.statement is not None

    sql = str(db.statement)
    assert "tasks.organization_id" in sql
    assert "tasks.user_id" in sql


@pytest.mark.asyncio
async def test_audit_query_is_scoped_to_user_organization():
    db = FakeDB()
    organization_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        organization_id=organization_id,
    )

    result = await list_audit_logs(db=db, user=user)

    assert result == []
    assert db.statement is not None

    compiled = db.statement.compile()
    sql = str(compiled).lower()

    assert "join tasks" in sql
    assert "tasks.organization_id" in sql
    assert organization_id in compiled.params.values()