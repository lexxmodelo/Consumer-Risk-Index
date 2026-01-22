import os
import math
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert
from app.models import EconomicIndicator
from fredapi import Fred
from app.services.parallel_fetcher import FredParallelFetcher
from app.services.database_service import DatabaseService
import logging
logger = logging.getLogger(__name__)

class FredService:
    BASE_URL = "https://api.stlouisfed.org/fred/series/observations"
    
    def __init__(self):
        self.api_key = os.getenv("FRED_API_KEY")
        self.fred: Optional[Fred] = None
        self.parallel = FredParallelFetcher()
        self.last_fetch_method: str = "sequential"
        self.db_service = DatabaseService()
        
        try:
            if self.api_key:
                self.fred = Fred(api_key=self.api_key)
                try:
                    self.parallel.api_key = self.api_key
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"Error initializing fredapi: {e}")
        
    async def fetch_series(self, session: Optional[AsyncSession], series_id: str, start_date: str = None) -> List[Dict[str, Any]]:
        """
        Fetch series data with fallback hierarchy:
        1. Database (via DatabaseService)
        2. File Storage (via DatabaseService)
        3. FRED API
        4. Mock Data (via DatabaseService)
        """
        if not start_date:
            start_date = "2000-01-01"

        # 1. & 2. Try Database & File Storage first and return immediately if available
        data = await self.db_service.get_series_data(series_id, start_date, allow_mock=False)
        if data:
            self.last_fetch_method = "database_or_file"
            return data

        # 3. Fetch from FRED API
        api_success = False
        formatted_data = []
        
        if self.fred:
            try:
                # Use parallel fetcher for single series as it handles async HTTP
                # Or stick to fredapi (synchronous) wrapped?
                # The existing code used self.fred.get_series (blocking) or parallel.
                # Let's use parallel fetcher which is async
                result = await self.parallel.fetch_series_batch([series_id], start_date)
                formatted_data = result.get(series_id, [])
                
                if formatted_data:
                    api_success = True
                    self.last_fetch_method = "api"
                    
                    # Save to DB and File
                    await self.db_service.save_series_data(series_id, formatted_data)
                    return formatted_data
            except Exception as e:
                logger.error(f"Error fetching {series_id} via API: {e}")

        # 4. Fallback to Mock Data
        self.last_fetch_method = "mock"
        return self.db_service.get_mock_data(series_id, start_date)

    async def fetch_multiple_series(self, session: Optional[AsyncSession], series_ids: List[str], start_date: str = None) -> Dict[str, List[Dict[str, Any]]]:
        if not start_date:
            start_date = "2000-01-01"
            
        # 1. & 2. Try DB/File first
        results = await self.db_service.get_multiple_series(series_ids, start_date, allow_mock=False)
        
        # Check for missing data only (do not block on staleness for historical views)
        missing_ids = []
        for sid in series_ids:
            data = results.get(sid, [])
            if not data:
                missing_ids.append(sid)

        # 3. Fetch missing from API
        if missing_ids:
            try:
                api_data = await self.parallel.fetch_series_batch(missing_ids, start_date)
                self.last_fetch_method = "mixed"
                
                for sid, data in api_data.items():
                    if data:
                        results[sid] = data
                        # Save updates
                        await self.db_service.save_series_data(sid, data)
            except Exception as e:
                logger.error(f"Batch API fetch error: {e}")

        # 4. Fill remaining gaps with Mock
        for sid in series_ids:
            if not results.get(sid):
                results[sid] = self.db_service.get_mock_data(sid, start_date)
                
        return results
    
    async def rebuild_file_cache(self, series_ids: List[str], start_date: str = "2000-01-01") -> Dict[str, int]:
        grouped = await self.parallel.fetch_series_batch(series_ids, start_date)
        counts: Dict[str, int] = {}
        for sid, recs in grouped.items():
            try:
                await self.db_service.save_series_data(sid, recs)
            except Exception as e:
                try:
                    logger.error(f"Save failed for {sid}: {e}")
                except Exception:
                    pass
            counts[sid] = len(recs)
        return counts

    async def get_data_updates(self, session: Optional[AsyncSession], since: str) -> Dict[str, Any]:
        try:
            dt = datetime.strptime(since, "%Y-%m-%dT%H:%M:%S")
        except Exception:
            try:
                dt = datetime.strptime(since, "%Y-%m-%d")
            except Exception:
                dt = datetime.now() - timedelta(days=365)
        start_date = dt.strftime("%Y-%m-%d")
        series_ids = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]
        grouped = await self.fetch_multiple_series(session, series_ids, start_date)
        return {"data": grouped}

    def _get_indicator_name(self, series_id: str) -> str:
        mapping = {
            "UNRATE": "Unemployment Rate",
            "CPIAUCSL": "CPI (Consumer Price Index)",
            "FEDFUNDS": "Federal Funds Rate",
            "RSAFS": "Retail Sales",
            "CCLACBW027SBOG": "Consumer Credit"
        }
        return mapping.get(series_id, series_id)

    def _get_mock_data(self, series_id: str) -> List[Dict[str, Any]]:
        # Delegate to DB service for consistency
        return self.db_service.get_mock_data(series_id, "2000-01-01")

    async def get_all_indicators(self, session: Optional[AsyncSession]) -> List[Dict[str, Any]]:
        indicators = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]
        grouped = await self.fetch_multiple_series(session, indicators)
        all_data: List[Dict[str, Any]] = []
        for sid in indicators:
            all_data.extend(grouped.get(sid, []))
            
        # Sort by date
        # Sanitize: remove NaN/inf values defensively
        all_data = [
            d for d in all_data
            if isinstance(d.get("value"), (int, float)) and math.isfinite(float(d["value"]))
        ]
        all_data.sort(key=lambda x: x["date"])
        return all_data
    
    async def get_risk_timeline(self, session: Optional[AsyncSession], incremental: bool = True) -> List[Dict[str, Any]]:
        """
        Get risk timeline with incremental computation support.
        
        Args:
            session: Database session
            incremental: Whether to use incremental computation (default: True)
            
        Returns:
            List of risk assessment dictionaries with date, level, and score
        """
        from app.caching.memory_cache import cache_store
        from app.caching.key_builders import risk_timeline_key, risk_timeline_incremental_key, risk_metadata_key
        
        # Try to get cached timeline first
        cache_key = risk_timeline_key()
        cached_timeline = await cache_store.get(cache_key)
        
        if cached_timeline is not None and incremental:
            return cached_timeline
        
        # Fetch the latest economic data
        grouped = await self.fetch_multiple_series(session, ["UNRATE", "CPIAUCSL", "RSAFS"])
        unrate = grouped.get("UNRATE", [])
        cpi = grouped.get("CPIAUCSL", [])
        sales = grouped.get("RSAFS", [])
        
        if not unrate or not cpi or not sales:
            return []
        
        # Convert to pandas DataFrames for vectorized operations
        unrate_df = pd.DataFrame(unrate)
        cpi_df = pd.DataFrame(cpi)
        sales_df = pd.DataFrame(sales)
        
        # Convert date strings to datetime and values to float
        unrate_df['date'] = pd.to_datetime(unrate_df['date'])
        unrate_df['value'] = pd.to_numeric(unrate_df['value'], errors='coerce')
        
        cpi_df['date'] = pd.to_datetime(cpi_df['date'])
        cpi_df['value'] = pd.to_numeric(cpi_df['value'], errors='coerce')
        
        sales_df['date'] = pd.to_datetime(sales_df['date'])
        sales_df['value'] = pd.to_numeric(sales_df['value'], errors='coerce')
        
        # Merge data on date to ensure alignment
        merged_df = unrate_df[['date', 'value']].rename(columns={'value': 'unrate'})
        merged_df = merged_df.merge(cpi_df[['date', 'value']].rename(columns={'value': 'cpi'}), on='date', how='left')
        merged_df = merged_df.merge(sales_df[['date', 'value']].rename(columns={'value': 'sales'}), on='date', how='left')
        
        # Drop rows with missing values
        merged_df = merged_df.dropna()
        
        if len(merged_df) < 19:  # Need at least 19 months for full analysis
            return []
        
        # Get metadata for incremental computation
        metadata = await cache_store.get(risk_metadata_key()) or {}
        last_computed_date = metadata.get('last_computed_date')
        
        if incremental and last_computed_date and cached_timeline:
            # Incremental computation: only process new data
            last_dt = pd.to_datetime(last_computed_date)
            new_data_mask = merged_df['date'] > last_dt
            
            if new_data_mask.any():
                # Get the existing timeline and convert to DataFrame
                existing_timeline_df = pd.DataFrame(cached_timeline)
                existing_timeline_df['date'] = pd.to_datetime(existing_timeline_df['date'])
                
                # Only compute risk for new dates
                new_dates_df = merged_df[new_data_mask].copy()
                
                if len(new_dates_df) > 0:
                    # For incremental updates, we need the full history for rolling calculations
                    # So we'll compute the entire timeline but only return new + existing
                    pass  # Fall through to full computation for now
        
        # Full computation (fallback for incremental or first run)
        # Vectorized calculations using pandas rolling operations
        # 1. CPI YoY Change
        merged_df['cpi_yoy_change'] = ((merged_df['cpi'] - merged_df['cpi'].shift(12)) / merged_df['cpi'].shift(12)) * 100
        
        # 2. Unemployment Rate Trend (3-month MA vs previous 3-month MA)
        unrate_ma3 = merged_df['unrate'].rolling(window=3).mean()
        unrate_ma3_prev = unrate_ma3.shift(3)
        merged_df['unrate_trend_rising'] = (unrate_ma3 > unrate_ma3_prev + 0.5)
        
        # 3. Sales Momentum (short-term vs long-term average)
        sales_ma3 = merged_df['sales'].rolling(window=3).mean()
        sales_ma12 = merged_df['sales'].rolling(window=12).mean()
        merged_df['sales_slowing'] = (sales_ma3 < sales_ma12 * 0.98)
        
        # 4. Lag Warning (inflation lag effect)
        cpi_6m_ago = merged_df['cpi'].shift(6)
        cpi_18m_ago = merged_df['cpi'].shift(18)
        past_inflation = ((cpi_6m_ago - cpi_18m_ago) / cpi_18m_ago) * 100
        merged_df['lag_warning'] = (past_inflation > 4.0) & merged_df['sales_slowing']
        
        # Calculate risk score
        merged_df['risk_score'] = 0
        merged_df.loc[merged_df['cpi_yoy_change'] > 3.0, 'risk_score'] += 1
        merged_df.loc[merged_df['unrate_trend_rising'] | (merged_df['unrate'] > 5.0), 'risk_score'] += 2
        merged_df.loc[merged_df['sales_slowing'], 'risk_score'] += 1
        merged_df.loc[merged_df['lag_warning'], 'risk_score'] += 2
        
        # Determine risk level
        merged_df['level'] = "Stable"
        merged_df.loc[merged_df['risk_score'] >= 4, 'level'] = "High Risk"
        merged_df.loc[(merged_df['risk_score'] >= 2) & (merged_df['risk_score'] < 4), 'level'] = "Watch"
        
        # Convert back to list of dictionaries
        timeline = []
        for _, row in merged_df.iterrows():
            timeline.append({
                "date": row['date'].strftime("%Y-%m-%d"),
                "level": row['level'],
                "score": int(row['risk_score'])
            })
        
        # Cache the computed timeline
        latest_date = merged_df['date'].max().strftime("%Y-%m-%d")
        await cache_store.set(cache_key, timeline, ttl=3600)  # 1 hour TTL
        
        # Update metadata for incremental computation
        metadata = {
            'last_computed_date': latest_date,
            'total_data_points': len(merged_df),
            'computed_at': pd.Timestamp.now().isoformat()
        }
        await cache_store.set(risk_metadata_key(), metadata, ttl=86400)  # 24 hours TTL
        
        return timeline

    async def get_risk_classification(self, session: Optional[AsyncSession]) -> Dict[str, Any]:
        # Advanced Risk Analysis
        
        # 1. Fetch Key Indicators
        grouped = await self.fetch_multiple_series(session, ["UNRATE", "CPIAUCSL", "RSAFS"])
        unrate = grouped.get("UNRATE", []) # Unemployment
        cpi = grouped.get("CPIAUCSL", []) # CPI
        sales = grouped.get("RSAFS", []) # Retail Sales
        
        # Allow partial datasets by computing metrics from available series
        available_series = {
            "UNRATE": bool(unrate),
            "CPIAUCSL": bool(cpi),
            "RSAFS": bool(sales)
        }

        # 2. Data Preparation (Convert to simple lists for analysis)
        def get_latest_values(data, months=12):
            return [d["value"] for d in data[-months:]]
            
        unrate_recent = get_latest_values(unrate)
        cpi_recent = get_latest_values(cpi)
        sales_recent = get_latest_values(sales)
        
        # 3. Calculate Metrics
        
        # A. Inflation Trend (YoY CPI Change)
        latest_cpi_change = 0
        if len(cpi) >= 13:
            latest_cpi = cpi[-1]["value"]
            year_ago_cpi = cpi[-13]["value"]
            latest_cpi_change = ((latest_cpi - year_ago_cpi) / year_ago_cpi) * 100

        # B. Unemployment Trend (3-month moving average change)
        unrate_trend = "Stable"
        if len(unrate_recent) >= 6:
            current_ma = sum(unrate_recent[-3:]) / 3
            prev_ma = sum(unrate_recent[-6:-3]) / 3
            if current_ma > prev_ma + 0.5:
                unrate_trend = "Rising"
        
        # C. Retail Sales Momentum (3-month vs 12-month avg)
        sales_momentum = "Neutral"
        if len(sales_recent) >= 12:
            short_term_avg = sum(sales_recent[-3:]) / 3
            long_term_avg = sum(sales_recent) / 12
            if short_term_avg < long_term_avg * 0.98: # 2% drop
                sales_momentum = "Slowing"
        
        # 4. Lag Analysis (Simplistic Correlation Check)
        # Check if high inflation 6 months ago correlates with sales drop today
        lag_warning = False
        if len(cpi) >= 18 and len(sales) >= 6:
            # High inflation 6 months ago?
            past_inflation_high = False
            cpi_6m_ago = cpi[-7]["value"]
            cpi_18m_ago = cpi[-19]["value"]
            past_inflation = ((cpi_6m_ago - cpi_18m_ago) / cpi_18m_ago) * 100
            
            if past_inflation > 4.0:
                past_inflation_high = True
                
            # Sales dropping now?
            sales_dropping = sales_momentum == "Slowing"
            
            if past_inflation_high and sales_dropping:
                lag_warning = True

        # 5. Determine Risk Level
        risk_score = 0
        reasons = []
        
        # Rule 1: High Inflation (> 3%)
        if available_series["CPIAUCSL"] and latest_cpi_change > 3.0:
            risk_score += 1
            reasons.append(f"Inflation is elevated ({latest_cpi_change:.1f}%)")
        # Rule 2: Rising Unemployment
        if available_series["UNRATE"]:
            if unrate_trend == "Rising" or unrate[-1]["value"] > 5.0:
                risk_score += 2
                reasons.append("Unemployment trend is deteriorating")
        # Rule 3: Slowing Sales
        if available_series["RSAFS"] and sales_momentum == "Slowing":
            risk_score += 1
            reasons.append("Retail sales momentum is slowing")
        # Rule 4: Lag Effect
        if available_series["CPIAUCSL"] and available_series["RSAFS"] and lag_warning:
            risk_score += 2
            reasons.append("Lag pattern detected: Past high inflation impacting current sales")
        # Classification
        if risk_score >= 4:
            risk_level = "High Risk"
        elif risk_score >= 2:
            risk_level = "Watch"
        else:
            risk_level = "Stable"
            reasons.append("Indicators show stable economic conditions")
        return {
            "level": risk_level,
            "reasons": reasons,
            "timestamp": datetime.now().isoformat(),
            "details": {
                "inflation_rate": round(latest_cpi_change, 2),
                "unemployment_trend": unrate_trend,
                "sales_momentum": sales_momentum,
                "lag_warning": lag_warning
            }
        }
