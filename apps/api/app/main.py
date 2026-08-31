from fastapi import FastAPI

app = FastAPI(
    title="AgentOS API",
    description="AI employee platform for business operations",
    version="0.1.0",
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "agentos-api",
        "version": "0.1.0",
    }