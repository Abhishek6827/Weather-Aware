"""
Unit and integration tests for Weather-Aware Truck Routing.
Verifies all assessment risk thresholds, rollover load rules, and ranking logic.
"""
from django.test import TestCase
from routes.services.risk import (
    RISK_LOW, RISK_MODERATE, RISK_HIGH, RISK_SEVERE, RISK_NO_TRAVEL,
    classify_wind, classify_rain, classify_snow,
    apply_load_rules, calculate_checkpoint_risk,
    calculate_route_summary, rank_routes
)


class RiskMatrixTests(TestCase):
    """Test every condition and threshold from the PDF risk table."""

    def test_wind_thresholds(self):
        # Wind: Low <25, Moderate 25-34, High 35-44, Severe 45-54, No Travel >=55
        self.assertEqual(classify_wind(15), RISK_LOW)
        self.assertEqual(classify_wind(24.9), RISK_LOW)
        self.assertEqual(classify_wind(25), RISK_MODERATE)
        self.assertEqual(classify_wind(34), RISK_MODERATE)
        self.assertEqual(classify_wind(35), RISK_HIGH)
        self.assertEqual(classify_wind(44), RISK_HIGH)
        self.assertEqual(classify_wind(45), RISK_SEVERE)
        self.assertEqual(classify_wind(54), RISK_SEVERE)
        self.assertEqual(classify_wind(55), RISK_NO_TRAVEL)
        self.assertEqual(classify_wind(70), RISK_NO_TRAVEL)

    def test_rain_thresholds(self):
        # Rain: Low <0.10, Moderate 0.10-0.25, High 0.25-0.50, Severe 0.50-1.00, No Travel >1.00
        self.assertEqual(classify_rain(0.05), RISK_LOW)
        self.assertEqual(classify_rain(0.10), RISK_MODERATE)
        self.assertEqual(classify_rain(0.25), RISK_MODERATE)
        self.assertEqual(classify_rain(0.30), RISK_HIGH)
        self.assertEqual(classify_rain(0.50), RISK_HIGH)
        self.assertEqual(classify_rain(0.75), RISK_SEVERE)
        self.assertEqual(classify_rain(1.00), RISK_SEVERE)
        self.assertEqual(classify_rain(1.20), RISK_NO_TRAVEL)

    def test_snow_thresholds(self):
        # Snow: Low <0.5, Moderate 0.5-1.0, High 1.0-2.0, Severe 2.0-3.0, No Travel >3.0
        self.assertEqual(classify_snow(0.2), RISK_LOW)
        self.assertEqual(classify_snow(0.5), RISK_MODERATE)
        self.assertEqual(classify_snow(1.0), RISK_MODERATE)
        self.assertEqual(classify_snow(1.5), RISK_HIGH)
        self.assertEqual(classify_snow(2.0), RISK_HIGH)
        self.assertEqual(classify_snow(2.5), RISK_SEVERE)
        self.assertEqual(classify_snow(3.0), RISK_SEVERE)
        self.assertEqual(classify_snow(3.5), RISK_NO_TRAVEL)


class LoadRulesTests(TestCase):
    """Test dynamic load weight escalation rules from PDF Page 2."""

    def test_severe_wind_any_load(self):
        # >=55 mph -> No Travel for any load
        risk, note = apply_load_rules(55, load_lbs=15000, base_risk=RISK_SEVERE)
        self.assertEqual(risk, RISK_NO_TRAVEL)
        self.assertIn("55 mph", note)

        risk, note = apply_load_rules(65, load_lbs=50000, base_risk=RISK_SEVERE)
        self.assertEqual(risk, RISK_NO_TRAVEL)

    def test_gale_wind_load_escalation(self):
        # 45-54 mph + >30,000 lb -> No Travel
        # Under 30,000 lbs -> remains Severe (base risk)
        risk, note = apply_load_rules(48, load_lbs=25000, base_risk=RISK_SEVERE)
        self.assertEqual(risk, RISK_SEVERE)
        self.assertIsNone(note)

        # Over 30,000 lbs -> escalates to No Travel
        risk, note = apply_load_rules(48, load_lbs=35000, base_risk=RISK_SEVERE)
        self.assertEqual(risk, RISK_NO_TRAVEL)
        self.assertIn("30,000 lbs", note)

    def test_high_wind_heavy_load_escalation(self):
        # 35-44 mph + >40,000 lb -> Severe
        # Under 40,000 lbs -> remains High
        risk, note = apply_load_rules(38, load_lbs=35000, base_risk=RISK_HIGH)
        self.assertEqual(risk, RISK_HIGH)
        self.assertIsNone(note)

        # Over 40,000 lbs -> escalates to Severe
        risk, note = apply_load_rules(38, load_lbs=45000, base_risk=RISK_HIGH)
        self.assertEqual(risk, RISK_SEVERE)
        self.assertIn("40,000 lbs", note)


class RouteRecommendationRankingTests(TestCase):
    """Test strict 4-priority ranking order."""

    def test_ranking_prefers_fewest_severe_miles(self):
        # Route A: 50 Severe miles, 600 mins
        # Route B: 10 Severe miles, 700 mins (slower but safer)
        route_a = {
            'index': 0, 'duration_minutes': 600,
            'summary': {'has_no_travel': False, 'severe_miles': 50.0, 'high_miles': 20.0, 'avg_risk': 2.1}
        }
        route_b = {
            'index': 1, 'duration_minutes': 700,
            'summary': {'has_no_travel': False, 'severe_miles': 10.0, 'high_miles': 40.0, 'avg_risk': 1.8}
        }

        ranked = rank_routes([route_a, route_b])
        # Route B must be recommended because it has fewer Severe miles
        self.assertEqual(ranked[0]['index'], 1)
        self.assertTrue(ranked[0]['recommended'])

    def test_ranking_prefers_fewest_high_miles_when_severe_tied(self):
        # Route A: 0 Severe, 80 High miles
        # Route B: 0 Severe, 20 High miles
        route_a = {
            'index': 0, 'duration_minutes': 500,
            'summary': {'has_no_travel': False, 'severe_miles': 0.0, 'high_miles': 80.0, 'avg_risk': 1.6}
        }
        route_b = {
            'index': 1, 'duration_minutes': 550,
            'summary': {'has_no_travel': False, 'severe_miles': 0.0, 'high_miles': 20.0, 'avg_risk': 1.4}
        }

        ranked = rank_routes([route_a, route_b])
        self.assertEqual(ranked[0]['index'], 1)

    def test_ranking_prefers_lowest_avg_risk_when_severe_and_high_tied(self):
        # Route A: 0 Severe, 0 High, avg_risk 1.4
        # Route B: 0 Severe, 0 High, avg_risk 0.6
        route_a = {
            'index': 0, 'duration_minutes': 400,
            'summary': {'has_no_travel': False, 'severe_miles': 0.0, 'high_miles': 0.0, 'avg_risk': 1.4}
        }
        route_b = {
            'index': 1, 'duration_minutes': 420,
            'summary': {'has_no_travel': False, 'severe_miles': 0.0, 'high_miles': 0.0, 'avg_risk': 0.6}
        }

        ranked = rank_routes([route_a, route_b])
        self.assertEqual(ranked[0]['index'], 1)

    def test_ranking_prefers_shortest_time_when_all_weather_tied(self):
        # Route A: 480 mins
        # Route B: 520 mins
        route_a = {
            'index': 0, 'duration_minutes': 480,
            'summary': {'has_no_travel': False, 'severe_miles': 0.0, 'high_miles': 0.0, 'avg_risk': 0.5}
        }
        route_b = {
            'index': 1, 'duration_minutes': 520,
            'summary': {'has_no_travel': False, 'severe_miles': 0.0, 'high_miles': 0.0, 'avg_risk': 0.5}
        }

        ranked = rank_routes([route_b, route_a])
        self.assertEqual(ranked[0]['index'], 0)
