from django.urls import path

from . import views

urlpatterns = [
    path('checkins/', views.CheckInView.as_view(), name='checkin-create'),
    path('checkins/me/', views.my_checkins, name='checkins-me'),
    path('checkins/<int:pk>/photo/', views.checkin_photo, name='checkin-photo'),
    path('pets/me/', views.my_pets, name='pets-me'),
    path('pets/<int:pk>/', views.pet_detail, name='pet-detail'),
    path('pets/<int:pk>/evolve/', views.pet_evolve, name='pet-evolve'),
    path('badges/', views.badge_list, name='badges'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('quests/', views.quest_list, name='quests'),
    path('teams/', views.teams, name='teams'),
    path('teams/join/', views.team_join, name='team-join'),
    path('teams/leave/', views.team_leave, name='team-leave'),
    path('users/<str:nickname>/', views.public_profile, name='public-profile'),
]
