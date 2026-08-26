@echo off
setlocal
title Tally Prime Web Interface - Setup
cd /d "%~dp0"

echo ============================================
echo   Tally Prime 2.1 - Web Interface Setup
echo ============================================
echo.

REM ────────────────────────────────────────────────────────────
REM 1. Check Python 3.9+
REM ────────────────────────────────────────────────────────────
set "PYCMD="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if not errorlevel 1 set "PYCMD=python"

if not defined PYCMD (
    py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
    if not errorlevel 1 set "PYCMD=py -3"
)

if not defined PYCMD (
    echo [ERROR] Python 3.9+ was not found on this PC.
    echo         Install it from https://www.python.org/downloads/
    echo         and tick "Add python.exe to PATH" during install.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('%PYCMD% --version 2^>^&1') do echo [OK] Found %%v

REM ────────────────────────────────────────────────────────────
REM 2. Create virtual environment
REM ────────────────────────────────────────────────────────────
if exist "venv\Scripts\python.exe" (
    echo [OK] Virtual environment already exists ^(venv^\).
) else (
    echo.
    echo Creating virtual environment in venv\ ...
    %PYCMD% -m venv venv
    if errorlevel 1 (
        echo [ERROR] Could not create the virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
)
set "VPY=%~dp0venv\Scripts\python.exe"

REM ────────────────────────────────────────────────────────────
REM 3. Upgrade pip
REM ────────────────────────────────────────────────────────────
echo.
echo Upgrading pip ...
"%VPY%" -m pip install --upgrade pip --disable-pip-version-check --quiet
if errorlevel 1 echo [WARN] pip upgrade failed - continuing with existing pip.

REM ────────────────────────────────────────────────────────────
REM 4. Install dependencies
REM ────────────────────────────────────────────────────────────
echo.
echo Installing dependencies - this can take a minute ...
"%VPY%" -m pip install -r requirements.txt --disable-pip-version-check
if errorlevel 1 (
    echo.
    echo [WARN] Full install failed - retrying without the optional ODBC driver ...
    set "TMPREQ=%TEMP%\tally-bridge-requirements.txt"
    findstr /v /i "pyodbc" requirements.txt > "%TEMP%\tally-bridge-requirements.txt"
    "%VPY%" -m pip install -r "%TEMP%\tally-bridge-requirements.txt" --disable-pip-version-check
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        echo         Check your internet connection and run setup.bat again.
        pause
        exit /b 1
    )
    echo [WARN] pyodbc was skipped - the bridge will run in XML-API-only mode.
    echo        Every feature still works; ODBC is an optional faster read path.
)

REM ────────────────────────────────────────────────────────────
REM 5. Create .env from the example (keep an existing one)
REM ────────────────────────────────────────────────────────────
echo.
if exist ".env" (
    echo [OK] Existing .env kept.
) else (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [OK] Created .env from .env.example.
        echo      Open it in Notepad to point the bridge at your Tally if
        echo      it runs on another PC ^(LAN^) or a non-default port.
    ) else (
        echo [WARN] .env.example not found - defaults will be used.
    )
)

REM ────────────────────────────────────────────────────────────
REM 6. Done
REM ────────────────────────────────────────────────────────────
echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo   How to start:
echo     - double-click run.bat      (or)
echo     - venv\Scripts\python.exe server.py
echo.
echo   The app will be at  http://127.0.0.1:5000
echo.
echo   Checklist before starting:
echo     1. Tally Prime 2.1 is running with a company open
echo     2. In Tally: Help - Settings - Connectivity
echo        set "TallyPrime acts as" = Both ^(ODBC + XML API^), port 9000
echo.
set /p "STARTNOW=Start the bridge now? [Y/N]: "
if /i "%STARTNOW%"=="Y" call run.bat
endlocal
