import os
import json
import asyncio
import logging
import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import text
import aiofiles
from app.config import settings
from app.caching.memory_cache import cache_store, DEFAULT_TTL

# Try to import database components, but don't fail if they are missing
# to ensure the class is instantiable without DB dependencies if needed
try:
    from app.database import AsyncSessionLocal, engine
    from app.models import EconomicIndicator
    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False
    AsyncSessionLocal = None
    EconomicIndicator = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseService:
    """
    Abstracts database operations with intelligent fallback mechanisms.
    Hierarchy: PostgreSQL -> File Storage -> Mock Data.
    """

    def __init__(self):
        self.use_database = bool(settings.USE_DATABASE)
        # Resolve data directory relative to this file: ../cache
        self.data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cache"))
        self._ensure_data_dir()
        
        self._db_available: Optional[bool] = None
        self._last_health_check: float = 0
        self._health_check_interval: int = 60  # seconds
        
        # Connection cache/pool is handled by SQLAlchemy engine in database.py

    def _get_cache_key(self, series_id: str, start_date: str) -> str:
        """Generate cache key for series data."""
        return f"db_service:{series_id}:{start_date}"

    def _ensure_data_dir(self):
        """Ensure the data directory exists."""
        try:
            os.makedirs(self.data_dir, exist_ok=True)
        except Exception as e:
            logger.error(f"Failed to create data directory at {self.data_dir}: {e}")

    async def is_database_available(self) -> bool:
        """
        Check if the database is available with proper timeouts and caching.
        Returns False immediately if disabled in settings.
        """
        # 1. Config Short-circuit
        if not self.use_database:
            return False
            
        if not HAS_SQLALCHEMY or AsyncSessionLocal is None:
            return False

        # 2. Check Shared Memory Cache
        # Use a specific key for database availability
        cache_key = "system:db_availability"
        cached_status = await cache_store.get(cache_key)
        
        if cached_status is not None:
            # Update instance variable for sync access if needed later
            self._db_available = cached_status
            return cached_status

        # 3. Perform Actual Check with Timeout
        now = datetime.now().timestamp()
        is_available = False
        
        try:
            # Use a short timeout (2.0 seconds) to fail fast
            await asyncio.wait_for(
                self._execute_health_check(),
                timeout=2.0
            )
            
            is_available = True
            # Cache success for longer (60s)
            ttl = 60
            
        except (asyncio.TimeoutError, Exception) as e:
            # Log only if status changed or it's been a while to avoid log spam
            if self._db_available is not False:
                logger.warning(f"Database health check failed: {str(e)}")
            
            is_available = False
            # Cache failure for shorter time (30s) to allow recovery detection
            ttl = 30
            
        # Update instance state
        self._db_available = is_available
        self._last_health_check = now
        
        # Update shared cache
        await cache_store.set(cache_key, is_available, ttl=ttl)
        
        return is_available

    async def _execute_health_check(self):
        """Execute the actual database health check query."""
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))

    async def get_series_data(self, series_id: str, start_date: str = "2000-01-01", allow_mock: bool = True) -> List[Dict[str, Any]]:
        """
        Fetch economic indicator data with cache-first strategy.
        Tries: Memory Cache -> DB -> File -> Mock (if allow_mock is True).
        """
        # 0. Check Memory Cache First
        cache_key = self._get_cache_key(series_id, start_date)
        cached_data = await cache_store.get(cache_key)
        if cached_data is not None:
            logger.info(f"Retrieved {len(cached_data)} records for {series_id} from Memory Cache")
            return cached_data
        
        data = []
        
        # 1. Try Database
        if await self.is_database_available():
            try:
                data = await self._get_from_db(series_id, start_date)
                if data:
                    logger.info(f"Retrieved {len(data)} records for {series_id} from Database")
                    normalized_data = self._normalize_data(data, series_id)
                    # Cache to memory for future requests
                    await cache_store.set(cache_key, normalized_data, ttl=DEFAULT_TTL)
                    # Auto-save to file cache for persistence
                    try:
                        await self._save_to_file(series_id, normalized_data)
                    except Exception as e:
                        logger.warning(f"Failed to cache {series_id} to file: {e}")
                    return normalized_data
            except Exception as e:
                logger.error(f"Database read error for {series_id}: {e}")
                # Fallthrough to file

        # 2. Try File Storage
        try:
            data = await self._get_from_file(series_id, start_date)
            if data:
                logger.info(f"Retrieved {len(data)} records for {series_id} from File Storage")
                normalized_data = self._normalize_data(data, series_id)
                # Cache to memory for future requests
                await cache_store.set(cache_key, normalized_data, ttl=DEFAULT_TTL)
                return normalized_data
        except Exception as e:
            logger.error(f"File storage read error for {series_id}: {e}")

        # 3. Fallback to Mock Data
        if allow_mock:
            logger.warning(f"Using mock data for {series_id}")
            mock_data = self.get_mock_data(series_id, start_date)
            # Cache mock data to avoid repeated generation
            await cache_store.set(cache_key, mock_data, ttl=3600)  # 1 hour TTL for mock data
            return mock_data
            
        return []

    def get_mock_data(self, series_id: str, start_date: str) -> List[Dict[str, Any]]:
        """Public alias for internal mock generation."""
        return self._generate_mock_data(series_id, start_date)

    async def save_series_data(self, series_id: str, data: List[Dict[str, Any]]) -> bool:
        """
        Persist data with deduplication.
        Saves to DB (if available) AND File Storage (backup).
        """
        success = False
        
        # Validate data
        if not data:
            return False
            
        # 1. Save to Database
        if await self.is_database_available():
            try:
                await self._save_to_db(series_id, data)
                success = True
            except Exception as e:
                logger.error(f"Database write error for {series_id}: {e}")
        
        # 2. Save to File Storage (Always try to save to file as backup)
        try:
            await self._save_to_file(series_id, data)
            # If DB failed but file succeeded, we consider it a partial success (data is safe)
            if not success:
                success = True
        except Exception as e:
            logger.error(f"File storage write error for {series_id}: {e}")
            
        return success

    async def get_multiple_series(self, series_ids: List[str], start_date: str = "2000-01-01", allow_mock: bool = True) -> Dict[str, List[Dict[str, Any]]]:
        """
        Batch fetch multiple series.
        """
        results = {}
        
        db_available = await self.is_database_available()
        
        if db_available:
            try:
                # Try batch DB fetch
                async with AsyncSessionLocal() as session:
                    sd = datetime.strptime(start_date, "%Y-%m-%d").date()
                    stmt = select(EconomicIndicator).where(
                        EconomicIndicator.series_id.in_(series_ids),
                        EconomicIndicator.date >= sd
                    ).order_by(EconomicIndicator.date)
                    result = await session.execute(stmt)
                    rows = result.scalars().all()
                    
                    # Group by series_id
                    for row in rows:
                        sid = row.series_id
                        if sid not in results:
                            results[sid] = []
                        results[sid].append(row.to_dict())
                    
                    # Normalize results
                    for sid in results:
                        results[sid] = self._normalize_data(results[sid], sid)

            except Exception as e:
                logger.error(f"Batch DB fetch failed: {e}")
                # Fallback to individual fetches (which will fallback to file/mock)
                db_available = False # trigger fallback logic below

        # Fill in missing series from File/Mock
        for sid in series_ids:
            if sid not in results or not results[sid]:
                # Try File first (via get_series_data with mock=False)
                # If that fails, we only mock if allow_mock is True
                data = await self.get_series_data(sid, start_date, allow_mock=allow_mock)
                results[sid] = data
                
        return results

    # --- Internal DB Methods ---

    async def _get_from_db(self, series_id: str, start_date: str) -> List[Dict[str, Any]]:
        # Additional safety check - skip if database is not available
        if not await self.is_database_available():
            return []
            
        async with AsyncSessionLocal() as session:
            sd = datetime.strptime(start_date, "%Y-%m-%d").date()
            stmt = select(EconomicIndicator).where(
                EconomicIndicator.series_id == series_id,
                EconomicIndicator.date >= sd
            ).order_by(EconomicIndicator.date)
            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [row.to_dict() for row in rows]

    async def _save_to_db(self, series_id: str, data: List[Dict[str, Any]]) -> None:
        if not data:
            return
            
        # Additional safety check - skip if database is not available
        if not await self.is_database_available():
            return
            
        async with AsyncSessionLocal() as session:
            # Prepare payload
            payload = []
            for item in data:
                # Ensure date is a date object
                d = item["date"]
                if isinstance(d, str):
                    d = datetime.strptime(d, "%Y-%m-%d").date()
                
                payload.append({
                    "series_id": series_id,
                    "date": d,
                    "value": item["value"],
                    "indicator_name": item.get("indicator_name", series_id)
                })
            
            # Upsert (PostgreSQL specific)
            stmt = insert(EconomicIndicator.__table__).values(payload)
            stmt = stmt.on_conflict_do_update(
                constraint='uix_series_date',
                set_={"value": stmt.excluded.value, "indicator_name": stmt.excluded.indicator_name}
            )
            await session.execute(stmt)
            await session.commit()

    # --- Internal File Methods ---

    def _get_file_path(self, series_id: str) -> str:
        return os.path.join(self.data_dir, f"{series_id.lower()}.json")

    async def _get_from_file(self, series_id: str, start_date: str) -> List[Dict[str, Any]]:
        file_path = self._get_file_path(series_id)
        
        if not os.path.exists(file_path):
            return []

        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                data = json.loads(content)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return []
        
        if not data:
            return []

        # Deduplicate by Year-Month to ensure monthly consistency
        # Keeps the latest date for each month (handling weekly vs monthly mix)
        monthly_map = {}
        for item in data:
            try:
                # specific fix for weekly consumer credit data
                # if we have both 01 (monthly) and other dates, prefer 01?
                # Actually, simply taking the last one is a reasonable default for "latest info"
                d_str = item.get("date")
                if not d_str: continue
                
                # Check if it's a valid date string
                d = datetime.strptime(d_str, "%Y-%m-%d")
                key = f"{d.year}-{d.month}"
                
                current = monthly_map.get(key)
                if not current:
                    monthly_map[key] = item
                else:
                    # If we already have a value, check dates
                    # If existing is '01' (start of month) and new is later, 
                    # we might want to keep '01' if we prefer canonical monthly?
                    # But the user says DB is End-Of-Month.
                    # Let's just keep the LATEST date in the month to be safe/consistent.
                    curr_d = datetime.strptime(current["date"], "%Y-%m-%d")
                    if d > curr_d:
                        monthly_map[key] = item
            except Exception:
                continue
        
        data = sorted(monthly_map.values(), key=lambda x: x["date"])

        # Filter by date
        filtered = []
        sd = datetime.strptime(start_date, "%Y-%m-%d").date()
        for item in data:
            try:
                item_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                if item_date >= sd:
                    filtered.append(item)
            except (ValueError, KeyError):
                continue
                
        return filtered

    async def _save_to_file(self, series_id: str, new_data: List[Dict[str, Any]]) -> None:
        file_path = self._get_file_path(series_id)
        
        existing_data = {}
        # Read existing data if file exists
        if os.path.exists(file_path):
            try:
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    old_list = json.loads(content)
                    for item in old_list:
                        existing_data[item['date']] = item
            except (FileNotFoundError, json.JSONDecodeError):
                # Corrupt file or other error, start fresh
                pass
            except Exception as e:
                logger.error(f"Error reading existing file {file_path}: {e}")
                # Start fresh on error
                pass

        # Merge new data
        for item in new_data:
            existing_data[item['date']] = item

        # Convert back to list and sort
        final_list = sorted(existing_data.values(), key=lambda x: x['date'])
        
        try:
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(final_list, indent=2))
        except Exception as e:
            logger.error(f"Error writing to file {file_path}: {e}")

    # --- Data Normalization ---

    def _normalize_data(self, data: List[Dict[str, Any]], series_id: str) -> List[Dict[str, Any]]:
        """
        Normalize data to ensure consistency across sources (DB, File, Mock).
        Ensures consistent keys, value types, and formatting.
        """
        indicator_names = {
            "UNRATE": "Unemployment Rate",
            "CPIAUCSL": "CPI (Consumer Price Index)",
            "FEDFUNDS": "Federal Funds Rate",
            "RSAFS": "Retail Sales",
            "CCLACBW027SBOG": "Consumer Credit"
        }
        
        normalized = []
        for item in data:
            # Handle date format
            d = item.get("date")
            if hasattr(d, "strftime"):
                date_str = d.strftime("%Y-%m-%d")
            else:
                date_str = str(d)
                
            # Handle value (ensure float)
            try:
                val = float(item.get("value", 0.0))
            except (ValueError, TypeError):
                val = 0.0
                
            # Handle indicator name
            name = item.get("indicator_name")
            if not name or name == series_id:
                name = indicator_names.get(series_id, series_id)
                
            normalized.append({
                "date": date_str,
                "value": val,
                "series_id": series_id,
                "indicator_name": name
            })
            
        return normalized

    # --- Mock Data Generation ---

    def _generate_mock_data(self, series_id: str, start_date: str) -> List[Dict[str, Any]]:
        """
        Generate realistic mock data based on series type.
        Simulates business cycles, trends, and seasonality.
        """
        indicator_names = {
            "UNRATE": "Unemployment Rate",
            "CPIAUCSL": "CPI (Consumer Price Index)",
            "FEDFUNDS": "Federal Funds Rate",
            "RSAFS": "Retail Sales",
            "CCLACBW027SBOG": "Consumer Credit"
        }
        
        # Configuration for simulation
        config = {
            "UNRATE": {
                "base": 4.0,
                "trend": 0.0,
                "cycle_amp": 2.0,  # Amplitude of business cycle
                "cycle_period_months": 84, # ~7 years
                "seasonality": 0.2,
                "noise": 0.1,
                "min": 2.5
            },
            "CPIAUCSL": {
                "base": 168.0, # Approx CPI in year 2000
                "trend": 0.002, # ~2.4% annual inflation baseline
                "cycle_amp": 0.0,
                "cycle_period_months": 120,
                "seasonality": 0.0,
                "noise": 0.002,
                "exponential": True # CPI grows exponentially
            },
            "FEDFUNDS": {
                "base": 5.5,
                "trend": -0.005, # Secular decline in rates
                "cycle_amp": 2.5,
                "cycle_period_months": 72,
                "seasonality": 0.0,
                "noise": 0.1,
                "min": 0.0,
                "lag_months": 12 # Lags business cycle
            },
            "RSAFS": {
                "base": 260000.0, # Approx Retail Sales in year 2000
                "trend": 0.003, # ~3.6% annual growth
                "cycle_amp": 0.05, # % deviation from trend
                "cycle_period_months": 60,
                "seasonality": 0.15, # Strong seasonality
                "noise": 0.01, # % noise
                "exponential": True
            },
            "CCLACBW027SBOG": {
                "base": 220.0, # Consumer Credit
                "trend": 0.005, # Growth
                "cycle_amp": 0.02,
                "cycle_period_months": 96,
                "seasonality": 0.02,
                "noise": 0.01,
                "exponential": True
            }
        }
        
        cfg = config.get(series_id, {
            "base": 100.0, "trend": 0.0, "cycle_amp": 10.0, 
            "cycle_period_months": 60, "seasonality": 0.0, "noise": 1.0
        })

        data = []
        try:
            current_date = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            current_date = datetime(2000, 1, 1)
            
        # Ensure we start from year 2000 if requested date is earlier, 
        # to align with typical mock expectations, or use requested date
        sim_start_date = datetime(2000, 1, 1)
        if current_date < sim_start_date:
            current_date = sim_start_date
            
        end_date = datetime.now()
        
        # Simulation state
        months_passed = 0
        
        # Adjust base for start date if exponential
        # (This is a simplified adjustment to prevent jumps if start_date changes)
        
        while current_date <= end_date:
            # 1. Trend Component
            if cfg.get("exponential"):
                trend_val = cfg["base"] * ((1 + cfg["trend"]) ** months_passed)
            else:
                trend_val = cfg["base"] + (cfg["trend"] * months_passed)
                
            # 2. Cyclical Component (Sine wave)
            # Offset cycles for different indicators to mimic economic relationships
            phase_shift = 0
            if series_id == "UNRATE": phase_shift = math.pi # Counter-cyclical
            if series_id == "FEDFUNDS": phase_shift = -1.0 # Lags
            
            cycle_val = math.sin((months_passed / cfg["cycle_period_months"]) * 2 * math.pi + phase_shift)
            
            if cfg.get("exponential"):
                cycle_component = 1 + (cycle_val * cfg["cycle_amp"])
            else:
                cycle_component = cycle_val * cfg["cycle_amp"]
                
            # 3. Seasonality (Monthly)
            month_idx = current_date.month - 1
            seasonal_factor = 0.0
            if cfg["seasonality"] > 0:
                # Simple seasonal pattern: High in Dec, Low in Jan/Feb
                seasonal_pattern = [
                    -0.8, -0.9, -0.2, 0.1, 0.3, 0.2, 
                    0.1, 0.5, -0.2, 0.1, 0.8, 1.0
                ]
                seasonal_factor = seasonal_pattern[month_idx] * cfg["seasonality"]
            
            # 4. Noise
            noise = random.gauss(0, cfg["noise"])
            
            # Combine
            if cfg.get("exponential"):
                val = trend_val * cycle_component * (1 + seasonal_factor) * (1 + noise)
            else:
                val = trend_val + cycle_component + seasonal_factor + noise
                
            # Constraints
            if "min" in cfg and val < cfg["min"]:
                val = cfg["min"]
                
            # Add specific recent history events (Shock)
            # COVID Shock (Early 2020)
            if 2020 <= current_date.year <= 2021:
                if series_id == "UNRATE": val += 8.0 * math.exp(-(months_passed - 243)**2 / 10) # Spike
                if series_id == "RSAFS": val -= val * 0.15 * math.exp(-(months_passed - 243)**2 / 5) # Drop
            
            # Inflation Spike (2021-2022)
            if series_id == "CPIAUCSL" and 2021 <= current_date.year <= 2022:
                val *= 1.05 # Accelerated inflation
                
            data.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "series_id": series_id,
                "value": round(val, 2),
                "indicator_name": indicator_names.get(series_id, series_id)
            })
            
            # Advance one month
            year = current_date.year + (current_date.month // 12)
            month = (current_date.month % 12) + 1
            current_date = current_date.replace(year=year, month=month)
            months_passed += 1
            
        return data

