from django.db import models
from apps.accounts.models import User
from apps.students.models import Student
import json

class Feedback(models.Model):
    """教师点评反馈模型"""
    # 使用需求文档中的字段名
    reply_time = models.DateTimeField(auto_now_add=True, verbose_name='点评时间')
    user_id = models.CharField(max_length=50, verbose_name='学员ID')  # 对应student.student_id
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name='学员')
    student_name = models.CharField(max_length=100, verbose_name='学员昵称')
    
    # 学习进度 - 使用TextField存储JSON
    progress_json = models.TextField(default='[]', verbose_name='学习进度JSON')
    
    teacher_name = models.CharField(max_length=50, verbose_name='回复教师姓名')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='教师')
    
    # 点评内容
    teacher_comment = models.TextField(blank=True, verbose_name='教师评语')
    
    # 推送备注
    push_research = models.TextField(blank=True, verbose_name='推送教研备注')
    push_ops = models.TextField(blank=True, verbose_name='推送运营备注')
    
    # 新增字段以支持前端需求
    course_name = models.CharField(max_length=100, blank=True, verbose_name='课程名称')
    course_progress = models.IntegerField(default=0, verbose_name='课程进度')
    is_featured = models.BooleanField(default=False, verbose_name='是否精选')
    
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
        return f"{self.student_name} - {self.teacher_name} - {timezone.localtime(self.reply_time).strftime('%Y-%m-%d')}"
    
    @property
    def progress(self):
        """获取学习进度列表"""
        try:
            return json.loads(self.progress_json)
        except (json.JSONDecodeError, TypeError):
            return []
    
    @progress.setter
    def progress(self, value):
        """设置学习进度列表"""
        self.progress_json = json.dumps(value if value else [])
    
    @property
    def learning_progress(self):
        """当前学习进度"""
        progress_list = self.progress
        return progress_list[-1] if progress_list else 0
    
    def save(self, *args, **kwargs):
        """保存反馈时同步更新学员信息"""
        super().save(*args, **kwargs)
        
        # 更新学员的学习进度
        if self.student and self.progress:
            self.student.progress = self.progress
            self.student.save()