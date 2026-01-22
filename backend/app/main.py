from fastapi import FastAPI, Depends, Response, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.response_cache import ResponseCacheMiddleware
from app.middleware.timing_middleware import TimingMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.fred_service import FredService
from app.utils.json_optimizer import OptimizedJSONEncoder
from app.services.database_service import DatabaseService
from app.database import engine, Base, get_db
from app.config import settings
import os
from datetime import datetime
from app.caching import get_stats, clear_cache
from app.services.cache_warmup import CacheWarmupService
import secrets
from typing import Dict, Optional, Any, List
import logging

app = FastAPI(title="Consumer Risk Index API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add response caching middleware
app.add_middleware(ResponseCacheMiddleware)

# Add timing middleware for performance monitoring
app.add_middleware(TimingMiddleware)

fred_service = FredService()
db_service = DatabaseService()
warmup_service = CacheWarmupService()
ADMIN_TOKEN = settings.ADMIN_API_TOKEN
_rate_window: Dict[str, list] = {}
logger = logging.getLogger(__name__)

if "*" in settings.CORS_ORIGINS:
    logger.warning("CORS_ORIGINS is permissive ('*'); consider restricting in production.")

async def verify_admin(request: Request):
    token = request.headers.get("X-Admin-Token")
    if not token or not ADMIN_TOKEN or not secrets.compare_digest(token, ADMIN_TOKEN):
        raise HTTPException(status_code=403, detail="Admin access required")
    now = datetime.now().timestamp()
    arr = _rate_window.get(token, [])
    arr = [t for t in arr if now - t < 60]
    if len(arr) >= 5:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    arr.append(now)
    _rate_window[token] = arr

@app.on_event("startup")
async def startup():
    if settings.USE_DATABASE and engine:
        # Log DB connection info (masked)
        db_url = settings.DATABASE_URL
        masked_url = db_url
        if "@" in db_url:
            prefix = db_url.split("@")[0]
            masked_url = f"{prefix.split('//')[0]}//****:****@{db_url.split('@')[1]}"
        
        logger.info(f"Connecting to database at: {masked_url}")
        
        try:
            logger.info("Attempting to initialize database tables...")
            async with engine.begin() as conn:
                # In production, use Alembic for migrations
                # For MVP, create tables if they don't exist
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables initialized successfully.")
        except Exception as e:
            logger.error(f"Database connection failed at startup: {e}")
            logger.error(f"Please check your DATABASE_URL and ensure the database server is reachable.")
    else:
        logger.info(f"Database disabled via configuration. USE_DATABASE={settings.USE_DATABASE}")
        
    warmup_service.start()
    import asyncio
    asyncio.create_task(warmup_service.startup_warmup())

@app.get("/")
async def root():
    return {"message": "Consumer Risk Index API is running"}

@app.get("/api/health")
async def health_check():
    """Health check with component status"""
    db_available = await db_service.is_database_available()
    db_status = "disabled"
    if settings.USE_DATABASE:
        db_status = "connected" if db_available else "disconnected"
    
    return {
        "status": "ok", 
        "components": {
            "database": db_status,
            "cache": "active" if settings.FILE_CACHE_ENABLED else "disabled",
            "api_key_configured": bool(settings.FRED_API_KEY)
        },
        "mode": "normal" if db_available else "fallback"
    }

@app.get("/api/sources")
async def get_sources():
    """Show available data sources"""
    db_available = await db_service.is_database_available()
    return {
        "sources": [
            {"id": "database", "name": "PostgreSQL Database", "available": db_available},
            {"id": "file", "name": "File Storage", "available": settings.FILE_CACHE_ENABLED},
            {"id": "api", "name": "FRED API", "available": bool(settings.FRED_API_KEY)},
            {"id": "mock", "name": "Mock Data Generator", "available": True}
        ],
        "current_priority": ["database", "file", "api", "mock"]
    }

async def build_response(data: Any, source: str = "unknown", error: str = None) -> Dict[str, Any]:
    # Cache database availability check to avoid repeated async calls
    db_available = await db_service.is_database_available()
    return {
        "data": data,
        "metadata": {
            "source": source,
            "timestamp": datetime.now().isoformat(),
            "db_available": db_available
        },
        "error": error
    }

async def build_streaming_response(data: Any, source: str = "unknown") -> StreamingResponse:
    """
    Build a response optimized for large data streaming.
    Uses optimized JSON serialization and avoids repeated database checks.
    """
    # Use cached database availability
    db_available = await db_service.is_database_available()
    
    async def response_generator():
        # Start JSON object
        yield b'{"data":['
        
        # Stream data items
        first = True
        # Handle both list and generator
        iterable = data if isinstance(data, list) else [data]
        if isinstance(data, list):
            for item in data:
                if not first:
                    yield b','
                else:
                    first = False
                # Use optimized encoder
                yield OptimizedJSONEncoder.encode_bytes(item)
        
        # End data array and add metadata
        metadata = {
            "source": source,
            "timestamp": datetime.now().isoformat(),
            "db_available": db_available,
            "streaming": True
        }
        yield b'],"metadata":' + OptimizedJSONEncoder.encode_bytes(metadata) + b'}'

    return StreamingResponse(response_generator(), media_type="application/json")

@app.get("/api/indicators")
async def get_all_indicators(response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    """Get all economic indicators"""
    try:
        data = await fred_service.get_all_indicators(db)
        source = getattr(fred_service, "last_fetch_method", "unknown")
        response.headers["X-Data-Source"] = source
        return await build_response(data, source)
    except Exception as e:
        return await build_response([], error=str(e))

@app.get("/api/indicators/{series_id}")
async def get_indicator(series_id: str, response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    """Get specific indicator data"""
    try:
        data = await fred_service.fetch_series(db, series_id)
        source = getattr(fred_service, "last_fetch_method", "unknown")
        response.headers["X-Data-Source"] = source
        return await build_response(data, source)
    except Exception as e:
        return await build_response([], error=str(e))

@app.get("/api/risk-assessment")
async def get_risk_assessment(response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    """Risk analysis endpoint"""
    try:
        risk = await fred_service.get_risk_classification(db)
        # Risk assessment internally uses fetch_multiple_series, so check source from service
        source = getattr(fred_service, "last_fetch_method", "computed")
        return await build_response(risk, source)
    except Exception as e:
        return await build_response(None, error=str(e))

# Backward compatibility routes
@app.get("/api/economic-data")
async def get_economic_data_legacy(response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    import time
    try:
        start = time.perf_counter()
        data = await fred_service.get_all_indicators(db)
        elapsed = int((time.perf_counter() - start) * 1000)
        last_date = data[-1]["date"] if data else ""
        response.headers["X-Last-Updated"] = datetime.now().isoformat()
        if last_date:
            response.headers["X-Last-Data-Date"] = last_date
        source = getattr(fred_service, "last_fetch_method", "sequential")
        response.headers["X-Fetch-Method"] = source
        response.headers["X-Fetch-Time-ms"] = str(elapsed)
        
        # Use streaming response for large dataset
        return await build_streaming_response(data, source)
    except Exception as e:
        return await build_response([], error=str(e))

@app.get("/api/risk-classification")
async def get_risk_classification_legacy(response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    """Applies risk logic to real data and returns current risk level"""
    return await get_risk_assessment(response, db)
    
@app.get("/api/risk-timeline")
async def get_risk_timeline(response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    try:
        timeline = await fred_service.get_risk_timeline(db)
        last_date = timeline[-1]["date"] if timeline else ""
        response.headers["X-Last-Updated"] = datetime.now().isoformat()
        if last_date:
            response.headers["X-Last-Data-Date"] = last_date
        source = getattr(fred_service, "last_fetch_method", "unknown")
        
        # Use streaming response for large dataset
        return await build_streaming_response(timeline, source)
    except Exception as e:
        return await build_response([], error=str(e))

# Cache management routes
@app.get("/api/cache-stats")
async def cache_stats():
    return get_stats()

@app.post("/api/clear-cache")
async def cache_clear(request: Request):
    await verify_admin(request)
    await clear_cache()
    return {"status": "cleared", "timestamp": datetime.now().isoformat()}

@app.get("/api/cache-health")
async def cache_health():
    return warmup_service.health()

@app.post("/api/refresh-cache")
async def refresh_cache(request: Request):
    await verify_admin(request)
    import asyncio
    asyncio.create_task(warmup_service.refresh_all())
    return {"status": "queued", "timestamp": datetime.now().isoformat()}

@app.get("/api/refresh-status")
async def refresh_status():
    return {"in_progress": warmup_service.refresh_in_progress, "last_run_time": warmup_service.last_run_time}

@app.post("/api/rebuild-file-cache")
async def rebuild_file_cache(request: Request):
    await verify_admin(request)
    series_ids = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]
    counts = await fred_service.rebuild_file_cache(series_ids, "2000-01-01")
    return {"status": "ok", "written_counts": counts, "timestamp": datetime.now().isoformat()}

@app.get("/api/rebuild-file-cache")
async def rebuild_file_cache_get(request: Request):
    await verify_admin(request)
    series_ids = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]
    counts = await fred_service.rebuild_file_cache(series_ids, "2000-01-01")
    return {"status": "ok", "written_counts": counts, "timestamp": datetime.now().isoformat()}

@app.get("/api/data-updates")
async def data_updates(since: str, response: Response, db: Optional[AsyncSession] = Depends(get_db)):
    import time
    start = time.perf_counter()
    db_available = await db_service.is_database_available()
    if not db_available:
        since = "2000-01-01"
    updates = await fred_service.get_data_updates(db, since)
    elapsed = int((time.perf_counter() - start) * 1000)
    
    # Metadata extraction logic
    data_dict = updates.get("data", {})
    latest_dates = [arr[-1]["date"] for arr in data_dict.values() if arr]
    latest_date = max(latest_dates) if latest_dates else ""
    freshness_minutes = 0
    try:
        if latest_date:
            from datetime import datetime as dt
            freshness_minutes = int((dt.now() - dt.strptime(latest_date, "%Y-%m-%d")).total_seconds() / 60)
    except Exception:
        freshness_minutes = 0
        
    response.headers["X-Fetch-Method"] = getattr(fred_service, "last_fetch_method", "sequential")
    response.headers["X-Fetch-Time-ms"] = str(elapsed)
    
    return {
        "data": data_dict,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "freshness_minutes": freshness_minutes,
            "cache_status": "HIT" if fred_service.last_fetch_method in ("memory", "database") else "MISS",
            "next_refresh": warmup_service.health().get("next_scheduled_runs", [None])[0],
            "source": getattr(fred_service, "last_fetch_method", "unknown"),
            "db_available": db_available
        }
    }

@app.get("/debug-token")
async def debug_token(request: Request):
    return {
        "has_token_header": "X-Admin-Token" in request.headers,
        "header_value": request.headers.get("X-Admin-Token"),
        "expected_token": ADMIN_TOKEN,
        "token_match": secrets.compare_digest(
            request.headers.get("X-Admin-Token", ""), 
            ADMIN_TOKEN
        ) if ADMIN_TOKEN else False
    }
