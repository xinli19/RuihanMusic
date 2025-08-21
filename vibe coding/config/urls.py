from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

def home_redirect(request):
    return redirect('teaching:dashboard')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('apps.accounts.urls')),
    path('students/', include('apps.students.urls')),
    path('operations/', include('apps.operations.urls')),
    path('teaching/', include('apps.teaching.urls')),
    path('research/', include('apps.research.urls')),  # 添加这一行
    path('', home_redirect, name='home'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += staticfiles_urlpatterns()