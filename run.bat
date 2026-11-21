@echo off
setlocal enabledelayedexpansion
title Smart Flight Booking Assistant Launcher
echo ========================================================
echo        SMART FLIGHT BOOKING ASSISTANT LAUNCHER
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Detect Python Environment (Prefer project venv if present, otherwise system Python)
set "PYTHON_EXE=python"
if exist "venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
    echo [*] Using project virtual environment: venv\Scripts\python.exe
) else (
    echo [*] Using system Python
)

:: 2. Check and clean up any stale processes on port 8000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [*] Stopping previous backend process on port 8000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. Check and clean up any stale processes on port 5500 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500" ^| findstr "LISTENING"') do (
    echo [*] Stopping previous frontend process on port 5500 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [1/3] Starting FastAPI Backend on port 8000...
start "Flight Assistant Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && "%PYTHON_EXE%" -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload"

echo [2/3] Starting Frontend Server on port 5500...
start "Flight Assistant Frontend (Server)" cmd /k "cd /d "%~dp0frontend" && "%PYTHON_EXE%" serve.py 5500"

echo [3/3] Waiting 3 seconds for services to initialize...
timeout /t 3 /nobreak >nul

echo Opening Smart Flight Booking Assistant in your browser...
start http://127.0.0.1:5500/index.html

echo.
echo ========================================================
echo   Services are running!
echo   Frontend : http://127.0.0.1:5500/index.html
echo   Backend  : http://127.0.0.1:8000
echo   API Docs : http://127.0.0.1:8000/docs
echo ========================================================
