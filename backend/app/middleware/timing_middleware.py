"""
Timing middleware for comprehensive performance monitoring.
"""
import time
from typing import Dict, Callable
from fastapi import Request
from fastapi.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging

logger = logging.getLogger(__name__)

class TimingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs detailed timing information for requests.
    """
    
    def __init__(self, app, sample_rate: float = 1.0):
        super().__init__(app)
        self.sample_rate = sample_rate
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip timing for some requests based on sample rate
        if self.sample_rate < 1.0 and hash(request.url.path) % 100 >= self.sample_rate * 100:
            return await call_next(request)
        
        timing_data = {
            "request_received": time.perf_counter(),
            "stages": {},
            "total_time": 0
        }
        
        # Time the entire request
        try:
            start_time = time.perf_counter()
            response = await call_next(request)
            end_time = time.perf_counter()
            
            timing_data["total_time"] = (end_time - start_time) * 1000  # ms
            timing_data["status_code"] = response.status_code
            timing_data["path"] = request.url.path
            timing_data["method"] = request.method
            
            # Log timing information
            self._log_timing(timing_data)
            
            # Add timing headers for client-side monitoring
            response.headers["X-Request-Time"] = f"{timing_data['total_time']:.2f}ms"
            
            return response
            
        except Exception as e:
            end_time = time.perf_counter()
            timing_data["total_time"] = (end_time - start_time) * 1000
            timing_data["error"] = str(e)
            timing_data["status_code"] = 500
            
            self._log_timing(timing_data)
            raise
    
    def _log_timing(self, timing_data: Dict) -> None:
        """Log timing information with appropriate level."""
        total_time = timing_data["total_time"]
        path = timing_data["path"]
        status = timing_data["status_code"]
        
        if total_time > 1000:  # > 1 second
            logger.warning(
                f"SLOW_REQUEST: {timing_data['method']} {path} - "
                f"{total_time:.2f}ms - Status: {status}"
            )
        elif total_time > 300:  # > 300ms
            logger.info(
                f"REQUEST_TIMING: {timing_data['method']} {path} - "
                f"{total_time:.2f}ms - Status: {status}"
            )
        else:
            logger.debug(
                f"REQUEST_TIMING: {timing_data['method']} {path} - "
                f"{total_time:.2f}ms - Status: {status}"
            )

def get_timing_middleware() -> Middleware:
    """Factory function to create timing middleware."""
    return Middleware(TimingMiddleware, sample_rate=0.1)  # Sample 10% of requests