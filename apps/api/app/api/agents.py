
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_db
from app.models.agent import Agent
from app.models.user import User


router = APIRouter(
    prefix="/agents",
    tags=["Agents"],
)

# Keep this list aligned with the registered AgentRuntime tools.
ALLOWED_TOOLS = {
    "google_sheets",
    "gmail",
    "crm",
    "web_search",
    "reasoning",
}


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    instructions: str | None = Field(default=None, max_length=10000)
    tool_config: dict[str, bool] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    instructions: str | None = Field(default=None, max_length=10000)
    tool_config: dict[str, bool] | None = None
    status: str | None = None


def validate_tool_config(tool_config: dict[str, bool]) -> None:
    unknown_tools = set(tool_config) - ALLOWED_TOOLS
    if unknown_tools:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown tools: {', '.join(sorted(unknown_tools))}",
        )


def serialize_agent(agent: Agent) -> dict:
    return {
        "id": str(agent.id),
        "name": agent.name,
        "description": agent.description,
        "instructions": agent.instructions,
        "tool_config": agent.tool_config or {},
        "status": agent.status,
        "created_at": agent.created_at,
    }


@router.post("/", status_code=201)
async def create_agent(
    agent_data: AgentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    validate_tool_config(agent_data.tool_config)

    agent = Agent(
        organization_id=user.organization_id,
        name=agent_data.name,
        description=agent_data.description,
        instructions=agent_data.instructions,
        tool_config=agent_data.tool_config,
        status="active",
    )

    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    return serialize_agent(agent)


@router.get("/")
async def list_agents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent)
        .where(Agent.organization_id == user.organization_id)
        .order_by(Agent.created_at.asc())
    )

    return [serialize_agent(agent) for agent in result.scalars().all()]


@router.get("/{agent_id}")
async def get_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == user.organization_id,
        )
    )

    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    return serialize_agent(agent)


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == user.organization_id,
        )
    )
    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    changes = agent_data.model_dump(exclude_unset=True)

    if "name" in changes and changes["name"] is None:
        raise HTTPException(status_code=422, detail="Name cannot be null")

    if "tool_config" in changes and changes["tool_config"] is not None:
        validate_tool_config(changes["tool_config"])

    if "status" in changes:
        if changes["status"] not in {"active", "inactive"}:
            raise HTTPException(
                status_code=422,
                detail="Status must be active or inactive",
            )

    for field, value in changes.items():
        setattr(agent, field, value)

    await db.commit()
    await db.refresh(agent)

    return serialize_agent(agent)
