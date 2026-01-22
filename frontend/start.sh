#!/usr/bin/env bash
set -e

echo "🚀 Starting Consumer Risk Index Frontend on Railway"

# Install dependencies
npm install

# Build React app
npm run build

# Install serve to serve static files
npm install -g serve

# Serve the dist folder on the Railway PORT
serve -s dist -l $PORT