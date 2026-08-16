"""Thin async Redis cache layer.

Usage:
    from app.core.cache import cache

    val = await cache.get("my:key")               # returns str | None
    await cache.set("my:key", "value", ttl=60)    # ttl in seconds
    await cache.delete("my:key")
    await cache.delete_prefix("github:")          # bulk delete by prefix
"""
import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


async def get(key: str) -> str | None:
    return await _get_client().get(key)


async def get_json(key: str) -> Any | None:
    raw = await get(key)
    return json.loads(raw) if raw is not None else None


async def set(key: str, value: str, ttl: int) -> None:
    await _get_client().setex(key, ttl, value)


async def set_json(key: str, value: Any, ttl: int) -> None:
    await set(key, json.dumps(value), ttl)


async def delete(key: str) -> None:
    await _get_client().delete(key)


async def delete_prefix(prefix: str) -> None:
    client = _get_client()
    keys = await client.keys(f"{prefix}*")
    if keys:
        await client.delete(*keys)
