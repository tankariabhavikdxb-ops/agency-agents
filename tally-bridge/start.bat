@echo off
REM Start the Tally Bridge middleware (Windows)
REM First time: py -3 -m pip install -r requirements.txt
cd /d "%~dp0"
set BRIDGE_HOST=127.0.0.1
if not "%BRIDGE_HOST_OVERRIDE%"=="" set BRIDGE_HOST=%BRIDGE_HOST_OVERRIDE%
echo Starting Tally Bridge on http://%BRIDGE_HOST%:5000 ...
py -3 server.py
pause
