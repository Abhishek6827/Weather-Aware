"""
Risk calculation engine for weather-aware truck routing.

Risk levels:
0 = Low
1 = Moderate
2 = High
3 = Severe
4 = No Travel
"""

RISK_LOW = 0
RISK_MODERATE = 1
RISK_HIGH = 2
RISK_SEVERE = 3
RISK_NO_TRAVEL = 4

RISK_LABELS = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']
RISK_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#7f1d1d']


def classify_wind(wind_mph):
    """
    Classify wind speed risk according to assessment guidelines:
    - Low: <25 mph
    - Moderate: 25-34 mph
    - High: 35-44 mph
    - Severe: 45-54 mph
    - No Travel: >=55 mph
    """
    if wind_mph < 25:
        return RISK_LOW
    if wind_mph < 35:
        return RISK_MODERATE
    if wind_mph < 45:
        return RISK_HIGH
    if wind_mph < 55:
        return RISK_SEVERE
    return RISK_NO_TRAVEL


def classify_rain(rain_in_per_hr):
    """
    Classify rain intensity risk according to assessment guidelines:
    - Low: <0.10 in/hr
    - Moderate: 0.10-0.25 in/hr
    - High: 0.25-0.50 in/hr
    - Severe: 0.50-1.00 in/hr
    - No Travel: >1.00 in/hr
    """
    if rain_in_per_hr < 0.10:
        return RISK_LOW
    if rain_in_per_hr <= 0.25:
        return RISK_MODERATE
    if rain_in_per_hr <= 0.50:
        return RISK_HIGH
    if rain_in_per_hr <= 1.00:
        return RISK_SEVERE
    return RISK_NO_TRAVEL


def classify_snow(snow_in_per_hr):
    """
    Classify snowfall intensity risk according to assessment guidelines:
    - Low: <0.5 in/hr
    - Moderate: 0.5-1.0 in/hr
    - High: 1.0-2.0 in/hr
    - Severe: 2.0-3.0 in/hr
    - No Travel: >3.0 in/hr
    """
    if snow_in_per_hr < 0.5:
        return RISK_LOW
    if snow_in_per_hr <= 1.0:
        return RISK_MODERATE
    if snow_in_per_hr <= 2.0:
        return RISK_HIGH
    if snow_in_per_hr <= 3.0:
        return RISK_SEVERE
    return RISK_NO_TRAVEL


def apply_load_rules(wind_mph, load_lbs, base_risk):
    """
    Apply load-specific wind rules that can escalate risk:
    - >=55 mph -> No Travel for any load
    - 45-54 mph + >30,000 lb -> No Travel
    - 35-44 mph + >40,000 lb -> Severe (or higher if already higher)

    Returns:
        (final_risk, escalation_note or None)
    """
    note = None
    final_risk = base_risk

    if wind_mph >= 55:
        final_risk = RISK_NO_TRAVEL
        note = f"Wind speed {wind_mph} mph reaches or exceeds 55 mph threshold: No Travel for any load weight."
    elif 45 <= wind_mph < 55 and load_lbs > 30000:
        final_risk = RISK_NO_TRAVEL
        note = f"High wind ({wind_mph} mph) combined with heavy load ({load_lbs:,.0f} lbs > 30,000 lbs) triggers No Travel rule."
    elif 35 <= wind_mph < 45 and load_lbs > 40000:
        if base_risk < RISK_SEVERE:
            final_risk = RISK_SEVERE
            note = f"Wind ({wind_mph} mph) with extreme load ({load_lbs:,.0f} lbs > 40,000 lbs) escalates checkpoint risk to Severe."

    return final_risk, note


def calculate_checkpoint_risk(weather, load_lbs):
    """
    Calculate comprehensive risk for a single checkpoint given weather conditions and load.
    """
    wind_mph = weather.get('wind_mph', 0)
    rain_rate = weather.get('rain_in_hr', 0)
    snow_rate = weather.get('snow_in_hr', 0)

    wind_risk = classify_wind(wind_mph)
    rain_risk = classify_rain(rain_rate)
    snow_risk = classify_snow(snow_rate)

    # Base risk is the maximum among individual weather risks
    base_risk = max(wind_risk, rain_risk, snow_risk)

    # Apply load escalation rules
    final_risk, load_escalation_note = apply_load_rules(wind_mph, load_lbs, base_risk)

    # Identify primary driving factor
    primary_factor = 'Clear conditions'
    factors = []
    if wind_risk > RISK_LOW:
        factors.append(f"Wind ({wind_mph} mph - {RISK_LABELS[wind_risk]})")
    if rain_risk > RISK_LOW:
        factors.append(f"Rain ({rain_rate} in/hr - {RISK_LABELS[rain_risk]})")
    if snow_risk > RISK_LOW:
        factors.append(f"Snow ({snow_rate} in/hr - {RISK_LABELS[snow_risk]})")
    if factors:
        primary_factor = ", ".join(factors)

    return {
        'risk_level': final_risk,
        'risk_label': RISK_LABELS[final_risk],
        'risk_color': RISK_COLORS[final_risk],
        'base_risk_level': base_risk,
        'base_risk_label': RISK_LABELS[base_risk],
        'wind_risk': RISK_LABELS[wind_risk],
        'rain_risk': RISK_LABELS[rain_risk],
        'snow_risk': RISK_LABELS[snow_risk],
        'load_escalation_note': load_escalation_note,
        'primary_factor': primary_factor,
    }


def calculate_route_summary(checkpoints, total_distance_miles):
    """
    Summarize risk across all checkpoints for a route.
    Calculates exact miles for each risk tier based on checkpoint distribution.
    """
    if not checkpoints:
        return {
            'avg_risk': 0.0,
            'risk_counts': {},
            'has_no_travel': False,
            'severe_miles': 0.0,
            'high_miles': 0.0,
            'moderate_miles': 0.0,
            'low_miles': 0.0,
            'no_travel_miles': 0.0,
        }

    total_cp = len(checkpoints)
    # Distance represented by each checkpoint segment
    miles_per_cp = total_distance_miles / max(1, total_cp)

    risk_counts = {label: 0 for label in RISK_LABELS}
    total_risk_score = 0

    severe_count = 0
    high_count = 0
    moderate_count = 0
    low_count = 0
    no_travel_count = 0

    for cp in checkpoints:
        level = cp['risk']['risk_level']
        label = RISK_LABELS[level]
        risk_counts[label] += 1
        total_risk_score += level

        if level == RISK_NO_TRAVEL:
            no_travel_count += 1
        elif level == RISK_SEVERE:
            severe_count += 1
        elif level == RISK_HIGH:
            high_count += 1
        elif level == RISK_MODERATE:
            moderate_count += 1
        elif level == RISK_LOW:
            low_count += 1

    avg_risk = total_risk_score / total_cp

    return {
        'avg_risk': round(avg_risk, 2),
        'risk_counts': risk_counts,
        'has_no_travel': no_travel_count > 0,
        'severe_count': severe_count,
        'high_count': high_count,
        'moderate_count': moderate_count,
        'low_count': low_count,
        'no_travel_count': no_travel_count,
        'severe_miles': round(severe_count * miles_per_cp, 1),
        'high_miles': round(high_count * miles_per_cp, 1),
        'moderate_miles': round(moderate_count * miles_per_cp, 1),
        'low_miles': round(low_count * miles_per_cp, 1),
        'no_travel_miles': round(no_travel_count * miles_per_cp, 1),
    }


def rank_routes(routes):
    """
    Rank routes according to the 4 strict assessment priorities:
    1. Fewest Severe miles
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel times

    Also ensures routes with No-Travel conditions are flagged and ranked lower than viable routes.
    """
    def sort_key(route):
        s = route['summary']
        # Viability: routes with zero No-Travel miles come first
        no_travel_flag = 1 if s.get('has_no_travel', False) else 0
        return (
            no_travel_flag,
            s.get('severe_miles', 0.0),
            s.get('high_miles', 0.0),
            s.get('avg_risk', 0.0),
            route.get('duration_minutes', 0.0),
        )

    sorted_routes = sorted(routes, key=sort_key)

    for i, route in enumerate(sorted_routes):
        route['rank'] = i + 1
        route['recommended'] = (i == 0)

        # Build clear reasoning explanation
        s = route['summary']
        if i == 0:
            if s.get('has_no_travel'):
                route['recommendation_reason'] = "Caution: All available routes have No Travel warnings. This route has the lowest relative exposure."
            elif s.get('severe_miles', 0) == 0 and s.get('high_miles', 0) == 0:
                route['recommendation_reason'] = f"Best choice: 0 Severe & High miles. Smooth weather (Avg risk: {s['avg_risk']:.1f}) in {route['duration_minutes'] / 60:.1f} hrs."
            else:
                route['recommendation_reason'] = f"Recommended: Minimizes severe exposure ({s['severe_miles']} mi Severe, {s['high_miles']} mi High) with optimal travel time."
        else:
            diff_reasons = []
            rec_s = sorted_routes[0]['summary']
            if s.get('has_no_travel') and not rec_s.get('has_no_travel'):
                diff_reasons.append("Contains unsafe No-Travel conditions")
            if s.get('severe_miles', 0) > rec_s.get('severe_miles', 0):
                diff_reasons.append(f"+{s['severe_miles'] - rec_s['severe_miles']:.1f} mi Severe weather")
            if s.get('high_miles', 0) > rec_s.get('high_miles', 0):
                diff_reasons.append(f"+{s['high_miles'] - rec_s['high_miles']:.1f} mi High risk weather")
            if s.get('moderate_miles', 0) > rec_s.get('moderate_miles', 0) and s.get('severe_miles', 0) == 0 and s.get('high_miles', 0) == 0:
                diff_reasons.append(f"+{s['moderate_miles'] - rec_s['moderate_miles']:.1f} mi Moderate weather exposure")
            
            # Compare average risk if there is a noticeable gap
            avg_diff = s.get('avg_risk', 0) - rec_s.get('avg_risk', 0)
            if avg_diff >= 0.15:
                diff_reasons.append(f"Higher avg risk ({s['avg_risk']:.1f} vs {rec_s['avg_risk']:.1f})")

            # Duration comparison
            if route.get('duration_minutes', 0) > sorted_routes[0].get('duration_minutes', 0):
                diff_mins = route['duration_minutes'] - sorted_routes[0]['duration_minutes']
                if diff_mins >= 30:
                    diff_hours = diff_mins / 60.0
                    diff_reasons.append(f"+{diff_hours:.1f} hrs longer transit")

            # Distance comparison if duration is close
            if not diff_reasons and route.get('distance_miles', 0) > sorted_routes[0].get('distance_miles', 0):
                diff_dist = route['distance_miles'] - sorted_routes[0]['distance_miles']
                diff_reasons.append(f"+{diff_dist:.0f} mi longer route")

            route['recommendation_reason'] = "Alternative route: " + (", ".join(diff_reasons) if diff_reasons else "Alternative corridor")

    return sorted_routes
