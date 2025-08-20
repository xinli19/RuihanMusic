from django.urls import path
from . import views

app_name = 'students'

urlpatterns = [
    # 临时注释掉缺失的类视图
    # path('', views.StudentListView.as_view(), name='list'),
    # path('<int:pk>/', views.StudentDetailView.as_view(), name='detail'),
    # path('<int:pk>/edit/', views.StudentUpdateView.as_view(), name='edit'),
    # path('import/', views.StudentImportView.as_view(), name='import'),
]