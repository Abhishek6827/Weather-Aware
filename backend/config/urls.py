from django.urls import path, include
from routes.views import health_check

urlpatterns = [
    path('', health_check, name='root-health'),
    path('health/', health_check, name='health-check'),
    path('api/', include('routes.urls')),
]
