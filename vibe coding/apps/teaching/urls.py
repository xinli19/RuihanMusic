from django.urls import path
from . import views

app_name = 'teaching'

urlpatterns = [
    # 教师点评主页
    path('', views.teacher_dashboard, name='dashboard'),
    
    # 任务管理
    path('tasks/today/', views.get_today_tasks, name='get_today_tasks'),
    path('tasks/add/', views.add_to_today_tasks, name='add_to_today_tasks'),
    path('tasks/delete/', views.batch_delete_tasks, name='batch_delete_tasks'),
    
    # 点评功能
    path('feedback/submit/', views.submit_feedback, name='submit_feedback'),
    path('feedback/manual/', views.manual_feedback, name='manual_feedback'),
    path('feedback/completed/', views.get_completed_feedbacks, name='get_completed_feedbacks'),
    
    # 推送功能
    path('push/research/', views.push_to_research, name='push_to_research'),
    path('push/operation/', views.push_to_operation, name='push_to_operation'),
    
    # 学员相关
    path('students/search/', views.search_students, name='search_students'),
    path('students/<str:student_id>/', views.get_student_detail, name='get_student_detail'),
]