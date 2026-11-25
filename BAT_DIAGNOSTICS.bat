@echo off
setlocal enabledelayedexpansion
title Smart Flight Booking Assistant - System Diagnostic Utility
echo ======================================================================
echo       SMART FLIGHT BOOKING ASSISTANT - STARTUP DIAGNOSTICS
echo ======================================================================
echo.

cd /d "%~dp0"
set /a PASS_COUNT=0
set /a FAIL_COUNT=0

echo [1/8] Checking Python Interpreter...
set "DIAG_PYTHON="
if exist "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" -c "import sys" >nul 2>&1
    if !errorlevel! equ 0 (
        set "DIAG_PYTHON=%~dp0venv\Scripts\python.exe"
        echo       [PASS] Virtual environment Python is valid: %~dp0venv\Scripts\python.exe
        set /a PASS_COUNT+=1
    ) else (
        echo       [WARN] venv\Scripts\python.exe exists but failed execution check.
    )
)

if not defined DIAG_PYTHON (
    python -c "import sys" >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "delims=" %%I in ('python -c "import sys; print(sys.executable)"') do set "DIAG_PYTHON=%%I"
        echo       [PASS] System Python is valid: !DIAG_PYTHON!
        set /a PASS_COUNT+=1
    ) else (
        echo       [FAIL] No executable Python interpreter found.
        set /a FAIL_COUNT+=1
    )
)

echo [2/8] Checking Required Dependencies (fastapi, uvicorn, pydantic, pandas, joblib, sklearn)...
if defined DIAG_PYTHON (
    "!DIAG_PYTHON!" -c "import fastapi, uvicorn, pydantic, pandas, joblib, sklearn" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       [PASS] All critical dependencies are installed.
        set /a PASS_COUNT+=1
    ) else (
        echo       [FAIL] Missing required dependencies.
        set /a FAIL_COUNT+=1
    )
) else (
    echo       [SKIP] Skipped dependencies check.
    set /a FAIL_COUNT+=1
)

echo [3/8] Checking Key Project Files...
set /a FILES_OK=1
if not exist "%~dp0backend\main.py" (
    echo       [FAIL] Missing backend\main.py
    set /a FILES_OK=0
)
if not exist "%~dp0frontend\index.html" (
    echo       [FAIL] Missing frontend\index.html
    set /a FILES_OK=0
)
if not exist "%~dp0frontend\script.js" (
    echo       [FAIL] Missing frontend\script.js
    set /a FILES_OK=0
)
if not exist "%~dp0frontend\serve.py" (
    echo       [FAIL] Missing frontend\serve.py
    set /a FILES_OK=0
)
if !FILES_OK! equ 1 (
    echo       [PASS] All essential frontend and backend scripts exist.
    set /a PASS_COUNT+=1
) else (
    set /a FAIL_COUNT+=1
)

echo [4/8] Checking Trained ML Model PKL File...
set /a MODEL_FOUND=0
if exist "%~dp0backend\flight_price_rf_pipeline_v2.pkl" (
    echo       [PASS] V2 Random Forest model found: backend\flight_price_rf_pipeline_v2.pkl
    set /a MODEL_FOUND=1
    set /a PASS_COUNT+=1
)
if !MODEL_FOUND! equ 0 (
    if exist "%~dp0backend\flight_price_rf_pipeline.pkl" (
        echo       [PASS] V1 Random Forest model found: backend\flight_price_rf_pipeline.pkl
        set /a MODEL_FOUND=1
        set /a PASS_COUNT+=1
    )
)
if !MODEL_FOUND! equ 0 (
    echo       [FAIL] No trained model file (.pkl^) found in backend directory.
    set /a FAIL_COUNT+=1
)

echo [5/8] Checking Duration Lookup Table...
if exist "%~dp0backend\duration_lookup.json" (
    echo       [PASS] Duration lookup table found: backend\duration_lookup.json
    set /a PASS_COUNT+=1
) else (
    echo       [WARN] duration_lookup.json missing; backend will use static fallback medians.
)

echo [6/8] Checking FastAPI App Importability...
if defined DIAG_PYTHON (
    "!DIAG_PYTHON!" -c "import sys; sys.path.insert(0, r'%CD%'); from backend.main import app" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       [PASS] backend.main:app imports without runtime errors.
        set /a PASS_COUNT+=1
    ) else (
        echo       [FAIL] Failed to import backend.main:app.
        set /a FAIL_COUNT+=1
    )
) else (
    echo       [SKIP] Skipped FastAPI import check.
    set /a FAIL_COUNT+=1
)

echo [7/8] Checking Port Availability - 8000 for backend, 5500 for frontend...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo       [NOTICE] Port 8000 occupied by PID %%a - run.bat auto-releases this.
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500" ^| findstr "LISTENING"') do (
    echo       [NOTICE] Port 5500 occupied by PID %%a - run.bat auto-releases this.
)
echo       [PASS] Ports checked.
set /a PASS_COUNT+=1

echo [8/8] Checking Render Deployment Configuration...
set /a RENDER_OK=1
if not exist "%~dp0render.yaml" set /a RENDER_OK=0
if not exist "%~dp0main.py" set /a RENDER_OK=0
if !RENDER_OK! equ 1 (
    echo       [PASS] Render deployment configurations are intact.
    set /a PASS_COUNT+=1
) else (
    echo       [WARN] Some Render deployment files were not detected.
)

echo.
echo ======================================================================
echo DIAGNOSTIC SUMMARY: !PASS_COUNT! Passed, !FAIL_COUNT! Failed
if !FAIL_COUNT! equ 0 (
    echo [RESULT] System is HEALTHY and READY to run via run.bat.
) else (
    echo [RESULT] Issues detected above. Please address the marked [FAIL] items.
)
echo ======================================================================
echo.
pause
exit /b !FAIL_COUNT!
