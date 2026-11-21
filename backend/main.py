# Import required libraries
import sys
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, validator
import pandas as pd
import joblib
from pathlib import Path
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
    description="Flight Price Prediction API",
    version="1.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained Random Forest pipeline
MODEL_PATH = Path(__file__).resolve().parent / "flight_price_rf_pipeline.pkl"

model = joblib.load(MODEL_PATH)
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
    ]
}
print("Random Forest model loaded successfully!")
# Test-set Mean Absolute Error
TEST_MAE = 2748.92
# Inspect Random Forest pipeline
print("\n========== MODEL INSPECTION ==========")

print("Model type:", type(model))

if hasattr(model, "named_steps"):

    print("\nPipeline steps:")

    for name, step in model.named_steps.items():
        print(name, ":", type(step))

    # Get final estimator
    rf_model = model.steps[-1][1]

    if hasattr(rf_model, "feature_importances_"):

        print("\nTop 15 Feature Importances:")

        importances = rf_model.feature_importances_

        try:
            feature_names = model[:-1].get_feature_names_out()

            importance_df = pd.DataFrame({
                "Feature": feature_names,
                "Importance": importances
            })

        except Exception as e:
            print("Feature name extraction error:", e)
            importance_df = pd.DataFrame({
                "Feature": [
                    f"Feature_{i}" for i in range(len(importances))
                ],
                "Importance": importances
            })

        print(
            importance_df.sort_values(
                by="Importance",
                ascending=False
            ).head(15).to_string(index=False)
        )

print("=====================================\n")

# Define input data structure
def validate_option(value, category):
    if value not in AVAILABLE_OPTIONS[category]:
        raise ValueError(
            f"Invalid value '{value}'. "
            f"Choose from: {AVAILABLE_OPTIONS[category]}"
        )
    return value


class FlightDetails(BaseModel):
    airline: str
    source_city: str
    departure_time: str
    stops: int = Field(ge=0, le=2)
    arrival_time: str
    destination_city: str
    flight_class: str
    duration: float = Field(gt=0)
    days_left: int = Field(ge=1)

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
        return validate_option(value, "arrival_times")

    @validator("flight_class")
    def check_flight_class(cls, value):
        return validate_option(value, "flight_classes")

# Home endpoint
@app.get("/") 
def home():
    return {
        "message": "Welcome to Smart Flight Booking Assistant API",
        "documentation": "/docs",
        "health": "healthy"
    }

# Health check endpoint for Render monitoring
@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": True}

# Available input options endpoint
@app.get("/available-options")
def get_available_options():
    return AVAILABLE_OPTIONS
# Prediction endpoint
@app.post("/predict")
def predict_price(flight: FlightDetails):
    if flight.source_city == flight.destination_city:
        raise HTTPException(
            status_code=400,
            detail="Source city and destination city cannot be the same."
        )
    input_data = pd.DataFrame([{
        "airline": flight.airline,
        "source_city": flight.source_city,
        "departure_time": flight.departure_time,
        "stops": flight.stops,
        "arrival_time": flight.arrival_time,
        "destination_city": flight.destination_city,
        "class": flight.flight_class,
        "duration": flight.duration,
        "days_left": flight.days_left
    }])

    prediction = model.predict(input_data)[0]

    return {
        "predicted_price": round(float(prediction), 2),
        "lower_price": round(max(0, float(prediction) - TEST_MAE), 2),
        "upper_price": round(float(prediction) + TEST_MAE, 2),
        "mae": TEST_MAE,
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
    })

    # Sort features by importance
    importance_df = importance_df.sort_values(
        by="importance",
        ascending=False
    )

    # Return top 10 features
    top_features = importance_df.head(10)

    return {
        "features": top_features["feature"].tolist(),
        "importance": [
            round(float(value) * 100, 2)
            for value in top_features["importance"]
        ]
    }
@app.post("/booking-trend")
def get_booking_trend(flight: FlightDetails):

    predictions = []

    for days in range(1, 51):

        input_data = pd.DataFrame([{
            "airline": flight.airline,
            "source_city": flight.source_city,
            "departure_time": flight.departure_time,
            "stops": flight.stops,
            "arrival_time": flight.arrival_time,
            "destination_city": flight.destination_city,
            "class": flight.flight_class,
            "duration": flight.duration,
            "days_left": days
        }])

        predicted_price = model.predict(input_data)[0]

        predictions.append({
            "days_left": days,
            "predicted_price": round(float(predicted_price), 2)
        })

    cheapest = min(
        predictions,
        key=lambda x: x["predicted_price"]
    )

    return {
        "booking_trend": predictions,
        "cheapest_days_left": cheapest["days_left"],
        "cheapest_price": cheapest["predicted_price"],
        "currency": "INR"
    }
# ==========================================
# CHEAPER ALTERNATIVES
# ==========================================

@app.post("/cheaper-alternatives")
def get_cheaper_alternatives(flight: FlightDetails):

    # Function to prepare input for prediction
    def predict_flight_price(
        airline,
        stops,
        departure_time
    ):

        input_data = pd.DataFrame([{
            "airline": airline,
            "source_city": flight.source_city,
            "departure_time": departure_time,
            "stops": stops,
            "arrival_time": flight.arrival_time,
            "destination_city": flight.destination_city,
            "class": flight.flight_class,
            "duration": flight.duration,
            "days_left": flight.days_left
        }])

        prediction = model.predict(input_data)[0]

        return round(float(prediction), 2)

    # Original flight price
    original_price = predict_flight_price(
        flight.airline,
        flight.stops,
        flight.departure_time
    )

    # Available alternatives
    airlines = [
        "AirAsia",
        "Air India",
        "GO_FIRST",
        "Indigo",
        "SpiceJet",
        "Vistara"
    ]

    stops_options = [0, 1, 2]

    departure_times = [
        "Early_Morning",
        "Morning",
        "Afternoon",
        "Evening",
        "Night",
        "Late_Night"
    ]

    # Compare alternative airlines
    airline_alternatives = []

    for airline in airlines:

        if airline == flight.airline:
            continue

        price = predict_flight_price(
            airline,
            flight.stops,
            flight.departure_time
        )

        if price < original_price:

            airline_alternatives.append({
                "airline": airline,
                "predicted_price": price,
                "savings": round(original_price - price, 2)
            })

    # Compare number of stops
    stops_alternatives = []

    for stops in stops_options:

        if stops == flight.stops:
            continue

        price = predict_flight_price(
            flight.airline,
            stops,
            flight.departure_time
        )

        if price < original_price:

            stops_alternatives.append({
                "stops": stops,
                "predicted_price": price,
                "savings": round(original_price - price, 2)
            })

    # Compare departure times
    time_alternatives = []

    for departure_time in departure_times:

        if departure_time == flight.departure_time:
            continue

        price = predict_flight_price(
            flight.airline,
            flight.stops,
            departure_time
        )

        if price < original_price:

            time_alternatives.append({
                "departure_time": departure_time,
                "predicted_price": price,
                "savings": round(original_price - price, 2)
            })

    # Sort alternatives by lowest predicted price
    airline_alternatives.sort(
        key=lambda x: x["predicted_price"]
    )

    stops_alternatives.sort(
        key=lambda x: x["predicted_price"]
    )

    time_alternatives.sort(
        key=lambda x: x["predicted_price"]
    )

    return {
        "original_price": original_price,
        "airline_alternatives": airline_alternatives,
        "stops_alternatives": stops_alternatives,
        "time_alternatives": time_alternatives,
        "currency": "INR"
    }