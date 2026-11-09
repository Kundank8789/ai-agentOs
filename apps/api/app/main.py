from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.tasks import router as tasks_router
from app.api.approvals import router as approvals_router
from app.api.agents import router as agents_router
from app.api import memories
from app.api import auth
from app.api import audit
from app.api.tools import router as tools_router
from app.database import AsyncSessionLocal
from app.api.tool_calls import router as tool_calls_router
from app.api.analytics import router as analytics_router
from app.api.alerts import router as alerts_router
from app.api.websocket import router as websocket_router
from app.services.notification_manager import notification_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    await notification_manager.connect_redis()

    try:
        yield
    finally:
        await notification_manager.close_redis()


app = FastAPI(
    title="AgentOS API",
    description="AI employee platform for business operations",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(memories.router)
app.include_router(auth.router)
app.include_router(audit.router)
app.include_router(tools_router)
app.include_router(tool_calls_router)
app.include_router(analytics_router)
app.include_router(alerts_router)
app.include_router(websocket_router)


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


@app.get("/health/redis")
async def redis_health():
    if notification_manager.redis is None:
        return {
            "status": "disconnected",
            "redis": False,
        }

    try:
        await notification_manager.redis.ping()
        return {
            "status": "ok",
            "redis": True,
        }
    except Exception:
        return {
            "status": "error",
            "redis": False,
        }