import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.caching.memory_cache import cache_store
from app.caching.key_builders import fred_batch_key
from app.services.parallel_fetcher import FredParallelFetcher
from app.database import AsyncSessionLocal
import logging
from datetime import datetime

SERIES_IDS = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]

class CacheWarmupService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.parallel = FredParallelFetcher()
        self.refresh_lock = asyncio.Lock()
        self.refresh_in_progress = False
        self.last_refresh: Dict[str, Optional[str]] = {sid: None for sid in SERIES_IDS}
        self.last_run_time: Optional[str] = None
        self.last_error: Optional[str] = None
        self.last_error_at: Optional[str] = None
        self.logger = logging.getLogger(__name__)

    def start(self):
        self.scheduler.start()
        for h in [0, 6, 12, 18]:
            self.scheduler.add_job(self.refresh_all, CronTrigger(hour=h, minute=0))
        self.scheduler.add_job(self._hourly_check, CronTrigger(minute=0))

    async def startup_warmup(self):
        await self.refresh_all()

    async def refresh_all(self):
        if self.refresh_in_progress:
            return
        async with self.refresh_lock:
            self.refresh_in_progress = True
            try:
                start_date_default = "2000-01-01"
                batch_key = fred_batch_key(SERIES_IDS, start_date_default)
                cached = await cache_store.get(batch_key) or {}
                grouped = await self.parallel.fetch_series_batch(SERIES_IDS, start_date_default)
                merged: Dict[str, List[Dict]] = {}
                for sid in SERIES_IDS:
                    existing = cached.get(sid, [])
                    existing_dates = set([r["date"] for r in existing])
                    new_records = [r for r in grouped.get(sid, []) if r.get("date") not in existing_dates]
                    merged[sid] = existing + new_records
                    self.last_refresh[sid] = datetime.now().isoformat()
                await cache_store.set(batch_key, merged)
                self.last_run_time = datetime.now().isoformat()
                self.last_error = None
                self.last_error_at = None
            except Exception as e:
                self.last_error = str(e)
                self.last_error_at = datetime.now().isoformat()
                try:
                    self.logger.error(str(e))
                except Exception:
                    pass
            finally:
                self.refresh_in_progress = False

    async def refresh_if_stale(self, stale_hours: int = 6):
        start_date_default = "2000-01-01"
        batch_key = fred_batch_key(SERIES_IDS, start_date_default)
        cached = await cache_store.get(batch_key) or {}
        stale: List[str] = []
        for sid in SERIES_IDS:
            arr = cached.get(sid, [])
            if not arr:
                stale.append(sid)
                continue
            last_date = arr[-1]["date"]
            try:
                dt = datetime.strptime(last_date, "%Y-%m-%d")
            except Exception:
                dt = datetime.now() - timedelta(days=365)
            if (datetime.now() - dt).total_seconds() > stale_hours * 3600:
                stale.append(sid)
        if stale:
            await self.refresh_all()

    async def _hourly_check(self):
        await self.refresh_if_stale(6)

    def health(self):
        jobs = self.scheduler.get_jobs()
        next_runs = [j.next_run_time.isoformat() if j.next_run_time else None for j in jobs]
        stale_count = sum(1 for v in self.last_refresh.values() if v is None)
        return {
            "last_refresh": self.last_refresh,
            "next_scheduled_runs": next_runs,
            "stale_series_count": stale_count,
            "refresh_in_progress": self.refresh_in_progress,
            "last_run_time": self.last_run_time,
            "last_error": self.last_error,
            "last_error_at": self.last_error_at
        }
