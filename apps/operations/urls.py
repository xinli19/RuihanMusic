from django.urls import path
from . import views

app_name = 'operations'

urlpatterns = [
    # 学员管理
    path('', views.student_list, name='student_list'),
    path('students/api/', views.get_students_list, name='get_students_list'),
    path('students/create/', views.create_student, name='create_student'),
    path('students/<str:student_id>/', views.get_student_detail, name='get_student_detail'),
    path('students/<str:student_id>/update/', views.update_student, name='update_student'),
    path('students/batch-import/', views.batch_import_students, name='batch_import_students'),
    
    # 任务管理
    path('tasks/', views.task_management, name='task_management'),
    path('tasks/api/', views.get_ops_tasks, name='get_ops_tasks'),
    path('tasks/<int:task_id>/update/', views.update_task_status, name='update_task_status'),
    path('tasks/manual/', views.add_manual_task, name='add_manual_task'),
    
    # 回访记录
    path('visits/', views.get_visit_records, name='get_visit_records'),
    path('visits/create/', views.create_visit_record, name='create_visit_record'),
]