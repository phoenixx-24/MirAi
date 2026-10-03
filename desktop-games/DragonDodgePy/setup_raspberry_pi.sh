#!/usr/bin/env bash
# ==============================================================================
# AI Fitness Platform — Raspberry Pi Setup & Startup Script
# ==============================================================================

set -e

echo "=== 1. Updating System Packages ==="
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv nodejs npm libgl1 libglib2.0-0

echo "=== 2. Setting up Node.js Backend ==="
npm install

echo "=== 3. Setting up Python Virtual Environment ==="
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r ai/requirements.txt
# If GUI libraries are missing on headless Raspberry Pi:
pip install opencv-python-headless || true

echo "=== 4. Verifying Configuration ==="
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

echo "=============================================================================="
echo "Setup Complete! To start the platform on Raspberry Pi, run:"
echo "  1) source venv/bin/activate && python3 -u ai/app.py &"
echo "  2) node backend/server.js"
echo "=============================================================================="
