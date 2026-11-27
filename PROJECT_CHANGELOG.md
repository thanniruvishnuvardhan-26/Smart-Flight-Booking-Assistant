# PROJECT CHANGELOG — SMART FLIGHT BOOKING ASSISTANT

## Version 2.1.0 — November 27, 2026

### 1. `run.bat` Syntax and Window Auto-Close Fix
- **Root Cause Identified:** Line 106 in `run.bat` included unescaped parentheses `(first run on this laptop)` inside an `if (...)` statement block. In Windows `cmd.exe`, nested unescaped parentheses prematurely terminate the batch parser with `... was unexpected at this time.`, which causes Command Prompt to exit immediately upon double-clicking.
- **Fix Applied:** Removed nested unescaped parentheses in all echo messages. Added a comprehensive log file `logs/startup.log` documenting every step of startup.
- **Window Persistence:** Added `pause >nul` at the end and in all error exit labels (`:ERROR`) so Command Prompt stays open on errors with explicit troubleshooting guidance.

### 2. Dual-Environment Host & Venv Portability
- **Smart Runtime Selection:** Updated `run.bat` to test host Python (`py` / `python`) for required packages first. If host Python has dependencies installed, it starts immediately with zero overhead.
- **Isolated Venv Auto-Healing:** If host Python lacks packages, `run.bat` automatically creates and populates an isolated local `.venv` using `requirements.txt`.
- **Zero Hardcoded Paths:** Dynamic `%~dp0` resolution ensures the project runs on any Windows machine regardless of username or drive letter.

### 3. Service Verification & Live Execution
- **FastAPI Backend (Uvicorn):** Running on `http://127.0.0.1:8000` with Random Forest model V2 (`flight_price_rf_pipeline_v2.pkl`) and `duration_lookup.json`.
- **Frontend Server:** Running on `http://127.0.0.1:5500/index.html` with static file serving and CORS configuration.
- **REST API Endpoints:** Verified `/health`, `/predict`, and `/feature-importance`.
