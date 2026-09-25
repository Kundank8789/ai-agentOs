import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Agent, Organization, User


async def seed():
    async with AsyncSessionLocal() as session:

        # -------------------------------------------------
        # Organization
        # -------------------------------------------------
        result = await session.execute(
            select(Organization).where(
                Organization.name == "AgentOS Development"
            )
        )

        organization = result.scalar_one_or_none()

        if organization is None:
            organization = Organization(
                name="AgentOS Development"
            )

            session.add(organization)
            await session.flush()

        # -------------------------------------------------
        # Development User
        # -------------------------------------------------
        result = await session.execute(
            select(User).where(
                User.email == "dev@agentos.local"
            )
        )

        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                organization_id=organization.id,
                name="AgentOS Developer",
                email="dev@agentos.local",
                role="admin",
            )

            session.add(user)

        # -------------------------------------------------
        # Agents
        # -------------------------------------------------
        agents = [
            {
                "name": "CRM Agent",
                "description": "Manages leads, customers, deals and CRM workflows.",
                "status": "active",
            },
            {
                "name": "Support Agent",
                "description": "Handles customer support requests and follow-ups.",
                "status": "active",
            },
            {
                "name": "Operations Agent",
                "description": "Handles operational tasks, workflows and automation.",
                "status": "active",
            },
        ]

        for agent_data in agents:
            result = await session.execute(
                select(Agent).where(
                    Agent.organization_id == organization.id,
                    Agent.name == agent_data["name"],
                )
            )

            existing_agent = result.scalar_one_or_none()

            if existing_agent is None:
                session.add(
                    Agent(
                        organization_id=organization.id,
                        name=agent_data["name"],
                        description=agent_data["description"],
                        status=agent_data["status"],
                    )
                )

        await session.commit()

        print("Seed completed.")
        print(f"Organization ID: {organization.id}")
        print(f"User ID: {user.id}")
        print("Agents seeded: CRM Agent, Support Agent, Operations Agent")


if __name__ == "__main__":
    asyncio.run(seed())
