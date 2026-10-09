from django.urls import path

from . import views

urlpatterns = [
    path('', views.create_battle, name='battle-create'),
    path('queue/', views.queue_battle, name='battle-queue'),
    path('<uuid:pk>/', views.battle_detail, name='battle-detail'),
    path('<uuid:pk>/join/', views.join_battle, name='battle-join'),
]
