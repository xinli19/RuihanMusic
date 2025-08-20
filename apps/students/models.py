from django.db import models
from django.contrib.postgres.fields import ArrayField

class Student(models.Model):
    """学员信息模型"""
    GROUP_CHOICES = [
        ('basic', '基础班'),
        ('intermediate', '中级班'),
        ('advanced', '高级班'),
        ('ear_training', '视唱练耳'),
    ]
    
    STATUS_CHOICES = [
        ('joined', '加入'),
        ('active', '活跃'),
        ('graduated', '已毕业'),
        ('archived', '已归档'),
    ]
    
    student_id = models.CharField(max_length=50, unique=True, verbose_name='学员ID')
    external_user_id = models.CharField(max_length=100, unique=True, verbose_name='小鹅通ID')
    student_name = models.CharField(max_length=100, verbose_name='学员昵称')
    alias_name = models.CharField(max_length=100, blank=True, verbose_name='备注名')
    
    # 使用ArrayField存储多选分组
    groups = ArrayField(
        models.CharField(max_length=20, choices=GROUP_CHOICES),
        default=list,
        verbose_name='分组'
    )
    
    # 使用ArrayField存储学习进度
    progress = ArrayField(
        models.FloatField(),
        default=list,
        verbose_name='学习进度'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='joined', verbose_name='学员状态')
    learning_hours = models.FloatField(default=0.0, verbose_name='累计学习时长')
    
    # 备注字段
    research_note = models.TextField(blank=True, verbose_name='教研备注')
    ops_note = models.TextField(blank=True, verbose_name='运营备注')
    
    # 时间字段
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='注册时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '学员'
        verbose_name_plural = '学员'
        db_table = 'students'
        indexes = [
            models.Index(fields=['student_name']),
            models.Index(fields=['external_user_id']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.student_name}({self.student_id})"
    
    @property
    def current_progress(self):
        """获取当前最新进度"""
        return max(self.progress) if self.progress else 0.0