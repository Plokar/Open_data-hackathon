from django.urls import path

from . import views

urlpatterns = [
    path('', views.create_battle, name='battle-create'),
    path('queue/', views.queue_battle, name='battle-queue'),
    path('challenges/', views.challenges, name='battle-challenges'),
    path('bosses/', views.boss_list, name='boss-list'),
    path('bosses/<int:place_id>/', views.boss_challenge, name='boss-challenge'),
    path('<uuid:pk>/', views.battle_detail, name='battle-detail'),
    path('<uuid:pk>/join/', views.join_battle, name='battle-join'),
    path('<uuid:pk>/start/', views.start_battle, name='battle-start'),
]
