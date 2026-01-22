import asyncio
import sys
import os
from dotenv import load_dotenv

# Ensure we are running with the backend directory in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from app.services.fred_service import FredService

# List of series to update
SERIES_IDS = ["UNRATE", "CPIAUCSL", "FEDFUNDS", "RSAFS", "CCLACBW027SBOG"]

async def main():
    # Load environment variables from .env file
    env_path = os.path.join(current_dir, "..", ".env")
    load_dotenv(env_path)
    
    # Manual fallback for loading env if load_dotenv fails (e.g. encoding issues)
    if not os.getenv("FRED_API_KEY"):
        try:
            with open(env_path, "r", encoding="utf-8-sig") as f:
                for line in f:
                    clean_line = line.strip()
                    if clean_line.startswith("FRED_API_KEY="):
                        key = clean_line.split("=", 1)[1].strip()
                        os.environ["FRED_API_KEY"] = key
                        break
        except Exception:
            pass

    api_key = os.getenv("FRED_API_KEY")
    if not api_key:
        print("Error: FRED_API_KEY not found in environment variables.")
        return

    print(f"Starting cache rebuild for {len(SERIES_IDS)} series...")
    
    service = FredService()
    
    try:
        # Rebuild cache starting from 2000-01-01 to ensure full coverage
        counts = await service.rebuild_file_cache(SERIES_IDS, start_date="2000-01-01")
        print("Cache rebuild complete.")
        print("Records updated per series:")
        for sid, count in counts.items():
            print(f"  {sid}: {count} records")
            
    except Exception as e:
        print(f"An error occurred during cache rebuild: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())