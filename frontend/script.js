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
const PRODUCTION_API_URL = "https://smart-flight-booking-assistant-16wy.onrender.com";

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
  const validPages = ["overview", "predictor", "trends", "alternatives", "insights", "admin", "about"];
  return validPages.includes(hash) ? hash : null;
}

function navigateToPage(pageId) {
  renderPage(pageId, true);
}

function renderPage(pageId, pushState = true) {
  const validPages = ["overview", "predictor", "trends", "alternatives", "insights", "admin", "about"];
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
    admin: "Admin Dashboard",
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
  } else if (pageId === "admin") {
    loadAdminMetrics();
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

// Dynamic Flight Calculation: Auto Duration and Arrival Slot (Hierarchical Lookup)
async function updateDynamicFlightCalculation() {
  const source = document.getElementById("source_city")?.value;
  const destination = document.getElementById("destination_city")?.value;
  const stops = document.getElementById("stops")?.value || "zero";
  const departureTime = document.getElementById("departure_time")?.value || "Morning";
  const airline = document.getElementById("airline")?.value || null;

  if (!source || !destination || source === destination) return;

  try {
    const res = await fetch(`${API_BASE_URL}/calculate-flight-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_city: source,
        destination_city: destination,
        stops: stops,
        departure_time: departureTime,
        airline: airline
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
// PART 1 & 4 & 5: SMART PREDICTION, ADMIN DASHBOARD & USER FEEDBACK
// ============================================================

let currentSmartOptions = [];
let activeSelectedFlight = null;
let currentPredictionId = null;

function switchPredictionMode(mode) {
  const smartSection = document.getElementById("smartPredictionSection");
  const advSection = document.getElementById("advancedPredictionSection");
  const btnSmart = document.getElementById("modeBtnSmart");
  const btnAdv = document.getElementById("modeBtnAdvanced");

  if (mode === "smart") {
    if (smartSection) smartSection.style.display = "block";
    if (advSection) advSection.style.display = "none";
    if (btnSmart) {
      btnSmart.style.background = "#FFFFFF";
      btnSmart.style.color = "#2563EB";
      btnSmart.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
    }
    if (btnAdv) {
      btnAdv.style.background = "transparent";
      btnAdv.style.color = "#64748B";
      btnAdv.style.boxShadow = "none";
    }
  } else {
    if (smartSection) smartSection.style.display = "none";
    if (advSection) advSection.style.display = "block";
    if (btnAdv) {
      btnAdv.style.background = "#FFFFFF";
      btnAdv.style.color = "#2563EB";
      btnAdv.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
    }
    if (btnSmart) {
      btnSmart.style.background = "transparent";
      btnSmart.style.color = "#64748B";
      btnSmart.style.boxShadow = "none";
    }
  }
}

function initSmartPrediction() {
  const smartForm = document.getElementById("smartFlightForm");
  if (!smartForm) return;

  smartForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const source = document.getElementById("smart_source_city").value;
    const dest = document.getElementById("smart_destination_city").value;
    const daysLeft = parseInt(document.getElementById("smart_days_left").value, 10);

    if (source === dest) {
      showToast("Source and destination city cannot be identical.", "error");
      return;
    }

    const searchBtn = document.getElementById("smartSearchBtn");
    searchBtn.disabled = true;
    searchBtn.innerHTML = `<span>Searching Operating Flights...</span>`;

    try {
      const res = await fetch(`${API_BASE_URL}/smart-prediction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_city: source,
          destination_city: dest,
          days_left: daysLeft
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to find flight combinations.");
      }

      const data = await res.json();
      currentSmartOptions = data.options || [];

      const resultsContainer = document.getElementById("smartResultsContainer");
      if (resultsContainer) resultsContainer.style.display = "block";

      const totalCount = document.getElementById("smartTotalCount");
      if (totalCount) totalCount.textContent = currentSmartOptions.length;

      applySmartFilters();

      // Automatically select the lowest fare option first
      if (currentSmartOptions.length > 0) {
        selectFlightOption(currentSmartOptions[0]);
      }

      showToast(`Found ${currentSmartOptions.length} valid flight combinations for ${source} → ${dest}.`, "info");
    } catch (err) {
      console.error("Smart Search Error:", err);
      showToast(err.message, "error");
    } finally {
      searchBtn.disabled = false;
      searchBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>Find Available Flight Options</span>
      `;
    }
  });
}

function applySmartFilters() {
  const airlineFilter = document.getElementById("filterAirline").value;
  const classFilter = document.getElementById("filterClass").value;
  const stopsFilter = document.getElementById("filterStops").value;
  const sortOption = document.getElementById("sortOptions").value;

  let filtered = currentSmartOptions.filter(opt => {
    if (airlineFilter !== "ALL" && opt.airline !== airlineFilter) return false;
    if (classFilter !== "ALL" && opt.flight_class !== classFilter) return false;
    if (stopsFilter !== "ALL" && String(opt.stops) !== String(stopsFilter)) return false;
    return true;
  });

  // Sorting logic
  if (sortOption === "price_asc") {
    filtered.sort((a, b) => a.predicted_price - b.predicted_price);
  } else if (sortOption === "price_desc") {
    filtered.sort((a, b) => b.predicted_price - a.predicted_price);
  } else if (sortOption === "duration_asc") {
    filtered.sort((a, b) => a.duration - b.duration);
  } else if (sortOption === "airline_asc") {
    filtered.sort((a, b) => a.airline.localeCompare(b.airline));
  }

  renderSmartFlightCards(filtered);
}

function renderSmartFlightCards(options) {
  const container = document.getElementById("smartFlightCardsList");
  if (!container) return;

  if (options.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding: 32px; text-align: center; color: #64748B;">
        <p style="font-size: 15px; font-weight: 600;">No flight options matched your current filter selection.</p>
        <p style="font-size: 13px; margin-top: 6px;">Try adjusting the airline or stops filter above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = options.map((opt, idx) => {
    const isSelected = activeSelectedFlight &&
      activeSelectedFlight.airline === opt.airline &&
      activeSelectedFlight.flight_class === opt.flight_class &&
      activeSelectedFlight.stops === opt.stops &&
      activeSelectedFlight.departure_time === opt.departure_time;

    return `
      <div class="card animate-card" onclick="selectFlightOptionByIndex(${idx})" style="padding: 16px 20px; cursor: pointer; border: 2px solid ${isSelected ? '#2563EB' : '#E2E8F0'}; background: ${isSelected ? '#F8FAFC' : '#FFFFFF'}; transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 16px; color: #0F172A;">${opt.airline}</strong>
              <span class="badge-tag ${opt.flight_class === 'Business' ? 'amber' : 'emerald'}" style="font-size: 10.5px; padding: 2px 7px;">${opt.flight_class}</span>
              <span class="badge-tag" style="background: #EEF2FF; color: #4338CA; font-size: 10.5px; padding: 2px 7px;">${opt.stops_label}</span>
            </div>
            <div style="font-size: 12.5px; color: #64748B; margin-top: 6px;">
              🛫 Departs: <strong>${opt.departure_time}</strong> • 🛬 Arrives: <strong>${opt.arrival_time}</strong> • ⏱️ <strong>${opt.duration} hrs</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700;">Est. Fare</div>
            <div style="font-size: 20px; font-weight: 900; color: #2563EB;">₹ ${opt.predicted_price.toLocaleString("en-IN")}</div>
            <span style="font-size: 11px; color: #059669; font-weight: 600;">View Details →</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function selectFlightOptionByIndex(idx) {
  if (currentSmartOptions[idx]) {
    selectFlightOption(currentSmartOptions[idx]);
    applySmartFilters();
  }
}

async function selectFlightOption(opt) {
  activeSelectedFlight = opt;

  const titleEl = document.getElementById("detailFlightTitle");
  const priceVal = document.getElementById("detailPriceVal");
  const floorVal = document.getElementById("detailFloorVal");
  const ceilVal = document.getElementById("detailCeilVal");
  const routeVal = document.getElementById("detailRouteVal");
  const airlineVal = document.getElementById("detailAirlineVal");
  const classVal = document.getElementById("detailClassVal");
  const stopsVal = document.getElementById("detailStopsVal");
  const depVal = document.getElementById("detailDepVal");
  const arrVal = document.getElementById("detailArrVal");
  const durVal = document.getElementById("detailDurationVal");
  const daysVal = document.getElementById("detailDaysVal");

  if (titleEl) titleEl.textContent = `${opt.airline} (${opt.flight_class})`;
  if (priceVal) priceVal.textContent = opt.predicted_price.toLocaleString("en-IN");
  if (floorVal) floorVal.textContent = opt.lower_price.toLocaleString("en-IN");
  if (ceilVal) ceilVal.textContent = opt.upper_price.toLocaleString("en-IN");
  if (routeVal) routeVal.textContent = `${opt.source_city} → ${opt.destination_city}`;
  if (airlineVal) airlineVal.textContent = opt.airline;
  if (classVal) classVal.textContent = opt.flight_class;
  if (stopsVal) stopsVal.textContent = opt.stops_label;
  if (depVal) depVal.textContent = opt.departure_time;
  if (arrVal) arrVal.textContent = opt.arrival_time;
  if (durVal) durVal.textContent = `${opt.duration} hrs`;
  if (daysVal) daysVal.textContent = `${opt.days_left} days prior`;

  // Reset feedback confirmation state
  const ack = document.getElementById("feedbackAck");
  if (ack) ack.style.display = "none";

  // Trigger Advisor Recommendation for selected option
  try {
    const res = await fetch(`${API_BASE_URL}/book-now-or-wait`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        airline: opt.airline,
        source_city: opt.source_city,
        departure_time: opt.departure_time,
        stops: opt.stops === 0 ? "zero" : (opt.stops === 1 ? "one" : "two_or_more"),
        arrival_time: opt.arrival_time,
        destination_city: opt.destination_city,
        flight_class: opt.flight_class,
        duration: opt.duration,
        days_left: opt.days_left
      })
    });
    if (res.ok) {
      const adv = await res.json();
      const advBox = document.getElementById("detailAdvisorBox");
      const advText = document.getElementById("detailAdvisorText");
      if (advBox && advText) {
        advBox.style.display = "block";
        advText.textContent = `${adv.recommendation} (${adv.price_change_summary || ''})`;
      }
    }
  } catch (e) {
    console.warn("Advisor fetch failed for option:", e);
  }
}

async function submitUserFeedback(rating) {
  try {
    const res = await fetch(`${API_BASE_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prediction_id: currentPredictionId,
        rating: rating,
        comments: `User responded ${rating} on ${activeSelectedFlight ? activeSelectedFlight.airline : 'itinerary'}`
      })
    });
    if (res.ok) {
      const ack = document.getElementById("feedbackAck");
      if (ack) ack.style.display = "block";
      showToast("Thank you for your feedback!", "info");
    }
  } catch (e) {
    console.error("Feedback submission error:", e);
  }
}

// ============================================================
// PART 4: ADMINISTRATOR DASHBOARD METRICS LOADER
// ============================================================

async function loadAdminMetrics() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/metrics`);
    if (!res.ok) throw new Error("Could not fetch metrics from database");

    const data = await res.json();

    // Update KPI numbers
    const totalS = document.getElementById("adminTotalSearches");
    const totalP = document.getElementById("adminTotalPredictions");
    const smartS = document.getElementById("adminSmartSearches");
    const advS = document.getElementById("adminAdvancedSearches");
    const dbType = document.getElementById("adminDbType");
    const fbSub = document.getElementById("adminFeedbackSub");

    if (totalS) totalS.textContent = data.total_searches;
    if (totalP) totalP.textContent = data.total_predictions;
    if (smartS) smartS.textContent = data.smart_searches;
    if (advS) advS.textContent = data.advanced_searches;
    if (dbType) dbType.textContent = data.database_type || "MySQL Active";
    if (fbSub) fbSub.textContent = `${data.feedback_summary.total} Feedback submissions (${data.feedback_summary.helpful} helpful)`;

    // Render Popular Routes Chart
    renderAdminBarChart("adminRoutesChart",
      data.popular_routes.map(r => r.route),
      data.popular_routes.map(r => r.count),
      "Searches", "#2563EB");

    // Render Airlines Chart
    renderAdminBarChart("adminAirlinesChart",
      data.popular_airlines.map(a => a.airline),
      data.popular_airlines.map(a => a.count),
      "Predictions", "#4F46E5");

    // Render Stops Distribution (0, 1, 2)
    renderAdminDoughnutChart("adminStopsChart",
      ["Direct (0 Stops)", "1 Stop", "2 Stops"],
      [data.stops_distribution["0"], data.stops_distribution["1"], data.stops_distribution["2"]],
      ["#10B981", "#3B82F6", "#F59E0B"]);

    // Render Feedback Breakdown
    renderAdminDoughnutChart("adminFeedbackChart",
      ["Helpful (Yes)", "Needs Improvement (No)"],
      [data.feedback_summary.helpful, data.feedback_summary.unhelpful],
      ["#059669", "#EF4444"]);

    // Render Recent Activity Table
    const tableBody = document.getElementById("adminRecentActivityBody");
    if (tableBody) {
      if (data.recent_activity.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94A3B8;">No prediction activity recorded yet. Run a prediction to see live database records.</td></tr>`;
      } else {
        tableBody.innerHTML = data.recent_activity.map(act => `
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 10px 12px; color: #64748B;">${act.timestamp}</td>
            <td style="padding: 10px 12px; font-weight: 700; color: #1E293B;">${act.source} → ${act.destination}</td>
            <td style="padding: 10px 12px; color: #475569;">${act.days_left}d</td>
            <td style="padding: 10px 12px;"><span class="badge-tag ${act.mode === 'Smart' ? 'emerald' : 'amber'}" style="font-size: 10px;">${act.mode}</span></td>
            <td style="padding: 10px 12px; color: #334155;">${act.airline}</td>
            <td style="padding: 10px 12px; font-weight: 800; color: #2563EB;">₹ ${act.price.toLocaleString("en-IN")}</td>
          </tr>
        `).join("");
      }
    }
  } catch (err) {
    console.error("Failed to load admin metrics:", err);
  }
}

const adminChartInstances = {};

function renderAdminBarChart(canvasId, labels, data, datasetLabel, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (adminChartInstances[canvasId]) {
    adminChartInstances[canvasId].destroy();
  }
  adminChartInstances[canvasId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No data"],
      datasets: [{
        label: datasetLabel,
        data: data.length ? data : [0],
        backgroundColor: color,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#F1F5F9" }, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderAdminDoughnutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (adminChartInstances[canvasId]) {
    adminChartInstances[canvasId].destroy();
  }
  const hasData = data.some(val => val > 0);
  adminChartInstances[canvasId] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: hasData ? labels : ["No Data Recorded"],
      datasets: [{
        data: hasData ? data : [1],
        backgroundColor: hasData ? colors : ["#E2E8F0"],
        borderWidth: 2,
        borderColor: "#FFFFFF"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}

// ============================================================
// 8. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initPredictorForm();
  initSmartPrediction();
  initBookingTrends();
  initCheaperAlternatives();
  initTravelDateSync();

  // Attach event listeners for dynamic flight duration and arrival slot calculation
  ["source_city", "destination_city", "stops", "departure_time", "airline"].forEach(id => {
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

