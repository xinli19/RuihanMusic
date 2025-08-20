from django.contrib import admin
from .models import TeachingTask

@admin.register(TeachingTask)
class TeachingTaskAdmin(admin.ModelAdmin):
    list_display = ('task_id', 'student', 'teacher', 'researcher', 'status', 'assigned_at')
    list_filter = ('status', 'assigned_at')
    search_fields = ('task_id', 'student__student_name', 'teacher__real_name')
    readonly_fields = ('task_id', 'assigned_at', 'created_at', 'updated_at')