import logging
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .serializers import RouteRequestSerializer
from .services.routing import geocode, get_routes, sample_checkpoints
from .services.weather import fetch_weather_at_checkpoints, fetch_corridor_forecast
from .services.risk import calculate_checkpoint_risk, calculate_route_summary, rank_routes

logger = logging.getLogger(__name__)


@api_view(['GET'])
def health_check(request):
    return Response({
        'status': 'online',
        'service': 'Weather-Aware Truck Routing API',
        'version': '1.0.0',
        'endpoints': {
            'calculate_routes': '/api/routes/'
        }
    })


@api_view(['POST'])
def calculate_routes(request):
    """
    Main endpoint:
    Accepts:
      - origin (str)
      - destination (str)
      - departure_datetime (ISO string)
      - load_weight_lbs (float)
      - interval_miles (int, 10 / 25 / 50)

    Returns:
      - 3 alternative routes with full checkpoints, ETA, weather conditions, risk scores
      - strict 4-priority ranking & recommendation
      - 0-48h corridor forecast series for heatmap slider
    """
    serializer = RouteRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    origin = data['origin']
    destination = data['destination']
    departure_dt = data['departure_datetime']
    load_lbs = data['load_weight_lbs']
    interval_miles = data.get('interval_miles', 25)
    weather_scenario = data.get('weather_scenario', 'live')

    try:
        # 1. Geocode origin and destination
        origin_geo = geocode(origin)
        dest_geo = geocode(destination)

        # 2. Get 3 distinct route options
        routes = get_routes(
            [origin_geo['lng'], origin_geo['lat']],
            [dest_geo['lng'], dest_geo['lat']],
            num_routes=3,
        )

        if not routes:
            return Response(
                {'error': 'No viable driving routes found between specified locations.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 3. For each route: sample checkpoints, fetch real-time weather at arrival time, calculate risk
        enriched_routes = []
        for route in routes:
            checkpoints = sample_checkpoints(
                route['coordinates'],
                route['distance_miles'],
                interval_miles=interval_miles,
            )

            # Fetch weather forecast for each checkpoint at its estimated arrival time
            checkpoints = fetch_weather_at_checkpoints(
                checkpoints,
                departure_dt,
                route['duration_minutes'],
                scenario=weather_scenario,
            )

            # Calculate weather risk per checkpoint according to weather thresholds and load weight rules
            for cp in checkpoints:
                cp['risk'] = calculate_checkpoint_risk(cp['weather'], load_lbs)

            # Route summary based on mile-weighted segments
            summary = calculate_route_summary(checkpoints, route['distance_miles'])

            enriched_routes.append({
                'index': route['index'],
                'name': route.get('name', f"Route {route['index'] + 1}"),
                'distance_km': route['distance_km'],
                'distance_miles': route['distance_miles'],
                'duration_minutes': route['duration_minutes'],
                'coordinates': route['coordinates'],
                'checkpoints': checkpoints,
                'summary': summary,
            })

        # 4. Rank routes using strict assessment rules
        ranked_routes = rank_routes(enriched_routes)

        # 5. Fetch full 0-48h weather corridor forecast for interactive heatmap
        recommended_route = ranked_routes[0]
        corridor_checkpoints = sample_checkpoints(
            recommended_route['coordinates'],
            recommended_route['distance_miles'],
            interval_miles=max(25, interval_miles),
        )
        corridor_forecast = fetch_corridor_forecast(
            corridor_checkpoints,
            departure_dt,
            hours=48,
            scenario=weather_scenario,
        )

        return Response({
            'status': 'success',
            'origin': origin_geo,
            'destination': dest_geo,
            'departure': departure_dt.isoformat(),
            'load_weight_lbs': load_lbs,
            'interval_miles': interval_miles,
            'weather_scenario': weather_scenario,
            'routes': ranked_routes,
            'corridor_forecast': corridor_forecast,
        })

    except ValueError as ve:
        logger.warning(f"Validation error in calculate_routes: {ve}")
        return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        logger.exception("Unexpected error during route calculation")
        return Response(
            {'error': f"Failed to compute route safety: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
