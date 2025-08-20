from django.contrib import admin
from .models import Feedback

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'teacher_name', 'reply_time')
    list_filter = ('reply_time', 'teacher')
    search_fields = ('student_name', 'teacher_name')
    readonly_fields = ('reply_time', 'created_at', 'updated_at')
    
    fieldsets = (
        ('基本信息', {
            'fields': ('user_id', 'student', 'student_name', 'teacher', 'teacher_name')
        }),
        ('学习进度', {
            'fields': ('progress',)
        }),
        ('点评内容', {
            'fields': ('teacher_comment',)
        }),
        ('推送备注', {
            'fields': ('push_research', 'push_ops')
        }),
        ('时间信息', {
            'fields': ('reply_time', 'created_at', 'updated_at')
        }),
    )