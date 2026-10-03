#!/usr/bin/env bash
set -e

echo "========================================================"
echo "       MirAi Fitness Platform - Automated Setup"
echo "========================================================"
echo ""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 1. Check Python
echo "[1/5] Checking Python 3..."
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python 3 was not found! Please install Python 3.11+."
    exit 1
fi
echo "Found: $($PYTHON_CMD --version)"

# 2. Check Node
echo "[2/5] Checking Node.js / NPM..."
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] Node.js/NPM was not found! Please install Node.js 20+."
    exit 1
fi
echo "Found: node $(node -v) / npm $(npm -v)"

# 3. Frontend Dependencies
echo "[3/5] Installing Frontend Dependencies..."
if [ ! -d "node_modules" ]; then
    npm install || npm install --legacy-peer-deps
else
    echo "node_modules already exists. Skipping."
fi

# 4. Backend Virtualenv & Dependencies
echo "[4/5] Setting up Backend Virtual Environment..."
cd backend
if [ ! -d ".venv" ]; then
    $PYTHON_CMD -m venv .venv
fi

VENV_PY=".venv/bin/python"
"$VENV_PY" -m pip install --upgrade pip
"$VENV_PY" -m pip install -r requirements.txt
if [ -f "requirements-games.txt" ]; then
    "$VENV_PY" -m pip install -r requirements-games.txt || true
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
fi

if [ ! -f "models/pose_landmarker.task" ]; then
    echo "Downloading pose model..."
    "$VENV_PY" download_models.py || true
fi

cd "$ROOT_DIR"

echo ""
echo "[5/5] Setup Complete!"
echo "Run ./start.sh or python3 launch.py to launch MirAi."
