import asyncio



from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Organization, User
async def seed():
    async with AsyncSessionLocal() as session:
        # Check whether our development organization already exists
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

        # Check whether our development user already exists
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

        await session.commit()

        print("Seed completed.")
        print(f"Organization ID: {organization.id}")
        print(f"User ID: {user.id}")


if __name__ == "__main__":
    asyncio.run(seed())