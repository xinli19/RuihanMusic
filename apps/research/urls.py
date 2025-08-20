from django.urls import path
from . import views

app_name = 'research'

urlpatterns = [
    path('', views.ResearchDashboardView.as_view(), name='dashboard'),
    path('tasks/', views.TeachingTaskListView.as_view(), name='task_list'),
    path('tasks/assign/', views.TaskAssignView.as_view(), name='task_assign'),
    path('tasks/<int:pk>/', views.TeachingTaskDetailView.as_view(), name='task_detail'),
    path('quality/', views.QualityMonitorView.as_view(), name='quality_monitor'),
]