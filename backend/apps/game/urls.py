from django.urls import path

from . import panel, views

urlpatterns = [
    path('checkins/', views.CheckInView.as_view(), name='checkin-create'),
    path('checkins/me/', views.my_checkins, name='checkins-me'),
    path('checkins/<int:pk>/photo/', views.checkin_photo, name='checkin-photo'),
    path('pets/me/', views.my_pets, name='pets-me'),
    path('pets/dex/', views.pet_dex, name='pet-dex'),
    path('pets/<int:pk>/', views.pet_detail, name='pet-detail'),
    path('pets/<int:pk>/evolve/', views.pet_evolve, name='pet-evolve'),
    path('pets/merge/', views.pet_merge, name='pet-merge'),
    path('pets/merge/preview/', views.merge_preview, name='pet-merge-preview'),
    path('badges/', views.badge_list, name='badges'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('quests/', views.quest_list, name='quests'),
    path('trails/', views.trail_list, name='trails'),
    path('food-pass/', views.food_pass, name='food-pass'),
    path('teams/', views.teams, name='teams'),
    path('teams/join/', views.team_join, name='team-join'),
    path('teams/leave/', views.team_leave, name='team-leave'),
    path('users/<str:nickname>/', views.public_profile, name='public-profile'),
    path('friends/', views.friends, name='friends'),
    path('friends/<int:pk>/accept/', views.friend_accept, name='friend-accept'),
    path('friends/<int:pk>/', views.friend_remove, name='friend-remove'),
    path('panel/login/', panel.login, name='panel-login'),
    path('panel/stats/', panel.stats, name='panel-stats'),
    path('panel/users/', panel.users, name='panel-users'),
    path('panel/users/<int:pk>/', panel.user_detail, name='panel-user'),
    path('panel/users/<int:pk>/badges/', panel.user_badge, name='panel-user-badge'),
    path('panel/pets/<int:pk>/', panel.pet_detail, name='panel-pet'),
    path('panel/actions/', panel.action, name='panel-action'),
]
