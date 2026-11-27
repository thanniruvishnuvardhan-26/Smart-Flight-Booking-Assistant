@echo off
setlocal enabledelayedexpansion
title Smart Flight Booking Assistant Launcher

:: Set window size and appearance
color 0B
echo ======================================================================
echo        SMART FLIGHT BOOKING ASSISTANT - PORTABLE LAUNCHER
echo ======================================================================
echo.

:: 1. Navigate to script's own folder dynamically (Zero hardcoded paths)
cd /d "%~dp0"
echo [*] Working Directory: %CD%

:: Ensure logs directory exists
if not exist "%~dp0logs" (
    mkdir "%~dp0logs" >nul 2>&1
)
set "LOG_FILE=%~dp0logs\startup.log"
echo [STARTUP %DATE% %TIME%] Initiating Smart Flight Booking Assistant launcher > "%LOG_FILE%"

:: 2. Resolve Host Python Interpreter (Check py launcher, python, python3)
set "HOST_PYTHON="

:: Try Windows standard Python launcher 'py'
py -c "import sys; assert sys.version_info >= (3, 9)" >> "%LOG_FILE%" 2>&1
if !errorlevel! equ 0 (
    set "HOST_PYTHON=py"
    echo [*] Detected Python Launcher: py
    echo [*] Detected Python Launcher: py >> "%LOG_FILE%"
)

:: Try 'python' on PATH if py was not found
if not defined HOST_PYTHON (
    python -c "import sys; assert sys.version_info >= (3, 9)" >> "%LOG_FILE%" 2>&1
    if !errorlevel! equ 0 (
        set "HOST_PYTHON=python"
        echo [*] Detected system Python: python
        echo [*] Detected system Python: python >> "%LOG_FILE%"
    )
)

:: Try 'python3' on PATH
if not defined HOST_PYTHON (
    python3 -c "import sys; assert sys.version_info >= (3, 9)" >> "%LOG_FILE%" 2>&1
    if !errorlevel! equ 0 (
        set "HOST_PYTHON=python3"
        echo [*] Detected system Python: python3
        echo [*] Detected system Python: python3 >> "%LOG_FILE%"
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
    echo [ERROR] No compatible Python installation found >> "%LOG_FILE%"
    echo.
    pause
    exit /b 1
)

:: Display detected host Python version
for /f "delims=" %%v in ('!HOST_PYTHON! -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"') do set "HOST_VER=%%v"
echo [*] Host Python Version: !HOST_VER!
echo [*] Host Python Version: !HOST_VER! >> "%LOG_FILE%"

:: 3. Select Python Runtime (Check Host Python packages vs isolated venv)
:: First test if host python already has all requirements
set "RUN_PYTHON="
!HOST_PYTHON! -c "import fastapi, uvicorn, pydantic, pandas, joblib, sklearn" >> "%LOG_FILE%" 2>&1
if !errorlevel! equ 0 (
    set "RUN_PYTHON=!HOST_PYTHON!"
    echo [*] Host Python has all required dependencies ready. Using host environment.
    echo [*] Selected RUN_PYTHON: Host Python >> "%LOG_FILE%"
)

:: If host python is missing dependencies, manage local isolated venv
if not defined RUN_PYTHON (
    echo [*] Checking local virtual environment...
    set "VENV_PYTHON=%~dp0venv\Scripts\python.exe"
    set "REBUILD_VENV=0"

    if not exist "!VENV_PYTHON!" (
        set "REBUILD_VENV=1"
        echo [*] Virtual environment not found. Preparing automatic setup...
    ) else (
        "!VENV_PYTHON!" -c "import fastapi, uvicorn, pydantic, pandas, joblib, sklearn" >> "%LOG_FILE%" 2>&1
        if !errorlevel! neq 0 (
            set "REBUILD_VENV=1"
            echo [NOTICE] Existing venv is incomplete or from another machine. Re-creating...
        )
    )

    if "!REBUILD_VENV!"=="1" (
        echo [*] Creating isolated virtual environment in .\venv ...
        if exist "%~dp0venv" (
            rmdir /s /q "%~dp0venv" >> "%LOG_FILE%" 2>&1
        )
        !HOST_PYTHON! -m venv "%~dp0venv" >> "%LOG_FILE%" 2>&1
        if !errorlevel! neq 0 (
            echo [ERROR] Failed to create virtual environment!
            echo Check "%LOG_FILE%" for details.
            pause
            exit /b 1
        )
        echo [*] Installing required packages from requirements.txt ...
        "!VENV_PYTHON!" -m pip install --upgrade pip >> "%LOG_FILE%" 2>&1
        "!VENV_PYTHON!" -m pip install -r "%~dp0requirements.txt" >> "%LOG_FILE%" 2>&1
        if !errorlevel! neq 0 (
            echo.
            echo [ERROR] Package installation failed!
            echo Please ensure you have an active internet connection on first startup.
            pause
            exit /b 1
        )
        echo [*] Dependencies installed successfully.
    )
    set "RUN_PYTHON=!VENV_PYTHON!"
)

:: 4. Verify Essential Files
if not exist "%~dp0backend\flight_price_rf_pipeline_v2.pkl" (
    if not exist "%~dp0backend\flight_price_rf_pipeline.pkl" (
        echo.
        echo [ERROR] Model file not found in %~dp0backend!
        echo [ERROR] Model file missing >> "%LOG_FILE%"
        pause
        exit /b 1
    )
)
if not exist "%~dp0backend\duration_lookup.json" (
    echo [WARN] duration_lookup.json missing; backend will use static fallbacks.
    echo [WARN] duration_lookup.json missing >> "%LOG_FILE%"
)
echo [*] Core ML Model and data lookup files verified.

:: 5. Clean Port Collisions safely (Port 8000 and 5500)
echo [*] Checking local port availability...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo [*] Releasing port 8000 - occupied by PID %%a
        echo [*] Terminating PID %%a on port 8000 >> "%LOG_FILE%"
        taskkill /F /PID %%a >> "%LOG_FILE%" 2>&1
    )
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500 " ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo [*] Releasing port 5500 - occupied by PID %%a
        echo [*] Terminating PID %%a on port 5500 >> "%LOG_FILE%"
        taskkill /F /PID %%a >> "%LOG_FILE%" 2>&1
    )
)

:: 6. Start FastAPI Backend Server
echo.
echo [1/3] Starting FastAPI Backend on port 8000...
start "Flight Assistant Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && !RUN_PYTHON! -m uvicorn main:app --port 8000 --host 127.0.0.1"

:: 7. Start Frontend Static Server
echo [2/3] Starting Frontend Server on port 5500...
start "Flight Assistant Frontend (Server)" cmd /k "cd /d "%~dp0frontend" && !RUN_PYTHON! serve.py 5500"

:: 8. Active Health Check Polling Loop (up to 15 seconds)
echo [3/3] Waiting for backend services to initialize...
set "READY=0"
for /L %%i in (1,1,15) do (
    if !READY! equ 0 (
        !RUN_PYTHON! -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" >> "%LOG_FILE%" 2>&1
        if !errorlevel! equ 0 (
            set "READY=1"
        ) else (
            !RUN_PYTHON! -c "import time; time.sleep(1)"
        )
    )
)

if !READY! equ 1 (
    echo [*] Backend health check PASSED - http://127.0.0.1:8000/health is responsive.
    echo [*] Backend health check PASSED >> "%LOG_FILE%"
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
    echo [WARNING] Backend did not respond within 15 seconds >> "%LOG_FILE%"
    echo Please inspect the "Flight Assistant Backend (FastAPI)" window for errors.
    echo Opening frontend anyway: http://127.0.0.1:5500/index.html
    start http://127.0.0.1:5500/index.html
)

echo.
echo Press any key to exit this launcher window (servers will continue running in their own windows)...
pause >nul
exit /b 0
