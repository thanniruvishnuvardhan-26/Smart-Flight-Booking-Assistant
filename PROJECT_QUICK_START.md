# Quick Start Guide — Smart Flight Booking Assistant

Welcome to the **Smart Flight Booking Assistant** (AeroMetrics). Follow this guide to run the project locally or access the API documentation.

---

## 1. Quick Launch with Double-Click (Recommended)

Simply double-click the primary batch script in the project root:

```cmd
run.bat
```

### What `run.bat` does automatically:
1. **Intelligent Python Detection:** Verifies whether `venv\Scripts\python.exe` is functional. If it was created under another user or machine path, it automatically falls back to your functional system Python or Windows `py` launcher.
2. **Dependency Verification:** Pre-checks that `fastapi`, `uvicorn`, `pandas`, `joblib`, and `scikit-learn` are installed.
3. **Port Conflict Cleanup:** Automatically releases any stale processes occupying ports `8000` or `5500`.
4. **Launches FastAPI Backend:** Starts the backend on `http://127.0.0.1:8000`.
5. **Launches Frontend HTTP Server:** Serves UI on `http://127.0.0.1:5500`.
6. **Health Verification Polling:** Polls `http://127.0.0.1:8000/health` up to 12 seconds until the model and API are confirmed live.
7. **Browser Launch:** Opens `http://127.0.0.1:5500/index.html` in your default browser.

---

## 2. Startup Diagnostics Utility

If you ever experience issues launching the application, run:

```cmd
BAT_DIAGNOSTICS.bat
```

This diagnostic script runs 8 automated tests:
1. Python interpreter execution.
2. Critical dependency imports.
3. Project script availability.
4. Model PKL file existence.
5. Duration lookup table existence.
6. FastAPI backend app importability.
7. Port 8000 & 5500 availability.
8. Render deployment configuration integrity.

It prints `[PASS]` or `[FAIL]` for each component and summarizes system readiness.

---

## 2. Manual Startup via Terminal

If you prefer launching each service manually:

### Step 1: Start Backend
```cmd
cd Smart_Flight_Booking_Assistant/backend
python -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload
```
- API Base: `http://127.0.0.1:8000`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

### Step 2: Start Frontend
In a second terminal window:
```cmd
cd Smart_Flight_Booking_Assistant/frontend
python serve.py 5500
```
- Access application in browser: `http://127.0.0.1:5500/index.html`

---

## 3. Key Navigation & Features
- **Overview Dashboard:** High-level platform statistics, pipeline architecture, and dataset limitations notice.
- **Price Predictor:** Select Origin, Destination, Departure Slot, Cabin Class, and Carrier. Duration and Arrival Slot calculate automatically!
- **Booking Trends:** Visualize the complete 50-day booking trajectory to discover the lowest airfare day.
- **Cheaper Alternatives:** One-click scan comparing alternative airlines, stops, and departure times with instant rupee savings indicators.
- **Fare Insights:** Interactive Chart.js visualizations covering class impact, airline pricing spreads, and stop penalties.
- **About & Methodology:** Full scientific specifications, feature importances, and historical dataset transparency.

---

## 4. Verification Check
To run an automated test of all backend endpoints:
```cmd
python -c "from backend.main import app; from fastapi.testclient import TestClient; c = TestClient(app); print(c.get('/health').json())"
```
Output:
```json
{"status": "healthy", "model_loaded": true, "model_version": "v2", "mae": 1293.06}
```
