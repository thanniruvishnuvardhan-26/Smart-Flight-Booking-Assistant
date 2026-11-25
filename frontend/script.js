/**
 * AeroMetrics - Premium Flight Intelligence Platform Frontend (Light Theme Edition)
 * Features:
 * - Multi-page SPA hash routing with smooth slide & fade transitions
 * - F. Genuine multi-stage airplane flight loading animation
 * - D. Smooth number-counting animation for predicted flight fares
 * - E. Animated Chart.js rendering (smooth lines, animated bar growth, light theme styling)
 * - G. Cheaper savings indicator with pulse green glow
 * - Real-time FastAPI model inference & benchmarks
 */

// API Configuration: Automatically detects local development vs production deployment
const IS_LOCAL = window.location.hostname === "localhost" || 
                 window.location.hostname === "127.0.0.1" || 
                 window.location.protocol === "file:";

// Local FastAPI backend vs Deployed Render backend URL
const LOCAL_API_URL = "http://127.0.0.1:8000";
const PRODUCTION_API_URL = "https://smart-flight-booking-assistant.onrender.com";

const API_BASE_URL = IS_LOCAL ? LOCAL_API_URL : PRODUCTION_API_URL;

// State Management
const appState = {
  currentPage: "overview",
  lastPrediction: null,
  charts: {
    trends: null,
    featureImportance: null,
    cabinComparison: null,
    routesComparison: null,
    stopsImpact: null
  },
  insightsData: null
};

// ============================================================
// 1. NAVIGATION & SPA ROUTING ARCHITECTURE (B. PAGE TRANSITIONS)
// ============================================================

function initNavigation() {
  const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
  const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("sidebar");

  // Click on navigation links
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const pageId = item.getAttribute("data-page");
      if (pageId) {
        navigateToPage(pageId);
        if (sidebar && sidebar.classList.contains("open")) {
          sidebar.classList.remove("open");
        }
      }
    });
  });

  // Mobile drawer toggle
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // Handle browser back/forward buttons
  window.addEventListener("popstate", (event) => {
    const pageId = (event.state && event.state.page) ? event.state.page : getHashPage() || "overview";
    renderPage(pageId, false);
  });

  // Initial load from URL hash or default to overview
  const initialPage = getHashPage() || "overview";
  renderPage(initialPage, true);
}

function getHashPage() {
  const hash = window.location.hash.replace("#", "").trim();
  const validPages = ["overview", "predictor", "trends", "alternatives", "insights", "about"];
  return validPages.includes(hash) ? hash : null;
}

function navigateToPage(pageId) {
  renderPage(pageId, true);
}

function renderPage(pageId, pushState = true) {
  const validPages = ["overview", "predictor", "trends", "alternatives", "insights", "about"];
  if (!validPages.includes(pageId)) pageId = "overview";

  // Update DOM classes for smooth slide & fade transitions
  document.querySelectorAll(".page-view").forEach(view => {
    view.classList.remove("active");
  });

  const targetView = document.getElementById(`page-${pageId}`);
  if (targetView) {
    targetView.classList.add("active");
  }

  // Update Sidebar active state
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
    if (item.getAttribute("data-page") === pageId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update Breadcrumb title
  const pageTitles = {
    overview: "Overview",
    predictor: "Price Predictor",
    trends: "Booking Trends",
    alternatives: "Cheaper Alternatives",
    insights: "Fare Insights",
    about: "About & Methodology"
  };
  const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = pageTitles[pageId] || "Overview";
  }

  appState.currentPage = pageId;

  if (pushState) {
    window.history.pushState({ page: pageId }, "", `#${pageId}`);
  }

  // Page-specific trigger actions & chart animations
  if (pageId === "insights") {
    loadFareInsightsCharts();
  } else if (pageId === "trends" && !appState.charts.trends) {
    triggerTrendAnalysis();
  } else if (pageId === "alternatives") {
    triggerAlternativesScan();
  }
}


// ============================================================
// 2. FORM DATA RETRIEVAL & VALIDATION
// ============================================================

function getFlightFormData() {
  const durationVal = parseFloat(document.getElementById("duration").value);
  const daysLeftVal = parseInt(document.getElementById("days_left").value, 10);
  const stopsVal = document.getElementById("stops").value || "zero";

  return {
    airline: document.getElementById("airline").value || "SpiceJet",
    source_city: document.getElementById("source_city").value || "Delhi",
    departure_time: document.getElementById("departure_time").value || "Morning",
    stops: stopsVal,
    arrival_time: document.getElementById("arrival_time").value || "Afternoon",
    destination_city: document.getElementById("destination_city").value || "Mumbai",
    flight_class: document.getElementById("flight_class").value || "Economy",
    duration: isNaN(durationVal) || durationVal <= 0 ? 2.17 : durationVal,
    days_left: isNaN(daysLeftVal) || daysLeftVal < 1 ? 15 : daysLeftVal
  };
}

// Dynamic Flight Calculation: Auto Duration and Arrival Slot
async function updateDynamicFlightCalculation() {
  const source = document.getElementById("source_city")?.value;
  const destination = document.getElementById("destination_city")?.value;
  const stops = document.getElementById("stops")?.value || "zero";
  const departureTime = document.getElementById("departure_time")?.value || "Morning";

  if (!source || !destination || source === destination) return;

  try {
    const res = await fetch(`${API_BASE_URL}/calculate-flight-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_city: source,
        destination_city: destination,
        stops: stops,
        departure_time: departureTime
      })
    });

    if (res.ok) {
      const data = await res.json();
      const durInput = document.getElementById("duration");
      const arrSelect = document.getElementById("arrival_time");
      const midnightNotice = document.getElementById("midnightCrossingNotice");

      if (durInput) durInput.value = data.duration;
      if (arrSelect) arrSelect.value = data.arrival_time;
      if (midnightNotice) {
        midnightNotice.style.display = data.crosses_midnight ? "block" : "none";
      }
    }
  } catch (err) {
    console.warn("Auto-calculation lookup error:", err);
  }
}

// Date Picker Sync with Days Left
function initTravelDateSync() {
  const dateInput = document.getElementById("travel_date");
  const daysLeftInput = document.getElementById("days_left");
  if (!dateInput || !daysLeftInput) return;

  // Set min date to today, max date to 50 days from today
  const today = new Date();
  const minDate = today.toISOString().split("T")[0];
  const maxDateObj = new Date();
  maxDateObj.setDate(today.getDate() + 50);
  const maxDate = maxDateObj.toISOString().split("T")[0];

  dateInput.min = minDate;
  dateInput.max = maxDate;

  // Set default date to today + days_left
  const defaultDate = new Date();
  defaultDate.setDate(today.getDate() + parseInt(daysLeftInput.value || 15, 10));
  dateInput.value = defaultDate.toISOString().split("T")[0];

  dateInput.addEventListener("change", () => {
    const selectedDate = new Date(dateInput.value);
    const timeDiff = selectedDate - new Date(today.toISOString().split("T")[0]);
    const diffDays = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    if (diffDays >= 1 && diffDays <= 50) {
      daysLeftInput.value = diffDays;
    }
  });

  daysLeftInput.addEventListener("input", () => {
    const days = parseInt(daysLeftInput.value, 10);
    if (!isNaN(days) && days >= 1 && days <= 50) {
      const newDate = new Date();
      newDate.setDate(today.getDate() + days);
      dateInput.value = newDate.toISOString().split("T")[0];
    }
  });
}

function validateCitySelection(flightData) {
  if (flightData.source_city === flightData.destination_city) {
    showToast("Source and destination cities cannot be identical.", "error");
    return false;
  }
  if (isNaN(flightData.duration) || flightData.duration <= 0) {
    showToast("Please enter a valid positive flight duration in hours.", "error");
    return false;
  }
  if (isNaN(flightData.days_left) || flightData.days_left < 1 || flightData.days_left > 50) {
    showToast("Booking window must be between 1 and 50 days.", "error");
    return false;
  }
  return true;
}


// ============================================================
// 3. PAGE 2: FLIGHT PRICE PREDICTION & ANIMATED AIRPLANE LOADING
// ============================================================

function initPredictorForm() {
  const form = document.getElementById("flightForm");
  const submitBtn = document.getElementById("predictSubmitBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const flightData = getFlightFormData();
    if (!validateCitySelection(flightData)) return;

    // UI Loading State with Stage Animation
    const emptyState = document.getElementById("predictorEmptyState");
    const resultCard = document.getElementById("predictorResultCard");
    const nextActions = document.getElementById("predictionNextActions");
    const loadingStage = document.getElementById("flightLoadingStage");
    const stageText = document.getElementById("loadingStageText");

    if (emptyState) emptyState.style.display = "none";
    if (resultCard) resultCard.style.display = "none";
    if (nextActions) nextActions.style.display = "none";
    if (loadingStage) loadingStage.style.display = "flex";

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="spinner"></div>
      <span>Calculating Airfare...</span>
    `;

    // Multi-stage text updates
    const stages = [
      "Analyzing flight details...",
      "Processing historical fare patterns...",
      "Generating your prediction..."
    ];
    let stageIdx = 0;
    stageText.textContent = stages[0];

    const stageInterval = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        stageText.textContent = stages[stageIdx];
      }
    }, 450);

    try {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flightData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Prediction request failed.");
      }

      // Ensure user sees the complete smooth airplane animation (at least 900ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 900) {
        await new Promise(r => setTimeout(r, 900 - elapsed));
      }

      clearInterval(stageInterval);

      // Store in state
      appState.lastPrediction = {
        flightData,
        result: data
      };

      // Hide Loader, Display Prediction
      if (loadingStage) loadingStage.style.display = "none";
      displayPredictionResult(data, flightData);
      if (data.warning) {
        showToast(data.warning, "info");
      } else {
        showToast("Airfare price calculated successfully!", "success");
      }

    } catch (error) {
      clearInterval(stageInterval);
      if (loadingStage) loadingStage.style.display = "none";
      if (emptyState) emptyState.style.display = "flex";
      console.error("Prediction error:", error);
      showToast(error.message || "Unable to reach prediction engine.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
        <span>Run AI Price Prediction</span>
      `;
    }
  });
}

// D. Number-Counting Animation for Predicted Price
function animateCounter(element, targetValue, duration = 800) {
  if (!element) return;
  const startTime = performance.now();
  const startValue = 0;

  function updateCount(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth ease-out cubic
    const easeOutProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutProgress);

    element.textContent = currentValue.toLocaleString("en-IN");

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      element.textContent = Math.round(targetValue).toLocaleString("en-IN");
    }
  }

  requestAnimationFrame(updateCount);
}

function displayPredictionResult(data, flightData) {
  const resultCard = document.getElementById("predictorResultCard");
  const nextActions = document.getElementById("predictionNextActions");

  const priceVal = document.getElementById("predictedPriceValue");
  const lowerVal = document.getElementById("predLowerPrice");
  const upperVal = document.getElementById("predUpperPrice");
  const maeVal = document.getElementById("predMaeValue");
  const routePill = document.getElementById("predRoutePill");
  const treeSpreadVal = document.getElementById("predTreeSpread");

  if (resultCard) resultCard.style.display = "block";
  if (nextActions) nextActions.style.display = "grid";

  // Trigger Number Counter Animation
  animateCounter(priceVal, data.predicted_price, 900);

  if (lowerVal) lowerVal.textContent = `₹ ${data.lower_price.toLocaleString("en-IN")}`;
  if (upperVal) upperVal.textContent = `₹ ${data.upper_price.toLocaleString("en-IN")}`;
  if (maeVal) maeVal.textContent = data.mae.toLocaleString("en-IN");
  if (treeSpreadVal && data.tree_uncertainty !== undefined) {
    treeSpreadVal.textContent = data.tree_uncertainty.toLocaleString("en-IN");
  }

  const stopLabel = flightData.stops === "zero" || flightData.stops === 0 ? "Non-stop" : (flightData.stops === "one" || flightData.stops === 1 ? "1 Stop" : "2+ Stops");
  if (routePill) {
    routePill.textContent = `${flightData.source_city} → ${flightData.destination_city} • ${flightData.airline} • ${flightData.flight_class} • ${stopLabel} • ${data.effective_duration || flightData.duration} hrs`;
  }

  // Fetch Book-Now-or-Wait Advice
  fetchBookNowOrWaitAdvice(flightData);
}

async function fetchBookNowOrWaitAdvice(flightData) {
  const badgeCard = document.getElementById("advisorBadgeCard");
  const badgeAction = document.getElementById("advisorBadgeAction");
  const badgeReason = document.getElementById("advisorBadgeReason");

  if (!badgeCard) return;

  try {
    const res = await fetch(`${API_BASE_URL}/book-now-or-wait`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flightData)
    });

    if (res.ok) {
      const data = await res.json();
      badgeCard.style.display = "block";
      badgeAction.textContent = data.action === "BOOK_NOW" ? "BOOK NOW" : (data.action === "CONSIDER_WAITING" ? "CONSIDER WAITING" : "STABLE FARE");
      badgeAction.className = `badge-tag ${data.badge_color || 'emerald'}`;
      badgeReason.textContent = data.recommendation;
    }
  } catch (err) {
    console.warn("Advisor fetch error:", err);
  }
}

function quickAnalyzeTrends() {
  navigateToPage("trends");
  triggerTrendAnalysis();
}

function quickAnalyzeAlternatives() {
  navigateToPage("alternatives");
  triggerAlternativesScan();
}


// ============================================================
// 4. PAGE 3: BOOKING TRENDS (E. ANIMATED CHART DRAWING)
// ============================================================

function initBookingTrends() {
  const trendBtn = document.getElementById("runTrendAnalysisBtn");
  if (trendBtn) {
    trendBtn.addEventListener("click", () => {
      triggerTrendAnalysis();
    });
  }
}

async function triggerTrendAnalysis() {
  const flightData = getFlightFormData();
  if (!validateCitySelection(flightData)) return;

  const trendBtn = document.getElementById("runTrendAnalysisBtn");
  const summaryStrip = document.getElementById("trendSummaryStrip");
  const recDays = document.getElementById("recDaysVal");
  const recPrice = document.getElementById("recPriceVal");
  const routeLabel = document.getElementById("trendRouteLabel");
  const paramLabel = document.getElementById("trendParamLabel");

  if (trendBtn) {
    trendBtn.disabled = true;
    trendBtn.innerHTML = `
      <div class="spinner"></div>
      <span>Simulating 50 Days...</span>
    `;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/booking-trend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flightData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Trend simulation failed.");
    }

    // Update labels
    if (summaryStrip) summaryStrip.style.display = "grid";
    if (recDays) recDays.textContent = data.cheapest_days_left;
    if (recPrice) recPrice.textContent = `₹ ${data.cheapest_price.toLocaleString("en-IN")}`;
    if (routeLabel) routeLabel.textContent = `${flightData.source_city} → ${flightData.destination_city} (${flightData.airline})`;
    if (paramLabel) paramLabel.textContent = `${flightData.flight_class} Class • ${flightData.stops === 0 ? 'Non-stop' : flightData.stops + ' Stop(s)'}`;

    // Render animated chart in light theme styling
    renderBookingTrendChart(data.booking_trend, data.cheapest_days_left, flightData.days_left);
    showToast("50-Day Booking Curve generated!", "success");

  } catch (error) {
    console.error("Trend Analysis Error:", error);
    showToast(error.message || "Failed to analyze booking trends.", "error");
  } finally {
    if (trendBtn) {
      trendBtn.disabled = false;
      trendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>Run Trend Analysis</span>
      `;
    }
  }
}

function renderBookingTrendChart(trendData, cheapestDays, selectedDays) {
  const canvas = document.getElementById("trendMainChart");
  if (!canvas) return;

  if (appState.charts.trends) {
    appState.charts.trends.destroy();
  }

  const ctx = canvas.getContext("2d");

  const labels = trendData.map(item => `${item.days_left}d`);
  const prices = trendData.map(item => item.predicted_price);

  // Styling point colors for light theme
  const pointBgColors = trendData.map(item => {
    if (item.days_left === cheapestDays) return "#10B981"; // Emerald for lowest
    if (item.days_left === selectedDays) return "#F59E0B"; // Amber for currently selected
    return "#2563EB";
  });

  const pointRadii = trendData.map(item => {
    if (item.days_left === cheapestDays || item.days_left === selectedDays) return 7;
    return 3;
  });

  // Soft Blue Gradient Fill for Light Theme
  const gradient = ctx.createLinearGradient(0, 0, 0, 420);
  gradient.addColorStop(0, "rgba(37, 99, 235, 0.22)");
  gradient.addColorStop(0.5, "rgba(96, 165, 250, 0.08)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

  appState.charts.trends = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Predicted Flight Price (₹)",
        data: prices,
        borderColor: "#2563EB",
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: pointBgColors,
        pointBorderColor: "#FFFFFF",
        pointBorderWidth: 2,
        pointRadius: pointRadii,
        pointHoverRadius: 9
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: "easeOutCubic"
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#64748B",
            font: { family: "Inter", size: 12, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: "#FFFFFF",
          titleColor: "#1E293B",
          bodyColor: "#2563EB",
          borderColor: "#E2E8F0",
          borderWidth: 1.5,
          padding: 12,
          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
          callbacks: {
            title: (items) => `Booking Window: ${items[0].label} before departure`,
            label: (item) => {
              let text = `Estimated Airfare: ₹ ${item.raw.toLocaleString("en-IN")}`;
              const dayNum = parseInt(item.label);
              if (dayNum === cheapestDays) text += " ⭐ (Cheapest Day)";
              if (dayNum === selectedDays) text += " 📍 (Selected in Form)";
              return text;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(226, 232, 240, 0.6)" },
          ticks: { color: "#64748B", font: { family: "Inter", size: 11, weight: 500 } },
          title: {
            display: true,
            text: "Days Left Before Flight Departure (1 to 50)",
            color: "#1E293B",
            font: { family: "Inter", size: 12, weight: 700 }
          }
        },
        y: {
          grid: { color: "rgba(226, 232, 240, 0.6)" },
          ticks: {
            color: "#64748B",
            font: { family: "Inter", size: 11, weight: 500 },
            callback: (val) => `₹ ${val.toLocaleString("en-IN")}`
          },
          title: {
            display: true,
            text: "Predicted Ticket Price (INR)",
            color: "#1E293B",
            font: { family: "Inter", size: 12, weight: 700 }
          }
        }
      }
    }
  });
}


// ============================================================
// 5. PAGE 4: CHEAPER FLIGHT ALTERNATIVES & SAVINGS ANIMATION
// ============================================================

function initCheaperAlternatives() {
  const altBtn = document.getElementById("runAlternativesBtn");
  if (altBtn) {
    altBtn.addEventListener("click", () => {
      triggerAlternativesScan();
    });
  }
}

async function triggerAlternativesScan() {
  const flightData = getFlightFormData();
  if (!validateCitySelection(flightData)) return;

  const altBtn = document.getElementById("runAlternativesBtn");
  const origPriceEl = document.getElementById("altOriginalPrice");
  const routeLabelEl = document.getElementById("altRouteLabel");

  if (altBtn) {
    altBtn.disabled = true;
    altBtn.innerHTML = `
      <div class="spinner"></div>
      <span>Scanning Alternatives...</span>
    `;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cheaper-alternatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flightData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Failed to scan alternatives.");
    }

    if (origPriceEl) {
      origPriceEl.textContent = `₹ ${data.original_price.toLocaleString("en-IN")}`;
    }
    if (routeLabelEl) {
      routeLabelEl.textContent = `${flightData.source_city} → ${flightData.destination_city} (${flightData.airline})`;
    }

    // Render 3 groups with animated cards
    renderAirlineAlternatives(data.airline_alternatives, data.original_price);
    renderStopsAlternatives(data.stops_alternatives, data.original_price);
    renderTimesAlternatives(data.time_alternatives, data.original_price);

    showToast("Cheaper alternatives evaluated!", "success");

  } catch (error) {
    console.error("Alternatives error:", error);
    showToast(error.message || "Failed to evaluate alternatives.", "error");
  } finally {
    if (altBtn) {
      altBtn.disabled = false;
      altBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Scan Alternatives</span>
      `;
    }
  }
}

function renderAirlineAlternatives(alternatives, originalPrice) {
  const container = document.getElementById("airlineAlternativesGrid");
  if (!container) return;

  if (!alternatives || alternatives.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">
        No cheaper carrier alternatives found for this exact route and timing. Your selected airline is already the lowest estimated carrier.
      </div>
    `;
    return;
  }

  let html = "";
  alternatives.forEach((item, index) => {
    const isBest = index === 0;
    const savingsPercent = originalPrice > 0 ? Math.round((item.savings / originalPrice) * 100) : 0;

    html += `
      <div class="alt-card ${isBest ? 'best-deal' : ''}">
        ${isBest ? '<div class="best-deal-tag">Lowest Carrier Fare</div>' : ''}
        <div class="alt-header">
          <div class="alt-name">${item.airline}</div>
        </div>
        <div>
          <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Estimated Price</span>
          <div class="alt-price">₹ ${item.predicted_price.toLocaleString("en-IN")}</div>
        </div>
        <div class="alt-savings-badge">
          <span>Rupee Savings:</span>
          <strong>₹ ${item.savings.toLocaleString("en-IN")} (${savingsPercent}%)</strong>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderStopsAlternatives(alternatives, originalPrice) {
  const container = document.getElementById("stopsAlternativesGrid");
  if (!container) return;

  if (!alternatives || alternatives.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">
        No cheaper layover configurations found.
      </div>
    `;
    return;
  }

  let html = "";
  alternatives.forEach((item, index) => {
    const isBest = index === 0;
    const stopText = item.stops === 0 ? "Non-stop (Direct)" : `${item.stops} Stop(s)`;
    const savingsPercent = originalPrice > 0 ? Math.round((item.savings / originalPrice) * 100) : 0;

    html += `
      <div class="alt-card ${isBest ? 'best-deal' : ''}">
        ${isBest ? '<div class="best-deal-tag">Best Layover Deal</div>' : ''}
        <div class="alt-header">
          <div class="alt-name">${stopText}</div>
        </div>
        <div>
          <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Estimated Price</span>
          <div class="alt-price">₹ ${item.predicted_price.toLocaleString("en-IN")}</div>
        </div>
        <div class="alt-savings-badge">
          <span>Rupee Savings:</span>
          <strong>₹ ${item.savings.toLocaleString("en-IN")} (${savingsPercent}%)</strong>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderTimesAlternatives(alternatives, originalPrice) {
  const container = document.getElementById("timesAlternativesGrid");
  if (!container) return;

  if (!alternatives || alternatives.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">
        No cheaper departure window options found. Your selected departure slot offers optimal pricing.
      </div>
    `;
    return;
  }

  let html = "";
  alternatives.forEach((item, index) => {
    const isBest = index === 0;
    const cleanSlot = item.departure_time.replaceAll("_", " ");
    const savingsPercent = originalPrice > 0 ? Math.round((item.savings / originalPrice) * 100) : 0;

    html += `
      <div class="alt-card ${isBest ? 'best-deal' : ''}">
        ${isBest ? '<div class="best-deal-tag">Cheapest Slot</div>' : ''}
        <div class="alt-header">
          <div class="alt-name">${cleanSlot}</div>
        </div>
        <div>
          <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Estimated Price</span>
          <div class="alt-price">₹ ${item.predicted_price.toLocaleString("en-IN")}</div>
        </div>
        <div class="alt-savings-badge">
          <span>Rupee Savings:</span>
          <strong>₹ ${item.savings.toLocaleString("en-IN")} (${savingsPercent}%)</strong>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}


// ============================================================
// 6. PAGE 5: FARE INSIGHTS CHARTS (ANIMATED & LIGHT THEMED)
// ============================================================

async function loadFareInsightsCharts() {
  await Promise.all([
    loadFeatureImportanceChart(),
    loadBenchmarkInsightsCharts()
  ]);
}

async function loadFeatureImportanceChart() {
  const canvas = document.getElementById("featureImportanceChart");
  if (!canvas) return;

  if (appState.charts.featureImportance) {
    return; // Already rendered
  }

  try {
    const response = await fetch(`${API_BASE_URL}/feature-importance`);
    if (!response.ok) throw new Error("Could not fetch feature importance");
    const data = await response.json();

    const ctx = canvas.getContext("2d");
    const labels = data.features.map(f =>
      f.replace("cat__", "")
        .replace("num__", "")
        .replaceAll("_", " ")
    );

    appState.charts.featureImportance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Feature Importance (%)",
          data: data.importance,
          backgroundColor: "#2563EB",
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: "easeOutCubic"
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#FFFFFF",
            titleColor: "#1E293B",
            bodyColor: "#2563EB",
            borderColor: "#E2E8F0",
            borderWidth: 1.5,
            callbacks: {
              label: (context) => ` Split Importance: ${context.raw}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(226, 232, 240, 0.6)" },
            ticks: { color: "#64748B", font: { family: "Inter", size: 11, weight: 500 } },
            title: {
              display: true,
              text: "Relative Importance (%)",
              color: "#1E293B",
              font: { family: "Inter", size: 11, weight: 700 }
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: "#1E293B", font: { family: "Inter", size: 11, weight: 600 } }
          }
        }
      }
    });
  } catch (err) {
    console.error("Feature Importance Error:", err);
  }
}

async function loadBenchmarkInsightsCharts() {
  if (appState.charts.cabinComparison && appState.charts.routesComparison && appState.charts.stopsImpact) {
    return; // Already rendered
  }

  try {
    // Attempt live fetch from backend original model endpoint first, fallback to synced static JSON
    let data;
    try {
      const liveRes = await fetch(`${API_BASE_URL}/fare-insights`);
      if (liveRes.ok) {
        data = await liveRes.json();
      } else {
        throw new Error("Backend fare-insights not 200");
      }
    } catch {
      const response = await fetch("insights_data.json");
      if (!response.ok) throw new Error("Could not load insights data");
      data = await response.json();
    }

    appState.insightsData = data;

    // 1. Cabin Class Comparison Chart (Economy vs Business)
    const cabinCanvas = document.getElementById("cabinComparisonChart");
    if (cabinCanvas && !appState.charts.cabinComparison) {
      const ctx = cabinCanvas.getContext("2d");
      const airlines = data.airline_comparison.map(x => x.airline);
      const economyPrices = data.airline_comparison.map(x => x.economy);
      const businessPrices = data.airline_comparison.map(x => x.business);

      appState.charts.cabinComparison = new Chart(ctx, {
        type: "bar",
        data: {
          labels: airlines,
          datasets: [
            {
              label: "Economy Class (₹)",
              data: economyPrices,
              backgroundColor: "#3B82F6",
              borderRadius: 6
            },
            {
              label: "Business Class (₹)",
              data: businessPrices,
              backgroundColor: "#8B5CF6",
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 850,
            easing: "easeOutCubic"
          },
          plugins: {
            legend: {
              display: true,
              labels: { color: "#64748B", font: { family: "Inter", size: 11, weight: 600 } }
            },
            tooltip: {
              backgroundColor: "#FFFFFF",
              titleColor: "#1E293B",
              bodyColor: "#1E293B",
              borderColor: "#E2E8F0",
              borderWidth: 1.5,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ₹ ${ctx.raw.toLocaleString("en-IN")}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: "rgba(226, 232, 240, 0.6)" },
              ticks: { color: "#1E293B", font: { family: "Inter", size: 11, weight: 600 } }
            },
            y: {
              grid: { color: "rgba(226, 232, 240, 0.6)" },
              ticks: {
                color: "#64748B",
                font: { family: "Inter", size: 11, weight: 500 },
                callback: (val) => `₹ ${val.toLocaleString("en-IN")}`
              }
            }
          }
        }
      });
    }

    // 2. Corridors Route Comparison
    const routeCanvas = document.getElementById("routesComparisonChart");
    if (routeCanvas && !appState.charts.routesComparison) {
      const ctx = routeCanvas.getContext("2d");
      const routes = data.route_comparison.map(x => x.route);
      const prices = data.route_comparison.map(x => x.price);

      appState.charts.routesComparison = new Chart(ctx, {
        type: "bar",
        data: {
          labels: routes,
          datasets: [{
            label: "Benchmark Fare (₹)",
            data: prices,
            backgroundColor: "#2563EB",
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 900,
            easing: "easeOutCubic"
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#FFFFFF",
              titleColor: "#1E293B",
              bodyColor: "#2563EB",
              borderColor: "#E2E8F0",
              borderWidth: 1.5,
              callbacks: {
                label: (ctx) => ` Base Fare: ₹ ${ctx.raw.toLocaleString("en-IN")}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#1E293B", font: { family: "Inter", size: 10, weight: 600 } }
            },
            y: {
              grid: { color: "rgba(226, 232, 240, 0.6)" },
              ticks: {
                color: "#64748B",
                font: { family: "Inter", size: 11, weight: 500 },
                callback: (val) => `₹ ${val.toLocaleString("en-IN")}`
              }
            }
          }
        }
      });
    }

    // 3. Stops Impact Chart
    const stopsCanvas = document.getElementById("stopsImpactChart");
    if (stopsCanvas && !appState.charts.stopsImpact) {
      const ctx = stopsCanvas.getContext("2d");
      const stopsLabels = data.stops_comparison.map(x => x.stops);
      const stopsPrices = data.stops_comparison.map(x => x.price);

      const grad = ctx.createLinearGradient(0, 0, 0, 350);
      grad.addColorStop(0, "rgba(16, 185, 129, 0.2)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

      appState.charts.stopsImpact = new Chart(ctx, {
        type: "line",
        data: {
          labels: stopsLabels,
          datasets: [{
            label: "Predicted Price vs Stops (₹)",
            data: stopsPrices,
            borderColor: "#10B981",
            backgroundColor: grad,
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: "#10B981",
            pointBorderColor: "#FFFFFF",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 9
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 850,
            easing: "easeOutCubic"
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#FFFFFF",
              titleColor: "#1E293B",
              bodyColor: "#10B981",
              borderColor: "#E2E8F0",
              borderWidth: 1.5,
              callbacks: {
                label: (ctx) => ` Fare: ₹ ${ctx.raw.toLocaleString("en-IN")}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: "rgba(226, 232, 240, 0.6)" },
              ticks: { color: "#1E293B", font: { family: "Inter", size: 11, weight: 600 } }
            },
            y: {
              grid: { color: "rgba(226, 232, 240, 0.6)" },
              ticks: {
                color: "#64748B",
                font: { family: "Inter", size: 11, weight: 500 },
                callback: (val) => `₹ ${val.toLocaleString("en-IN")}`
              }
            }
          }
        }
      });
    }

  } catch (err) {
    console.error("Benchmark Insights Load Error:", err);
  }
}


// ============================================================
// 7. TOAST NOTIFICATION UTILITY
// ============================================================

let toastTimeout = null;
function showToast(message, type = "info") {
  const toast = document.getElementById("appToast");
  const msgEl = document.getElementById("toastMessage");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.className = `toast show ${type === 'error' ? 'error' : ''}`;

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}


// ============================================================
// 8. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initPredictorForm();
  initBookingTrends();
  initCheaperAlternatives();
  initTravelDateSync();

  // Attach event listeners for dynamic flight duration and arrival slot calculation
  ["source_city", "destination_city", "stops", "departure_time"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        updateDynamicFlightCalculation();
      });
    }
  });

  // Initial calculation on load
  updateDynamicFlightCalculation();

  // Test API heartbeat
  fetch(`${API_BASE_URL}/`)
    .then(r => r.json())
    .then(() => {
      const statusText = document.getElementById("apiStatusText");
      if (statusText) statusText.textContent = "FastAPI Online";
    })
    .catch(() => {
      const statusText = document.getElementById("apiStatusText");
      if (statusText) {
        statusText.textContent = "Backend Offline";
        statusText.parentElement.classList.remove("emerald");
        statusText.parentElement.classList.add("amber");
      }
    });
});
