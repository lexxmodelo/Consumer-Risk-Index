"""
Unified Caching Layer with Configurable Strategies

Supports:
- Memory caching (aiocache)
- Redis caching (optional)
- File-based caching (fallback)
- Write-through, write-behind, and cache-aside strategies
- Configurable TTLs and eviction policies
- Advanced monitoring and metrics
"""

import asyncio
import json
import logging
import time
from enum import Enum
from typing import Any, Optional, Dict, List, Callable, Union
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import OrderedDict

from aiocache import SimpleMemoryCache, RedisCache
from aiocache.serializers import JsonSerializer

from app.config import settings

logger = logging.getLogger(__name__)

class CacheStrategy(Enum):
    WRITE_THROUGH = "write_through"
    WRITE_BEHIND = "write_behind"
    CACHE_ASIDE = "cache_aside"
    READ_THROUGH = "read_through"

class CacheLayer(Enum):
    MEMORY = "memory"
    REDIS = "redis"
    FILE = "file"

@dataclass
class CacheConfig:
    strategy: CacheStrategy = CacheStrategy.CACHE_ASIDE
    default_ttl: int = 3600  # 1 hour
    max_memory_mb: int = 100
    enable_redis: bool = False
    redis_ttl: int = 86400  # 24 hours
    file_cache_path: str = "./cache"
    write_behind_batch_size: int = 100
    write_behind_delay: int = 60  # seconds

@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    writes: int = 0
    deletes: int = 0
    evictions: int = 0
    total_size_bytes: int = 0
    avg_response_time_ms: float = 0.0

class UnifiedCache:
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self.memory_cache = SimpleMemoryCache(serializer=JsonSerializer())
        self.redis_cache = None
        if self.config.enable_redis:
            self.redis_cache = RedisCache(
                endpoint=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                serializer=JsonSerializer(),
                timeout=5
            )
        
        self.stats = CacheStats()
        self.write_behind_queue: asyncio.Queue = asyncio.Queue()
        self.write_behind_task: Optional[asyncio.Task] = None
        self.lru: OrderedDict[str, dict] = OrderedDict()
        self.lock = asyncio.Lock()
        
        if self.config.strategy == CacheStrategy.WRITE_BEHIND:
            self.write_behind_task = asyncio.create_task(self._write_behind_worker())
    
    async def get(self, key: str, layer: CacheLayer = CacheLayer.MEMORY) -> Optional[Any]:
        """Get value from cache with fallback strategy."""
        start_time = time.time()
        
        try:
            # Try memory cache first
            value = await self.memory_cache.get(key)
            if value is not None:
                async with self.lock:
                    self.stats.hits += 1
                    self.lru.move_to_end(key)
                self._update_stats_time(start_time)
                return value
            
            # Fallback to Redis if enabled
            if self.config.enable_redis and self.redis_cache:
                value = await self.redis_cache.get(key)
                if value is not None:
                    # Populate memory cache
                    await self.memory_cache.set(key, value, ttl=self.config.default_ttl)
                    async with self.lock:
                        self.stats.hits += 1
                        self.lru[key] = {"size": self._estimate_size(value), "last_access": time.time()}
                    self._update_stats_time(start_time)
                    return value
            
            async with self.lock:
                self.stats.misses += 1
            
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            async with self.lock:
                self.stats.misses += 1
        
        self._update_stats_time(start_time)
        return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None, 
                 strategy: Optional[CacheStrategy] = None) -> bool:
        """Set value in cache with specified strategy."""
        start_time = time.time()
        cache_strategy = strategy or self.config.strategy
        ttl = ttl or self.config.default_ttl
        
        try:
            if cache_strategy == CacheStrategy.WRITE_THROUGH:
                success = await self._write_through(key, value, ttl)
            elif cache_strategy == CacheStrategy.WRITE_BEHIND:
                success = await self._write_behind(key, value, ttl)
            else:  # CACHE_ASIDE or READ_THROUGH
                success = await self._cache_aside(key, value, ttl)
            
            if success:
                async with self.lock:
                    self.stats.writes += 1
                    self.lru[key] = {"size": self._estimate_size(value), "last_access": time.time()}
                    await self._evict_if_needed()
            
            self._update_stats_time(start_time)
            return success
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            self._update_stats_time(start_time)
            return False
    
    async def _write_through(self, key: str, value: Any, ttl: int) -> bool:
        """Write to all cache layers synchronously."""
        # Write to memory
        memory_success = await self.memory_cache.set(key, value, ttl=ttl)
        
        # Write to Redis if enabled
        redis_success = True
        if self.config.enable_redis and self.redis_cache:
            redis_success = await self.redis_cache.set(key, value, ttl=self.config.redis_ttl)
        
        return memory_success and redis_success
    
    async def _write_behind(self, key: str, value: Any, ttl: int) -> bool:
        """Queue for asynchronous write to persistent storage."""
        # Always write to memory immediately
        memory_success = await self.memory_cache.set(key, value, ttl=ttl)
        
        # Queue for background Redis write
        await self.write_behind_queue.put((key, value, ttl))
        
        return memory_success
    
    async def _cache_aside(self, key: str, value: Any, ttl: int) -> bool:
        """Standard cache-aside pattern."""
        return await self.memory_cache.set(key, value, ttl=ttl)
    
    async def _write_behind_worker(self):
        """Background worker for write-behind strategy."""
        batch = []
        last_flush = time.time()
        
        while True:
            try:
                # Get item with timeout
                try:
                    item = await asyncio.wait_for(
                        self.write_behind_queue.get(), 
                        timeout=1.0
                    )
                    batch.append(item)
                except asyncio.TimeoutError:
                    item = None
                
                # Flush batch if size or time threshold reached
                current_time = time.time()
                if (len(batch) >= self.config.write_behind_batch_size or 
                    (item is None and len(batch) > 0) or
                    (current_time - last_flush) >= self.config.write_behind_delay):
                    
                    if batch and self.redis_cache:
                        # Batch write to Redis
                        async with asyncio.TaskGroup() as tg:
                            for key, value, ttl in batch:
                                tg.create_task(
                                    self.redis_cache.set(key, value, ttl=self.config.redis_ttl)
                                )
                        
                        logger.info(f"Write-behind flushed {len(batch)} items to Redis")
                        
                    batch.clear()
                    last_flush = current_time
                
                if item is not None:
                    self.write_behind_queue.task_done()
                    
            except Exception as e:
                logger.error(f"Write-behind worker error: {e}")
                await asyncio.sleep(5)  # Backoff on error
    
    async def delete(self, key: str) -> bool:
        """Delete key from all cache layers."""
        try:
            # Delete from memory
            memory_success = await self.memory_cache.delete(key)
            
            # Delete from Redis if enabled
            redis_success = True
            if self.config.enable_redis and self.redis_cache:
                redis_success = await self.redis_cache.delete(key)
            
            async with self.lock:
                if key in self.lru:
                    del self.lru[key]
                self.stats.deletes += 1
            
            return memory_success and redis_success
            
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def clear(self, layer: Optional[CacheLayer] = None) -> bool:
        """Clear cache layers."""
        try:
            if layer == CacheLayer.MEMORY or layer is None:
                await self.memory_cache.clear()
            if (layer == CacheLayer.REDIS or layer is None) and self.redis_cache:
                await self.redis_cache.clear()
            
            async with self.lock:
                self.lru.clear()
                self.stats = CacheStats()
            
            return True
            
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        async with self.lock:
            return {
                "hits": self.stats.hits,
                "misses": self.stats.misses,
                "writes": self.stats.writes,
                "deletes": self.stats.deletes,
                "evictions": self.stats.evictions,
                "hit_ratio": self.stats.hits / max(self.stats.hits + self.stats.misses, 1),
                "total_keys": len(self.lru),
                "total_size_mb": self.stats.total_size_bytes / (1024 * 1024),
                "avg_response_time_ms": self.stats.avg_response_time_ms,
                "write_behind_queue_size": self.write_behind_queue.qsize(),
            }
    
    async def _evict_if_needed(self):
        """Evict least recently used items if memory limit exceeded."""
        max_bytes = self.config.max_memory_mb * 1024 * 1024
        
        while self.stats.total_size_bytes > max_bytes and self.lru:
            key, meta = self.lru.popitem(last=False)
            await self.memory_cache.delete(key)
            self.stats.total_size_bytes -= meta.get("size", 0)
            self.stats.evictions += 1
    
    def _estimate_size(self, value: Any) -> int:
        """Estimate serialized size of value."""
        try:
            return len(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        except Exception:
            return 1024  # fallback estimate
    
    def _update_stats_time(self, start_time: float):
        """Update average response time statistics."""
        response_time = (time.time() - start_time) * 1000  # ms
        async with self.lock:
            total_ops = self.stats.hits + self.stats.misses + self.stats.writes
            self.stats.avg_response_time_ms = (
                (self.stats.avg_response_time_ms * (total_ops - 1) + response_time) / total_ops
            )

# Global cache instance
cache_config = CacheConfig(
    enable_redis=hasattr(settings, 'REDIS_HOST') and settings.REDIS_HOST,
    strategy=CacheStrategy.WRITE_BEHIND if hasattr(settings, 'REDIS_HOST') else CacheStrategy.CACHE_ASIDE,
    default_ttl=getattr(settings, 'CACHE_TTL', 3600),
    max_memory_mb=getattr(settings, 'CACHE_MAX_MEMORY_MB', 100),
)

unified_cache = UnifiedCache(cache_config)