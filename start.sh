#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if command -v python3 >/dev/null 2>&1; then
    python3 launch.py
elif command -v python >/dev/null 2>&1; then
    python launch.py
else
    echo "Python 3 is required to run the launcher."
    exit 1
fi
