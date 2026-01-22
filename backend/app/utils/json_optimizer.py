"""
Optimized JSON serialization utilities for large responses.
"""
import json
import orjson
from typing import Any, Dict, List
from datetime import datetime, date
from decimal import Decimal

class OptimizedJSONEncoder:
    """
    Optimized JSON encoder that handles common data types efficiently.
    """
    
    @staticmethod
    def encode(obj: Any) -> str:
        """
        Encode object to JSON string using optimized serialization.
        """
        return json.dumps(obj, cls=OptimizedJSONEncoder, ensure_ascii=False)
    
    @staticmethod
    def encode_bytes(obj: Any) -> bytes:
        """
        Encode object to JSON bytes using orjson for maximum performance.
        """
        return orjson.dumps(
            obj,
            option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_UTC_Z
        )
    
    def default(self, obj: Any) -> Any:
        """
        Handle serialization of specific data types.
        """
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        elif hasattr(obj, "to_dict"):
            return obj.to_dict()
        elif hasattr(obj, "dict"):
            return obj.dict()
        elif hasattr(obj, "__dict__"):
            return obj.__dict__
        
        # Let the base class default method raise the TypeError
        raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

def optimized_json_response(data: Any, status_code: int = 200) -> Dict[str, Any]:
    """
    Create an optimized JSON response structure.
    """
    return {
        "data": data,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "optimized": True
        },
        "status": "success" if status_code == 200 else "error"
    }

def stream_large_json(data: List[Dict[str, Any]], chunk_size: int = 1000) -> str:
    """
    Stream large JSON data in chunks to reduce memory usage.
    Returns a generator that yields JSON chunks.
    """
    encoder = OptimizedJSONEncoder()
    
    # Yield opening bracket
    yield "["
    
    # Yield items with commas
    for i, item in enumerate(data):
        if i > 0:
            yield ","
        yield encoder.encode(item)
    
    # Yield closing bracket
    yield "]"