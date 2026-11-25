# Portable Setup & Cross-Laptop Guide
## Smart Flight Booking Assistant

This guide explains how to copy the **Smart Flight Booking Assistant** project to **any other Windows laptop** and run it immediately with a single double-click.

---

## 1. Zero-Configuration Running (Quick Start)

1. **Copy the Folder:**
   Copy the entire `Smart_Flight_Booking_Assistant` folder to any location on the target laptop (e.g. `C:\Users\username\Desktop\Smart_Flight_Booking_Assistant`).
2. **Double-Click:**
   Double-click `run.bat`.

### What `run.bat` does automatically:
- **Zero Hardcoded Paths:** Uses Windows dynamic path resolution (`%~dp0`) to locate scripts regardless of drive, username, or folder nesting.
- **Python Launcher Detection:** Automatically checks `py`, `python`, and `python3`.
- **Automatic Virtual Environment Setup:**
  - If no `venv` exists, it creates a fresh one using the target laptop's Python.
  - If a copied `venv` from another laptop is detected (with invalid hardcoded paths from the original machine), it automatically cleans it up and creates a clean local `venv`.
- **Automatic Dependency Installation:** Checks if `fastapi`, `uvicorn`, `pandas`, `joblib`, and `scikit-learn` are installed. If missing, it installs them directly from `requirements.txt`.
- **Port Conflict Handling:** Safely frees ports `8000` and `5500` if occupied.
- **Active Health Verification:** Verifies the backend responds to `http://127.0.0.1:8000/health` before opening your default browser to `http://127.0.0.1:5500/index.html`.

---

## 2. Prerequisites on Target Laptop

The only requirement on the target Windows laptop is:
- **Windows 10 / 11**
- **Python 3.9, 3.10, 3.11, 3.12, 3.13, or 3.14** installed.
  - Download: [python.org/downloads](https://www.python.org/downloads/)
  - **CRITICAL STEP DURING INSTALLATION:**
    Be sure to check the box:  
    `[X] Add Python to PATH` or `[X] Install Python Launcher (py)`.

No manual `pip install`, environment variables, or config edits are needed.

---

## 3. Diagnostic & Troubleshooting Tool

If you want to verify system readiness on a new laptop without launching the servers:
```cmd
BAT_DIAGNOSTICS.bat
```
This utility checks Python availability, package integrity, model files, and port availability, reporting `[PASS]` or `[FAIL]` for each component.

---

## 4. Offline Portability Note

- **First Launch on a new laptop:** Requires internet access for 1–2 minutes if packages from `requirements.txt` need to be downloaded into the newly generated `venv`.
- **Subsequent Launches:** Runs completely offline with instant startup.
