# Administrator Analytics Dashboard Documentation

**Project:** Smart Flight Booking Assistant  
**Module:** Academic Administrator Telemetry & Relational Analytics  
**Authentication Requirement:** None (Academic Demonstration Public Access)  

---

## 1. Purpose & Access

The Administrator Dashboard (`#admin`) provides system observability into how travelers use the Smart Flight Booking Assistant.

### Key Policy:
Per academic demonstration requirements, **no user login, authentication gates, or user account forms are implemented**. The dashboard is directly accessible via the sidebar navigation item **"Admin Dashboard"**.

All metrics and charts reflect **real database records** inserted into MySQL (or the local SQLite database). If the database is newly initialized, empty states are displayed instead of fabricated sample data.

---

## 2. Dashboard KPIs & Metrics

| Metric | Source Table | Description |
| :--- | :--- | :--- |
| **Total Searches** | `search_activity` | Total number of flight route queries executed. |
| **Model Predictions** | `prediction_history` | Total flight options valued by the Random Forest model. |
| **Smart vs Advanced Ratio** | `search_activity` | Breakdown of searches conducted via Smart Mode vs Advanced Mode. |
| **Database Engine** | Connection Driver | Confirms whether MySQL or local resilient storage is active. |
| **Feedback Count** | `user_feedback` | Total user helpfulness ratings recorded. |

---

## 3. Visualizations

The dashboard utilizes responsive **Chart.js** visualizations:
1. **Most Searched Routes (Bar Chart):** Ranks the most queried travel corridors (e.g., Delhi → Mumbai).
2. **Airlines Selected in Predictions (Bar Chart):** Distribution of airline carriers evaluated by users.
3. **Flight Stops Distribution (Doughnut Chart):** Illustrates user preferences across Non-stop (0), 1 Stop, and 2 Stops.
4. **User Feedback Breakdown (Doughnut Chart):** Ratio of "Helpful (Yes)" vs "Needs Improvement (No)" responses.

---

## 4. Recent Activity Log Table

Displays the last 10 predictions recorded in the database:
- **Timestamp** of the query.
- **Route** (Origin → Destination).
- **Booking Window** (Days Left).
- **Prediction Mode** (`Smart` or `Advanced`).
- **Airline Carrier**.
- **Predicted Airfare** in INR.
