
import asyncio
import jwt

from uuid import UUID
from sqlalchemy import select
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.jwt import decode_access_token
from app.services.notification_manager import notification_manager


router = APIRouter(tags=["Real-time Notifications"])


@router.websocket("/ws/notifications")
async def notification_socket(websocket: WebSocket):
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_access_token(token)
        user_id = UUID(payload.get("sub"))
        organization_id = UUID(payload.get("organization_id"))

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
        AttributeError,
    ):
        await websocket.close(code=1008)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.id == user_id,
                User.organization_id == organization_id,
            )
        )

        user = result.scalar_one_or_none()

    if user is None:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    pubsub = None
    channel = f"agentos:notifications:{organization_id}"

    try:
        pubsub = await notification_manager.subscribe(
            organization_id
        )

        await websocket.send_json({
            "type": "connected",
        })

        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )

            if message and message["type"] == "message":
                await websocket.send_text(message["data"])

            try:
                await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.1,
                )
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        pass

    finally:
        if pubsub:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
