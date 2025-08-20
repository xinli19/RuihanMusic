from django.db import models

# 移除 Announcement 模型，公告内容通过视图逻辑从学员数据中提取

class SystemConfig(models.Model):
    """系统配置模型"""
    key = models.CharField(max_length=100, unique=True, verbose_name='配置键')
    value = models.TextField(verbose_name='配置值')
    description = models.CharField(max_length=200, blank=True, verbose_name='配置描述')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '系统配置'
        verbose_name_plural = '系统配置'
        db_table = 'system_config'
    
    def __str__(self):
        return f"{self.key}: {self.value[:50]}"