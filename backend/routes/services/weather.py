"""
Open-Meteo weather API integration.
Free, high-precision hourly forecasts.
Supports batch location queries for maximum performance.
"""
import logging
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'


def _weather_code_to_text(code):
    """Convert WMO weather code to clear condition text and icon."""
    codes = {
        0: ('Clear Sky', '☀️'),
        1: ('Mainly Clear', '🌤️'),
        2: ('Partly Cloudy', '⛅'),
        3: ('Overcast', '☁️'),
        45: ('Foggy', '🌫️'),
        48: ('Freezing Fog', '🌫️'),
        51: ('Light Drizzle', '🌦️'),
        53: ('Moderate Drizzle', '🌧️'),
        55: ('Dense Drizzle', '🌧️'),
        61: ('Slight Rain', '🌧️'),
        63: ('Moderate Rain', '🌧️'),
        65: ('Heavy Rain', '🌧️'),
        66: ('Freezing Rain', '🌨️'),
        67: ('Heavy Freezing Rain', '🌨️'),
        71: ('Slight Snow', '🌨️'),
        73: ('Moderate Snow', '❄️'),
        75: ('Heavy Snowfall', '❄️'),
        77: ('Snow Grains', '❄️'),
        80: ('Slight Rain Showers', '🌦️'),
        81: ('Moderate Rain Showers', '🌧️'),
        82: ('Violent Rain Showers', '⛈️'),
        85: ('Slight Snow Showers', '🌨️'),
        86: ('Heavy Snow Showers', '❄️'),
        95: ('Thunderstorm', '⛈️'),
        96: ('Thunderstorm with Slight Hail', '⛈️'),
        99: ('Thunderstorm with Heavy Hail', '⛈️'),
    }
    desc, icon = codes.get(code, ('Variable Conditions', '🌡️'))
    return f"{icon} {desc}"


def fetch_weather_at_checkpoints(checkpoints, departure_dt, duration_minutes, scenario='live'):
    """
    Fetch weather for each checkpoint at the truck's estimated arrival time.
    Uses chunked batch queries for optimal network performance.
    Applies test scenario modifiers when specified.
    """
    if not checkpoints:
        return []

    # Calculate arrival time for each checkpoint
    for cp in checkpoints:
        minutes_offset = cp['fraction'] * duration_minutes
        arrival_dt = departure_dt + timedelta(minutes=minutes_offset)
        cp['estimated_arrival'] = arrival_dt.isoformat()
        cp['arrival_dt'] = arrival_dt

    # Batch query in chunks of 25 coordinates to stay well within query string limits
    chunk_size = 25
    for i in range(0, len(checkpoints), chunk_size):
        chunk = checkpoints[i:i + chunk_size]
        _enrich_checkpoint_chunk(chunk)

    # Clean up internal datetime object before serialization
    for cp in checkpoints:
        if 'arrival_dt' in cp:
            del cp['arrival_dt']

    # Apply assessment simulation scenario if specified
    if scenario and scenario != 'live':
        _apply_scenario_to_checkpoints(checkpoints, scenario)

    return checkpoints


def _apply_scenario_to_checkpoints(checkpoints, scenario):
    """Apply simulated weather conditions to checkpoints for testing assessment rules."""
    for i, cp in enumerate(checkpoints):
        f = cp.get('fraction', 0.5)
        # Apply storm along the mid-route corridor (fraction 0.20 to 0.85)
        in_storm = 0.20 <= f <= 0.85
        w = cp['weather']

        if scenario == 'high_wind_38':
            if in_storm:
                w['wind_mph'] = round(38.0 + (i % 5) * 1.5, 1)  # 38 to 44 mph
                w['description'] = '💨 High Crosswinds (Advisory)'
        elif scenario == 'storm_48':
            if in_storm:
                w['wind_mph'] = round(48.0 + (i % 4) * 1.5, 1)  # 48 to 52.5 mph
                w['description'] = '🌪️ Severe Windstorm (Warning)'
        elif scenario == 'gale_58':
            if in_storm:
                w['wind_mph'] = round(56.0 + (i % 4) * 2.0, 1)  # 56 to 62 mph
                w['description'] = '⛔ Gale Force Crosswinds'
        elif scenario == 'blizzard':
            if in_storm:
                w['snow_in_hr'] = round(2.5 + (i % 4) * 0.3, 2)  # 2.5 to 3.4 in/hr
                w['temp_f'] = 22.0
                w['description'] = '❄️ Severe Winter Blizzard'


def _enrich_checkpoint_chunk(chunk):
    """Fetch and assign weather for a chunk of checkpoints."""
    lats = [f"{cp['lat']:.4f}" for cp in chunk]
    lngs = [f"{cp['lng']:.4f}" for cp in chunk]

    # Find earliest and latest dates across this chunk
    dates = [cp['arrival_dt'].strftime('%Y-%m-%d') for cp in chunk]
    start_date = min(dates)
    # Give a 2-day buffer for long journeys
    end_date = (max(cp['arrival_dt'] for cp in chunk) + timedelta(days=1)).strftime('%Y-%m-%d')

    params = {
        'latitude': ','.join(lats),
        'longitude': ','.join(lngs),
        'hourly': 'wind_speed_10m,rain,snowfall,temperature_2m,weather_code',
        'wind_speed_unit': 'mph',
        'precipitation_unit': 'inch',
        'temperature_unit': 'fahrenheit',
        'start_date': start_date,
        'end_date': end_date,
        'timezone': 'UTC',
    }

    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=12)
        resp.raise_for_status()
        raw_data = resp.json()
    except Exception as exc:
        logger.warning(f"Batch weather request failed: {exc}, using fallback values")
        for cp in chunk:
            cp['weather'] = {
                'wind_mph': 10.0,
                'rain_in_hr': 0.0,
                'snow_in_hr': 0.0,
                'temp_f': 65.0,
                'description': '☀️ Clear Sky',
            }
        return

    # If single coordinate query, Open-Meteo returns a single object; if multiple, a list
    forecast_list = raw_data if isinstance(raw_data, list) else [raw_data]

    for idx, cp in enumerate(chunk):
        if idx >= len(forecast_list):
            cp['weather'] = {
                'wind_mph': 10.0,
                'rain_in_hr': 0.0,
                'snow_in_hr': 0.0,
                'temp_f': 65.0,
                'description': '☀️ Clear Sky',
            }
            continue

        item = forecast_list[idx]
        hourly = item.get('hourly', {})
        times = hourly.get('time', [])

        # Find closest hourly slot in UTC
        target_utc_str = cp['arrival_dt'].strftime('%Y-%m-%dT%H:00')
        closest_idx = 0
        if times:
            try:
                closest_idx = times.index(target_utc_str)
            except ValueError:
                # Find closest by difference
                closest_idx = 0
                min_diff = float('inf')
                target_epoch = cp['arrival_dt'].timestamp()
                for t_i, t_str in enumerate(times):
                    try:
                        t_epoch = datetime.fromisoformat(t_str).timestamp()
                        diff = abs(t_epoch - target_epoch)
                        if diff < min_diff:
                            min_diff = diff
                            closest_idx = t_i
                    except Exception:
                        pass

        wind = _safe_get(hourly.get('wind_speed_10m'), closest_idx, 0.0)
        rain = _safe_get(hourly.get('rain'), closest_idx, 0.0)
        snow_cm = _safe_get(hourly.get('snowfall'), closest_idx, 0.0)
        temp = _safe_get(hourly.get('temperature_2m'), closest_idx, 60.0)
        code = int(_safe_get(hourly.get('weather_code'), closest_idx, 0))

        # Snowfall is returned in cm, convert to inches/hr
        snow_inches = round(snow_cm / 2.54, 2)

        cp['weather'] = {
            'wind_mph': round(float(wind), 1),
            'rain_in_hr': round(float(rain), 2),
            'snow_in_hr': snow_inches,
            'temp_f': round(float(temp), 1),
            'description': _weather_code_to_text(code),
        }


def fetch_corridor_forecast(checkpoints, departure_dt, hours=48, scenario='live'):
    """
    Fetch full 0-48h forecast series along the trip corridor for the heatmap slider.
    Samples key waypoints evenly along the route corridor.
    """
    if not checkpoints:
        return []

    # Sample ~12 to 15 corridor nodes along the route for a rich, smooth heatmap
    step = max(1, len(checkpoints) // 14)
    sampled = checkpoints[::step]
    if checkpoints[-1] not in sampled:
        sampled.append(checkpoints[-1])

    lats = [f"{cp['lat']:.4f}" for cp in sampled]
    lngs = [f"{cp['lng']:.4f}" for cp in sampled]

    start_date = departure_dt.strftime('%Y-%m-%d')
    end_date = (departure_dt + timedelta(hours=hours + 4)).strftime('%Y-%m-%d')

    params = {
        'latitude': ','.join(lats),
        'longitude': ','.join(lngs),
        'hourly': 'wind_speed_10m,rain,snowfall,temperature_2m,weather_code',
        'wind_speed_unit': 'mph',
        'precipitation_unit': 'inch',
        'temperature_unit': 'fahrenheit',
        'start_date': start_date,
        'end_date': end_date,
        'timezone': 'UTC',
    }

    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=12)
        resp.raise_for_status()
        raw_data = resp.json()
    except Exception as exc:
        logger.warning(f"Corridor forecast failed: {exc}")
        return []

    forecast_list = raw_data if isinstance(raw_data, list) else [raw_data]
    corridor_result = []

    dep_utc_epoch = departure_dt.timestamp()

    for idx, cp in enumerate(sampled):
        if idx >= len(forecast_list):
            continue

        item = forecast_list[idx]
        hourly = item.get('hourly', {})
        times = hourly.get('time', [])
        winds = hourly.get('wind_speed_10m', [])
        rains = hourly.get('rain', [])
        snows = hourly.get('snowfall', [])
        temps = hourly.get('temperature_2m', [])
        codes = hourly.get('weather_code', [])

        hourly_series = []
        for h in range(min(hours + 1, len(times))):
            target_time = departure_dt + timedelta(hours=h)
            target_iso = target_time.strftime('%Y-%m-%dT%H:00')

            t_idx = h
            if target_iso in times:
                t_idx = times.index(target_iso)

            w = _safe_get(winds, t_idx, 0.0)
            r = _safe_get(rains, t_idx, 0.0)
            s_cm = _safe_get(snows, t_idx, 0.0)
            t = _safe_get(temps, t_idx, 60.0)
            c = int(_safe_get(codes, t_idx, 0))

            # Modify values if scenario simulation active
            wind_val = round(float(w), 1)
            rain_val = round(float(r), 2)
            snow_val = round(float(s_cm) / 2.54, 2)
            desc_val = _weather_code_to_text(c)

            if scenario == 'high_wind_38':
                wind_val = max(wind_val, round(38.0 + (h % 5) * 1.2, 1))
                desc_val = '💨 High Crosswinds (Advisory)'
            elif scenario == 'storm_48':
                wind_val = max(wind_val, round(48.0 + (h % 4) * 1.5, 1))
                desc_val = '🌪️ Severe Windstorm (Warning)'
            elif scenario == 'gale_58':
                wind_val = max(wind_val, round(56.0 + (h % 4) * 2.0, 1))
                desc_val = '⛔ Gale Force Crosswinds'
            elif scenario == 'blizzard':
                snow_val = max(snow_val, round(2.5 + (h % 4) * 0.25, 2))
                t = 22.0
                desc_val = '❄️ Severe Winter Blizzard'

            hourly_series.append({
                'hour_offset': h,
                'time': target_iso,
                'wind_mph': wind_val,
                'rain_in_hr': rain_val,
                'snow_in_hr': snow_val,
                'temp_f': round(float(t), 1),
                'description': desc_val,
            })

        corridor_result.append({
            'lat': cp['lat'],
            'lng': cp['lng'],
            'mile_marker': cp.get('mile_marker', 0),
            'hourly': hourly_series,
        })

    return corridor_result


def _safe_get(arr, idx, default):
    if arr and 0 <= idx < len(arr):
        val = arr[idx]
        return val if val is not None else default
    return default
