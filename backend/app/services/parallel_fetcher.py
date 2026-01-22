import os
import asyncio
from typing import List, Dict, Any, Tuple
import aiohttp
from datetime import datetime, timedelta

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

class FredParallelFetcher:
    def __init__(self, rate_delay_ms: int = 100, timeout_s: int = 20):
        self.rate_delay_ms = rate_delay_ms
        self.timeout_s = timeout_s
        self.api_key = os.getenv("FRED_API_KEY", "")

    async def _fetch_one(self, session: aiohttp.ClientSession, series_id: str, start_date: str) -> Tuple[str, List[Dict[str, Any]]]:
        await asyncio.sleep(self.rate_delay_ms / 1000.0)
        params = {
            "series_id": series_id,
            "observation_start": start_date,
            "api_key": self.api_key,
            "file_type": "json",
            "frequency": "m",
        }
        try:
            async with session.get(FRED_BASE, params=params, timeout=self.timeout_s) as resp:
                if resp.status != 200:
                    return (series_id, [])
                data = await resp.json()
                observations = data.get("observations", [])
                records: List[Dict[str, Any]] = []
                # Map series_id to indicator_name consistent with FredService
                indicator_name = self._get_indicator_name(series_id)
                for obs in observations:
                    try:
                        date_str = obs.get("date")
                        val_str = obs.get("value")
                        if val_str in (None, ".", ""):
                            continue
                        value = float(val_str)
                    except Exception:
                        continue
                    records.append({
                        "date": date_str,
                        "indicator_name": indicator_name,
                        "value": value,
                        "series_id": series_id
                    })
                return (series_id, records)
        except Exception:
            return (series_id, [])

    async def fetch_series_batch(self, series_ids: List[str], start_date: str) -> Dict[str, List[Dict[str, Any]]]:
        if not start_date:
            start_date = "2000-01-01"
        connector = aiohttp.TCPConnector(limit=len(series_ids))
        async with aiohttp.ClientSession(connector=connector) as session:
            tasks = [self._fetch_one(session, sid, start_date) for sid in series_ids]
            results = await asyncio.gather(*tasks, return_exceptions=False)
        return {sid: recs for sid, recs in results}

    def _get_indicator_name(self, series_id: str) -> str:
        mapping = {
            "UNRATE": "Unemployment Rate",
            "CPIAUCSL": "CPI (Consumer Price Index)",
            "FEDFUNDS": "Federal Funds Rate",
            "RSAFS": "Retail Sales",
            "CCLACBW027SBOG": "Consumer Credit"
        }
        return mapping.get(series_id, series_id)
