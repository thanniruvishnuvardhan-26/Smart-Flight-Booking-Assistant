# Flight Duration Calculation & Arrival Slot Fix Report

**Project:** Smart Flight Booking Assistant  
**Module:** Dataset Duration Analytics & Hierarchical Lookup  
**Issue Priority:** Critical Bug Resolution  

---

## 1. Problem Statement

Previously, users noticed an apparent discrepancy when calculating flight durations:
- A non-stop flight from Bangalore to Chennai took **~1.08 hours**.
- A 1-stop flight for the same route was estimated at **~13.8 to 15 hours**.

At first glance, a 15-hour duration between two neighboring cities (Bangalore and Chennai) seemed like a software bug or unit calculation error.

---

## 2. Root Cause Analysis of the Historical Dataset

An exhaustive statistical audit of the original **300,153 cleaned flight observations** was conducted to understand whether this was a calculation bug or reflected dataset characteristics:

### A. Dataset Structure & Duration Definition
In commercial aviation data (specifically the Kaggle Indian domestic airline dataset collected via EaseMyTrip):
- `duration` represents the **total itinerary elapsed travel time** from initial departure to final arrival, including all intermediate layover wait times at connecting airports.
- It does **not** represent pure airborne flight time.

### B. Route Empirical Distributions

#### Bangalore → Chennai Route Duration Statistics:
| Stop Configuration | Sample Count | Minimum Duration | 25th Percentile | Median Duration | Mean Duration | Max Duration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Non-stop (Direct)** | 480 flights | 0.83 hrs | 1.00 hrs | **1.08 hrs** | 1.04 hrs | 1.17 hrs |
| **1 Stop (Connecting)** | 5,427 flights | 3.75 hrs | 11.25 hrs | **13.83 hrs** | 15.19 hrs | 47.75 hrs |
| **2 or More Stops** | 503 flights | 8.42 hrs | 11.25 hrs | **15.92 hrs** | 17.56 hrs | 40.75 hrs |

#### Delhi → Mumbai Route Duration Statistics:
| Stop Configuration | Sample Count | Minimum Duration | Median Duration | Mean Duration | Max Duration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Non-stop (Direct)** | 3,601 flights | 2.00 hrs | **2.17 hrs** | 2.21 hrs | 2.50 hrs |
| **1 Stop (Connecting)** | 11,615 flights | 3.17 hrs | **11.50 hrs** | 12.89 hrs | 30.08 hrs |
| **2 or More Stops** | 73 flights | 7.50 hrs | **9.67 hrs** | 10.12 hrs | 12.08 hrs |

### Why Connecting Flights Take 11 to 15 Hours:
1. Hub-and-Spoke Routing: Major Indian full-service carriers (such as Air India and Vistara) routing from Bangalore to Chennai do not fly direct; instead, they route passengers through central hubs like Delhi (DEL) or Mumbai (BOM).
2. Layovers: Passengers wait 4 to 10 hours at the transit hub for their connecting flight, stretching the total journey to 11–16 hours.
3. Machine Learning Input Integrity: The trained Random Forest model was trained on these exact total elapsed hours. Feeding an artificially compressed duration (e.g., 2.5 hours) into a 1-stop connecting flight would produce an inaccurate price prediction.

---

## 3. Hierarchical Duration Lookup Strategy

To prevent coarse route generalizations and ensure high accuracy, a **4-level hierarchical lookup** was built into `backend/duration_lookup.json` and `backend/main.py`:

```
Level 1: Source + Destination + Stops + Airline (Specific airline operational median)
           ↓ (if < 3 observations)
Level 2: Source + Destination + Stops (Route & stop specific median)
           ↓ (if unobserved)
Level 3: Source + Destination (Route-level median)
           ↓ (if unobserved)
Level 4: Overall Dataset Median (11.25 hours)
```

### Arrival Slot Calculation with Midnight Crossing
1. The departure slot midpoint is resolved (e.g., Morning = 10:00).
2. Duration in hours is added: `Arrival Hour = (Departure Midpoint + Duration) % 24`.
3. If `(Departure Midpoint + Duration) >= 24`, the flag `crosses_midnight = True` is raised, and the UI displays `🌙 Arrival crosses midnight (+1 day)`.
4. The resulting 24-hour float is mapped into the dataset's standard categories:
   - `Early_Morning`: 04:00 – 08:00
   - `Morning`: 08:00 – 12:00
   - `Afternoon`: 12:00 – 16:00
   - `Evening`: 16:00 – 20:00
   - `Night`: 20:00 – 00:00
   - `Late_Night`: 00:00 – 04:00

---

## 4. Verification Test Results

| Route | Stops | Carrier | Computed Duration | Arrival Slot | Midnight Crossing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bangalore → Chennai** | Non-stop (0) | AirAsia | **1.08 hrs** | Morning | False |
| **Bangalore → Chennai** | 1 Stop (1) | Vistara | **13.83 hrs** | Night | False |
| **Delhi → Mumbai** | Non-stop (0) | Indigo | **2.17 hrs** | Afternoon | False |
| **Delhi → Mumbai** | 1 Stop (1) | Air India | **11.50 hrs** | Night | False |
| **Hyderabad → Delhi** | 2 Stops (2) | Air India | **8.83 hrs** | Evening | False |
