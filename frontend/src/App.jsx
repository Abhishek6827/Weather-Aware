import { useState } from 'react';
import RouteForm from './components/RouteForm';
import RouteCard from './components/RouteCard';
import MapView from './components/MapView';
import ForecastSlider from './components/ForecastSlider';
import { calculateRoutes } from './services/api';
import './index.css';

export default function App() {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [forecastHour, setForecastHour] = useState(0);
  const [activeLayer, setActiveLayer] = useState('risk');

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await calculateRoutes(formData);
      setRouteData(data);
      // Auto-focus on recommended route
      const recommendedIdx = data.routes.findIndex((r) => r.recommended);
      setActiveRouteIndex(recommendedIdx >= 0 ? recommendedIdx : 0);
      setForecastHour(0);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.data?.errors && JSON.stringify(err.response.data.errors)) ||
        err.message ||
        'Unable to calculate routes. Please check connection and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const routes = routeData?.routes || [];
  const recommendedRoute = routes.find((r) => r.recommended);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__logo">
          <div className="app-header__icon">🚛</div>
          <div>
            <div className="app-header__title">Weather-Aware Truck Routing</div>
            <div className="app-header__subtitle">
              Dynamic Weather Risk Dispatch Engine • OpenRoute & Open-Meteo
            </div>
          </div>
        </div>

        {routeData && (
          <div className="app-header__trip-summary">
            <span className="trip-tag origin-tag">
              🟢 {routeData.origin?.label?.split(',')[0]}
            </span>
            <span className="trip-arrow">➔</span>
            <span className="trip-tag dest-tag">
              🏁 {routeData.destination?.label?.split(',')[0]}
            </span>
            <span className="trip-tag load-tag">
              ⚖️ {routeData.load_weight_lbs?.toLocaleString()} lbs
            </span>
            <span className="trip-tag interval-tag">
              📍 Every {routeData.interval_miles || 25} mi
            </span>
          </div>
        )}
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <div className="sidebar__section">
            <div className="sidebar__section-title">Trip Parameters & Load Rules</div>
            <RouteForm onSubmit={handleSubmit} loading={loading} />
          </div>

          {error && (
            <div className="error-banner">
              <span className="error-banner__icon">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {routes.length > 0 && (
            <div className="sidebar__section" style={{ borderBottom: 'none', flex: 1 }}>
              <div className="sidebar__routes-header">
                <span className="sidebar__section-title">
                  Route Evaluation ({routes.length} Options)
                </span>
                {recommendedRoute && (
                  <span className="recommended-highlight-pill">
                    ★ Best: Option {recommendedRoute.rank}
                  </span>
                )}
              </div>

              <div className="route-cards">
                {routes.map((route, idx) => (
                  <RouteCard
                    key={route.index}
                    route={route}
                    active={idx === activeRouteIndex}
                    onClick={() => setActiveRouteIndex(idx)}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="map-wrapper" style={{ position: 'relative' }}>
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <div className="loading-text">
                Sampling waypoints & calculating weather risk along corridors…
              </div>
            </div>
          )}

          <MapView
            routes={routes}
            activeRouteIndex={activeRouteIndex}
            onSelectRoute={setActiveRouteIndex}
            corridorForecast={routeData?.corridor_forecast}
            forecastHour={forecastHour}
            activeLayer={activeLayer}
          />

          <ForecastSlider
            corridorForecast={routeData?.corridor_forecast}
            forecastHour={forecastHour}
            onHourChange={setForecastHour}
            departureTime={routeData?.departure}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
          />
        </div>
      </main>
    </div>
  );
}
