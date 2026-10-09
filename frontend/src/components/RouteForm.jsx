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
  { label: 'Chicago ➔ Denver', origin: 'Chicago, IL', dest: 'Denver, CO', weight: 42000 },
  { label: 'Dallas ➔ Atlanta', origin: 'Dallas, TX', dest: 'Atlanta, GA', weight: 32000 },
  { label: 'Seattle ➔ Los Angeles', origin: 'Seattle, WA', dest: 'Los Angeles, CA', weight: 48000 },
];

export default function RouteForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState('Chicago, IL');
  const [destination, setDestination] = useState('Denver, CO');
  const [departureDateTime, setDepartureDateTime] = useState(DEFAULT_DEPARTURE);
  const [loadWeightLbs, setLoadWeightLbs] = useState(42000);
  const [intervalMiles, setIntervalMiles] = useState(25);

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
    });
  };

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setDestination(preset.dest);
    setLoadWeightLbs(preset.weight);
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
            {loadWeightLbs > 40000 && (
              <span className="risk-indicator-tag tag-severe" title=">40,000 lbs: Wind 35-44mph escalates to Severe">
                Heavy Load
              </span>
            )}
            {loadWeightLbs > 30000 && loadWeightLbs <= 40000 && (
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
