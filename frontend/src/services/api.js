import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://weather-aware-9axh.onrender.com/api';

export async function calculateRoutes({
  origin,
  destination,
  departureDateTime,
  loadWeightLbs,
  intervalMiles,
  weatherScenario,
}) {
  const response = await axios.post(`${API_BASE}/routes/`, {
    origin,
    destination,
    departure_datetime: departureDateTime,
    load_weight_lbs: loadWeightLbs,
    interval_miles: intervalMiles || 25,
    weather_scenario: weatherScenario || 'live',
  });
  return response.data;
}
