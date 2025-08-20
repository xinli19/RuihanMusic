from django.contrib import admin
from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'student_id', 'status', 'learning_hours', 'created_at')
    list_filter = ('status', 'groups', 'created_at')
    search_fields = ('student_name', 'student_id', 'external_user_id', 'alias_name')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('基本信息', {
            'fields': ('student_id', 'external_user_id', 'student_name', 'alias_name')
        }),
        ('学习信息', {
            'fields': ('groups', 'progress', 'status', 'learning_hours')
        }),
        ('备注信息', {
            'fields': ('research_note', 'ops_note')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at')
        }),
    )