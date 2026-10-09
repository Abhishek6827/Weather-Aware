from rest_framework import serializers


class RouteRequestSerializer(serializers.Serializer):
    origin = serializers.CharField(
        max_length=200,
        help_text='Origin city, address, or landmark'
    )
    destination = serializers.CharField(
        max_length=200,
        help_text='Destination city, address, or landmark'
    )
    departure_datetime = serializers.DateTimeField(
        help_text='Departure date/time in ISO format'
    )
    load_weight_lbs = serializers.FloatField(
        min_value=0,
        max_value=80000,
        help_text='Gross truck load weight in pounds (0 - 80,000 lbs)'
    )
    interval_miles = serializers.ChoiceField(
        choices=[10, 25, 50],
        default=25,
        required=False,
        help_text='Checkpoint sampling interval in miles (10, 25, or 50 miles)'
    )
    weather_scenario = serializers.ChoiceField(
        choices=['live', 'high_wind_38', 'storm_48', 'gale_58', 'blizzard'],
        default='live',
        required=False,
        help_text='Weather mode: live satellite data or specific assessment test scenarios'
    )
