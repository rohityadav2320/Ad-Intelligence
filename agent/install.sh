#!/bin/bash
# Ad Intelligence Agent — Mac Setup
# Run this ONCE when setting up a new laptop

set -e

echo ""
echo "================================================"
echo "  Ad Intelligence Agent — Mac Setup"
echo "================================================"
echo ""

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed."
    echo "   Download from: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $PYTHON_VERSION found"

# 2. Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# 3. Install dependencies
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# 4. Install Chromium for Playwright
echo "🌐 Installing Chromium (one-time, ~150MB)..."
playwright install chromium

# 5. Set up .env
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "📝 Created .env file — open it and fill in your values:"
    echo "   SUPABASE_URL"
    echo "   SUPABASE_KEY"
    echo "   BACKEND_URL"
    echo ""
    echo "   Then run: ./start.sh"
else
    echo "✅ .env already exists"
fi

echo ""
echo "================================================"
echo "  Setup complete!"
echo "  Next: fill in .env then run ./start.sh"
echo "================================================"
echo ""
