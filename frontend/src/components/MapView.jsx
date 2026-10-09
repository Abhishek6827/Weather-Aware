import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const ROUTE_COLORS = ['#3b82f6', '#a855f7', '#06b6d4'];
const ROUTE_COLORS_INACTIVE = ['rgba(59,130,246,0.35)', 'rgba(168,85,247,0.35)', 'rgba(6,182,212,0.35)'];

const RISK_COLORS = {
  'Low': '#22c55e',
  'Moderate': '#eab308',
  'High': '#f97316',
  'Severe': '#ef4444',
  'No Travel': '#7f1d1d',
};

function AutoFitBounds({ routes, origin, destination }) {
  const map = useMap();

  useEffect(() => {
    if (!routes || routes.length === 0) return;
    const allCoords = [];
    routes.forEach(r => {
      r.coordinates.forEach(c => allCoords.push([c[1], c[0]]));
    });
    if (allCoords.length > 0) {
      map.fitBounds(allCoords, { padding: [60, 60], maxZoom: 12 });
    }
  }, [routes, map]);

  return null;
}

export default function MapView({
  routes,
  activeRouteIndex,
  onSelectRoute,
  corridorForecast,
  forecastHour,
  activeLayer = 'risk',
}) {
  const activeRoute = routes && routes[activeRouteIndex] ? routes[activeRouteIndex] : null;

  if (!routes || routes.length === 0) {
    return (
      <div className="map-container">
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri, DeLorme, NAVTEQ"
            maxZoom={16}
          />
        </MapContainer>
        <div className="empty-state">
          <div className="empty-state__icon">🚛</div>
          <div className="empty-state__text">Ready for Route Dispatch Analysis</div>
          <div className="empty-state__hint">
            Enter origin, destination, departure time, and truck load weight to evaluate weather risk across 3 alternative routes.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri, DeLorme, NAVTEQ"
          maxZoom={16}
        />

        <AutoFitBounds routes={routes} />

        {/* 1. Weather Heatmap Corridor (0-48h forecast simulation) */}
        {corridorForecast && corridorForecast.map((point, i) => {
          const hourData = getHourData(point.hourly, forecastHour);
          if (!hourData) return null;
          const style = getHeatmapStyle(hourData, activeLayer);

          return (
            <CircleMarker
              key={`heat-${i}-${forecastHour}-${activeLayer}`}
              center={[point.lat, point.lng]}
              radius={style.radius}
              pathOptions={{
                color: style.strokeColor,
                weight: 1,
                fillColor: style.fillColor,
                fillOpacity: style.opacity,
              }}
            >
              <Popup>
                <div className="checkpoint-popup">
                  <div className="checkpoint-popup__title">
                    Corridor Weather Radar (T+{forecastHour}h)
                  </div>
                  <div className="checkpoint-popup__row">
                    <span>Forecast Time</span>
                    <span>{new Date(hourData.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="checkpoint-popup__row">
                    <span>Conditions</span>
                    <span>{hourData.description}</span>
                  </div>
                  <div className="checkpoint-popup__row">
                    <span>Wind Speed</span>
                    <span>{hourData.wind_mph} mph</span>
                  </div>
                  <div className="checkpoint-popup__row">
                    <span>Rain / Snow</span>
                    <span>{hourData.rain_in_hr} in/h | {hourData.snow_in_hr} in/h</span>
                  </div>
                  <div className="checkpoint-popup__row">
                    <span>Temperature</span>
                    <span>{hourData.temp_f}°F</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* 2. Alternative Route Polylines */}
        {routes.map((route, idx) => {
          const isActive = idx === activeRouteIndex;
          const positions = route.coordinates.map(c => [c[1], c[0]]);

          return (
            <Polyline
              key={`route-poly-${idx}`}
              positions={positions}
              eventHandlers={{
                click: () => onSelectRoute(idx),
              }}
              pathOptions={{
                color: isActive ? ROUTE_COLORS[idx % ROUTE_COLORS.length] : ROUTE_COLORS_INACTIVE[idx % ROUTE_COLORS_INACTIVE.length],
                weight: isActive ? 6 : 4,
                opacity: isActive ? 1.0 : 0.45,
                dashArray: isActive ? undefined : '6, 6',
              }}
            />
          );
        })}

        {/* 3. Checkpoints for Active Route */}
        {activeRoute && activeRoute.checkpoints.map((cp, i) => {
          const isSevere = cp.risk.risk_level >= 3;
          const isNoTravel = cp.risk.risk_level === 4;

          return (
            <React.Fragment key={`cp-group-${i}`}>
              {/* Pulsing outer aura for high risk */}
              {isSevere && (
                <CircleMarker
                  center={[cp.lat, cp.lng]}
                  radius={16}
                  pathOptions={{
                    color: cp.risk.risk_color,
                    weight: 1,
                    fillColor: cp.risk.risk_color,
                    fillOpacity: 0.25,
                  }}
                />
              )}

              <CircleMarker
                center={[cp.lat, cp.lng]}
                radius={isNoTravel ? 9 : 7}
                eventHandlers={{
                  click: () => {},
                }}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: cp.risk.risk_color,
                  fillOpacity: 1.0,
                }}
              >
                <Popup>
                  <div className="checkpoint-popup">
                    <div className="checkpoint-popup__title">
                      Checkpoint #{cp.checkpoint_number || i + 1} — Mile {cp.mile_marker}
                    </div>

                    <div className="checkpoint-popup__row">
                      <span>Est. Truck Arrival</span>
                      <span style={{ fontWeight: 700, color: '#3b82f6' }}>
                        {new Date(cp.estimated_arrival).toLocaleString([], {
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="checkpoint-popup__row">
                      <span>Condition</span>
                      <span>{cp.weather.description}</span>
                    </div>

                    <div className="checkpoint-popup__row">
                      <span>Temperature</span>
                      <span>{cp.weather.temp_f}°F</span>
                    </div>

                    <div className="checkpoint-popup__row">
                      <span>Wind Speed</span>
                      <span>
                        {cp.weather.wind_mph} mph ({cp.risk.wind_risk})
                      </span>
                    </div>

                    <div className="checkpoint-popup__row">
                      <span>Rain Rate</span>
                      <span>
                        {cp.weather.rain_in_hr} in/hr ({cp.risk.rain_risk})
                      </span>
                    </div>

                    <div className="checkpoint-popup__row">
                      <span>Snow Rate</span>
                      <span>
                        {cp.weather.snow_in_hr} in/hr ({cp.risk.snow_risk})
                      </span>
                    </div>

                    {cp.risk.load_escalation_note && (
                      <div className="checkpoint-popup__escalation">
                        ⚖️ <strong>Load Impact:</strong> {cp.risk.load_escalation_note}
                      </div>
                    )}

                    <div
                      className="checkpoint-popup__risk"
                      style={{ background: cp.risk.risk_color }}
                    >
                      Overall Risk: {cp.risk.risk_label}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Dynamic Map Legend */}
      <div className="heatmap-legend">
        <div className="heatmap-legend__header">
          <span className="heatmap-legend__title">
            {activeLayer === 'risk' && 'Weather Risk Classification'}
            {activeLayer === 'wind' && 'Wind Speed Thresholds'}
            {activeLayer === 'precip' && 'Precipitation Thresholds'}
            {activeLayer === 'temp' && 'Temperature Range'}
          </span>
          <span className="heatmap-legend__active-tag">{activeLayer.toUpperCase()}</span>
        </div>

        {activeLayer === 'risk' && (
          <div className="heatmap-legend__items">
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#22c55e' }} />
              <span>Low (Wind &lt;25mph, Rain &lt;0.10", Snow &lt;0.5")</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#eab308' }} />
              <span>Moderate (Wind 25-34mph, Rain 0.1-0.25")</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#f97316' }} />
              <span>High (Wind 35-44mph, Rain 0.25-0.5")</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#ef4444' }} />
              <span>Severe (Wind 45-54mph or &gt;40k lb load)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#7f1d1d' }} />
              <span>No Travel (Wind ≥55mph or 45-54mph + &gt;30k lb)</span>
            </div>
          </div>
        )}

        {activeLayer === 'wind' && (
          <div className="heatmap-legend__items">
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#38bdf8' }} />
              <span>Calm (&lt;20 mph)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#eab308' }} />
              <span>Gusty (25-34 mph)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#f97316' }} />
              <span>High Crosswinds (35-44 mph)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#ef4444' }} />
              <span>Severe Crosswinds (45-54 mph)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#7f1d1d' }} />
              <span>Gale Force / Rollover (≥55 mph)</span>
            </div>
          </div>
        )}

        {activeLayer === 'precip' && (
          <div className="heatmap-legend__items">
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#60a5fa' }} />
              <span>Light Rain (&lt;0.10 in/h) / Light Snow (&lt;0.5")</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#3b82f6' }} />
              <span>Moderate Rain (0.10-0.25 in/h) / Snow (0.5-1.0")</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#f97316' }} />
              <span>Heavy Rain (0.25-0.50 in/h) / Snow (1.0-2.0")</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#ef4444' }} />
              <span>Severe Blizzard (&gt;2.0 in/h snow) / Downpour</span>
            </div>
          </div>
        )}

        {activeLayer === 'temp' && (
          <div className="heatmap-legend__items">
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#3b82f6' }} />
              <span>Freezing (&le; 32°F)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#22c55e' }} />
              <span>Cool / Mild (33°F - 65°F)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#f97316' }} />
              <span>Warm (66°F - 85°F)</span>
            </div>
            <div className="heatmap-legend__item">
              <div className="heatmap-legend__color" style={{ background: '#ef4444' }} />
              <span>Extreme Heat (&gt; 85°F)</span>
            </div>
          </div>
        )}

        {/* Route selector buttons on map */}
        <div className="map-route-switcher">
          {routes.map((r, i) => (
            <button
              key={i}
              type="button"
              className={`route-pill-btn ${i === activeRouteIndex ? 'active' : ''}`}
              onClick={() => onSelectRoute(i)}
            >
              <span className="pill-dot" style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
              Option {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getHourData(hourly, forecastHour) {
  if (!hourly || hourly.length === 0) return null;
  const idx = Math.min(forecastHour, hourly.length - 1);
  return hourly[idx];
}

function getHeatmapStyle(data, layer) {
  const wind = data.wind_mph || 0;
  const rain = data.rain_in_hr || 0;
  const snow = data.snow_in_hr || 0;
  const temp = data.temp_f || 60;

  if (layer === 'wind') {
    if (wind >= 55) return { fillColor: '#7f1d1d', strokeColor: '#ef4444', opacity: 0.55, radius: 26 };
    if (wind >= 45) return { fillColor: '#ef4444', strokeColor: '#f87171', opacity: 0.5, radius: 24 };
    if (wind >= 35) return { fillColor: '#f97316', strokeColor: '#fb923c', opacity: 0.45, radius: 22 };
    if (wind >= 25) return { fillColor: '#eab308', strokeColor: '#facc15', opacity: 0.35, radius: 20 };
    return { fillColor: '#38bdf8', strokeColor: '#0284c7', opacity: 0.25, radius: 18 };
  }

  if (layer === 'precip') {
    const maxP = Math.max(rain, snow);
    if (maxP > 2.0) return { fillColor: '#ef4444', strokeColor: '#f87171', opacity: 0.55, radius: 26 };
    if (maxP > 1.0) return { fillColor: '#f97316', strokeColor: '#fb923c', opacity: 0.5, radius: 24 };
    if (maxP > 0.25) return { fillColor: '#3b82f6', strokeColor: '#60a5fa', opacity: 0.4, radius: 22 };
    if (maxP > 0.05) return { fillColor: '#60a5fa', strokeColor: '#93c5fd', opacity: 0.3, radius: 20 };
    return { fillColor: '#22c55e', strokeColor: '#4ade80', opacity: 0.2, radius: 18 };
  }

  if (layer === 'temp') {
    if (temp <= 32) return { fillColor: '#3b82f6', strokeColor: '#60a5fa', opacity: 0.45, radius: 24 };
    if (temp <= 65) return { fillColor: '#22c55e', strokeColor: '#4ade80', opacity: 0.35, radius: 20 };
    if (temp <= 85) return { fillColor: '#f97316', strokeColor: '#fb923c', opacity: 0.4, radius: 22 };
    return { fillColor: '#ef4444', strokeColor: '#f87171', opacity: 0.5, radius: 24 };
  }

  // Default: Risk Layer
  let riskLevel = 0;
  if (wind >= 55 || rain > 1.0 || snow > 3.0) riskLevel = 4;
  else if (wind >= 45 || rain > 0.5 || snow > 2.0) riskLevel = 3;
  else if (wind >= 35 || rain > 0.25 || snow > 1.0) riskLevel = 2;
  else if (wind >= 25 || rain >= 0.1 || snow >= 0.5) riskLevel = 1;

  const colors = [
    { fill: '#22c55e', stroke: '#4ade80', opacity: 0.25, r: 18 },
    { fill: '#eab308', stroke: '#facc15', opacity: 0.35, r: 20 },
    { fill: '#f97316', stroke: '#fb923c', opacity: 0.45, r: 22 },
    { fill: '#ef4444', stroke: '#f87171', opacity: 0.55, r: 25 },
    { fill: '#7f1d1d', stroke: '#dc2626', opacity: 0.65, r: 28 },
  ];

  const cfg = colors[riskLevel];
  return {
    fillColor: cfg.fill,
    strokeColor: cfg.stroke,
    opacity: cfg.opacity,
    radius: cfg.r,
  };
}
