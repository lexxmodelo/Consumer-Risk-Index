def fred_key(series_id: str, start_date: str) -> str:
    return f"fred:{series_id}:{start_date}"

def fred_batch_key(series_ids: list[str], start_date: str) -> str:
    import hashlib
    base = f"{start_date}:" + ",".join(sorted(series_ids))
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()
    return f"fred:batch:{h}"

def risk_timeline_key() -> str:
    return "risk:timeline:latest"

def risk_timeline_incremental_key(last_date: str) -> str:
    return f"risk:timeline:incremental:{last_date}"

def risk_metadata_key() -> str:
    return "risk:metadata"