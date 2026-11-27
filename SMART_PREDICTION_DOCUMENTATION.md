# Smart Prediction Architecture & Functional Documentation

**Project:** Smart Flight Booking Assistant  
**Module:** Mode 1: Smart Route Flight Exploration  
**Default Application Mode:** True  

---

## 1. Overview & Objective

The primary objective of **Smart Prediction** is to minimize cognitive load for travelers. Instead of requiring users to manually guess or configure 7+ intricate technical fields (Carrier, Stops, Departure Slot, Cabin Class, Duration, etc.), Smart Prediction requires **only three intuitive inputs**:

1. **Source Origin City** (e.g. Delhi)
2. **Destination City** (e.g. Mumbai)
3. **Days Left Before Booking** (e.g. 15 days)

Upon clicking **"Find Available Flight Options"**, the backend identifies all genuine historical operating flight combinations for that corridor and uses the trained Random Forest model to compute real-time fair market airfares for every available option.

---

## 2. Combination Generation Rules

To ensure authenticity and prevent fabricated flight options:
1. **Actual Operating Flights Only:** The application loads pre-indexed route combinations from `backend/route_combinations.json` (derived from 300,153 empirical flight observations across all 30 metro corridors).
2. **Strict Stops Restriction (0, 1, or 2 Stops Only):**
   - Direct / Non-stop: `0 stops` (`"zero"`)
   - 1 Layover Stop: `1 stop` (`"one"`)
   - 2 Layover Stops: `2 stops` (`"two_or_more"`)
   - **No invalid stops:** Combinations with 3, 4, 5, or unlimited stops are strictly disallowed across all layers.
3. **High-Performance Batch Vectorization:**
   Instead of running individual single-row model predictions in a slow loop, the backend constructs a unified pandas DataFrame for all valid route combinations and calls `model.predict(batch_df)`. Over 180+ options are predicted in milliseconds.

---

## 3. Results Display, Filtering & Sorting

The UI presents the options in an intuitive card layout:
- **Default Order:** Sorted from Lowest Predicted Price to Highest.
- **Sorting Options:**
  - Lowest Price
  - Highest Price
  - Shortest Duration
  - Airline Name
- **Interactive Filters:**
  - Airline Carrier (Air India, AirAsia, GO_FIRST, Indigo, SpiceJet, Vistara)
  - Cabin Class (Economy, Business)
  - Stops Configuration (0 Stops, 1 Stop, 2 Stops)

### Detailed Flight Inspection View
Clicking on any flight card updates the inspection panel:
1. **Predicted Fair Airfare** (highlighted with prominent typography).
2. **Confidence Range** (Floor and Ceiling calculated with validation MAE ±₹1,293.06).
3. **Flight Parameters** (Carrier, Departure & Arrival Slot, Duration in hours, Stops).
4. **AI Booking Recommendation** (Real-time "Book Now" or "Consider Waiting" based on 50-day price trends).
5. **Interactive User Feedback** (One-click "Was this prediction useful?" logged into MySQL).
