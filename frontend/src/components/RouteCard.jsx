import React from 'react';

function getRiskBadgeStyle(avgRisk, hasNoTravel) {
  if (hasNoTravel) {
    return { background: 'rgba(153, 27, 27, 0.25)', color: '#f87171', border: '1px solid #dc2626' };
  }
  if (avgRisk < 0.8) {
    return { background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid #22c55e' };
  }
  if (avgRisk < 1.8) {
    return { background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid #eab308' };
  }
  if (avgRisk < 2.8) {
    return { background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid #f97316' };
  }
  return { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444' };
}

function getRiskLabel(avgRisk, hasNoTravel) {
  if (hasNoTravel) return '⛔ No Travel';
  if (avgRisk < 0.8) return '🟢 Low Risk';
  if (avgRisk < 1.8) return '🟡 Moderate';
  if (avgRisk < 2.8) return '🟠 High Risk';
  return '🔴 Severe';
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RouteCard({ route, active, onClick }) {
  const { summary, distance_miles, duration_minutes, recommended, rank, name, recommendation_reason } = route;
  const badgeStyle = getRiskBadgeStyle(summary.avg_risk, summary.has_no_travel);

  return (
    <div
      className={`route-card animate-in ${active ? 'route-card--active' : ''} ${recommended ? 'route-card--recommended' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="route-card__header">
        <div className="route-card__title-row">
          <span className="route-card__badge-rank">Option {rank}</span>
          <span className="route-card__name">{name || `Route ${rank}`}</span>
        </div>
        <span className="route-card__risk-badge" style={badgeStyle}>
          {getRiskLabel(summary.avg_risk, summary.has_no_travel)}
        </span>
      </div>

      {/* Recommendation callout */}
      {recommendation_reason && (
        <div className={`route-card__reason ${recommended ? 'reason-recommended' : 'reason-alt'}`}>
          {recommended ? '★ ' : '• '}
          {recommendation_reason}
        </div>
      )}

      {/* Main metrics grid */}
      <div className="route-card__stats">
        <div className="route-card__stat">
          <div className="route-card__stat-value">{Math.round(distance_miles)}</div>
          <div className="route-card__stat-label">Total Miles</div>
        </div>
        <div className="route-card__stat">
          <div className="route-card__stat-value">{formatDuration(duration_minutes)}</div>
          <div className="route-card__stat-label">Drive Time</div>
        </div>
        <div className="route-card__stat">
          <div className="route-card__stat-value">{summary.avg_risk.toFixed(1)}</div>
          <div className="route-card__stat-label">Avg Risk Score</div>
        </div>
      </div>

      {/* Strict Mile Distribution according to PDF ranking rules */}
      <div className="route-card__mile-breakdown">
        <div className="mile-pill severe-pill">
          <span className="mile-val">{summary.severe_miles || 0} mi</span>
          <span className="mile-lbl">Severe</span>
        </div>
        <div className="mile-pill high-pill">
          <span className="mile-val">{summary.high_miles || 0} mi</span>
          <span className="mile-lbl">High</span>
        </div>
        <div className="mile-pill mod-pill">
          <span className="mile-val">{summary.moderate_miles || 0} mi</span>
          <span className="mile-lbl">Moderate</span>
        </div>
        <div className="mile-pill low-pill">
          <span className="mile-val">{summary.low_miles || 0} mi</span>
          <span className="mile-lbl">Low</span>
        </div>
      </div>

      {/* Checkpoint Risk Segment Bar */}
      <div className="route-card__risk-bar-container">
        <div className="risk-bar-label">
          <span>Route Waypoints Weather Risk Timeline</span>
          <span>{route.checkpoints?.length || 0} points</span>
        </div>
        <div className="route-card__risk-bar">
          {route.checkpoints?.map((cp, i) => (
            <div
              key={i}
              className="route-card__risk-segment"
              style={{ background: cp.risk.risk_color }}
              title={`Mile ${cp.mile_marker}: ${cp.risk.risk_label} | Wind: ${cp.weather.wind_mph}mph, Rain: ${cp.weather.rain_in_hr}in/h, Snow: ${cp.weather.snow_in_hr}in/h`}
            />
          ))}
        </div>
      </div>

      {summary.has_no_travel && (
        <div className="route-card__warning-alert">
          ⛔ Contains unsafe No-Travel segments (Wind ≥55mph or Heavy Wind + Load weight trigger)
        </div>
      )}
    </div>
  );
}
