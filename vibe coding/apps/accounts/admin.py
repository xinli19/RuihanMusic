from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

class UserAdmin(BaseUserAdmin):
    # 添加自定义字段到编辑表单
    fieldsets = BaseUserAdmin.fieldsets + (
        ('角色信息', {'fields': ('roles_json', 'real_name', 'phone')}),
    )
    
    # 添加到列表显示
    list_display = BaseUserAdmin.list_display + ('real_name', 'get_roles_display')
    
    def get_roles_display(self, obj):
        return ', '.join(obj.get_roles_display())
    get_roles_display.short_description = '角色'

# 直接注册User模型
admin.site.register(User, UserAdmin)