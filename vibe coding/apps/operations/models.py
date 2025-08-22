from django.db import models
from apps.accounts.models import User
from apps.students.models import Student

class OpsTask(models.Model):
    """运营待办事项模型"""
    TASK_SOURCE_CHOICES = [
        ('teacher', '教师端'),
        ('system', '系统规则'),
        ('research', '教务'),
        ('manual', '手动添加'),
    ]
    
    TASK_STATUS_CHOICES = [
        ('pending', '待办'),
        ('contacted', '已联系'),
        ('no_reply', '未回复'),
        ('closed', '已关闭'),
    ]
    
    task_id = models.CharField(max_length=50, unique=True, verbose_name='任务ID')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name='关联学员')
    
    # 冗余字段，方便列表展示
    student_name = models.CharField(max_length=100, verbose_name='学员昵称')
    
    visit_count = models.IntegerField(default=0, verbose_name='回访次数')
    source = models.CharField(max_length=20, choices=TASK_SOURCE_CHOICES, verbose_name='推送来源')
    task_status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default='pending', verbose_name='待办状态')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='任务创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '运营待办事项'
        verbose_name_plural = '运营待办事项'
        db_table = 'ops_tasks'
        indexes = [
            models.Index(fields=['student', 'task_status']),
            models.Index(fields=['source', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.student_name} - {self.get_task_status_display()}"

class VisitRecord(models.Model):
    """回访记录模型"""
    VISIT_STATUS_CHOICES = [
        ('pending', '待办'),
        ('contacted', '已联系'),
        ('no_reply', '未回复'),
        ('closed', '已关闭'),
    ]
    
    record_id = models.CharField(max_length=50, unique=True, verbose_name='记录ID')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name='学员')
    
    # 冗余字段，方便列表展示
    student_name = models.CharField(max_length=100, verbose_name='学员昵称')
    
    visit_time = models.DateTimeField(auto_now_add=True, verbose_name='回访时间')
    visit_status = models.CharField(max_length=20, choices=VISIT_STATUS_CHOICES, verbose_name='回访状态')
    visit_count = models.IntegerField(verbose_name='累计回访次数')
    teacher_name = models.CharField(max_length=50, verbose_name='任课老师')
    visit_note = models.TextField(verbose_name='回访记录文本')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '回访记录'
        verbose_name_plural = '回访记录'
        db_table = 'visit_records'
        indexes = [
            models.Index(fields=['student', 'visit_time']),
            models.Index(fields=['visit_status', 'visit_time']),
        ]
    
    def __str__(self):
        return f"{self.student_name} - {timezone.localtime(self.visit_time).strftime('%Y-%m-%d')}"