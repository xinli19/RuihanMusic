from django.contrib import admin
from .models import OpsTask, VisitRecord

@admin.register(OpsTask)
class OpsTaskAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'source', 'task_status', 'visit_count', 'created_at')
    list_filter = ('source', 'task_status', 'created_at')
    search_fields = ('student_name', 'task_id')
    readonly_fields = ('task_id', 'created_at', 'updated_at')

@admin.register(VisitRecord)
class VisitRecordAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'teacher_name', 'visit_status', 'visit_time')
    list_filter = ('visit_status', 'visit_time')
    search_fields = ('student_name', 'teacher_name')
    readonly_fields = ('record_id', 'created_at', 'updated_at')