import { useEffect, useState, useMemo } from 'react';

export default function ForecastSlider({
  corridorForecast,
  forecastHour,
  onHourChange,
  departureTime,
  activeLayer,
  onLayerChange,
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  const maxHours = useMemo(() => {
    if (!corridorForecast || corridorForecast.length === 0) return 48;
    const firstPoint = corridorForecast[0];
    return Math.min(48, (firstPoint?.hourly?.length || 49) - 1);
  }, [corridorForecast]);

  // Animation player loop
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onHourChange((prev) => {
          if (prev >= maxHours) {
            return 0; // loop back to start
          }
          return prev + 1;
        });
      }, 700); // 700ms per step
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, maxHours, onHourChange]);

  const timeLabel = useMemo(() => {
    if (!departureTime) return `+${forecastHour}h`;
    const dt = new Date(departureTime);
    dt.setHours(dt.getHours() + forecastHour);
    return dt.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [forecastHour, departureTime]);

  if (!corridorForecast || corridorForecast.length === 0) return null;

  return (
    <div className="forecast-slider-container">
      {/* Top Header: Controls & Time */}
      <div className="forecast-slider__header">
        <div className="forecast-slider__left">
          <span className="forecast-badge">48h FORECAST SIMULATION</span>
          <span className="forecast-time-display">{timeLabel}</span>
          <span className="forecast-offset-pill">T+{forecastHour} hrs</span>
        </div>

        {/* Layer Selector */}
        <div className="forecast-layer-selector">
          <button
            type="button"
            className={`layer-btn ${activeLayer === 'risk' ? 'active' : ''}`}
            onClick={() => onLayerChange('risk')}
          >
            🛡️ Risk Heatmap
          </button>
          <button
            type="button"
            className={`layer-btn ${activeLayer === 'wind' ? 'active' : ''}`}
            onClick={() => onLayerChange('wind')}
          >
            💨 Wind
          </button>
          <button
            type="button"
            className={`layer-btn ${activeLayer === 'precip' ? 'active' : ''}`}
            onClick={() => onLayerChange('precip')}
          >
            🌧️ Rain / Snow
          </button>
          <button
            type="button"
            className={`layer-btn ${activeLayer === 'temp' ? 'active' : ''}`}
            onClick={() => onLayerChange('temp')}
          >
            🌡️ Temp
          </button>
        </div>
      </div>

      {/* Main Track & Playback Buttons */}
      <div className="forecast-slider__track-row">
        <button
          type="button"
          className="play-pause-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <button
          type="button"
          className="step-btn"
          onClick={() => onHourChange(Math.max(0, forecastHour - 1))}
          title="Previous hour"
        >
          -1h
        </button>

        <input
          type="range"
          min={0}
          max={maxHours}
          value={forecastHour}
          onChange={(e) => onHourChange(parseInt(e.target.value, 10))}
          className="forecast-range-input"
          aria-label="0-48h forecast hour slider"
        />

        <button
          type="button"
          className="step-btn"
          onClick={() => onHourChange(Math.min(maxHours, forecastHour + 1))}
          title="Next hour"
        >
          +1h
        </button>
      </div>

      {/* Hours tick marks */}
      <div className="forecast-ticks">
        <span>Departure (0h)</span>
        <span>+12h</span>
        <span>+24h (Day 2)</span>
        <span>+36h</span>
        <span>+48h Horizon</span>
      </div>
    </div>
  );
}
