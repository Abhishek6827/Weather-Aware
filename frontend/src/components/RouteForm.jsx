import { useState } from 'react';

const DEFAULT_DEPARTURE = () => {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 2);
  // Format for datetime-local input YYYY-MM-DDTHH:mm
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const SAMPLE_PRESETS = [
  { label: 'Chicago ➔ Denver', origin: 'Chicago, IL', dest: 'Denver, CO' },
  { label: 'Dallas ➔ Atlanta', origin: 'Dallas, TX', dest: 'Atlanta, GA' },
  { label: 'Seattle ➔ Los Angeles', origin: 'Seattle, WA', dest: 'Los Angeles, CA' },
];

export default function RouteForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDateTime, setDepartureDateTime] = useState(DEFAULT_DEPARTURE);
  const [loadWeightLbs, setLoadWeightLbs] = useState('');
  const [intervalMiles, setIntervalMiles] = useState(25);
  const [weatherScenario, setWeatherScenario] = useState('live');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim() || !loadWeightLbs) return;

    // Convert local datetime string to ISO string
    const isoDateTime = new Date(departureDateTime).toISOString();

    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      departureDateTime: isoDateTime,
      loadWeightLbs: parseFloat(loadWeightLbs),
      intervalMiles: parseInt(intervalMiles, 10),
      weatherScenario,
    });
  };

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setDestination(preset.dest);
  };

  return (
    <form onSubmit={handleSubmit} className="route-form">
      {/* Quick Demo Corridor Presets */}
      <div className="presets-container">
        <span className="presets-label">Quick Corridors:</span>
        <div className="presets-chips">
          {SAMPLE_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="chip-btn"
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="origin">Origin City / Landmark</label>
        <div className="input-with-icon">
          <span className="input-icon">🟢</span>
          <input
            id="origin"
            type="text"
            placeholder="e.g. Chicago, IL"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="destination">Destination City / Landmark</label>
        <div className="input-with-icon">
          <span className="input-icon">🏁</span>
          <input
            id="destination"
            type="text"
            placeholder="e.g. Denver, CO"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="departure">Departure Time</label>
          <input
            id="departure"
            type="datetime-local"
            value={departureDateTime}
            onChange={(e) => setDepartureDateTime(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="load-weight">
            Load Weight (lbs)
            {Boolean(loadWeightLbs && Number(loadWeightLbs) > 40000) && (
              <span className="risk-indicator-tag tag-severe" title=">40,000 lbs: Wind 35-44mph escalates to Severe">
                Heavy Load
              </span>
            )}
            {Boolean(loadWeightLbs && Number(loadWeightLbs) > 30000 && Number(loadWeightLbs) <= 40000) && (
              <span className="risk-indicator-tag tag-warn" title=">30,000 lbs: Wind 45-54mph triggers No Travel">
                Med Load
              </span>
            )}
          </label>
          <input
            id="load-weight"
            type="number"
            placeholder="e.g. 42000"
            min="1000"
            max="80000"
            step="500"
            value={loadWeightLbs}
            onChange={(e) => setLoadWeightLbs(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Checkpoint Sampling Interval Selector (Requirement: 10 / 25 / 50 miles) */}
      <div className="form-group">
        <label>
          Weather Checkpoint Sampling Interval
          <span className="label-hint">PDF requirement: 10 / 25 / 50 mi</span>
        </label>
        <div className="sampling-selector">
          {[10, 25, 50].map((miles) => (
            <button
              key={miles}
              type="button"
              className={`sampling-btn ${intervalMiles === miles ? 'active' : ''}`}
              onClick={() => setIntervalMiles(miles)}
            >
              Every {miles} miles
            </button>
          ))}
        </div>
      </div>

      {/* Weather Scenario / Assessment Load Rule Tester */}
      <div className="form-group">
        <label htmlFor="weather-scenario">
          Weather Data Mode
          <span className="label-hint">Assessment Rule Testing</span>
        </label>
        <select
          id="weather-scenario"
          className="scenario-select"
          value={weatherScenario}
          onChange={(e) => setWeatherScenario(e.target.value)}
        >
          <option value="live">🌐 Live Satellite Forecast (Open-Meteo API)</option>
          <option value="high_wind_38">💨 Crosswind Advisory (38 mph) — [Test Rule: &gt;40k lb &rarr; Severe]</option>
          <option value="storm_48">🌪️ Severe Windstorm (48 mph) — [Test Rule: &gt;30k lb &rarr; No Travel]</option>
          <option value="gale_58">⛔ Gale Force Storm (58 mph) — [Test Rule: &ge;55 mph &rarr; No Travel]</option>
          <option value="blizzard">❄️ Winter Blizzard (2.5 in/h snow) — [Test Rule: Severe Snow Hazard]</option>
        </select>

        {weatherScenario !== 'live' && (
          <div className="scenario-info-banner">
            {weatherScenario === 'high_wind_38' && (
              <span>⚡ <strong>Testing Rule 3:</strong> 35–44 mph wind. Loads &gt; 40,000 lbs will escalate to <strong>Severe</strong>.</span>
            )}
            {weatherScenario === 'storm_48' && (
              <span>⚡ <strong>Testing Rule 2:</strong> 45–54 mph wind. Loads &gt; 30,000 lbs will trigger <strong>⛔ No Travel</strong>.</span>
            )}
            {weatherScenario === 'gale_58' && (
              <span>⚡ <strong>Testing Rule 1:</strong> &ge; 55 mph gale wind. Triggers <strong>⛔ No Travel</strong> for any load weight.</span>
            )}
            {weatherScenario === 'blizzard' && (
              <span>⚡ <strong>Testing Snow Rule:</strong> 2.0–3.0 in/hr snowfall rate triggers <strong>Severe Winter Hazard</strong>.</span>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        className={`btn-primary ${loading ? 'btn-primary--loading' : ''}`}
        disabled={loading}
      >
        {loading ? (
          <span>Analyzing 3 Routes & Forecasts…</span>
        ) : (
          <span>⚡ Find Safest Truck Route</span>
        )}
      </button>
    </form>
  );
}
