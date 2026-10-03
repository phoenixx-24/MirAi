#!/usr/bin/env bash
# ==============================================================================
# AI Fitness Platform — One-Click Runner for Raspberry Pi
# ==============================================================================

echo "Starting Python AI Microservice on Port 5001..."
source venv/bin/activate
python3 -u ai/app.py &
AI_PID=$!

echo "Waiting for AI service to initialize..."
sleep 3

echo "Starting Node.js Backend Server on Port 3000..."
node backend/server.js &
NODE_PID=$!

echo "===================================================="
echo " AI Fitness Platform is RUNNING!"
echo " Web UI:     http://localhost:3000"
echo " Python AI:  http://127.0.0.1:5001"
echo " Press CTRL+C to stop both services."
echo "===================================================="

trap "kill $AI_PID $NODE_PID; exit 0" SIGINT SIGTERM
wait
