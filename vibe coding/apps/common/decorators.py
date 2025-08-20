from functools import wraps
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

def role_required(allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'error': '请先登录'}, status=401)
            
            # 中文角色名称到英文代码的映射
            role_mapping = {
                '运营': 'operator',
                '教学': 'teacher', 
                '教研': 'researcher',
                '管理员': 'admin'
            }
            
            # 将中文角色名称转换为英文代码
            mapped_roles = [role_mapping.get(role, role) for role in allowed_roles]
            
            # 检查用户是否拥有任一允许的角色
            user_roles = request.user.roles  # 使用复数形式
            if not any(role in user_roles for role in mapped_roles):
                return JsonResponse({'error': '权限不足'}, status=403)
            
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator