import asyncio
import os
import sys
import json
from datetime import datetime
from app.services.database_service import DatabaseService

# Force use of backend directory
sys.path.append(os.getcwd())

async def validate():
    print("Starting Consistency Audit...")
    service = DatabaseService()
    
    # Check DB
    db_available = await service.is_database_available()
    print(f"Database Available: {db_available}")
    
    indicators = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]
    
    for indicator in indicators:
        print(f"\n--- Analyzing {indicator} ---")
        
        # 1. DB Data
        db_data = []
        if db_available:
            try:
                db_data = await service._get_from_db(indicator, "2000-01-01")
                # Normalize DB data to match dict format
                # _get_from_db returns dicts already (from to_dict)
            except Exception as e:
                print(f"DB Error: {e}")
        
        # 2. File Data (Service Path: backend/data)
        file_data_service = await service._get_from_file(indicator, "2000-01-01")
        
        # 3. File Data (Legacy/Actual Path: backend/cache)
        cache_path = os.path.join("cache", f"{indicator.lower()}.json")
        file_data_cache = []
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    file_data_cache = json.load(f)
                    # Simple filter
                    file_data_cache = [x for x in file_data_cache if x.get('date') >= "2000-01-01"]
            except Exception as e:
                print(f"Error reading cache file: {e}")
        
        # 4. Mock Data
        mock_data = service.get_mock_data(indicator, "2000-01-01")
        
        print(f"Counts -> DB: {len(db_data)}, File(Service): {len(file_data_service)}, File(CacheDir): {len(file_data_cache)}, Mock: {len(mock_data)}")
        
        # Compare DB vs Mock
        if db_data and mock_data:
            compare_series(db_data, mock_data, "DB", "Mock")
            
        # Compare DB vs File(CacheDir)
        if db_data and file_data_cache:
            compare_series(db_data, file_data_cache, "DB", "File(CacheDir)")
            
        # Compare Mock vs File(CacheDir)
        if mock_data and file_data_cache:
            compare_series(mock_data, file_data_cache, "Mock", "File(CacheDir)")
        elif not mock_data:
             print("  No Mock data generated")
        elif not file_data_cache:
             print("  No File(CacheDir) data found")

def compare_series(list1, list2, name1, name2):
    # Convert to dict for easier lookup
    # Ensure values are floats
    try:
        d1 = {x['date']: float(x['value']) for x in list1 if x.get('value') is not None}
        d2 = {x['date']: float(x['value']) for x in list2 if x.get('value') is not None}
    except Exception as e:
        print(f"  Error parsing data for comparison: {e}")
        return
    
    common_dates = set(d1.keys()).intersection(set(d2.keys()))
    if not common_dates:
        print(f"  CRITICAL: No common dates between {name1} and {name2}")
        # Show sample dates
        if d1: print(f"    {name1} sample dates: {list(d1.keys())[:3]}")
        if d2: print(f"    {name2} sample dates: {list(d2.keys())[:3]}")
        return

    print(f"  Comparing {name1} vs {name2} on {len(common_dates)} common dates...")
    
    diffs = []
    for date in common_dates:
        val1 = d1[date]
        val2 = d2[date]
        diff = abs(val1 - val2)
        if diff > 0.001:
            diffs.append((date, val1, val2, diff))
            
    if diffs:
        print(f"  MISMATCHES FOUND: {len(diffs)}")
        # Show first 5
        for date, v1, v2, d in sorted(diffs)[:5]:
            print(f"    {date}: {name1}={v1}, {name2}={v2}, Diff={d}")
    else:
        print(f"  MATCH: Data identical on common dates.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(validate())
