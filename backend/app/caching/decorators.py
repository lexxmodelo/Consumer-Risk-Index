from typing import Callable, Any, Awaitable
from .memory_cache import cache_store, DEFAULT_TTL

def cached_response(key_builder: Callable[..., str], ttl: int = DEFAULT_TTL):
    def decorator(func: Callable[..., Awaitable[Any]]):
        async def wrapper(*args, **kwargs):
            key = key_builder(*args, **kwargs)
            cached = await cache_store.get(key)
            if cached is not None:
                return cached
            result = await func(*args, **kwargs)
            await cache_store.set(key, result, ttl)
            return result
        return wrapper
    return decorator