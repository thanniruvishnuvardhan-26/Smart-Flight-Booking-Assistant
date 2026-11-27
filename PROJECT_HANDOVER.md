# PROJECT HANDOVER & ARCHITECTURE MANUAL

**Project Name:** Smart Flight Booking Assistant – Airfare Price Estimation and Fare Pattern Analysis  
**Technology Stack:** Python 3.14 / 3.11, FastAPI, Uvicorn, Scikit-Learn (Random Forest Regressor V2), MySQL / SQLite, HTML5, Vanilla JavaScript, Chart.js  
**Version:** 2.2.0  
**Repository:** [https://github.com/thanniruvishnuvardhan-26/Smart-Flight-Booking-Assistant](https://github.com/thanniruvishnuvardhan-26/Smart-Flight-Booking-Assistant)  

---

## 1. System Architecture Overview

```
                                  +-----------------------------+
                                  |    Web Browser Frontend     |
                                  | HTML5 / CSS3 / JavaScript   |
                                  | Chart.js / Dual-Mode UI     |
                                  +--------------+--------------+
                                                 |
                                         REST HTTP / JSON
                                                 |
                                                 v
                                  +-----------------------------+
                                  |     FastAPI REST Server     |
                                  |         (main.py)           |
                                  +-------+--------------+------+
                                          |              |
                      +-------------------+              +-------------------+
                      |                                                      |
                      v                                                      v
      +---------------------------------+                  +---------------------------------+
      |    ML Inference Pipeline        |                  |   Relational Database Layer     |
      |  flight_price_rf_pipeline_v2    |                  |             (db.py)             |
      |  duration_lookup.json (V3)      |                  | Primary: MySQL Server (Port 3306|
      |  route_combinations.json        |                  | Fallback: local_flight_assistant|
      +---------------------------------+                  +---------------------------------+
```

---

## 2. Directory Structure

- `run.bat`: **Protected Windows launcher** (do not modify). Sets up environment, verifies dependencies, clears ports 8000 and 5500, launches backend and frontend, and polls `/health`.
- `backend/`:
  - `main.py`: Core FastAPI REST API application containing all inference and analytics endpoints.
  - `db.py`: Database connection manager supporting MySQL (`pymysql`) with automatic SQLite fallback.
  - `flight_price_rf_pipeline_v2.pkl`: Pre-trained Random Forest regression model (MAE ₹1,293.06, R² 98.43%).
  - `duration_lookup.json`: 4-level hierarchical flight duration and arrival time lookup table.
  - `route_combinations.json`: Authenticated catalog of all valid operating flight combinations per city corridor.
- `frontend/`:
  - `index.html`: Responsive single-page application (SPA) with Mode 1 (Smart Prediction) and Mode 2 (Advanced Prediction).
  - `style.css`: Modern styling with mobile responsiveness.
  - `script.js`: Frontend application logic, Chart.js controllers, filter algorithms, and API bindings.
  - `serve.py`: Lightweight static file server for local hosting on port 5500.
- `requirements.txt`: Python package requirements.
- `.env.example`: Template for MySQL credentials.
- `MYSQL_DATABASE_SETUP.md`: Database setup guide.
- `DURATION_CALCULATION_FIX.md`: Statistical root cause analysis and resolution of duration calculation.
- `SMART_PREDICTION_DOCUMENTATION.md`: Functional guide to Mode 1 (Smart Prediction).
- `ADMIN_DASHBOARD_DOCUMENTATION.md`: Administrator telemetry and reporting guide.
- `PROJECT_CHANGELOG.md`: Chronological log of changes.

---

## 3. Registered API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status and model version metadata |
| `POST` | `/smart-prediction` | **Mode 1:** Generates price predictions for all valid operating options given 3 inputs |
| `POST` | `/predict` | **Mode 2:** Values a specific flight itinerary; logs record into MySQL database |
| `POST` | `/calculate-flight-details` | Calculates flight duration & arrival slot using 4-level hierarchy |
| `POST` | `/feedback` | Records user satisfaction feedback anonymously into MySQL |
| `GET` | `/admin/metrics` | Returns aggregated metrics and recent activity for Admin Dashboard |
| `GET` | `/feature-importance` | Feature importance weights from Random Forest model |
| `POST` | `/booking-trend` | 50-day booking trajectory curve for selected route |
| `POST` | `/book-now-or-wait` | Booking recommendation engine based on 50-day price trend |
| `POST` | `/cheaper-alternatives` | Alternative carrier, stop, and time recommendations |
| `GET` | `/fare-insights` | Aggregated market metrics and corridor comparisons |

---

## 4. How to Run the Application

Double-click `run.bat` in the project root.
- The launcher starts the FastAPI backend on port `8000`.
- It starts the frontend server on port `5500`.
- It performs an automated health check loop and launches `http://127.0.0.1:5500/index.html` in your default browser.
