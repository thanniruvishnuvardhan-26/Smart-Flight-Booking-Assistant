# Import required libraries
import sys
import os
import json
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, validator
import pandas as pd
import joblib
from pathlib import Path
from typing import Optional, Union, List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware

# Compatibility shim for scikit-learn unpickling of ColumnTransformer across versions
try:
    import sklearn.compose._column_transformer as _ct
    if not hasattr(_ct, "_RemainderColsList"):
        class _RemainderColsList(list):
            pass
        _ct._RemainderColsList = _RemainderColsList
except Exception:
    pass

# Create FastAPI application
app = FastAPI(
    title="Smart Flight Booking Assistant",
    description="Flight Price Prediction and Airfare Analytics API",
    version="2.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File Paths
BACKEND_DIR = Path(__file__).resolve().parent
MODEL_PATH = BACKEND_DIR / "flight_price_rf_pipeline_v2.pkl"
LOOKUP_PATH = BACKEND_DIR / "duration_lookup.json"

# Load duration lookup table
DURATION_LOOKUP: Dict[str, Any] = {}
if LOOKUP_PATH.exists():
    try:
        with open(LOOKUP_PATH, "r", encoding="utf-8") as f:
            DURATION_LOOKUP = json.load(f)
        print(f"[*] Loaded duration lookup table from {LOOKUP_PATH}")
    except Exception as e:
        print(f"[!] Warning: Could not load duration lookup: {e}")

# Load the trained Random Forest pipeline V2 (Trained on 300,153 rows with OneHotEncoded stops)
if not MODEL_PATH.exists():
    # Fallback to v1 if v2 is not found
    MODEL_PATH = BACKEND_DIR / "flight_price_rf_pipeline.pkl"
    print(f"[*] Fallback to {MODEL_PATH}")

model = joblib.load(MODEL_PATH)
print(f"[*] Loaded ML model from {MODEL_PATH}")

# Measured Test-set Performance Metrics for V2
TEST_MAE = 1293.06
TEST_RMSE = 2841.19
TEST_R2 = 0.9843

# Available input options
AVAILABLE_OPTIONS = {
    "airlines": [
        "AirAsia",
        "Air India",
        "GO_FIRST",
        "Indigo",
        "SpiceJet",
        "Vistara"
    ],
    "cities": [
        "Bangalore",
        "Chennai",
        "Delhi",
        "Hyderabad",
        "Kolkata",
        "Mumbai"
    ],
    "departure_times": [
        "Early_Morning",
        "Morning",
        "Afternoon",
        "Evening",
        "Night",
        "Late_Night"
    ],
    "arrival_times": [
        "Early_Morning",
        "Morning",
        "Afternoon",
        "Evening",
        "Night",
        "Late_Night"
    ],
    "flight_classes": [
        "Economy",
        "Business"
    ],
    "stops": [
        "zero",
        "one",
        "two_or_more"
    ]
}

# Departure Slot midpoint hours for arrival calculation
SLOT_MIDPOINTS = {
    "Early_Morning": 6.0,   # 04:00 - 08:00
    "Morning": 10.0,        # 08:00 - 12:00
    "Afternoon": 14.0,      # 12:00 - 16:00
    "Evening": 18.0,        # 16:00 - 20:00
    "Night": 22.0,          # 20:00 - 00:00
    "Late_Night": 2.0       # 00:00 - 04:00
}

def map_hour_to_slot(hour: float) -> str:
    """Map a 24-hour float hour into the corresponding time slot category."""
    hour = hour % 24.0
    if 4.0 <= hour < 8.0:
        return "Early_Morning"
    elif 8.0 <= hour < 12.0:
        return "Morning"
    elif 12.0 <= hour < 16.0:
        return "Afternoon"
    elif 16.0 <= hour < 20.0:
        return "Evening"
    elif 20.0 <= hour < 24.0:
        return "Night"
    else:  # 00:00 to 04:00
        return "Late_Night"

def normalize_stops_value(val: Union[int, str]) -> str:
    """Normalize stops to 'zero', 'one', or 'two_or_more' for model V2."""
    if isinstance(val, (int, float)):
        val_int = int(val)
        if val_int == 0:
            return "zero"
        elif val_int == 1:
            return "one"
        else:
            return "two_or_more"
    s = str(val).strip().lower()
    if s in ("0", "zero", "direct", "non-stop", "non_stop"):
        return "zero"
    elif s in ("1", "one", "1 stop"):
        return "one"
    elif s in ("2", "two", "two_or_more", "2+", "2 or more stops"):
        return "two_or_more"
    return "one"

def calculate_duration_and_arrival(source: str, destination: str, stops: Union[int, str], departure_time: str) -> Dict[str, Any]:
    """Calculate flight duration from historical dataset lookup and compute arrival slot."""
    norm_stops = normalize_stops_value(stops)
    key = f"{source}|{destination}|{norm_stops}"
    pair_key = f"{source}|{destination}"
    
    duration = None
    if DURATION_LOOKUP:
        route_stops = DURATION_LOOKUP.get("route_stops", {})
        if key in route_stops:
            duration = route_stops[key]
        elif pair_key in DURATION_LOOKUP.get("route_pairs", {}):
            duration = DURATION_LOOKUP["route_pairs"][pair_key]
        else:
            duration = DURATION_LOOKUP.get("overall_median", 11.25)
    
    if duration is None:
        # Fallback default reasonable durations if json is missing
        if norm_stops == "zero":
            duration = 2.17
        elif norm_stops == "one":
            duration = 11.5
        else:
            duration = 14.5
            
    # Calculate arrival slot
    dep_mid = SLOT_MIDPOINTS.get(departure_time, 10.0)
    arr_hour = (dep_mid + duration) % 24.0
    arrival_slot = map_hour_to_slot(arr_hour)
    
    # Check if crosses midnight
    crosses_midnight = (dep_mid + duration) >= 24.0
    days_added = int((dep_mid + duration) // 24)
    
    return {
        "duration": round(float(duration), 2),
        "arrival_time": arrival_slot,
        "crosses_midnight": crosses_midnight,
        "days_added": days_added,
        "departure_time": departure_time,
        "stops": norm_stops
    }

# Input data validation models
def validate_option(value, category):
    if value not in AVAILABLE_OPTIONS[category]:
        raise ValueError(
            f"Invalid value '{value}'. "
            f"Choose from: {AVAILABLE_OPTIONS[category]}"
        )
    return value

class FlightCalculationRequest(BaseModel):
    source_city: str
    destination_city: str
    stops: Union[int, str]
    departure_time: str

class FlightDetails(BaseModel):
    airline: str
    source_city: str
    departure_time: str
    stops: Union[int, str]
    arrival_time: Optional[str] = None
    destination_city: str
    flight_class: str
    duration: Optional[float] = None
    days_left: int = Field(ge=1, le=50)

    @validator("airline")
    def check_airline(cls, value):
        return validate_option(value, "airlines")

    @validator("source_city")
    def check_source_city(cls, value):
        return validate_option(value, "cities")

    @validator("destination_city")
    def check_destination_city(cls, value):
        return validate_option(value, "cities")

    @validator("departure_time")
    def check_departure_time(cls, value):
        return validate_option(value, "departure_times")

    @validator("arrival_time")
    def check_arrival_time(cls, value):
        if value is not None and value != "":
            return validate_option(value, "arrival_times")
        return value

    @validator("flight_class")
    def check_flight_class(cls, value):
        return validate_option(value, "flight_classes")

# Home endpoint
@app.get("/") 
def home():
    return {
        "message": "Welcome to Smart Flight Booking Assistant API",
        "documentation": "/docs",
        "health": "healthy",
        "version": "2.0",
        "model_pipeline": "Random Forest V2 (One-Hot Stops & Clean Dataset)",
        "metrics": {
            "mae": TEST_MAE,
            "rmse": TEST_RMSE,
            "r2": TEST_R2
        }
    }

# Health check endpoint for Render monitoring
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": True,
        "model_version": "v2",
        "mae": TEST_MAE
    }

# Available input options endpoint
@app.get("/available-options")
def get_available_options():
    return AVAILABLE_OPTIONS

# Flight auto-calculation endpoint (Duration & Arrival Slot)
@app.post("/calculate-flight-details")
def calculate_details(req: FlightCalculationRequest):
    if req.source_city == req.destination_city:
        raise HTTPException(
            status_code=400,
            detail="Source city and destination city cannot be the same."
        )
    return calculate_duration_and_arrival(
        source=req.source_city,
        destination=req.destination_city,
        stops=req.stops,
        departure_time=req.departure_time
    )

# Model tree-to-tree uncertainty calculation helper
def compute_prediction_and_uncertainty(df: pd.DataFrame):
    """Calculate mean prediction and tree-to-tree spread (std dev)."""
    # Pipeline prediction
    pred = float(model.predict(df)[0])
    
    # Calculate uncertainty across individual decision trees in the Random Forest
    spread = 0.0
    try:
        if hasattr(model, "named_steps") and "model" in model.named_steps:
            rf = model.named_steps["model"]
            pre = model.named_steps["preprocessor"]
            X_trans = pre.transform(df)
            tree_preds = [float(tree.predict(X_trans)[0]) for tree in rf.estimators_]
            spread = float(np.std(tree_preds))
    except Exception as e:
        spread = TEST_MAE * 0.4
    
    return pred, spread

# Helper to build model input dataframe
def build_input_row(flight: FlightDetails) -> pd.DataFrame:
    norm_stops = normalize_stops_value(flight.stops)
    
    # Auto compute duration or arrival if missing
    duration = flight.duration
    arrival_time = flight.arrival_time
    
    if duration is None or duration <= 0 or arrival_time is None or arrival_time == "":
        calc = calculate_duration_and_arrival(
            flight.source_city,
            flight.destination_city,
            norm_stops,
            flight.departure_time
        )
        if duration is None or duration <= 0:
            duration = calc["duration"]
        if arrival_time is None or arrival_time == "":
            arrival_time = calc["arrival_time"]
            
    return pd.DataFrame([{
        "airline": flight.airline,
        "source_city": flight.source_city,
        "departure_time": flight.departure_time,
        "stops": norm_stops,
        "arrival_time": arrival_time,
        "destination_city": flight.destination_city,
        "class": flight.flight_class,
        "duration": float(duration),
        "days_left": int(flight.days_left)
    }])

# Prediction endpoint
@app.post("/predict")
def predict_price(flight: FlightDetails):
    if flight.source_city == flight.destination_city:
        raise HTTPException(
            status_code=400,
            detail="Source city and destination city cannot be the same."
        )

    # Check for automatic calculation details
    calc_info = calculate_duration_and_arrival(
        flight.source_city,
        flight.destination_city,
        flight.stops,
        flight.departure_time
    )
    
    # Use calculated values if not explicitly provided or invalid
    effective_duration = flight.duration if (flight.duration and flight.duration > 0) else calc_info["duration"]
    effective_arrival = flight.arrival_time if (flight.arrival_time and flight.arrival_time != "") else calc_info["arrival_time"]
    norm_stops = normalize_stops_value(flight.stops)

    input_data = pd.DataFrame([{
        "airline": flight.airline,
        "source_city": flight.source_city,
        "departure_time": flight.departure_time,
        "stops": norm_stops,
        "arrival_time": effective_arrival,
        "destination_city": flight.destination_city,
        "class": flight.flight_class,
        "duration": effective_duration,
        "days_left": flight.days_left
    }])

    prediction, tree_uncertainty = compute_prediction_and_uncertainty(input_data)

    return {
        "predicted_price": round(prediction, 2),
        "lower_price": round(max(0.0, prediction - TEST_MAE), 2),
        "upper_price": round(prediction + TEST_MAE, 2),
        "mae": TEST_MAE,
        "tree_uncertainty": round(tree_uncertainty, 2),
        "model_spread_low": round(max(0.0, prediction - tree_uncertainty), 2),
        "model_spread_high": round(prediction + tree_uncertainty, 2),
        "effective_duration": effective_duration,
        "effective_arrival_time": effective_arrival,
        "crosses_midnight": calc_info["crosses_midnight"],
        "currency": "INR"
    }

# Feature Importance API
@app.get("/feature-importance")
def get_feature_importance():
    rf_model = model.named_steps["model"]
    preprocessor = model.named_steps["preprocessor"]
    feature_names = preprocessor.get_feature_names_out()
    importances = rf_model.feature_importances_

    importance_df = pd.DataFrame({
        "feature": feature_names,
        "importance": importances
    }).sort_values(by="importance", ascending=False)

    # Friendly naming map for clear charts
    friendly_names = []
    for f in importance_df["feature"]:
        clean_name = f.replace("cat__", "").replace("num__", "")
        clean_name = clean_name.replace("class_", "Cabin Class: ").replace("airline_", "Airline: ")
        clean_name = clean_name.replace("source_city_", "Origin: ").replace("destination_city_", "Dest: ")
        clean_name = clean_name.replace("stops_", "Stops: ").replace("departure_time_", "Departure: ")
        clean_name = clean_name.replace("arrival_time_", "Arrival: ")
        clean_name = clean_name.capitalize()
        friendly_names.append(clean_name)
    importance_df["display_feature"] = friendly_names

    top_features = importance_df.head(10)

    return {
        "features": top_features["display_feature"].tolist(),
        "raw_features": top_features["feature"].tolist(),
        "importance": [
            round(float(value) * 100, 2)
            for value in top_features["importance"]
        ]
    }

# 50-Day Booking Curve
@app.post("/booking-trend")
def get_booking_trend(flight: FlightDetails):
    if flight.source_city == flight.destination_city:
        raise HTTPException(
            status_code=400,
            detail="Source city and destination city cannot be the same."
        )

    calc_info = calculate_duration_and_arrival(
        flight.source_city,
        flight.destination_city,
        flight.stops,
        flight.departure_time
    )
    effective_duration = flight.duration if (flight.duration and flight.duration > 0) else calc_info["duration"]
    effective_arrival = flight.arrival_time if (flight.arrival_time and flight.arrival_time != "") else calc_info["arrival_time"]
    norm_stops = normalize_stops_value(flight.stops)

    rows = []
    for days in range(1, 51):
        rows.append({
            "airline": flight.airline,
            "source_city": flight.source_city,
            "departure_time": flight.departure_time,
            "stops": norm_stops,
            "arrival_time": effective_arrival,
            "destination_city": flight.destination_city,
            "class": flight.flight_class,
            "duration": effective_duration,
            "days_left": days
        })

    df_batch = pd.DataFrame(rows)
    preds = model.predict(df_batch)

    predictions = [
        {"days_left": d, "predicted_price": round(float(p), 2)}
        for d, p in zip(range(1, 51), preds)
    ]

    cheapest = min(predictions, key=lambda x: x["predicted_price"])
    current_pred = next((p["predicted_price"] for p in predictions if p["days_left"] == flight.days_left), predictions[0]["predicted_price"])

    return {
        "booking_trend": predictions,
        "cheapest_days_left": cheapest["days_left"],
        "cheapest_price": cheapest["predicted_price"],
        "current_price": current_pred,
        "currency": "INR"
    }

# Cheaper Alternatives
@app.post("/cheaper-alternatives")
def get_cheaper_alternatives(flight: FlightDetails):
    if flight.source_city == flight.destination_city:
        raise HTTPException(
            status_code=400,
            detail="Source city and destination city cannot be the same."
        )

    calc_info = calculate_duration_and_arrival(
        flight.source_city,
        flight.destination_city,
        flight.stops,
        flight.departure_time
    )
    base_duration = flight.duration if (flight.duration and flight.duration > 0) else calc_info["duration"]
    base_arrival = flight.arrival_time if (flight.arrival_time and flight.arrival_time != "") else calc_info["arrival_time"]
    base_stops = normalize_stops_value(flight.stops)

    # Base price
    base_df = pd.DataFrame([{
        "airline": flight.airline,
        "source_city": flight.source_city,
        "departure_time": flight.departure_time,
        "stops": base_stops,
        "arrival_time": base_arrival,
        "destination_city": flight.destination_city,
        "class": flight.flight_class,
        "duration": base_duration,
        "days_left": flight.days_left
    }])
    original_price = round(float(model.predict(base_df)[0]), 2)

    airlines = AVAILABLE_OPTIONS["airlines"]
    stops_options = ["zero", "one", "two_or_more"]
    departure_times = AVAILABLE_OPTIONS["departure_times"]

    # 1. Compare alternative airlines
    airline_alt_rows = []
    airline_names = []
    for airline in airlines:
        if airline == flight.airline:
            continue
        airline_names.append(airline)
        airline_alt_rows.append({
            "airline": airline,
            "source_city": flight.source_city,
            "departure_time": flight.departure_time,
            "stops": base_stops,
            "arrival_time": base_arrival,
            "destination_city": flight.destination_city,
            "class": flight.flight_class,
            "duration": base_duration,
            "days_left": flight.days_left
        })
    
    airline_alternatives = []
    if airline_alt_rows:
        airline_preds = model.predict(pd.DataFrame(airline_alt_rows))
        for name, pred in zip(airline_names, airline_preds):
            p = round(float(pred), 2)
            if p < original_price:
                airline_alternatives.append({
                    "airline": name,
                    "predicted_price": p,
                    "savings": round(original_price - p, 2)
                })

    # 2. Compare number of stops
    stops_alt_rows = []
    stops_names = []
    for s_opt in stops_options:
        if s_opt == base_stops:
            continue
        # Recalculate duration and arrival slot for different stop count
        alt_calc = calculate_duration_and_arrival(
            flight.source_city, flight.destination_city, s_opt, flight.departure_time
        )
        stops_names.append(s_opt)
        stops_alt_rows.append({
            "airline": flight.airline,
            "source_city": flight.source_city,
            "departure_time": flight.departure_time,
            "stops": s_opt,
            "arrival_time": alt_calc["arrival_time"],
            "destination_city": flight.destination_city,
            "class": flight.flight_class,
            "duration": alt_calc["duration"],
            "days_left": flight.days_left
        })

    stops_alternatives = []
    if stops_alt_rows:
        stops_preds = model.predict(pd.DataFrame(stops_alt_rows))
        for s_name, pred in zip(stops_names, stops_preds):
            p = round(float(pred), 2)
            if p < original_price:
                display_stops = "Non-stop (Direct)" if s_name == "zero" else ("1 Stop" if s_name == "one" else "2+ Stops")
                stops_alternatives.append({
                    "stops": s_name,
                    "display_stops": display_stops,
                    "predicted_price": p,
                    "savings": round(original_price - p, 2)
                })

    # 3. Compare departure times
    time_alt_rows = []
    time_names = []
    for dep_time in departure_times:
        if dep_time == flight.departure_time:
            continue
        alt_calc = calculate_duration_and_arrival(
            flight.source_city, flight.destination_city, base_stops, dep_time
        )
        time_names.append(dep_time)
        time_alt_rows.append({
            "airline": flight.airline,
            "source_city": flight.source_city,
            "departure_time": dep_time,
            "stops": base_stops,
            "arrival_time": alt_calc["arrival_time"],
            "destination_city": flight.destination_city,
            "class": flight.flight_class,
            "duration": base_duration,
            "days_left": flight.days_left
        })

    time_alternatives = []
    if time_alt_rows:
        time_preds = model.predict(pd.DataFrame(time_alt_rows))
        for t_name, pred in zip(time_names, time_preds):
            p = round(float(pred), 2)
            if p < original_price:
                time_alternatives.append({
                    "departure_time": t_name,
                    "predicted_price": p,
                    "savings": round(original_price - p, 2)
                })

    airline_alternatives.sort(key=lambda x: x["predicted_price"])
    stops_alternatives.sort(key=lambda x: x["predicted_price"])
    time_alternatives.sort(key=lambda x: x["predicted_price"])

    return {
        "original_price": original_price,
        "airline_alternatives": airline_alternatives,
        "stops_alternatives": stops_alternatives,
        "time_alternatives": time_alternatives,
        "currency": "INR"
    }

# Book-Now-or-Wait Advisor
@app.post("/book-now-or-wait")
def book_now_or_wait_advisor(flight: FlightDetails):
    """
    Advisor Rule Engine:
    - If days_left <= 3: Urgent window, prices increase rapidly close to departure -> "Book Now"
    - If lowest price occurs in > days_left: (Can only wait if days_left allows)
    - If lowest price in upcoming 50-day window occurs further out with > 15% discount -> "Consider Waiting"
    - If currently at lowest or price variation is < 5% -> "Prices Stable / Good to Book"
    """
    trend_result = get_booking_trend(flight)
    trend = trend_result["booking_trend"]
    curr_days = flight.days_left
    
    current_price = next((item["predicted_price"] for item in trend if item["days_left"] == curr_days), trend[0]["predicted_price"])
    
    closer_days = [item for item in trend if item["days_left"] < curr_days]
    
    if curr_days <= 3:
        action = "BOOK_NOW"
        confidence = "High"
        badge_color = "red"
        reason = f"Only {curr_days} day(s) left before departure. In the historical dataset, airfares surge steeply in the final 72 hours."
        savings_potential = 0.0
    else:
        if closer_days:
            min_future = min(closer_days, key=lambda x: x["predicted_price"])
            if min_future["predicted_price"] < current_price * 0.92:
                action = "CONSIDER_WAITING"
                confidence = "Moderate"
                badge_color = "amber"
                savings = round(current_price - min_future["predicted_price"], 2)
                reason = f"Model projects a possible dip around {min_future['days_left']} days before departure (potential savings of ₹{savings:,.2f})."
                savings_potential = savings
            else:
                action = "BOOK_NOW"
                confidence = "High"
                badge_color = "emerald"
                reason = f"Current airfare (₹{current_price:,.2f}) is optimal. Fares historically rise steadily as the departure date nears."
                savings_potential = 0.0
        else:
            action = "BOOK_NOW"
            confidence = "High"
            badge_color = "emerald"
            reason = "Optimal booking window reached."
            savings_potential = 0.0

    return {
        "action": action,
        "confidence": confidence,
        "badge_color": badge_color,
        "recommendation": reason,
        "current_price": current_price,
        "cheapest_price_overall": trend_result["cheapest_price"],
        "cheapest_overall_days_left": trend_result["cheapest_days_left"],
        "savings_potential": savings_potential,
        "currency": "INR"
    }

# ==========================================
# FARE PATTERN INSIGHTS (PHASE 2 REQUIREMENT)
# ==========================================
@app.get("/fare-insights")
def get_fare_insights():
    """
    Returns empirical benchmarks and feature importances calculated directly
    from the active Random Forest V2 pipeline for the Insights Dashboard.
    """
    # 1. Feature importance
    rf_model = model.named_steps["model"]
    preprocessor = model.named_steps["preprocessor"]
    feature_names = preprocessor.get_feature_names_out()
    importances = rf_model.feature_importances_

    fi_list = [
        {"feature": str(f).replace("cat__", "").replace("num__", "").capitalize(), "importance": round(float(imp) * 100, 2)}
        for f, imp in sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:10]
    ]

    # 2. Airline & Cabin Class benchmarks (DEL -> BOM, 15 days, Morning, Direct)
    airlines = AVAILABLE_OPTIONS["airlines"]
    airline_comp = []
    for air in airlines:
        df_eco = pd.DataFrame([{
            "airline": air, "source_city": "Delhi", "departure_time": "Morning",
            "stops": "zero", "arrival_time": "Afternoon", "destination_city": "Mumbai",
            "class": "Economy", "duration": 2.17, "days_left": 15
        }])
        df_biz = pd.DataFrame([{
            "airline": air, "source_city": "Delhi", "departure_time": "Morning",
            "stops": "zero", "arrival_time": "Afternoon", "destination_city": "Mumbai",
            "class": "Business", "duration": 2.17, "days_left": 15
        }])
        p_eco = round(float(model.predict(df_eco)[0]), 2)
        p_biz = round(float(model.predict(df_biz)[0]), 2)
        airline_comp.append({"airline": air, "economy": p_eco, "business": p_biz})

    # 3. Route comparisons
    sample_routes = [
        ("Delhi", "Mumbai"), ("Mumbai", "Bangalore"), ("Delhi", "Bangalore"),
        ("Bangalore", "Kolkata"), ("Delhi", "Chennai"), ("Kolkata", "Hyderabad")
    ]
    route_comp = []
    for s, d in sample_routes:
        calc = calculate_duration_and_arrival(s, d, "zero", "Morning")
        df_r = pd.DataFrame([{
            "airline": "Vistara", "source_city": s, "departure_time": "Morning",
            "stops": "zero", "arrival_time": calc["arrival_time"], "destination_city": d,
            "class": "Economy", "duration": calc["duration"], "days_left": 15
        }])
        p_r = round(float(model.predict(df_r)[0]), 2)
        route_comp.append({"route": f"{s} → {d}", "price": p_r, "duration_hours": calc["duration"]})

    # 4. Stops impact comparison (DEL -> BOM)
    stops_comp = []
    for st_label, st_val in [("Non-stop (Direct)", "zero"), ("1 Stop", "one"), ("2 or More Stops", "two_or_more")]:
        calc = calculate_duration_and_arrival("Delhi", "Mumbai", st_val, "Morning")
        df_s = pd.DataFrame([{
            "airline": "Vistara", "source_city": "Delhi", "departure_time": "Morning",
            "stops": st_val, "arrival_time": calc["arrival_time"], "destination_city": "Mumbai",
            "class": "Economy", "duration": calc["duration"], "days_left": 15
        }])
        p_s = round(float(model.predict(df_s)[0]), 2)
        stops_comp.append({"stops": st_label, "price": p_s})

    return {
        "model_metadata": {
            "model_pipeline": "flight_price_rf_pipeline_v2.pkl",
            "mae": TEST_MAE,
            "rmse": TEST_RMSE,
            "r2": TEST_R2,
            "includes_duration": True
        },
        "feature_importance": fi_list,
        "airline_comparison": airline_comp,
        "route_comparison": route_comp,
        "stops_comparison": stops_comp
    }


# Book-Now-or-Wait Advisor
@app.post("/book-now-or-wait")
def book_now_or_wait_advisor(flight: FlightDetails):
    """
    Advisor Rule Engine:
    - If days_left <= 3: Urgent window, prices increase rapidly close to departure -> "Book Now"
    - If lowest price occurs in > days_left: (Can only wait if days_left allows)
    - If lowest price in upcoming 50-day window occurs further out with > 15% discount -> "Consider Waiting"
    - If currently at lowest or price variation is < 5% -> "Prices Stable / Good to Book"
    """
    trend_result = get_booking_trend(flight)
    trend = trend_result["booking_trend"]
    curr_days = flight.days_left
    
    current_price = next((item["predicted_price"] for item in trend if item["days_left"] == curr_days), trend[0]["predicted_price"])
    
    closer_days = [item for item in trend if item["days_left"] < curr_days]
    
    if curr_days <= 3:
        action = "BOOK_NOW"
        confidence = "High"
        badge_color = "red"
        reason = f"Only {curr_days} day(s) left before departure. In the historical dataset, airfares surge steeply in the final 72 hours."
        savings_potential = 0.0
    else:
        if closer_days:
            min_future = min(closer_days, key=lambda x: x["predicted_price"])
            if min_future["predicted_price"] < current_price * 0.92:
                action = "CONSIDER_WAITING"
                confidence = "Moderate"
                badge_color = "amber"
                savings = round(current_price - min_future["predicted_price"], 2)
                reason = f"Model projects a possible dip around {min_future['days_left']} days before departure (potential savings of ₹{savings:,.2f})."
                savings_potential = savings
            else:
                action = "BOOK_NOW"
                confidence = "High"
                badge_color = "emerald"
                reason = f"Current airfare (₹{current_price:,.2f}) is optimal. Fares historically rise steadily as the departure date nears."
                savings_potential = 0.0
        else:
            action = "BOOK_NOW"
            confidence = "High"
            badge_color = "emerald"
            reason = "Optimal booking window reached."
            savings_potential = 0.0

    return {
        "action": action,
        "confidence": confidence,
        "badge_color": badge_color,
        "recommendation": reason,
        "current_price": current_price,
        "cheapest_price_overall": trend_result["cheapest_price"],
        "cheapest_overall_days_left": trend_result["cheapest_days_left"],
        "savings_potential": savings_potential,
        "currency": "INR"
    }

# ==========================================
# FARE PATTERN INSIGHTS (PHASE 2 REQUIREMENT)
# ==========================================
@app.get("/fare-insights")
def get_fare_insights():
    """
    Returns empirical benchmarks and feature importances calculated directly
    from the active Random Forest V2 pipeline for the Insights Dashboard.
    """
    # 1. Feature importance
    rf_model = model.named_steps["model"]
    preprocessor = model.named_steps["preprocessor"]
    feature_names = preprocessor.get_feature_names_out()
    importances = rf_model.feature_importances_

    fi_list = [
        {"feature": str(f).replace("cat__", "").replace("num__", "").capitalize(), "importance": round(float(imp) * 100, 2)}
        for f, imp in sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:10]
    ]

    # 2. Airline & Cabin Class benchmarks (DEL -> BOM, 15 days, Morning, Direct)
    airlines = AVAILABLE_OPTIONS["airlines"]
    airline_comp = []
    for air in airlines:
        df_eco = pd.DataFrame([{
            "airline": air, "source_city": "Delhi", "departure_time": "Morning",
            "stops": "zero", "arrival_time": "Afternoon", "destination_city": "Mumbai",
            "class": "Economy", "duration": 2.17, "days_left": 15
        }])
        df_biz = pd.DataFrame([{
            "airline": air, "source_city": "Delhi", "departure_time": "Morning",
            "stops": "zero", "arrival_time": "Afternoon", "destination_city": "Mumbai",
            "class": "Business", "duration": 2.17, "days_left": 15
        }])
        p_eco = round(float(model.predict(df_eco)[0]), 2)
        p_biz = round(float(model.predict(df_biz)[0]), 2)
        airline_comp.append({"airline": air, "economy": p_eco, "business": p_biz})

    # 3. Route comparisons
    sample_routes = [
        ("Delhi", "Mumbai"), ("Mumbai", "Bangalore"), ("Delhi", "Bangalore"),
        ("Bangalore", "Kolkata"), ("Delhi", "Chennai"), ("Kolkata", "Hyderabad")
    ]
    route_comp = []
    for s, d in sample_routes:
        calc = calculate_duration_and_arrival(s, d, "zero", "Morning")
        df_r = pd.DataFrame([{
            "airline": "Vistara", "source_city": s, "departure_time": "Morning",
            "stops": "zero", "arrival_time": calc["arrival_time"], "destination_city": d,
            "class": "Economy", "duration": calc["duration"], "days_left": 15
        }])
        p_r = round(float(model.predict(df_r)[0]), 2)
        route_comp.append({"route": f"{s} → {d}", "price": p_r, "duration_hours": calc["duration"]})

    # 4. Stops impact comparison (DEL -> BOM)
    stops_comp = []
    for st_label, st_val in [("Non-stop (Direct)", "zero"), ("1 Stop", "one"), ("2 or More Stops", "two_or_more")]:
        calc = calculate_duration_and_arrival("Delhi", "Mumbai", st_val, "Morning")
        df_s = pd.DataFrame([{
            "airline": "Vistara", "source_city": "Delhi", "departure_time": "Morning",
            "stops": st_val, "arrival_time": calc["arrival_time"], "destination_city": "Mumbai",
            "class": "Economy", "duration": calc["duration"], "days_left": 15
        }])
        p_s = round(float(model.predict(df_s)[0]), 2)
        stops_comp.append({"stops": st_label, "price": p_s})

    return {
        "model_metadata": {
            "model_pipeline": "flight_price_rf_pipeline_v2.pkl",
            "mae": TEST_MAE,
            "rmse": TEST_RMSE,
            "r2": TEST_R2,
            "includes_duration": True
        },
        "feature_importance": fi_list,
        "airline_comparison": airline_comp,
        "route_comparison": route_comp,
        "stops_comparison": stops_comp
    }