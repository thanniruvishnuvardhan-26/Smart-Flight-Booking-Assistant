@echo off
setlocal enabledelayedexpansion
title Smart Flight Booking Assistant Launcher
echo ========================================================
echo        SMART FLIGHT BOOKING ASSISTANT LAUNCHER
echo ========================================================
echo.

:: 1. Navigate to script directory
cd /d "%~dp0"
echo [*] Project Root: %CD%

:: 2. Resolve Working Python Interpreter
set "PYTHON_EXE="

if exist "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" -c "import sys" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
        echo [*] Using project virtual environment: venv\Scripts\python.exe
    ) else (
        echo [NOTICE] venv\Scripts\python.exe is invalid on this machine. Falling back...
    )
)

if not defined PYTHON_EXE (
    python -c "import sys" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
        echo [*] Using system Python
    )
)

if not defined PYTHON_EXE (
    py -c "import sys" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=py"
        echo [*] Using Python launcher (py)
    )
)

if not defined PYTHON_EXE (
    echo.
    echo [ERROR] No working Python interpreter found on this computer!
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    echo Ensure "Add Python to PATH" is checked during installation.
    echo.
    pause
    exit /b 1
)

:: Verify critical modules
echo [*] Verifying essential packages (fastapi, uvicorn, pandas, joblib, sklearn)...
"!PYTHON_EXE!" -c "import fastapi, uvicorn, pandas, joblib, sklearn" >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Required packages are missing in the selected Python environment:
    echo   !PYTHON_EXE!
    echo.
    echo Please install dependencies by running:
    echo   "!PYTHON_EXE!" -m pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)
echo [*] All required Python dependencies verified.

:: Verify model files exist
set "MODEL_OK=0"
if exist "%~dp0backend\flight_price_rf_pipeline_v2.pkl" set "MODEL_OK=1"
if exist "%~dp0backend\flight_price_rf_pipeline.pkl" set "MODEL_OK=1"

if "!MODEL_OK!"=="0" (
    echo.
    echo [ERROR] Trained model file not found in "%~dp0backend"!
    echo.
    pause
    exit /b 1
)
echo [*] ML Model file verified.

:: 3. Port conflict resolution - Ports 8000 and 5500
echo.
echo [*] Checking port availability...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [*] Detected process on port 8000 - PID %%a - releasing port...
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500" ^| findstr "LISTENING"') do (
    echo [*] Detected process on port 5500 - PID %%a - releasing port...
    taskkill /F /PID %%a >nul 2>&1
)

:: 4. Start Backend Server
echo.
echo [1/3] Starting FastAPI Backend on port 8000...
start "Flight Assistant Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && "!PYTHON_EXE!" -m uvicorn main:app --port 8000 --host 127.0.0.1"

:: 5. Start Frontend Server
echo [2/3] Starting Frontend Server on port 5500...
start "Flight Assistant Frontend (Server)" cmd /k "cd /d "%~dp0frontend" && "!PYTHON_EXE!" serve.py 5500"

:: 6. Health Check Wait Loop (Verify backend is actually responding before opening browser)
echo [3/3] Waiting for backend services to respond...
set "READY=0"
for /L %%i in (1,1,12) do (
    if !READY! equ 0 (
        "!PYTHON_EXE!" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "READY=1"
        ) else (
            "!PYTHON_EXE!" -c "import time; time.sleep(1)"
        )
    )
)

if !READY! equ 1 (
    echo [*] Backend health check PASSED - http://127.0.0.1:8000/health is responsive.
    echo.
    echo ========================================================
    echo   SUCCESS: All Services Are Live!
    echo   Frontend Web App : http://127.0.0.1:5500/index.html
    echo   FastAPI Backend  : http://127.0.0.1:8000
    echo   Interactive Docs : http://127.0.0.1:8000/docs
    echo ========================================================
    echo.
    echo Launching default web browser...
    start http://127.0.0.1:5500/index.html
) else (
    echo.
    echo [WARNING] Backend did not respond to health check within 12 seconds.
    echo Please check the "Flight Assistant Backend (FastAPI)" console window for errors.
    echo Attempting to open frontend anyway: http://127.0.0.1:5500/index.html
    start http://127.0.0.1:5500/index.html
)

exit /b 0
