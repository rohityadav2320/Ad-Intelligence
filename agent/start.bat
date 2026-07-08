@echo off
REM Start the Ad Intelligence Agent (Windows)
cd /d "%~dp0"

if not exist "venv" (
    echo Run install.bat first
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
python agent.py
pause
