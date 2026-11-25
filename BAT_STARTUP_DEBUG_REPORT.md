# BAT Startup Debugging & Local Execution Resolution Report

**Project Name:** Smart Flight Booking Assistant  
**Repository:** `Smart-Flight-Booking-Assistant`  
**Author:** AI Engineering Assistant  
**Date:** November 25, 2026  
**Status:** FULLY RESOLVED & OPERATIONAL

---

## 1. Executive Summary & Problem Overview
Following the deployment of the Smart Flight Booking Assistant on Render, local startup via the primary batch script (`run.bat`) failed. The user reported that executing the BAT file did not result in a running local application.

Our investigation uncovered the exact root causes, separated local development from the cloud deployment architecture, made `run.bat` resilient to virtual environment breakages, implemented automated health check polling, created a dedicated startup diagnostic utility (`BAT_DIAGNOSTICS.bat`), and verified all services end-to-end.

---

## 2. Root Cause Analysis

### Root Cause 1: Broken Hardcoded Paths in Virtual Environment (`venv/pyvenv.cfg`)
- **Evidence:**
  `Smart_Flight_Booking_Assistant/venv/pyvenv.cfg` contained:
  ```ini
  home = C:\Users\bse70\AppData\Local\Programs\Python\Python313
  executable = C:\Users\bse70\AppData\Local\Programs\Python\Python313\python.exe
  command = C:\Users\bse70\AppData\Local\Programs\Python\Python313\python.exe -m venv C:\Users\bse70\OneDrive\Desktop\Smart_Flight_Booking_Assistant\venv
  ```
- **Analysis:**
  The `venv` was created on a different computer/user account (`bse70`). When `venv\Scripts\python.exe` was invoked on the current machine (`thann`), it attempted to execute `C:\Users\bse70\AppData\Local\Programs\Python\Python313\python.exe`, which did not exist:
  ```
  did not find executable at 'C:\Users\bse70\AppData\Local\Programs\Python\Python313\python.exe': The system cannot find the path specified.
  ```
- **Impact on Previous BAT File:**
  The original BAT file blindly checked `if exist "venv\Scripts\python.exe" set PYTHON_EXE=venv\Scripts\python.exe`. Because the file existed as a stub, the script selected it and subsequently failed every Python invocation silently or aborted immediately when launching Uvicorn and the frontend.

### Root Cause 2: Lack of Python Environment Validation and Fallback
- The previous BAT script lacked fallback logic. On the current computer, Python 3.14 (`C:\Users\thann\AppData\Local\Programs\Python\Python314\python.exe`) is installed and has all dependencies (`fastapi`, `uvicorn`, `pandas`, `joblib`, `scikit-learn`, `pydantic`) installed.
- The BAT file never tested whether the chosen Python interpreter could execute before trying to start services.

### Root Cause 3: Fixed Sleep Timer vs. True Health Check
- The previous BAT script ran `timeout /t 3 /nobreak` and immediately launched the browser, assuming the backend was ready.
- If the backend was still loading the Random Forest pipeline or failed to start, the browser opened to a blank/connection error screen with no feedback to the user.

### Root Cause 4: Render vs. Local URL Coupling in Frontend
- While `render.yaml` was introduced for cloud deployment (`uvicorn backend.main:app --host 0.0.0.0 --port $PORT`), the frontend needed clean detection to ensure local execution always connects to `http://127.0.0.1:8000` while production deployments connect to the Render backend URL.

---

## 3. Files Modified & Changes Implemented

### 1. `run.bat` (Completely Rewritten & Hardened)
- **Interpreter Execution Validation:**
  Tests `venv\Scripts\python.exe` with a test execution command (`-c "import sys"`). If broken or pointing to a missing base path, it automatically falls back to system Python or the Windows `py` launcher.
- **Dependency Self-Check:**
  Pre-validates that `fastapi`, `uvicorn`, `pandas`, `joblib`, and `sklearn` can be imported by the chosen interpreter before starting processes.
- **Model File Verification:**
  Verifies that either `flight_price_rf_pipeline_v2.pkl` or `flight_price_rf_pipeline.pkl` exists in `backend/`.
- **Safe Port Release:**
  Checks for stale processes on port 8000 (FastAPI) and port 5500 (frontend HTTP server) and releases them cleanly.
- **Dynamic Polling Health Loop:**
  Polls `http://127.0.0.1:8000/health` up to 12 times (1-second intervals). Only after receiving HTTP 200 does it open the browser, ensuring zero race conditions.
- **Visible Error Reporting:**
  Console windows remain open with informative error logs if any service encounters an exception.

### 2. `BAT_DIAGNOSTICS.bat` (New Diagnostic Utility)
A stand-alone, non-destructive script that performs 8 system checks:
1. Python Interpreter accessibility and executable status.
2. Critical dependencies (`fastapi`, `uvicorn`, `pydantic`, `pandas`, `joblib`, `sklearn`).
3. Key project scripts (`backend/main.py`, `frontend/index.html`, `frontend/script.js`, `frontend/serve.py`).
4. Machine learning model (`flight_price_rf_pipeline_v2.pkl`).
5. Duration lookup table (`backend/duration_lookup.json`).
6. FastAPI app import test (`from backend.main import app`).
7. Port 8000 and 5500 availability.
8. Render deployment configuration integrity (`render.yaml`, root `main.py`).

### 3. `frontend/script.js` (Environment Separation)
Added clean, automated environment switching:
```javascript
const IS_LOCAL = window.location.hostname === "localhost" || 
                 window.location.hostname === "127.0.0.1" || 
                 window.location.protocol === "file:";

const LOCAL_API_URL = "http://127.0.0.1:8000";
const PRODUCTION_API_URL = "https://smart-flight-booking-assistant.onrender.com";

const API_BASE_URL = IS_LOCAL ? LOCAL_API_URL : PRODUCTION_API_URL;
```

### 4. Preservation of Render Configuration
- `render.yaml` remains untouched and configured for cloud deployment.
- Root `main.py` remains in place to support Render's ASGI entry point (`uvicorn main:app` or `uvicorn backend.main:app`).

---

## 4. Verification Evidence & Test Results

### A. Diagnostic Script Output (`BAT_DIAGNOSTICS.bat`)
```
======================================================================
      SMART FLIGHT BOOKING ASSISTANT - STARTUP DIAGNOSTICS
======================================================================

[1/8] Checking Python Interpreter...
      [WARN] venv\Scripts\python.exe exists but failed execution check.
      [PASS] System Python is valid: C:\Users\thann\AppData\Local\Programs\Python\Python314\python.exe
[2/8] Checking Required Dependencies (fastapi, uvicorn, pydantic, pandas, joblib, sklearn)...
      [PASS] All critical dependencies are installed.
[3/8] Key Project Files...
      [PASS] All essential frontend and backend scripts exist.
[4/8] Checking Trained ML Model PKL File...
      [PASS] V2 Random Forest model found: backend\flight_price_rf_pipeline_v2.pkl
[5/8] Checking Duration Lookup Table...
      [PASS] Duration lookup table found: backend\duration_lookup.json
[6/8] Checking FastAPI App Importability...
      [PASS] backend.main:app imports without runtime errors.
[7/8] Checking Port Availability - 8000 for backend, 5500 for frontend...
      [PASS] Ports checked.
[8/8] Checking Render Deployment Configuration...
      [PASS] Render deployment configurations are intact.

======================================================================
DIAGNOSTIC SUMMARY: 8 Passed, 0 Failed
[RESULT] System is HEALTHY and READY to run via run.bat.
======================================================================
```

### B. Backend API Test Suite Output
```
Health Check: PASS -> {'status': 'healthy', 'model_loaded': True, 'model_version': 'v2', 'mae': 1293.06}
Available Options: PASS -> ['airlines', 'cities', 'departure_times', 'arrival_times', 'flight_classes', 'stops']
Flight Details Calculation: PASS -> duration: 2.17 arrival: Afternoon
Flight Prediction: PASS -> price: 2594.38 MAE: 1293.06 tree_uncertainty: 271.48
Booking Advisor: PASS -> action: BOOK_NOW recommendation: Current airfare (₹2,594.38) is optimal. Fares historically rise steadily as the departure date nears.

ALL BACKEND VERIFICATIONS CONFIRMED OPERATIONAL!
```

---

## 5. How to Run Locally

Double-click `run.bat` in the project directory:
```
Smart_Flight_Booking_Assistant\run.bat
```
1. It validates the Python interpreter and dependencies.
2. It cleans ports 8000 and 5500 if occupied.
3. It launches the FastAPI backend on port 8000.
4. It launches the frontend server on port 5500.
5. It polls `http://127.0.0.1:8000/health` until ready.
6. It opens `http://127.0.0.1:5500/index.html` in your default web browser.

For troubleshooting, run:
```
Smart_Flight_Booking_Assistant\BAT_DIAGNOSTICS.bat
```
