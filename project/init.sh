#!/bin/bash
# POD Platform — Development Server Initialization
# Starts Next.js app (frontend + API routes on port 3000)

set -e

echo "Starting POD Platform..."

# Check if we're in the project directory
if [ ! -d "frontend" ]; then
  cd "$(dirname "$0")"
fi

# Kill any existing processes on port 3000 and clean stale lock files
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
rm -f frontend/.next/dev/lock 2>/dev/null

# Function to kill background processes on exit
cleanup() {
  echo ""
  echo "Shutting down server..."
  kill $(jobs -p) 2>/dev/null || true
  exit
}

trap cleanup SIGINT SIGTERM

# Install dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start Next.js (frontend + API routes on port 3000)
echo "Starting Next.js on port 3000 (Turbopack)..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "==========================================="
echo "  POD Platform — Server Starting"
echo "==========================================="
echo "  App:      http://localhost:3000"
echo "  API:      http://localhost:3000/api/"
echo "  Health:   http://localhost:3000/api/health"
echo "  Locales:  /en/ | /es/ | /de/"
echo "  PID:      $FRONTEND_PID"
echo "==========================================="
echo ""
echo "Logs: tail -f frontend.log"
echo "Press Ctrl+C to stop"
echo ""

# Wait for the process
wait
