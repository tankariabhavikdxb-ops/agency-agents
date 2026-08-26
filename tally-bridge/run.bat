@echo off
title Tally Prime Web Interface
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found.
    echo         Run setup.bat first to install the Tally Bridge.
    pause
    exit /b 1
)

echo Starting Tally Bridge ...
echo Open http://127.0.0.1:5000 in your browser  (Ctrl+C here to stop)
echo.
venv\Scripts\python.exe server.py
echo.
echo Bridge stopped.
pause
