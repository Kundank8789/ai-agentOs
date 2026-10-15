import asyncio

from redis.asyncio import Redis
from app.config import settings


async def main():
    client = Redis.from_url(settings.redis_url)

    try:
        print("Redis ping:", await client.ping())
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())