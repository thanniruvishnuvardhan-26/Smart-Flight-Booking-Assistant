# Final Audit & Verification Report — Smart Flight Booking Assistant
**Document:** BAT Startup, ML Model Compatibility, and Render Deployment Final Audit  
**Project:** Smart Flight Booking Assistant  
**Repository:** [thanniruvishnuvardhan-26/Smart-Flight-Booking-Assistant](https://github.com/thanniruvishnuvardhan-26/Smart-Flight-Booking-Assistant)  
**Audit Date:** November 25, 2026  
**Auditor:** Antigravity AI Engineering Assistant  
**Verdict:** **ALL SYSTEMS VERIFIED & OPERATIONAL (LOCAL & RENDER)**

---

## 1. Render Deployment URL Verification

### Audit Methodology
We performed live network requests directly to both candidate URLs:
1. `https://smart-flight-booking-assistant.onrender.com`
2. `https://smart-flight-booking-assistant-16wy.onrender.com`

### Empirical Test Results
| Endpoint Tested | Candidate A: `smart-flight-booking-assistant.onrender.com` | Candidate B: `smart-flight-booking-assistant-16wy.onrender.com` | Verified Status |
| :--- | :--- | :--- | :--- |
| **`GET /`** | Connection Timeout (Unreachable / Expired slug) | **HTTP 200 OK** (`{"version": "2.0", "health": "healthy"}`) | **Active & Live** |
| **`GET /health`** | Connection Timeout | **HTTP 200 OK** (`{"status": "healthy", "model_version": "v2"}`) | **Active & Live** |
| **`GET /docs`** | Connection Timeout | **HTTP 200 OK** (Interactive Swagger UI) | **Active & Live** |
| **`POST /predict`** | Connection Timeout | **HTTP 200 OK** (`predicted_price: ₹ 2,675.32`) | **Active & Live** |
| **CORS Header** | N/A | `access-control-allow-origin: <origin>` (`allow_credentials=True`) | **Fully Compliant** |

### Verified Correction
- **True Production URL:** `https://smart-flight-booking-assistant-16wy.onrender.com`
- **Action Taken:** Updated `frontend/script.js` so `PRODUCTION_API_URL` points directly to `https://smart-flight-booking-assistant-16wy.onrender.com`.
- **Automatic Fallback:** When running locally via `127.0.0.1` or `localhost`, `frontend/script.js` automatically routes to `http://127.0.0.1:8000`.

---

## 2. Machine Learning Model Compatibility Audit (`flight_price_rf_pipeline_v2.pkl`)

We inspected `backend/flight_price_rf_pipeline_v2.pkl` using Scikit-Learn and Pandas:

### A. Feature Inclusion Audit
- **Pipeline Structure:**
  - `preprocessor` (`sklearn.compose.ColumnTransformer`)
  - `model` (`sklearn.ensemble.RandomForestRegressor`, 30 estimators, max depth 20, random_state 42)
- **Numerical Features (StandardScaler):**
  - **`['duration', 'days_left']`**
  - **Confirmed:** `duration` is **explicitly included and scaled**, satisfying the core requirement that duration remains an active model feature.
- **Categorical Features (OneHotEncoder):**
  - `['airline', 'source_city', 'departure_time', 'arrival_time', 'destination_city', 'class', 'stops']`
  - Total encoded features: **37 features**.

### B. Stops Preprocessing Compatibility
- `stops` is processed with `OneHotEncoder` across categories `['zero', 'one', 'two_or_more']`.
- The backend `main.py` contains the `normalize_stops_value()` adapter:
  - Input `0` / `"0"` / `"zero"` / `"non-stop"` $\to$ `"zero"`
  - Input `1` / `"1"` / `"one"` $\to$ `"one"`
  - Input `2` / `"2"` / `"two_or_more"` $\to$ `"two_or_more"`
- Both integer and string payloads operate with zero transformation errors.

### C. Feature Importance Alignment
Extracted directly from the pipeline's 30 decision trees:
1. `cat__class_Economy`: **53.16%**
2. `cat__class_Business`: **35.43%**
3. `num__duration`: **5.56%**
4. `num__days_left`: **1.60%**
5. `cat__airline_Air_India`: **0.57%**
6. `cat__airline_Vistara`: **0.44%**
7. `cat__source_city_Delhi`: **0.38%**
8. `cat__destination_city_Delhi`: **0.34%**
- **Alignment:** Identical features and importances serve both the prediction engine (`/predict`) and the Fare Insights dashboard (`/feature-importance`).

---

## 3. Local Startup & BAT File Verification (`run.bat`)

### Root Cause of Previous BAT Failures
1. **Broken Virtual Environment Base:** `Smart_Flight_Booking_Assistant/venv/pyvenv.cfg` pointed to `C:\Users\bse70\AppData\Local\Programs\Python\Python313\python.exe` (a different user account on another machine). Invoking `venv\Scripts\python.exe` aborted with "The system cannot find the path specified."
2. **Batch Parser Syntax Errors:** Unescaped parentheses inside `for /f` and `if exist` loops caused cmd syntax crashes (`. was unexpected at this time`).
3. **Timeout vs. Redirection Error:** `timeout /t 1 >nul` inside background batch loops failed with `ERROR: Input redirection is not supported`.

### Corrections Made in `run.bat`
1. **Executable Validation:** `run.bat` tests `venv\Scripts\python.exe -c "import sys"`. If invalid, it seamlessly falls back to the working system Python (`C:\Users\thann\AppData\Local\Programs\Python\Python314\python.exe`).
2. **Safe Syntax:** Escaped cmd delimiters and clean variable expansion.
3. **Python Sleep:** Replaced `timeout /t 1` with `"!PYTHON_EXE!" -c "import time; time.sleep(1)"` inside the health check loop.
4. **Port Management:** Releases stale processes on port 8000 and 5500 cleanly before binding.
5. **Dynamic Health Polling:** Polls `http://127.0.0.1:8000/health` up to 12 times and opens `http://127.0.0.1:5500/index.html` only when confirmed responsive.

### Live Execution Test Output (`run.bat`)
```
========================================================
       SMART FLIGHT BOOKING ASSISTANT LAUNCHER
========================================================

[*] Project Root: c:\Users\thann\OneDrive\Desktop\Airfare prediction\Smart_Flight_Booking_Assistant
[NOTICE] venv\Scripts\python.exe is invalid on this machine. Falling back...
[*] Using system Python
[*] Verifying essential packages (fastapi, uvicorn, pandas, joblib, sklearn)...
[*] All required Python dependencies verified.
[*] ML Model file verified.

[*] Checking port availability...

[1/3] Starting FastAPI Backend on port 8000...
[2/3] Starting Frontend Server on port 5500...
[3/3] Waiting for backend services to respond...
[*] Backend health check PASSED - http://127.0.0.1:8000/health is responsive.

========================================================
  SUCCESS: All Services Are Live
  Frontend Web App : http://127.0.0.1:5500/index.html
  FastAPI Backend  : http://127.0.0.1:8000
  Interactive Docs : http://127.0.0.1:8000/docs
========================================================

Launching default web browser...
```

---

## 4. Render Deployment Verification

### Cloud Configuration Inspection
- **`render.yaml`:**
  ```yaml
  services:
    - type: web
      name: smart-flight-booking-assistant
      runtime: python
      buildCommand: pip install -r requirements.txt
      startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
      envVars:
        - key: PYTHON_VERSION
          value: 3.11.9
  ```
  - Port binding `$PORT` is respected.
  - Entry point `backend.main:app` is valid.
  - Root proxy `main.py` is present (`from backend.main import app`) to ensure compatibility with either root or subfolder module resolvers.

### Live Live Production Prediction Test
Tested via `urllib.request` with an external `Origin: https://example.com` header:
- **HTTP Status:** `200 OK`
- **CORS Header Returned:** `access-control-allow-origin: https://example.com`
- **Prediction Payload Tested:**
  ```json
  {
    "airline": "Vistara",
    "source_city": "Delhi",
    "departure_time": "Morning",
    "stops": "zero",
    "destination_city": "Mumbai",
    "flight_class": "Economy",
    "days_left": 15
  }
  ```
- **Prediction Returned:**
  ```json
  {
    "predicted_price": 2675.32,
    "lower_price": 1382.26,
    "upper_price": 3968.38,
    "mae": 1293.06,
    "tree_uncertainty": 278.66,
    "effective_duration": 2.17,
    "effective_arrival_time": "Afternoon",
    "crosses_midnight": false,
    "currency": "INR"
  }
  ```

---

## 5. Audit Summary Matrix

| Verification Item | Target Criteria | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Render URL** | Identifies true live endpoint | **PASS** | `https://smart-flight-booking-assistant-16wy.onrender.com` confirmed 200 OK; outdated slug replaced |
| **Model Duration** | Duration included in features | **PASS** | Numerical transformer contains `['duration', 'days_left']` (5.56% importance) |
| **Model Stops** | Stops One-Hot encoded | **PASS** | Categorical transformer handles `zero`, `one`, `two_or_more` (37 total features) |
| **BAT Script** | `run.bat` launches clean | **PASS** | Auto-detects functional Python, cleans ports, starts Uvicorn & Frontend, passes health check |
| **Diagnostics** | `BAT_DIAGNOSTICS.bat` | **PASS** | 8/8 automated checks passed |
| **Local Prediction**| Prediction works locally | **PASS** | Tested on `http://127.0.0.1:8000/predict` $\to$ ₹ 2,675.32 |
| **Render Prediction**| Prediction works on cloud | **PASS** | Tested on Render URL $\to$ ₹ 2,675.32 with full CORS headers |
| **Independence** | Local & Cloud separated | **PASS** | `frontend/script.js` dynamically routes based on `window.location.hostname` |

---

## 6. How to Run the Verified Project
- **To Launch Locally:** Double-click `run.bat` in the project folder.
- **To Run Startup Diagnostics:** Double-click `BAT_DIAGNOSTICS.bat`.
- **To Access Online Cloud Deployment:** Visit `https://smart-flight-booking-assistant-16wy.onrender.com/docs`.
