from django.urls import path
from . import views

urlpatterns = [
    path('routes/', views.calculate_routes, name='calculate-routes'),
]
