from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.user import User


router = APIRouter(
    prefix="/agents",
    tags=["Agents"],
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def get_dev_user(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.email == "dev@agentos.local"
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=500,
            detail="Development user not found. Run python -m app.seed",
        )

    return user


@router.get("/")
async def list_agents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_dev_user),
):
    result = await db.execute(
        select(Agent)
        .where(
            Agent.organization_id == user.organization_id
        )
        .order_by(Agent.created_at.asc())
    )

    agents = result.scalars().all()

    return [
        {
            "id": str(agent.id),
            "name": agent.name,
            "description": agent.description,
            "status": agent.status,
            "created_at": agent.created_at,
        }
        for agent in agents
    ]


@router.get("/{agent_id}")
async def get_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_dev_user),
):
    result = await db.execute(
        select(Agent).where(
            Agent.id == agent_id,
            Agent.organization_id == user.organization_id,
        )
    )

    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(
            status_code=404,
            detail="Agent not found",
        )

    return {
        "id": str(agent.id),
        "name": agent.name,
        "description": agent.description,
        "status": agent.status,
        "created_at": agent.created_at,
    }
