from django.urls import path

from . import views

urlpatterns = [
    path('geojson/', views.places_geojson, name='places-geojson'),
    path('<int:pk>/', views.place_detail, name='place-detail'),
]
