from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

# Create engine conditionally based on USE_DATABASE setting
if settings.USE_DATABASE:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=settings.DB_MAX_CONNECTIONS,
        max_overflow=0,
        pool_pre_ping=True,
    )
    
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
else:
    # Dummy engine/session for when DB is disabled
    engine = None
    AsyncSessionLocal = None

Base = declarative_base()

async def get_db():
    if not settings.USE_DATABASE or not AsyncSessionLocal:
        yield None
        return
        
    async with AsyncSessionLocal() as session:
        yield session
