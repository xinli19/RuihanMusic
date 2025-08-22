from django.db import models
import json

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
    
    LEARNING_STATUS_CHOICES = [
        ('normal', '正常学习'),
        ('attention', '需要关注'),
        ('excellent', '优秀学员'),
        ('new', '新学员'),
    ]
    
    student_id = models.CharField(max_length=50, unique=True, verbose_name='学员ID')
    external_user_id = models.CharField(max_length=100, unique=True, verbose_name='小鹅通ID')
    student_name = models.CharField(max_length=100, verbose_name='学员昵称')
    alias_name = models.CharField(max_length=100, blank=True, verbose_name='备注名')
    
    # 使用TextField存储JSON格式的数据，兼容SQLite
    groups_json = models.TextField(default='[]', verbose_name='分组JSON')
    progress_json = models.TextField(default='[]', verbose_name='学习进度JSON')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='joined', verbose_name='学员状态')
    learning_hours = models.FloatField(default=0.0, verbose_name='累计学习时长')
    
    # 备注字段
    research_note = models.TextField(blank=True, verbose_name='教研备注')
    ops_note = models.TextField(blank=True, verbose_name='运营备注')

    # 其他字段
    is_difficult = models.BooleanField(default=False, verbose_name='是否需要关注')
    assigned_teacher = models.ForeignKey(
        'accounts.User', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_students',
        verbose_name='分配教师'
    )
    difficulty_source = models.CharField(
        max_length=50, 
        choices=[
            ('system', '系统推送'),
            ('teacher', '教师推送'),
            ('manual', '教研选择'),
        ],
        blank=True,
        verbose_name='困难来源'
    )
    learning_status = models.CharField(
        max_length=20,
        choices=LEARNING_STATUS_CHOICES,
        default='normal',
        verbose_name='学习状态'
    )
    
    # 额外字段
    learning_progress = models.IntegerField(default=0, verbose_name='学习进度（课程数）')
    total_study_time = models.FloatField(default=0.0, verbose_name='总学习时长')
   
    
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
            models.Index(fields=['learning_status']),
            models.Index(fields=['is_difficult']),
        ]
    
    def __str__(self):
        return f"{self.student_name} ({self.student_id})"
    
    @property
    def groups(self):
        """获取分组列表"""
        try:
            return json.loads(self.groups_json)
        except (json.JSONDecodeError, TypeError):
            return []
    
    @groups.setter
    def groups(self, value):
        """设置分组列表"""
        self.groups_json = json.dumps(value if value else [])
    
    @property
    def progress(self):
        """获取学习进度列表"""
        try:
            return json.loads(self.progress_json)
        except (json.JSONDecodeError, TypeError):
            return []
    
    @progress.setter
    def progress(self, value):
        """设置学习进度列表，同时同步 learning_progress（以 progress_json 为事实源）"""
        import json as _json
        self.progress_json = _json.dumps(value if value else [])
        try:
            lst = value if isinstance(value, list) else []
            current = lst[-1] if lst else 0
            if isinstance(current, str) and current.strip().isdigit():
                self.learning_progress = int(current.strip())
            elif isinstance(current, int):
                self.learning_progress = current
            else:
                # 兜底策略：无法解析时使用列表长度
                self.learning_progress = len(lst)
        except Exception:
            self.learning_progress = 0
    
    @property
    def current_progress(self):
        """当前学习进度"""
        progress_list = self.progress
        return progress_list[-1] if progress_list else 0
    
    @property
    def course_progress(self):
        """课程进度百分比"""
        return min(self.learning_progress * 10, 100)
    
    @property
    def assigned_teacher_name(self):
        """分配教师姓名"""
        return self.assigned_teacher.real_name if self.assigned_teacher else '未分配'
    
    @property
    def latest_feedback(self):
        """最新反馈"""
        from apps.teaching.models import Feedback
        return Feedback.objects.filter(student=self).order_by('-reply_time').first()
    
    def get_learning_status_display_custom(self):
        """自定义学习状态显示"""
        status_dict = dict(self.LEARNING_STATUS_CHOICES)
        return status_dict.get(self.learning_status, '未知')
    
    def save(self, *args, **kwargs):
        """保存时的额外处理"""
        super().save(*args, **kwargs)
    
    def get_difficulty_source_display(self):
        """获取困难来源显示名称"""
        source_dict = {
            'system': '系统推送',
            'teacher': '教师推送', 
            'manual': '教研选择',
        }
        return source_dict.get(self.difficulty_source, '未知')