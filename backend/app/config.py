import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import json

# Determine environment for prioritized env file loading
ENV = os.getenv("ENV", "development")

class Settings(BaseSettings):
    # Database
    USE_DATABASE: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/consumerriskindex"
    DB_MAX_CONNECTIONS: int = 10

    # FRED API
    FRED_API_KEY: str = ""
    FRED_RATE_LIMIT: int = 120

    # Server
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"

    # Cache
    CACHE_TTL: int = 3600
    FILE_CACHE_ENABLED: bool = True

    # Security
    CORS_ORIGINS: List[str] = ["*"]
    ADMIN_API_TOKEN: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # Fallback for comma-separated string with no brackets
                return [origin.strip() for origin in v.split(",")]
        return v

    # pydantic-settings v2 configuration
    model_config = SettingsConfigDict(
        env_file=(
            f".env.{ENV}",
            ".env"
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
