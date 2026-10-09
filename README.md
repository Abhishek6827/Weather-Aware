# 🚛 Weather-Aware Truck Routing System

> **Full Stack React + Django Application** that computes the safest highway routes for commercial freight trucks by analyzing real-time weather forecasts, load weight rollover risks, and transit times.

---

## 🌟 Executive Summary & Capabilities

Truck freight dispatchers and drivers face critical safety decisions when routing through winter storms, high crosswinds, and heavy precipitation. A high-profile trailer carrying 45,000 lbs in 40+ mph crosswinds faces a severe rollover hazard, whereas an empty trailer faces wind shear at even lower thresholds.

This application solves this by:
1. **Generating 3 Alternative Routes** between any origin and destination via highway routing APIs.
2. **Sampling Weather Checkpoints** every **10, 25, or 50 miles** (configurable by the user).
3. **Calculating Dynamic ETAs** at each checkpoint along the route to evaluate the weather forecast at the *exact hour the truck will arrive*.
4. **Applying Strict Safety & Load Weight Escalation Rules** (per Spotter assessment requirements).
5. **Ranking and Recommending** the optimal route using the 4-tier decision priority hierarchy.
6. **Simulating Trip Corridor Weather Heatmaps** with an interactive **0–48 hour forecast slider** and animated playback.

---

## 📐 Architecture & Technology Stack

```
Weather-Aware/
├── backend/                  # Django REST Framework (Python 3.14)
│   ├── config/               # Settings, CORS, WSGI, URLs
│   ├── routes/               # Route dispatch core app
│   │   ├── services/
│   │   │   ├── routing.py    # Multi-provider routing (ORS + OSRM 3-route engine)
│   │   │   ├── weather.py    # Open-Meteo batch hourly forecast integration
│   │   │   └── risk.py       # Weather risk matrix & load weight escalation rules
│   │   ├── serializers.py    # Validation schema (origin, dest, time, weight, interval)
│   │   ├── views.py          # API endpoints
│   │   └── urls.py
│   ├── manage.py
│   └── requirements.txt
└── frontend/                 # React 19 + Vite (Modern Dark Theme)
    ├── src/
    │   ├── components/
    │   │   ├── RouteForm.jsx       # Dispatch form with corridor presets & interval selector
    │   │   ├── RouteCard.jsx       # Route comparison card with mile breakdowns & risk bar
    │   │   ├── MapView.jsx         # Leaflet map with checkpoints, popups, and layer toggles
    │   │   └── ForecastSlider.jsx  # 0-48h radar slider with animated Play/Pause
    │   ├── services/
    │   │   └── api.js              # Axios backend client
    │   ├── App.jsx                 # Workspace coordinator
    │   ├── index.css               # Design system & dark theme
    │   └── main.jsx
    ├── package.json
    └── index.html
```

---

## ⚖️ Safety & Risk Decision Matrix

### 1. Weather Severity Classification

| Condition | Low (0) | Moderate (1) | High (2) | Severe (3) | No Travel (4) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Wind Speed** | `< 25 mph` | `25 – 34 mph` | `35 – 44 mph` | `45 – 54 mph` | `≥ 55 mph` |
| **Rain Intensity** | `< 0.10 in/hr` | `0.10 – 0.25` | `0.25 – 0.50` | `0.50 – 1.00` | `> 1.00 in/hr` |
| **Snowfall Rate** | `< 0.5 in/hr` | `0.5 – 1.0` | `1.0 – 2.0` | `2.0 – 3.0` | `> 3.0 in/hr` |

### 2. Commercial Load Weight Escalation Rules

In addition to baseline atmospheric conditions, truck gross weight directly escalates the risk tier:
- **Rule 1 (Universal No Travel):** Wind speed $\ge 55\text{ mph} \implies \text{No Travel}$ regardless of load weight.
- **Rule 2 (Heavy Load High Wind):** Wind speed $45\text{--}54\text{ mph}$ with load weight $> 30,000\text{ lbs} \implies \text{No Travel}$ (high center of gravity rollover hazard).
- **Rule 3 (Extreme Load Moderate Wind):** Wind speed $35\text{--}44\text{ mph}$ with load weight $> 40,000\text{ lbs} \implies \text{Severe}$ (escalates High base risk to Severe).

### 3. Route Recommendation Priority Hierarchy

Routes are strictly sorted and recommended according to:
1. **Fewest Severe Miles** (primary objective: avoid catastrophic weather corridors)
2. **Fewest High Miles**
3. **Lowest Average Risk Score** across all sampled checkpoints
4. **Shortest Travel Duration** (tie-breaker for routes with equivalent safety)

*(Note: Routes with any No-Travel segments are flagged with safety alerts and ranked behind viable alternatives).*

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# (Optional) OpenRouteService API key in backend/.env
# If left blank, the system automatically uses built-in free OSRM + Nominatim routing
echo ORS_API_KEY=your_key_here > .env

# Start Django development server
python manage.py runserver 8000
```
Backend runs at: `http://127.0.0.1:8000/`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend runs at: `http://localhost:5173/`

---

## 📡 API Specification

### `POST /api/routes/`

**Request Payload:**
```json
{
  "origin": "Chicago, IL",
  "destination": "Denver, CO",
  "departure_datetime": "2026-10-10T08:00:00Z",
  "load_weight_lbs": 42000,
  "interval_miles": 25
}
```

**Response Format:**
```json
{
  "status": "success",
  "origin": { "lat": 41.8781, "lng": -87.6298, "label": "Chicago, IL, USA" },
  "destination": { "lat": 39.7392, "lng": -104.9903, "label": "Denver, CO, USA" },
  "departure": "2026-10-10T08:00:00Z",
  "load_weight_lbs": 42000.0,
  "interval_miles": 25,
  "routes": [
    {
      "index": 0,
      "name": "Interstate Primary",
      "distance_miles": 1005.1,
      "duration_minutes": 1229.4,
      "recommended": true,
      "rank": 1,
      "recommendation_reason": "Best choice: 0 Severe & High miles. Smooth weather (Avg risk: 0.0) in 20.5 hrs.",
      "summary": {
        "avg_risk": 0.0,
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "moderate_miles": 0.0,
        "low_miles": 1005.1,
        "has_no_travel": false
      },
      "checkpoints": [ ... ]
    }
  ],
  "corridor_forecast": [ ... ]
}
```

---

## 🎬 5–10 Min Loom Walkthrough Guide

Use this outline when recording your video submission:

1. **Introduction (1 min):**
   - Introduce yourself and state the problem: Commercial trucks encounter hazardous weather and variable rollover thresholds depending on trailer weight.
   - Show the application layout: Dark logistics command dashboard, parameter sidebar, Leaflet geospatial view.
2. **Parameters & Inputs (1.5 min):**
   - Click one of the quick presets (e.g. *Chicago ➔ Denver*).
   - Point out the **Checkpoint Sampling Interval** selector (`10 mi`, `25 mi`, `50 mi`), explaining the trade-off between spatial granularity and API query density.
   - Enter a heavy load weight ($42,000\text{ lbs}$) and highlight the **Heavy Load** badge warning.
3. **Route Generation & Comparison (2 min):**
   - Click **"Find Safest Truck Route"**.
   - Review the **3 distinct alternative routes** rendered on the map and listed on cards.
   - Show the **Recommendation Badge** on Option 1 and read the algorithmic reason (tie-breaker logic: fewest severe miles $\to$ fewest high miles $\to$ lowest average risk $\to$ shortest travel time).
   - Show the mile distribution tags (Severe, High, Moderate, Low miles).
4. **Checkpoint Weather Inspection (1.5 min):**
   - Click a checkpoint marker on the map to display the popup.
   - Walk through the dynamic **Estimated Arrival Time (ETA)** calculated specifically for that waypoint.
   - Point out the conditions: temperature, wind speed, rain/snow rates, and the load weight escalation impact note.
5. **Corridor Heatmap & 48-Hour Forecast Simulation (2 min):**
   - Show the **48h Forecast Simulation** radar at the bottom of the map.
   - Click **▶ Play** to demonstrate the automated timeline playback as weather fronts move across the corridor over 48 hours.
   - Switch between layer views: **🛡️ Risk Heatmap**, **💨 Wind Speed**, **🌧️ Precipitation**, **🌡️ Temperature**.
6. **Code Architecture & Closing (1 min):**
   - Briefly highlight the backend clean separation (`services/risk.py`, `services/routing.py`, `services/weather.py`) with zero-dependency fallback reliability.
   - Conclude walkthrough.
