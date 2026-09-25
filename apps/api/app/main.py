from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.tasks import router as tasks_router
from app.api.approvals import router as approvals_router
from app.database import AsyncSessionLocal
from app.api.agents import router as agents_router


app = FastAPI(
    title="AgentOS API",
    description="AI employee platform for business operations",
    version="0.1.0",
)


# -----------------------------------------
# CORS — allow the Next.js frontend to call us
# -----------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(tasks_router)
app.include_router(approvals_router)
app.include_router(agents_router)


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