from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """扩展用户模型"""
    ROLE_CHOICES = [
        ('teacher', '教师'),
        ('researcher', '教研'),
        ('operator', '运营'),
        ('admin', '管理员'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='teacher')
    real_name = models.CharField(max_length=50, verbose_name='真实姓名')
    phone = models.CharField(max_length=20, blank=True, verbose_name='电话')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'
        db_table = 'auth_user_extended'