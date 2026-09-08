from fastapi import FastAPI
from sqlalchemy import text

from app.api.tasks import router as tasks_router
from app.database import AsyncSessionLocal


app = FastAPI(
    title="AgentOS API",
    description="AI employee platform for business operations",
    version="0.1.0",
)

app.include_router(tasks_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "agentos-api",
        "version": "0.1.0",
    }


@app.get("/health/db")
async def database_health():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "database": result.scalar(),
        }