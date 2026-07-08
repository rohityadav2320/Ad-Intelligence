#!/bin/bash
# Start the Ad Intelligence Agent (foreground — shows logs in terminal)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    echo "❌ Run ./install.sh first"
    exit 1
fi

source venv/bin/activate
python agent.py
