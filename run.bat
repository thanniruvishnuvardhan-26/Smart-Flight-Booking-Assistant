@echo off
setlocal enabledelayedexpansion
title Smart Flight Booking Assistant Launcher
echo ======================================================================
echo        SMART FLIGHT BOOKING ASSISTANT - PORTABLE LAUNCHER
echo ======================================================================
echo.

:: 1. Navigate to script's own folder dynamically (Zero hardcoded paths)
cd /d "%~dp0"
echo [*] Working Directory: %CD%

:: 2. Resolve Host Python Interpreter (Check py launcher, python, python3)
set "HOST_PYTHON="

:: Try Windows standard Python launcher 'py'
py -c "import sys; assert sys.version_info >= (3, 9)" >nul 2>&1
if !errorlevel! equ 0 (
    set "HOST_PYTHON=py"
    echo [*] Detected Python Launcher: py
)

:: Try 'python' on PATH if py was not found
if not defined HOST_PYTHON (
    python -c "import sys; assert sys.version_info >= (3, 9)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "HOST_PYTHON=python"
        echo [*] Detected system Python: python
    )
)

:: Try 'python3' on PATH
if not defined HOST_PYTHON (
    python3 -c "import sys; assert sys.version_info >= (3, 9)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "HOST_PYTHON=python3"
        echo [*] Detected system Python: python3
    )
)

if not defined HOST_PYTHON (
    echo.
    echo ======================================================================
    echo [ERROR] No compatible Python installation found on this laptop!
    echo.
    echo This project requires Python 3.9, 3.10, 3.11, 3.12, 3.13, or 3.14.
    echo.
    echo How to fix:
    echo  1. Download Python from: https://www.python.org/downloads/
    echo  2. IMPORTANT: During installation, CHECK the box:
    echo     [X] "Add Python to PATH" or "Use py launcher"
    echo  3. Re-run run.bat after installation.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

:: Display detected host Python version
for /f "delims=" %%v in ('!HOST_PYTHON! -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"') do set "HOST_VER=%%v"
echo [*] Host Python Version: !HOST_VER!

:: 3. Manage Local Virtual Environment
:: Check if existing venv is functional on THIS machine
set "VENV_PYTHON=%~dp0venv\Scripts\python.exe"
set "REBUILD_VENV=0"

if not exist "!VENV_PYTHON!" (
    set "REBUILD_VENV=1"
    echo [*] Virtual environment not found. Preparing automatic setup...
) else (
    "!VENV_PYTHON!" -c "import sys" >nul 2>&1
    if !errorlevel! neq 0 (
        set "REBUILD_VENV=1"
        echo [NOTICE] Existing venv belongs to another laptop/path. Re-creating for this machine...
    )
)

:: Automatically create fresh venv if missing or invalid
if "!REBUILD_VENV!"=="1" (
    echo [*] Creating isolated virtual environment in .\venv ...
    if exist "%~dp0venv" (
        rmdir /s /q "%~dp0venv" >nul 2>&1
    )
    !HOST_PYTHON! -m venv "%~dp0venv"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [*] Virtual environment created successfully.
)

:: Verify venv python is now operational
"!VENV_PYTHON!" -c "import sys" >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Unable to run python inside virtual environment: !VENV_PYTHON!
    pause
    exit /b 1
)

:: 4. Verify & Install Dependencies from requirements.txt
echo [*] Checking dependencies in virtual environment...
"!VENV_PYTHON!" -c "import fastapi, uvicorn, pydantic, pandas, joblib, sklearn" >nul 2>&1
if !errorlevel! neq 0 (
    echo [*] Installing required packages from requirements.txt (first run on this laptop)...
    "!VENV_PYTHON!" -m pip install --upgrade pip >nul 2>&1
    "!VENV_PYTHON!" -m pip install -r "%~dp0requirements.txt"
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Package installation failed!
        echo Please ensure you have an active internet connection on first startup.
        pause
        exit /b 1
    )
    echo [*] Dependencies installed successfully.
) else (
    echo [*] All required dependencies verified.
)

:: 5. Verify Essential Files
if not exist "%~dp0backend\flight_price_rf_pipeline_v2.pkl" (
    if not exist "%~dp0backend\flight_price_rf_pipeline.pkl" (
        echo.
        echo [ERROR] Model file not found in %~dp0backend!
        pause
        exit /b 1
    )
)
if not exist "%~dp0backend\duration_lookup.json" (
    echo [WARN] duration_lookup.json missing; backend will use static fallbacks.
)
echo [*] Core ML Model and data lookup files verified.

:: 6. Clean Port Collisions (Port 8000 and 5500)
echo [*] Checking local port availability...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [*] Releasing port 8000 - occupied by PID %%a
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500" ^| findstr "LISTENING"') do (
    echo [*] Releasing port 5500 - occupied by PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: 7. Start FastAPI Backend Server
echo.
echo [1/3] Starting FastAPI Backend on port 8000...
start "Flight Assistant Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && "!VENV_PYTHON!" -m uvicorn main:app --port 8000 --host 127.0.0.1"

:: 8. Start Frontend Static Server
echo [2/3] Starting Frontend Server on port 5500...
start "Flight Assistant Frontend (Server)" cmd /k "cd /d "%~dp0frontend" && "!VENV_PYTHON!" serve.py 5500"

:: 9. Active Health Check Polling Loop
echo [3/3] Waiting for backend services to initialize...
set "READY=0"
for /L %%i in (1,1,15) do (
    if !READY! equ 0 (
        "!VENV_PYTHON!" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "READY=1"
        ) else (
            "!VENV_PYTHON!" -c "import time; time.sleep(1)"
        )
    )
)

if !READY! equ 1 (
    echo [*] Backend health check PASSED - http://127.0.0.1:8000/health is responsive.
    echo.
    echo ======================================================================
    echo   SUCCESS: Smart Flight Booking Assistant is LIVE!
    echo   Frontend Web Application : http://127.0.0.1:5500/index.html
    echo   FastAPI REST API Docs    : http://127.0.0.1:8000/docs
    echo ======================================================================
    echo.
    echo Launching default web browser...
    start http://127.0.0.1:5500/index.html
) else (
    echo.
    echo [WARNING] Backend did not respond within 15 seconds.
    echo Please inspect the "Flight Assistant Backend (FastAPI)" window for errors.
    echo Opening frontend anyway: http://127.0.0.1:5500/index.html
    start http://127.0.0.1:5500/index.html
)

exit /b 0
