@echo off
REM Ad Intelligence Agent — Double-click this file to run
cd /d "%~dp0"

echo.
echo ================================================
echo   Ad Intelligence Agent - by Vidrow
echo ================================================
echo.

REM Check Python
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed.
    echo.
    echo Install it from: https://www.python.org/downloads/
    echo IMPORTANT: check "Add Python to PATH" during install.
    echo Then double-click this file again.
    echo.
    pause
    exit /b 1
)

REM First time setup
if not exist "venv" (
    echo First time setup - this takes 2-3 minutes...
    echo.
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -q -r requirements.txt
    playwright install chromium
    echo.
    echo Setup complete!
    echo.
) else (
    call venv\Scripts\activate.bat
)

python agent.py
pause
