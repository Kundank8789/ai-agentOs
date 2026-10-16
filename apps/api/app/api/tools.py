
from fastapi import APIRouter, Depends

from app.agent.runtime import AgentRuntime
from app.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/tools", tags=["Tools"])


@router.get("/")
async def list_tools(user: User = Depends(get_current_user)):
    """List tools available in AgentOS."""
    del user

    runtime = AgentRuntime()

    metadata = {
        "google_sheets": {
            "category": "Data",
            "approval_required": False,
            "integration_type": "mock",
        },
        "gmail": {
            "category": "Communication",
            "approval_required": True,
            "integration_type": "mock",
        },
        "crm": {
            "category": "Sales",
            "approval_required": False,
            "integration_type": "mock",
        },
        "web_search": {
            "category": "Research",
            "approval_required": False,
            "integration_type": "mock",
        },
        "reasoning": {
            "category": "AI",
            "approval_required": False,
            "integration_type": "ai",
        },
    }

    return [
        {
            "name": name,
            "description": runtime.registry.get(name).description,
            **metadata.get(
                name,
                {
                    "category": "Other",
                    "approval_required": False,
                    "integration_type": "unknown",
                },
            ),
        }
        for name in runtime.registry.list_tools()
    ]
