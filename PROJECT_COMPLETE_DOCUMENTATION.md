# SMART FLIGHT BOOKING ASSISTANT
## Complete Technical Architecture, Implementation & Verification Documentation
**Project Name:** Smart Flight Booking Assistant  
**Project ID:** 16  
**Problem Statement:** Airfare Price Estimation and Fare Pattern Analysis  
**Repository:** `Smart-Flight-Booking-Assistant`  
**Stack:** Python 3.10+, FastAPI, Scikit-Learn, Random Forest Regressor, Pandas, HTML5, Modern CSS (Light Theme), JavaScript (Vanilla ES6+), Chart.js

---

## 1. Executive Summary & Problem Overview
Airline flight pricing in the Indian domestic aviation market exhibits extreme volatility governed by complex yield-management algorithms. Dynamic adjustments occur continuously based on cabin class, carrier tier, advance booking window (`days_left`), routing stops, and departure times.

The **Smart Flight Booking Assistant** (branded as **AeroMetrics**) provides travelers, data scientists, and industry analysts with a transparent, algorithmic airfare estimation platform. It replaces arbitrary manual price guessing with machine learning inference, confidence intervals, 50-day booking trajectory curves, cheaper flight alternatives, and an automated booking advisor.

---

## 2. Dataset Architecture & Empirical Profile
The machine learning pipeline is trained on the comprehensive **Clean_Dataset.csv** containing **300,153 validated flight observations** across India's top 6 metropolitan hubs.

### Dataset Schema & Attributes
| Column Name | Data Type | Categories / Value Range | Description |
| :--- | :--- | :--- | :--- |
| `airline` | Categorical | AirAsia, Air India, GO_FIRST, Indigo, SpiceJet, Vistara | Operating commercial carrier |
| `flight` | String | e.g. `SG-8709`, `UK-995` | Flight identification code |
| `source_city` | Categorical | Delhi, Mumbai, Bangalore, Kolkata, Hyderabad, Chennai | Origin airport metro |
| `departure_time` | Categorical | Early_Morning, Morning, Afternoon, Evening, Night, Late_Night | Departure time window |
| `stops` | Categorical | `zero` (direct), `one` (1 stop), `two_or_more` (2+ stops) | Layover stop count |
| `arrival_time` | Categorical | Early_Morning, Morning, Afternoon, Evening, Night, Late_Night | Arrival time window |
| `destination_city`| Categorical | Delhi, Mumbai, Bangalore, Kolkata, Hyderabad, Chennai | Destination airport metro |
| `class` | Categorical | Economy, Business | Travel cabin class |
| `duration` | Continuous | 0.83 to 49.83 hours | Total elapsed flight journey duration |
| `days_left` | Discrete | 1 to 50 days | Booking window before journey date |
| `price` | Target (Continuous) | ₹ 1,105 to ₹ 123,071 | Actual booking ticket price (INR) |

---

## 3. Machine Learning Engineering & Model Evolution

### Model Version Comparison
| Metric / Characteristic | Initial Baseline (V1) | Enhanced Clean Model (V2 - Active) | Improvement / Justification |
| :--- | :--- | :--- | :--- |
| **`stops` Encoding** | Numerical Ordinal (0, 1, 2) + `StandardScaler` | Nominal Categorical (`zero`, `one`, `two_or_more`) + `OneHotEncoder` | Captures non-linear pricing penalties between layover structures |
| **Dataset Size** | 300,153 rows | 300,153 rows | Full population dataset used for robust generalization |
| **Mean Absolute Error (MAE)** | **₹ 2,748.92** | **₹ 1,293.06** | **52.96% Error Reduction** |
| **Root Mean Squared Error (RMSE)** | ₹ 5,821.40 | **₹ 2,841.19** | **51.19% Reduction in outlier error** |
| **Coefficient of Determination (R²)**| 0.9340 | **0.9843 (98.43%)** | Explains nearly all airfare variance |
| **Tree Ensemble Size** | 100 Trees | 30 Trees (Optimized depth 20) | High inference throughput without over-fitting |

### Feature Importance Hierarchy
Analysis of the 30 decision trees in the ensemble reveals the structural drivers of domestic airfares:
1. **Cabin Class (Economy vs. Business):** ~88.59% cumulative importance. The single dominant factor dictating ticket price.
2. **Flight Duration:** ~5.56% importance. Longer routes with layovers correlate with direct operational costs.
3. **Booking Window (`days_left`):** ~1.60% importance. Drives the final 72-hour price surge.
4. **Airline Carrier Tier:** ~1.45% importance (Vistara and Air India premium vs low-cost carriers).
5. **Route & Stop Categories:** ~2.80% combined impact.

---

## 4. Key Advanced Features & Implementation

### 1. Automatic Duration Lookup Table
- To eliminate manual user guesswork and human input errors, the backend utilizes `backend/duration_lookup.json`.
- Precomputed median historical flight durations across all 90 `source_city|destination_city|stops` combinations, backed by 30 city-pair route fallbacks and a global domestic median (11.25 hrs).

### 2. Automatic Arrival Slot Calculation
- Users select their mandatory **Departure Slot** (e.g. *Morning*: 08:00 - 12:00, midpoint 10:00).
- Arrival hour is dynamically computed:  
  $$\text{Arrival Hour} = (\text{Departure Midpoint} + \text{Duration}) \pmod{24}$$
- The system checks if $(\text{Departure Midpoint} + \text{Duration}) \ge 24$, automatically notifying the traveler of midnight flight crossings.

### 3. Dual-Layer Prediction Confidence Interval
- **Error Boundary:** $\text{Predicted Price} \pm \text{MAE}$ ($\pm ₹ 1,293.06$).
- **Model Uncertainty Spread:** Standard deviation across individual decision trees in the Random Forest ensemble:
  $$\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N} (T_i(X) - \mu)^2}$$
  Providing travelers with an indicator of model consensus on atypical routes.

### 4. 50-Day Booking Curve Simulation
- Evaluates the route across all 50 discrete days leading up to departure.
- Pinpoints the mathematical cheapest day to book (typically 20–45 days in advance) and highlights the final 7-day price spike.

### 5. Cheaper Flight Alternatives Scan
- In a single parallel vector computation, compares the requested flight against:
  - Alternative airlines on the same route.
  - Alternative layover counts (`zero`, `one`, `two_or_more`).
  - Alternative departure slots (Early Morning, Afternoon, Evening, Night).
- Calculates net Rupee savings for every cheaper alternative found.

### 6. Book-Now-or-Wait Intelligent Advisor
- Analyzes current `days_left` relative to historical price trajectories.
- If $days\_left \le 3$, flags `BOOK_NOW` (High urgency, steep surge imminent).
- If upcoming window drops price by $>8\%$, flags `CONSIDER_WAITING` with potential rupee savings.
- Otherwise flags `BOOK_NOW` (Fares are historically stable or rising).

---

## 5. API Reference & REST Endpoints

### 1. `GET /`
Returns API metadata, health status, model pipeline specifications, and validated performance metrics (MAE, RMSE, R²).

### 2. `GET /health`
Liveness probe returning `{"status": "healthy", "model_loaded": true, "model_version": "v2", "mae": 1293.06}`.

### 3. `GET /available-options`
Returns valid categorical options for airlines, cities, departure slots, arrival slots, classes, and stops.

### 4. `POST /calculate-flight-details`
Calculates median historical duration and arrival slot for a given route and departure time.
```json
{
  "source_city": "Delhi",
  "destination_city": "Mumbai",
  "stops": "zero",
  "departure_time": "Morning"
}
```
**Response:**
```json
{
  "duration": 2.17,
  "arrival_time": "Afternoon",
  "crosses_midnight": false,
  "days_added": 0,
  "departure_time": "Morning",
  "stops": "zero"
}
```

### 5. `POST /predict`
Executes Random Forest price estimation.
```json
{
  "airline": "SpiceJet",
  "source_city": "Delhi",
  "departure_time": "Morning",
  "stops": "zero",
  "destination_city": "Mumbai",
  "flight_class": "Economy",
  "days_left": 15
}
```
**Response:**
```json
{
  "predicted_price": 2594.38,
  "lower_price": 1301.32,
  "upper_price": 3887.44,
  "mae": 1293.06,
  "tree_uncertainty": 271.48,
  "model_spread_low": 2322.90,
  "model_spread_high": 2865.87,
  "effective_duration": 2.17,
  "effective_arrival_time": "Afternoon",
  "crosses_midnight": false,
  "currency": "INR"
}
```

### 6. `POST /booking-trend`
Simulates daily predictions across days 1 to 50.
Returns 50 datapoints, `cheapest_days_left`, and `cheapest_price`.

### 7. `POST /cheaper-alternatives`
Returns sorted cheaper alternatives across airlines, stops, and departure slots with net savings.

### 8. `POST /book-now-or-wait`
Returns actionable booking advice badge, recommendation text, and savings potential.

### 9. `GET /feature-importance`
Returns top 10 feature importances formatted with clean display names.

---

## 6. Verification & Automated Test Results
All API endpoints and machine learning routines were tested under `fastapi.testclient.TestClient`:
- **Root & Health Check:** `HTTP 200` OK.
- **Flight Calculations:** Verified across DEL-BOM (direct), BLR-MAA (1-stop), CCU-HYD (2+ stops). Midnight crossing logic confirmed.
- **V2 Model Predictions:**
  - Economy DEL-BOM: ₹ 2,594.38 (realistic budget fare).
  - Business DEL-BOM: ₹ 34,525.71 (13.3x economy multiplier matching empirical training data).
- **Booking Curve:** 50 distinct day points generated without nulls.
- **Cheaper Alternatives:** Correctly isolated cheaper airlines and slots.
- **Advisor:** Accurately triggers `BOOK_NOW` at 2 days left.

---

## 7. Platform Limitations & Ethical Disclaimers
1. **Historical Snapshot:** The model was trained on 300,153 flight booking samples collected between February 11 and March 31, 2022.
2. **Algorithmic Estimation:** Predictions reflect historical statistical relationships and yield management dynamics; they do not constitute live airline ticketing or guaranteed quotes.
3. **Route Coverage:** Supported across 30 metro routes between Delhi, Mumbai, Bangalore, Kolkata, Hyderabad, and Chennai.
