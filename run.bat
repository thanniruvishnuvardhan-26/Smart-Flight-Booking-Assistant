@echo off
title AeroMetrics Platform Launcher
echo ========================================================
echo        STARTING AEROMETRICS FLIGHT INTELLIGENCE
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting FastAPI Backend on port 8000...
start "AeroMetrics Backend (FastAPI)" cmd /k "cd /d backend && python -m uvicorn main:app --port 8000 --reload"

echo [2/3] Starting Frontend Web Server on port 5500...
start "AeroMetrics Frontend (Server)" cmd /k "cd /d frontend && python serve.py 5500"

echo [3/3] Waiting 2 seconds for services to initialize...
timeout /t 2 /nobreak >nul

echo Opening AeroMetrics in your default browser...
start http://127.0.0.1:5500/index.html

echo.
echo ========================================================
echo   Services are running!
echo   Frontend : http://127.0.0.1:5500/index.html
echo   Backend  : http://127.0.0.1:8000
echo   API Docs : http://127.0.0.1:8000/docs
echo ========================================================
