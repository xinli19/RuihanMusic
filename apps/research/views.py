from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.db.models import Q, Count
from django.utils import timezone
from datetime import datetime, timedelta
from django.core.paginator import Paginator
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO

from .models import TeachingTask
from apps.students.models import Student
from apps.accounts.models import User
from apps.teaching.models import Feedback

# 教学任务分配视图
@login_required
def task_assignment(request):
    """教学任务分配主页"""
    if not request.user.has_role('researcher'):
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    # 获取所有教师
    teachers = User.objects.filter(roles__contains=['teacher'])
    
    # 获取最近的任务分配记录
    recent_tasks = TeachingTask.objects.select_related('student', 'teacher', 'researcher').order_by('-created_at')[:10]
    
    context = {
        'teachers': teachers,
        'recent_tasks': recent_tasks,
    }
    return render(request, 'research/task_assignment.html', context)

@login_required
@require_http_methods(["POST"])
def create_task_assignment(request):
    """创建任务分配"""
    if not request.user.has_role('researcher'):
        return JsonResponse({'success': False, 'message': '权限不足'})
    
    try:
        data = json.loads(request.body)
        teacher_id = data.get('teacher_id')
        student_assignments = data.get('assignments', [])
        
        teacher = get_object_or_404(User, id=teacher_id, roles__contains=['teacher'])
        
        created_tasks = []
        for assignment in student_assignments:
            student_id = assignment.get('student_id')
            task_note = assignment.get('task_note', '')
            
            student = get_object_or_404(Student, id=student_id)
            
            # 创建任务
            task = TeachingTask.objects.create(
                task_id=f"TASK_{uuid.uuid4().hex[:8].upper()}",
                student=student,
                teacher=teacher,
                researcher=request.user,
                task_note=task_note
            )
            created_tasks.append({
                'id': task.id,
                'task_id': task.task_id,
                'student_name': student.student_name,
                'teacher_name': teacher.real_name
            })
        
        return JsonResponse({
            'success': True,
            'message': f'成功分配 {len(created_tasks)} 个任务',
            'tasks': created_tasks
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})

@login_required
def search_students(request):
    """搜索学员（AJAX接口）"""
    query = request.GET.get('q', '')
    if len(query) < 2:
        return JsonResponse({'students': []})
    
    students = Student.objects.filter(
        Q(student_name__icontains=query) | 
        Q(student_id__icontains=query) |
        Q(alias_name__icontains=query)
    ).values('id', 'student_id', 'student_name', 'alias_name', 'groups')[:20]
    
    return JsonResponse({'students': list(students)})

@login_required
def task_history(request):
    """任务分配历史"""
    if not request.user.has_role('researcher'):
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    # 筛选条件
    teacher_id = request.GET.get('teacher')
    status = request.GET.get('status')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    
    tasks = TeachingTask.objects.select_related('student', 'teacher', 'researcher')
    
    if teacher_id:
        tasks = tasks.filter(teacher_id=teacher_id)
    if status:
        tasks = tasks.filter(status=status)
    if date_from:
        tasks = tasks.filter(created_at__gte=date_from)
    if date_to:
        tasks = tasks.filter(created_at__lte=date_to)
    
    tasks = tasks.order_by('-created_at')
    
    # 分页
    paginator = Paginator(tasks, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # 获取教师列表用于筛选
    teachers = User.objects.filter(roles__contains=['teacher'])
    
    context = {
        'page_obj': page_obj,
        'teachers': teachers,
        'current_filters': {
            'teacher': teacher_id,
            'status': status,
            'date_from': date_from,
            'date_to': date_to,
        }
    }
    return render(request, 'research/task_history.html', context)

@login_required
@require_http_methods(["POST"])
def delete_task(request, task_id):
    """删除任务分配"""
    if not request.user.has_role('researcher'):
        return JsonResponse({'success': False, 'message': '权限不足'})
    
    try:
        task = get_object_or_404(TeachingTask, id=task_id)
        task_info = f"{task.teacher.real_name} -> {task.student.student_name}"
        task.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'已删除任务分配: {task_info}'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})

# 教学质量监控视图
@login_required
def quality_monitoring(request):
    """教学质量监控主页"""
    if not request.user.has_role('researcher'):
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    return render(request, 'research/quality_monitoring.html')

@login_required
def feedback_monitoring(request):
    """点评记录监控"""
    if not request.user.has_role('researcher'):
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    # 获取本周点评
    week_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = week_start - timedelta(days=week_start.weekday())
    week_end = week_start + timedelta(days=7)
    
    # 筛选条件
    teacher_id = request.GET.get('teacher')
    group = request.GET.get('group')
    keyword = request.GET.get('keyword')
    course_from = request.GET.get('course_from')
    course_to = request.GET.get('course_to')
    
    feedbacks = Feedback.objects.select_related('student', 'teacher')
    
    # 默认显示本周点评
    if not any([teacher_id, group, keyword, course_from, course_to]):
        feedbacks = feedbacks.filter(reply_time__gte=week_start, reply_time__lt=week_end)
    
    if teacher_id:
        feedbacks = feedbacks.filter(teacher_id=teacher_id)
    if group:
        feedbacks = feedbacks.filter(student__groups__contains=[group])
    if keyword:
        feedbacks = feedbacks.filter(
            Q(student__student_name__icontains=keyword) |
            Q(teacher_comment__icontains=keyword)
        )
    if course_from and course_to:
        # 这里需要根据实际的课程进度字段来筛选
        pass
    
    feedbacks = feedbacks.order_by('-reply_time')
    
    # 分页
    paginator = Paginator(feedbacks, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # 获取教师和分组列表用于筛选
    teachers = User.objects.filter(roles__contains=['teacher'])
    groups = Student.GROUP_CHOICES
    
    context = {
        'page_obj': page_obj,
        'teachers': teachers,
        'groups': groups,
        'week_start': week_start,
        'week_end': week_end,
        'current_filters': {
            'teacher': teacher_id,
            'group': group,
            'keyword': keyword,
            'course_from': course_from,
            'course_to': course_to,
        }
    }
    return render(request, 'research/feedback_monitoring.html', context)

@login_required
def student_search(request):
    """学员搜索功能"""
    if not request.user.has_role('researcher'):
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    query = request.GET.get('q', '')
    students = []
    
    if query and len(query) >= 2:
        students = Student.objects.filter(
            Q(student_name__icontains=query) |
            Q(student_id__icontains=query) |
            Q(alias_name__icontains=query)
        ).order_by('student_name')[:50]
    
    context = {
        'query': query,
        'students': students,
    }
    return render(request, 'research/student_search.html', context)

@login_required
def student_detail(request, student_id):
    """学员详情页面"""
    if not request.user.has_role('researcher'):
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    student = get_object_or_404(Student, id=student_id)
    
    # 获取学员的点评记录
    feedbacks = Feedback.objects.filter(student=student).select_related('teacher').order_by('-reply_time')[:10]
    
    # 获取学员的任务分配记录
    tasks = TeachingTask.objects.filter(student=student).select_related('teacher', 'researcher').order_by('-created_at')[:10]
    
    context = {
        'student': student,
        'feedbacks': feedbacks,
        'tasks': tasks,
    }
    return render(request, 'research/student_detail.html', context)

@login_required
@require_http_methods(["POST"])
def update_student_research_note(request, student_id):
    """更新学员教研备注"""
    if not request.user.has_role('researcher'):
        return JsonResponse({'success': False, 'message': '权限不足'})
    
    try:
        student = get_object_or_404(Student, id=student_id)
        data = json.loads(request.body)
        research_note = data.get('research_note', '')
        
        student.research_note = research_note
        student.save()
        
        return JsonResponse({
            'success': True,
            'message': '教研备注已更新'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})