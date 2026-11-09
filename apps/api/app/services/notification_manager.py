
import json
from uuid import UUID

from redis.asyncio import Redis

from app.config import settings


class NotificationManager:
    def __init__(self):
        self.redis: Redis | None = None

    async def connect_redis(self):
        client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_timeout=10,
            health_check_interval=30,
        )

        try:
            await client.ping()
            self.redis = client
            print("Redis connected successfully")
        except Exception:
            await client.aclose()
            raise

    async def close_redis(self):
        if self.redis:
            await self.redis.aclose()
            self.redis = None
            print("Redis connection closed")

    async def publish(
        self,
        organization_id: UUID,
        payload: dict,
    ):
        if not self.redis:
            raise RuntimeError("Redis is not connected")

        await self.redis.publish(
            f"agentos:notifications:{organization_id}",
            json.dumps(payload, default=str),
        )

    async def subscribe(self, organization_id: UUID):
        if not self.redis:
            raise RuntimeError("Redis is not connected")

        pubsub = self.redis.pubsub()

        await pubsub.subscribe(
            f"agentos:notifications:{organization_id}"
        )

        return pubsub


notification_manager = NotificationManager()
