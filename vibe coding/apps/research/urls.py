from django.urls import path
from . import views

app_name = 'research'

urlpatterns = [
    # 默认进入教研模块 => 质量监控
    path('', views.quality_monitoring, name='quality_monitoring'),
    # 兼容旧路径（不占用命名路由）
    path('quality/', views.quality_monitoring),
    # 任务分配
    path('tasks/', views.task_assignment, name='task_assignment'),
    path('tasks/create/', views.create_task_assignment, name='create_task_assignment'),
    path('tasks/history/', views.task_history, name='task_history'),
    path('tasks/history/api/', views.get_task_history_api, name='get_task_history_api'),
    path('tasks/delete/<int:task_id>/', views.delete_task, name='delete_task'),
    path('tasks/detail/<int:task_id>/', views.get_task_detail, name='get_task_detail'),
    path('tasks/use-history/<int:task_id>/', views.use_history_assignment, name='use_history_assignment'),
    path('tasks/export/', views.export_assignment_results, name='export_assignment_results'),
    path('students/search/', views.search_students, name='search_students'),
    path('teachers/stats/', views.get_teacher_stats, name='get_teacher_stats'),
    
    # 质量监控子功能（命名保持不变）
    path('quality/feedback/', views.feedback_monitoring, name='feedback_monitoring'),
    path('quality/students/search/', views.student_search, name='student_search'),
    path('quality/students/<int:student_id>/', views.student_detail, name='student_detail'),
    path('quality/students/<int:student_id>/note/', views.update_student_research_note, name='update_student_research_note'),
]