#!/bin/bash

# Consumer Risk Index - Railway Deployment Script
# This script handles the build and startup process for Railway deployment

echo "🚀 Starting Consumer Risk Index deployment on Railway"

# Check if we're running in production (Railway sets RAILWAY_ENVIRONMENT)
if [ "$RAILWAY_ENVIRONMENT" = "production" ]; then
    echo "📦 Production environment detected"
    
    # Install backend dependencies
    echo "🐍 Installing Python dependencies..."
    cd backend
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
    echo "🔧 Development mode - using Docker Compose"
    
    # For development/local testing, use docker-compose
    if command -v docker-compose &> /dev/null; then
        echo "🐳 Starting with Docker Compose..."
        docker-compose up --build
    else
        echo "❌ Docker Compose not found. Please install Docker Desktop."
        echo "💡 Alternatively, run the backend and frontend separately:"
        echo "   Backend: cd backend && uvicorn app.main:app --reload"
        echo "   Frontend: cd frontend && npm run dev"
        exit 1
    fi
fi