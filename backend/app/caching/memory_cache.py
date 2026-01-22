from aiocache import SimpleMemoryCache
from collections import OrderedDict
import asyncio
import json
import time
from typing import Any, Optional

# 24 hours TTL (seconds)
DEFAULT_TTL = 24 * 60 * 60
# Soft memory cap ~100MB measured via JSON-serialized payload length
MEMORY_CAP_BYTES = 100 * 1024 * 1024

class CacheStore:
    def __init__(self):
        self.cache = SimpleMemoryCache()
        self.meta_lock = asyncio.Lock()
        self.lru: "OrderedDict[str, dict]" = OrderedDict()
        self.total_bytes = 0
        self.hits = 0
        self.misses = 0

    async def get(self, key: str) -> Optional[Any]:
        val = await self.cache.get(key)
        async with self.meta_lock:
            if val is not None:
                self.hits += 1
                if key in self.lru:
                    self.lru.move_to_end(key)
                    self.lru[key]["last_access"] = time.time()
                else:
                    # Unknown meta, initialize minimal
                    self.lru[key] = {"size": self._estimate_size(val), "last_access": time.time()}
                    self.total_bytes += self.lru[key]["size"]
                return val
            else:
                self.misses += 1
                return None

    async def set(self, key: str, value: Any, ttl: int = DEFAULT_TTL):
        # Store in cache and update LRU metadata
        await self.cache.set(key, value, ttl=ttl)
        size = self._estimate_size(value)
        async with self.meta_lock:
            if key in self.lru:
                # adjust total by delta
                delta = size - self.lru[key]["size"]
                self.total_bytes += max(delta, 0)
                self.lru[key]["size"] = size
                self.lru[key]["last_access"] = time.time()
                self.lru.move_to_end(key)
            else:
                self.lru[key] = {"size": size, "last_access": time.time()}
                self.total_bytes += size
            await self._evict_if_needed()

    async def delete(self, key: str):
        await self.cache.delete(key)
        async with self.meta_lock:
            meta = self.lru.pop(key, None)
            if meta:
                self.total_bytes = max(0, self.total_bytes - meta.get("size", 0))

    async def clear(self):
        await self.cache.clear()
        async with self.meta_lock:
            self.lru.clear()
            self.total_bytes = 0
            self.hits = 0
            self.misses = 0

    async def _evict_if_needed(self):
        # Simple LRU eviction by serialized size cap
        while self.total_bytes > MEMORY_CAP_BYTES and self.lru:
            key, meta = self.lru.popitem(last=False)  # pop least recently used
            await self.cache.delete(key)
            self.total_bytes = max(0, self.total_bytes - meta.get("size", 0))

    def _estimate_size(self, value: Any) -> int:
        try:
            return len(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        except Exception:
            return 1024  # fallback estimate

    def stats(self):
        return {
            "keys": len(self.lru),
            "approx_bytes": self.total_bytes,
            "hits": self.hits,
            "misses": self.misses,
        }

    async def get_many(self, keys: list[str]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k in keys:
            v = await self.get(k)
            if v is not None:
                out[k] = v
        return out

cache_store = CacheStore()

def get_stats():
    return cache_store.stats()

async def clear_cache():
    await cache_store.clear()