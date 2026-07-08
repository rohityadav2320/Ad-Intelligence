#!/bin/bash
# Ad Intelligence Agent — Double-click this file to run
# Works on Mac — opens Terminal automatically

cd "$(dirname "$0")"

echo ""
echo "================================================"
echo "  Ad Intelligence Agent — by Vidrow"
echo "================================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found."
    echo ""
    echo "Install it from: https://www.python.org/downloads/"
    echo "Then double-click this file again."
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

# First time setup
if [ ! -d "venv" ]; then
    echo "⏳ First time setup (takes 2-3 minutes)..."
    echo ""
    python3 -m venv venv
    source venv/bin/activate
    pip install -q -r requirements.txt
    playwright install chromium
    echo ""
    echo "✅ Setup complete!"
    echo ""
fi

source venv/bin/activate
python agent.py
