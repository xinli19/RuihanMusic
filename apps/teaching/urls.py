from django.urls import path
from . import views

app_name = 'teaching'

urlpatterns = [
    path('', views.TeachingDashboardView.as_view(), name='dashboard'),
    path('announcements/', views.AnnouncementView.as_view(), name='announcements'),
    path('tasks/', views.FeedbackTaskListView.as_view(), name='task_list'),
    path('feedback/', views.FeedbackListView.as_view(), name='feedback_list'),
    path('feedback/create/', views.FeedbackCreateView.as_view(), name='feedback_create'),
    path('feedback/<int:pk>/', views.FeedbackDetailView.as_view(), name='feedback_detail'),
]