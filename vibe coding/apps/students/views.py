from django.shortcuts import render, get_object_or_404
from django.views.generic import ListView, DetailView, UpdateView, TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.contrib import messages
from django.urls import reverse_lazy
from .models import Student
from apps.accounts.models import User

class StudentListView(LoginRequiredMixin, ListView):
    """学员列表视图"""
    model = Student
    template_name = 'students/list.html'
    context_object_name = 'students'
    paginate_by = 20
    
    def get_queryset(self):
        queryset = Student.objects.all()
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                student_name__icontains=search
            )
        return queryset.order_by('-created_at')

class StudentDetailView(LoginRequiredMixin, DetailView):
    """学员详情视图"""
    model = Student
    template_name = 'students/detail.html'
    context_object_name = 'student'

class StudentUpdateView(LoginRequiredMixin, UpdateView):
    """学员信息更新视图"""
    model = Student
    template_name = 'students/edit.html'
    fields = ['student_name', 'alias_name', 'groups', 'status', 'research_note', 'ops_note']
    success_url = reverse_lazy('students:list')
    
    def form_valid(self, form):
        messages.success(self.request, '学员信息更新成功！')
        return super().form_valid(form)

class StudentImportView(LoginRequiredMixin, TemplateView):
    """学员数据导入视图"""
    template_name = 'students/import.html'
    
    def post(self, request, *args, **kwargs):
        # 这里可以实现学员数据导入逻辑
        messages.success(request, '学员数据导入功能待实现')
        return self.render_to_response(self.get_context_data())