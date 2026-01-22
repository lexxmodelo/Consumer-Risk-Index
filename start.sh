#!/bin/bash

# Consumer Risk Index - Railway Deployment Script
# This script handles the build and startup process for Railway deployment

echo "🚀 Starting Consumer Risk Index deployment on Railway"

# Set working directory to backend for Python runtime
echo "📁 Setting working directory to backend..."
cd backend

# Check if we're running in production (Railway sets RAILWAY_ENVIRONMENT)
if [ "$RAILWAY_ENVIRONMENT" = "production" ]; then
    echo "📦 Production environment detected"
    
    # Install backend dependencies
    echo "🐍 Installing Python dependencies..."
    pip install -r requirements.txt
    
    # Run database migrations (if needed)
    echo "🗄️  Initializing database..."
    python -c "
import asyncio
from app.database import init_db
from app.config import settings

async def setup():
    if settings.USE_DATABASE:
        print('Initializing database...')
        await init_db()
    else:
        print('Database disabled, skipping initialization')

asyncio.run(setup())
"
    
    # Start the backend server
    echo "🔧 Starting FastAPI server..."
    uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
    
else
    echo "🔧 Development mode detected"
    
    # For Railway development or local testing
    echo "� Installing Python dependencies..."
    pip install -r requirements.txt
    
    echo "� Starting FastAPI server with reload..."
    uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload
fi