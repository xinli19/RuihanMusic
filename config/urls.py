from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # 应用路由
    path('accounts/', include('apps.accounts.urls')),
    path('students/', include('apps.students.urls')),
    path('operations/', include('apps.operations.urls')),
    path('research/', include('apps.research.urls')),
    path('teaching/', include('apps.teaching.urls')),
    
    # 根路径重定向到教学模块
    path('', include('apps.teaching.urls')),
]

# 开发环境下的静态文件和媒体文件服务
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)