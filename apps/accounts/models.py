from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.postgres.fields import ArrayField

class User(AbstractUser):
    """扩展用户模型"""
    ROLE_CHOICES = [
        ('teacher', '教师'),
        ('researcher', '教研'),
        ('operator', '运营'),
        ('admin', '管理员'),
    ]
    
    # 修改为ArrayField支持多角色
    roles = ArrayField(
        models.CharField(max_length=20, choices=ROLE_CHOICES),
        default=list,
        verbose_name='角色'
    )
    
    real_name = models.CharField(max_length=50, verbose_name='真实姓名')
    phone = models.CharField(max_length=20, blank=True, verbose_name='电话')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'
        db_table = 'auth_user_extended'
    
    def has_role(self, role):
        """检查用户是否拥有指定角色"""
        return role in self.roles
    
    def is_teacher(self):
        """检查是否为教师"""
        return 'teacher' in self.roles
    
    def is_researcher(self):
        """检查是否为教研"""
        return 'researcher' in self.roles
    
    def is_operator(self):
        """检查是否为运营"""
        return 'operator' in self.roles
    
    def get_roles_display(self):
        """获取角色显示名称"""
        role_dict = dict(self.ROLE_CHOICES)
        return [role_dict.get(role, role) for role in self.roles]