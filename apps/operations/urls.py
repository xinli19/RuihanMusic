from django.urls import path
from . import views

app_name = 'operations'

urlpatterns = [
    path('', views.OperationsDashboardView.as_view(), name='dashboard'),
    path('tasks/', views.OpsTaskListView.as_view(), name='task_list'),
    path('tasks/<int:pk>/', views.OpsTaskDetailView.as_view(), name='task_detail'),
    path('visits/', views.VisitRecordListView.as_view(), name='visit_list'),
    path('visits/create/', views.VisitRecordCreateView.as_view(), name='visit_create'),
]