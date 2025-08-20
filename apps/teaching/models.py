from django.db import models
from django.contrib.postgres.fields import ArrayField
from apps.accounts.models import User
from apps.students.models import Student

class Feedback(models.Model):
    """教师点评反馈模型"""
    # 使用需求文档中的字段名
    reply_time = models.DateTimeField(auto_now_add=True, verbose_name='点评时间')
    user_id = models.CharField(max_length=50, verbose_name='学员ID')  # 对应student.student_id
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name='学员')
    student_name = models.CharField(max_length=100, verbose_name='学员昵称')
    
    # 学习进度
    progress = ArrayField(
        models.FloatField(),
        verbose_name='学习进度'
    )
    
    teacher_name = models.CharField(max_length=50, verbose_name='回复教师姓名')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='教师')
    
    # 点评内容
    teacher_comment = models.TextField(blank=True, verbose_name='教师评语')
    
    # 推送备注
    push_research = models.TextField(blank=True, verbose_name='推送教研备注')
    push_ops = models.TextField(blank=True, verbose_name='推送运营备注')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '教学反馈'
        verbose_name_plural = '教学反馈'
        db_table = 'feedback'
        indexes = [
            models.Index(fields=['student', 'reply_time']),
            models.Index(fields=['teacher', 'reply_time']),
        ]
    
    def __str__(self):
        return f"{self.teacher_name} -> {self.student_name}"
    
    def save(self, *args, **kwargs):
        """保存时自动更新学员进度"""
        super().save(*args, **kwargs)
        # 更新学员的最新进度
        if self.progress:
            current_progress = list(self.student.progress)
            current_progress.extend(self.progress)
            self.student.progress = sorted(list(set(current_progress)))
            self.student.save()