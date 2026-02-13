#!/bin/bash
# Development server initialization script
# Starts both frontend (Next.js) and backend (Express) servers

set -e

echo "🚀 Starting POD Platform Development Servers..."
echo ""

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
  cd "$(dirname "$0")"
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill background processes on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down servers..."
  kill $(jobs -p) 2>/dev/null || true
  exit
}

trap cleanup SIGINT SIGTERM

# Start backend server
echo -e "${BLUE}Starting backend server on port 3001...${NC}"
cd backend
export NODE_ENV=development
export PORT=3001
export FRONTEND_URL=http://localhost:3000
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo -e "${BLUE}Starting frontend server on port 3000...${NC}"
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Servers starting!${NC}"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
echo ""
echo "Logs:"
echo "  Frontend: tail -f frontend.log"
echo "  Backend:  tail -f backend.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait
