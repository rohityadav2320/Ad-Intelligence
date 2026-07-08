@echo off
REM Ad Intelligence Agent — Windows Setup
REM Run this ONCE when setting up a new laptop

echo.
echo ================================================
echo   Ad Intelligence Agent — Windows Setup
echo ================================================
echo.

REM Check Python
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed.
    echo Download from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install
    pause
    exit /b 1
)

echo Python found.

REM Create virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -q -r requirements.txt

REM Install Chromium
echo Installing Chromium (one-time, ~150MB)...
playwright install chromium

REM Set up .env
if not exist ".env" (
    copy .env.example .env
    echo.
    echo Created .env file - open it with Notepad and fill in:
    echo   SUPABASE_URL
    echo   SUPABASE_KEY
    echo   BACKEND_URL
    echo.
    echo Then double-click start.bat to run the agent
) else (
    echo .env already exists
)

echo.
echo ================================================
echo   Setup complete!
echo   Next: fill in .env then run start.bat
echo ================================================
echo.
pause
