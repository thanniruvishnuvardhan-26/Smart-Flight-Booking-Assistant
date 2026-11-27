# PROJECT CHANGELOG — SMART FLIGHT BOOKING ASSISTANT

## Version 2.2.0 — November 27, 2026
**Major Milestone: Smart Prediction, Advanced Mode, Duration Hierarchy, MySQL Integration & Administrator Dashboard**

### 1. Dual Prediction Modes
- **Mode 1: Smart Prediction (Default):**
  - Requires only 3 inputs: Source City, Destination City, and Days Left.
  - Generates price predictions across all authentic operating flight combinations from `route_combinations.json` using high-performance batch vectorization.
  - Implements interactive client-side sorting (Lowest Price, Highest Price, Shortest Duration, Airline) and filtering (Airline, Cabin Class, Stops).
  - Enforces strict stops restriction: **0 stops (Non-stop), 1 stop, and 2 stops only**.
- **Mode 2: Advanced Prediction (Preserved):**
  - Preserved the manual form for users who wish to customize Carrier, Departure Slot, Stops, and Cabin Class.
  - Uses the same Random Forest model (`flight_price_rf_pipeline_v2.pkl`) and confidence range calculations.

### 2. Duration & Arrival Calculation Resolution
- Diagnosed that connecting 1-stop flights in the dataset include total elapsed travel time with layovers (hence 11–15 hours for certain routes).
- Implemented a 4-level hierarchical duration lookup in `duration_lookup.json` (`route_stops_airline` -> `route_stops` -> `route_pair` -> `overall_median`).
- Implemented arrival slot calculation with midnight crossing indicator (`crosses_midnight`).

### 3. MySQL Database Integration
- Implemented `backend/db.py` supporting MySQL (`pymysql`) with automatic SQLite fallback (`local_flight_assistant.db`).
- Created tables: `search_activity`, `prediction_history`, and `user_feedback`.
- Created `.env.example` template for credentials.
- Strictly enforced **zero login / registration** per academic project requirements.

### 4. Administrator Analytics Dashboard
- Created `#page-admin` in `index.html` with real-time KPI metrics, popular routes bar chart, airline selection distribution, stops breakdown, and feedback ratings.
- Added recent activity log table displaying the last 10 queries from the database.

### 5. `run.bat` Preservation
- **Strictly preserved `run.bat` without modifying a single line of code.**

---

## Version 2.1.0 — November 27, 2026
- Fixed unescaped parentheses in batch script syntax.
- Added startup logging to `logs/startup.log`.
- Added dual-runtime portability checks.
