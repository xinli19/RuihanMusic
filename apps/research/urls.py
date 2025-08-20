from django.urls import path
from . import views

app_name = 'research'

urlpatterns = [
    # 教学任务分配
    path('', views.task_assignment, name='task_assignment'),
    path('tasks/create/', views.create_task_assignment, name='create_task_assignment'),
    path('tasks/history/', views.task_history, name='task_history'),
    path('tasks/delete/<int:task_id>/', views.delete_task, name='delete_task'),
    path('students/search/', views.search_students, name='search_students'),
    
    # 教学质量监控
    path('quality/', views.quality_monitoring, name='quality_monitoring'),
    path('quality/feedback/', views.feedback_monitoring, name='feedback_monitoring'),
    path('quality/students/search/', views.student_search, name='student_search'),
    path('quality/students/<int:student_id>/', views.student_detail, name='student_detail'),
    path('quality/students/<int:student_id>/note/', views.update_student_research_note, name='update_student_research_note'),
]