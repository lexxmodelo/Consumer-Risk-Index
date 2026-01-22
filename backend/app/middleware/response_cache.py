"""
Response-level caching middleware for FastAPI.
Caches entire HTTP responses to improve performance for frequently accessed endpoints.
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable, Any
from fastapi import Request, Response
from fastapi.middleware import Middleware
from starlette.types import ASGIApp
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.caching.memory_cache import cache_store

class ResponseCacheMiddleware(BaseHTTPMiddleware):
    """
    Middleware that caches entire HTTP responses for specific endpoints.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        cache_ttl: int = 300,  # 5 minutes default
        cacheable_paths: Optional[Dict[str, int]] = None
    ):
        super().__init__(app)
        self.cache_ttl = cache_ttl
        self.cacheable_paths = cacheable_paths or {
            "/api/economic-data": 60,      # 1 minute for economic data
            "/api/risk-timeline": 120,      # 2 minutes for risk timeline
            "/api/risk-assessment": 120,    # 2 minutes for risk assessment
            "/api/risk-classification": 120 # 2 minutes for risk classification
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only cache GET requests to specified paths
        if request.method != "GET" or request.url.path not in self.cacheable_paths:
            return await call_next(request)
        
        # Generate cache key based on request path and query parameters
        cache_key = self._generate_cache_key(request)
        
        # Try to get cached response
        cached_response = await cache_store.get(cache_key)
        if cached_response is not None:
            # Return cached response
            return self._build_cached_response(cached_response)
        
        # Process request and cache the response
        response = await call_next(request)
        
        # Only cache successful responses
        if response.status_code == 200:
            # We need to read the response body to cache it
            # This consumes the iterator, so we need to reconstruct the response
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk
            
            # Cache the response
            await self._cache_response_data(cache_key, response, response_body, request.url.path)
            
            # Reconstruct response for the client
            # Remove Content-Length as it will be recalculated
            headers = dict(response.headers)
            if "content-length" in headers:
                del headers["content-length"]
                
            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=headers,
                media_type=response.media_type
            )
        
        return response
    
    def _generate_cache_key(self, request: Request) -> str:
        """Generate unique cache key based on request path and query params."""
        key_data = f"{request.url.path}:{str(request.query_params)}"
        return f"response_cache:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    async def _cache_response_data(self, cache_key: str, response: Response, body: bytes, path: str) -> None:
        """Cache the response with appropriate TTL."""
        # Get TTL for this specific path
        ttl = self.cacheable_paths.get(path, self.cache_ttl)
        
        # Store in cache
        cache_data = {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": body.decode(),
            "cached_at": datetime.now().isoformat()
        }
        
        await cache_store.set(cache_key, cache_data, ttl=ttl)
    
    def _build_cached_response(self, cached_data: Dict[str, Any]) -> Response:
        """Build a Response object from cached data."""
        # Create response with cached body
        response = Response(
            content=cached_data["body"],
            status_code=cached_data["status_code"]
        )
        
        # Add original headers
        for key, value in cached_data["headers"].items():
            if key.lower() not in ["content-length", "content-encoding"]:
                response.headers[key] = value
        
        # Add cache headers
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Cached-At"] = cached_data["cached_at"]
        
        return response

def get_response_cache_middleware() -> Middleware:
    """Factory function to create response cache middleware."""
    return Middleware(ResponseCacheMiddleware)