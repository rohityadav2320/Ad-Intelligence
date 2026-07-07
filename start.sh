#!/bin/bash
# Start both backend and frontend

echo "Starting Ad Intelligence Tool..."
echo ""

# Start backend
echo "[1/2] Starting Python backend on port 8001..."
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8001 &
BACKEND_PID=$!
cd ..

# Wait a moment
sleep 2

# Start frontend
echo "[2/2] Starting Next.js frontend on port 3001..."
cd frontend
npm run dev -- --port 3001 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ Backend running at: http://localhost:8001"
echo "✓ Frontend running at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
