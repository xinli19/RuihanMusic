from django.db import models
from apps.accounts.models import User
from apps.students.models import Student

class TeachingTask(models.Model):
    """教学任务分配模型"""
    TASK_STATUS_CHOICES = [
        ('pending', '待处理'),
        ('in_progress', '进行中'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    ]
    
    task_id = models.CharField(max_length=50, unique=True, verbose_name='任务ID')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name='学员')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='分配教师')
    researcher = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='assigned_tasks',
        verbose_name='分配教研'
    )
    
    task_note = models.TextField(blank=True, verbose_name='任务备注')
    status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default='pending', verbose_name='任务状态')
    
    # 时间字段
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name='分配时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '教学任务'
        verbose_name_plural = '教学任务'
        db_table = 'teaching_tasks'
        indexes = [
            models.Index(fields=['teacher', 'status']),
            models.Index(fields=['student', 'assigned_at']),
        ]
    
    def __str__(self):
        return f"{self.teacher.real_name} -> {self.student.student_name}"