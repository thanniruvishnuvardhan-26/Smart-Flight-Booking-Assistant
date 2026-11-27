# Process Cleanup & Port Management Report

**Project:** Smart Flight Booking Assistant  
**Date:** November 27, 2026  
**Status:** ALL SERVICES ACTIVE & HEALTHY  

---

## 1. Process and Port Audit Summary

During the audit and startup of the Smart Flight Booking Assistant, port usage was inspected to prevent duplicate processes, orphan servers, and address conflicts:

| Port | Service | Bound Host | Status | Process Name / PID |
| :--- | :--- | :--- | :--- | :--- |
| **8000** | FastAPI Uvicorn REST API | `127.0.0.1` | **Active / Listening** | `python.exe` (PID 1680) |
| **5500** | Python Frontend HTTP Server | `127.0.0.1` | **Active / Listening** | `python.exe` (PID 28632) |

---

## 2. Port Collision Prevention in `run.bat`

To prevent background port collision errors on Windows:
1. `run.bat` queries Windows `netstat -aon` specifically for ports `8000` and `5500` in `LISTENING` state.
2. Identifies any occupying process ID (`PID`).
3. Safely releases the port via `taskkill /F /PID %PID%` without terminating unrelated applications.
4. Logs each action to `logs/startup.log`.

---

## 3. Current Live Verification

- **Backend Health Check:** `http://127.0.0.1:8000/health` -> `200 OK`
  ```json
  {"status": "healthy", "model_loaded": true, "model_version": "v2", "mae": 1293.06}
  ```
- **Frontend Server:** `http://127.0.0.1:5500/index.html` -> `200 OK` (49,884 bytes)
- **Prediction Endpoint:** `http://127.0.0.1:8000/predict` -> `200 OK`
