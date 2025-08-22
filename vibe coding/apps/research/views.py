from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.db.models import Q, Count, OuterRef, Subquery
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
    teachers = User.objects.filter(roles_json__contains='"teacher"')
    
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
        
        teacher = get_object_or_404(User, id=teacher_id, roles_json__contains='"teacher"')
        
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
    
    # 注意：不能直接 values('groups')，因为 groups 是 property
    qs = Student.objects.filter(
        Q(student_name__icontains=query) |
        Q(student_id__icontains=query) |
        Q(alias_name__icontains=query)
    ).only('id', 'student_id', 'student_name', 'alias_name', 'groups_json')[:20]
    
    students = []
    for s in qs:
        students.append({
            'id': s.id,
            'student_id': s.student_id,
            'student_name': s.student_name,
            'alias_name': s.alias_name,
            'groups': s.groups,  # property 转为 list
        })
    
    return JsonResponse({'students': students})

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
    teachers = User.objects.filter(roles_json__contains='"teacher"')
    
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
    teachers = User.objects.filter(roles_json__contains='"teacher"')
    groups = Student.GROUP_CHOICES
    latest_comment_sq = Feedback.objects.filter(
        student=OuterRef('pk')
    ).order_by('-reply_time').values('teacher_comment')[:1]
    latest_teacher_sq = Feedback.objects.filter(
        student=OuterRef('pk')
    ).order_by('-reply_time').values('teacher_name')[:1]
    attention_students = (
        Student.objects.filter(is_difficult=True)
        .select_related('assigned_teacher')
        .annotate(
            latest_teacher_comment=Subquery(latest_comment_sq),
            latest_teacher_name=Subquery(latest_teacher_sq),
        )
    )
    context = {
        'current_user': request.user,
        'teachers': teachers,
        'groups': groups,
        'attention_students': attention_students,
    }
    return render(request, 'research/quality_monitor.html', context)

@login_required
def feedback_monitoring(request):
    """点评记录监控 - AJAX接口"""
    if not request.user.has_role('researcher'):
        return JsonResponse({'success': False, 'message': '权限不足'})
    
    # 如果是AJAX请求，返回JSON数据
    if request.GET.get('ajax') == '1':
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
        student_id = request.GET.get('student')  # 新增：按学员ID筛选
        
        feedbacks = Feedback.objects.select_related('student', 'teacher')
        
        # 默认显示本周点评（当没有任何筛选条件时）
        if not any([teacher_id, group, keyword, course_from, course_to, student_id]):
            feedbacks = feedbacks.filter(reply_time__gte=week_start, reply_time__lt=week_end)
        
        if teacher_id:
            feedbacks = feedbacks.filter(teacher_id=teacher_id)
        if group:
            # 原来的groups查询
            # feedbacks = feedbacks.filter(student__groups__contains=[group])
            # 改为SQLite兼容的查询
            feedbacks = feedbacks.filter(student__groups_json__icontains=f'"{group}"')
        if student_id:
            feedbacks = feedbacks.filter(student_id=student_id)
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
        
        # 序列化数据（修正：只序列化当前页）
        feedbacks_data = []
        for feedback in page_obj:
            feedbacks_data.append({
                'id': feedback.id,
                'student': {
                    'id': feedback.student.id,
                    'student_id': feedback.student.student_id,
                    'student_name': feedback.student.student_name,
                    'groups': feedback.student.groups,
                },
                'teacher': {
                    'id': feedback.teacher.id,
                    'real_name': feedback.teacher.real_name,
                },
                'teacher_comment': feedback.teacher_comment,
                'reply_time': feedback.reply_time.isoformat(),
            })
        
        return JsonResponse({
            'success': True,
            'feedbacks': feedbacks_data,
            'total': paginator.count,
        })
    
    # 非AJAX请求返回模板
    messages.error(request, '您没有权限访问此页面')
    return redirect('accounts:profile')

@login_required
def student_search(request):
    """学员搜索功能（改为返回 JSON，以供质量监控页的前端 fetch 使用）"""
    if not request.user.has_role('researcher'):
        # 前端 fetch 需要 JSON，而不是重定向
        return JsonResponse({'success': False, 'message': '权限不足'}, status=403)
    
    query = (request.GET.get('q') or '').strip()
    if len(query) < 1:
        # 与前端最小长度校验保持一致：1 个字符即可
        return JsonResponse({'success': True, 'students': []})
    
    students_qs = Student.objects.filter(
        Q(student_name__icontains=query) |
        Q(student_id__icontains=query) |
        Q(alias_name__icontains=query)
    ).order_by('student_name')[:50]
    
    students_data = []
    for s in students_qs:
        students_data.append({
            'id': s.id,
            'student_id': s.student_id,
            'student_name': s.student_name,
            'groups': s.groups,  # list
            # 前端期望“第N课”，使用 learning_progress（课程数），不要用 course_progress 百分比
            'course_progress': s.learning_progress,
            'assigned_teacher_name': s.assigned_teacher_name,
            'learning_status': s.learning_status,
            'get_learning_status_display': s.get_learning_status_display_custom(),
        })
    
    return JsonResponse({'success': True, 'students': students_data})
    context = {
        'query': query,
        'students': students,
    }
    return render(request, 'research/student_search.html', context)

@login_required
def student_detail(request, student_id):
    """学员详情页面 / Ajax 数据"""
    if not request.user.has_role('researcher'):
        if request.GET.get('ajax') == '1':
            return JsonResponse({'success': False, 'message': '权限不足'})
        messages.error(request, '您没有权限访问此页面')
        return redirect('accounts:profile')
    
    student = get_object_or_404(Student, id=student_id)

    # Ajax：返回 JSON 供抽屉使用
    if request.GET.get('ajax') == '1':
        try:
            # 最近 5 条点评（抽屉概览可能用到）
            feedbacks = list(
                Feedback.objects.filter(student=student)
                .select_related('teacher')
                .order_by('-reply_time')[:5]
                .values(
                    'id',
                    'teacher_comment',
                    'reply_time',
                    'teacher__real_name',
                )
            )
            feedbacks_payload = [
                {
                    'id': fb['id'],
                    'teacher_comment': fb['teacher_comment'],
                    'reply_time': fb['reply_time'].isoformat() if fb['reply_time'] else None,
                    'teacher': {'real_name': fb['teacher__real_name'] or ''},
                }
                for fb in feedbacks
            ]
            payload = {
                'id': student.id,
                'student_id': student.student_id,
                'student_name': student.student_name,
                'groups': student.groups,
                'course_progress': student.course_progress,  # 第几课
                'assigned_teacher_name': student.assigned_teacher_name,
                'research_note': getattr(student, 'research_note', '') or '',
                'recent_feedbacks': feedbacks_payload,
            }
            return JsonResponse({'success': True, 'student': payload})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})

    # 页面渲染（保留原行为）
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


# 修复 get_task_detail 函数（第350-360行）
@login_required
def get_task_detail(request, task_id):
    try:
        task = get_object_or_404(TeachingTask, id=task_id)
        
        # 获取分配的学员信息（修复：使用单个student而不是students.all()）
        student_data = {
            'id': task.student.id,
            'name': task.student.student_name,  # 修复：使用student_name
            'student_id': task.student.student_id,
            'alias_name': task.student.alias_name,  # 修复：使用alias_name替代phone
            'status': task.student.status,  # 修复：使用status替代level
            'learning_status': task.student.learning_status  # 修复：使用learning_status替代instrument
        }
        
        return JsonResponse({
            'success': True,
            'data': {
                'id': task.id,
                'task_id': task.task_id,
                'teacher': task.teacher.get_full_name(),
                'teacher_id': task.teacher.id,
                'student': student_data,  # 修复：返回单个学员对象
                'status': task.status,
                'task_note': task.task_note,
                'assigned_at': task.assigned_at.strftime('%Y-%m-%d %H:%M:%S'),
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# get_teacher_stats函数已经在第375-402行正确修复了
# 使用了正确的roles_json__contains查询和teacher.real_name字段
@login_required
def get_teacher_stats(request):
    try:
        # 修复：使用正确的角色查询
        teachers = User.objects.filter(roles_json__contains='"teacher"')
        stats = []
        
        for teacher in teachers:
            total_tasks = TeachingTask.objects.filter(teacher=teacher).count()
            pending_tasks = TeachingTask.objects.filter(teacher=teacher, status='pending').count()
            completed_tasks = TeachingTask.objects.filter(teacher=teacher, status='completed').count()
            
            # 修复：统计分配的学员数量
            total_students = TeachingTask.objects.filter(teacher=teacher).values('student').distinct().count()
            
            stats.append({
                'teacher_id': teacher.id,
                'teacher_name': teacher.real_name or teacher.username,
                'total_tasks': total_tasks,
                'pending_tasks': pending_tasks,
                'completed_tasks': completed_tasks,
                'total_students': total_students
            })
        
        return JsonResponse({'success': True, 'data': stats})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# 修复export_assignment_results函数（第404-477行）
@login_required
def export_assignment_results(request):
    try:
        # 获取查询参数
        teacher_id = request.GET.get('teacher_id')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        # 构建查询条件
        tasks = TeachingTask.objects.select_related('student', 'teacher', 'researcher')
        
        if teacher_id:
            tasks = tasks.filter(teacher_id=teacher_id)
        
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
            tasks = tasks.filter(created_at__gte=start_date)
        
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
            tasks = tasks.filter(created_at__lte=end_date + timedelta(days=1))
        
        # 创建PDF
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # 设置标题
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, height - 50, "Teaching Task Assignment Report")
        
        # 设置内容
        y_position = height - 100
        p.setFont("Helvetica", 12)
        
        for task in tasks:
            if y_position < 100:  # 换页
                p.showPage()
                y_position = height - 50
            
            # 任务信息
            p.drawString(50, y_position, f"Teacher: {task.teacher.real_name or task.teacher.username}")
            y_position -= 20
            p.drawString(50, y_position, f"Date: {task.created_at.strftime('%Y-%m-%d %H:%M')}")
            y_position -= 20
            p.drawString(50, y_position, f"Status: {task.get_status_display()}")
            y_position -= 20
            
            # 修复：显示单个学员信息（TeachingTask与Student是一对一关系）
            p.drawString(50, y_position, "Student:")
            y_position -= 20
            p.drawString(70, y_position, f"- {task.student.student_name} ({task.student.student_id})")
            y_position -= 15
            
            # 修复：使用正确的字段名task_note而不是remarks
            if task.task_note:
                p.drawString(50, y_position, f"Note: {task.task_note}")
                y_position -= 20
            
            y_position -= 20  # 任务间隔
        
        p.save()
        buffer.seek(0)
        
        # 返回PDF文件
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="assignment_report_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
        
        return response
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def use_history_assignment(request, task_id):
    """使用历史分配记录"""
    if not request.user.has_role('researcher'):
        return JsonResponse({'success': False, 'message': '权限不足'})
    
    try:
        # 获取历史任务
        history_task = get_object_or_404(TeachingTask, id=task_id)
        
        # 获取学员信息（使用正确的字段名）
        student = history_task.student
        students_data = [{
            'id': student.id,
            'name': student.student_name,
            'student_id': student.student_id,
            'alias_name': student.alias_name,  # 使用实际存在的字段
            'status': student.status,
            'learning_status': student.learning_status
        }]
        
        return JsonResponse({
            'success': True,
            'data': {
                'teacher_id': history_task.teacher.id,
                'teacher_name': history_task.teacher.get_full_name(),
                'students': students_data,
                'remarks': history_task.task_note
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})

# 在文件末尾添加这个函数
@login_required
def get_task_history_api(request):
    """获取任务分配历史的API接口"""
    if not request.user.has_role('researcher'):
        return JsonResponse({'success': False, 'message': '权限不足'})
    
    try:
        # 获取最近的任务分配记录
        tasks = TeachingTask.objects.select_related('student', 'teacher', 'researcher').order_by('-created_at')[:50]
        
        tasks_data = []
        for task in tasks:
            tasks_data.append({
                'id': task.id,
                'task_id': task.task_id,
                'student_name': task.student.student_name,
                'student_id': task.student.student_id,
                'teacher_name': task.teacher.get_full_name(),
                'teacher_id': task.teacher.id,
                'researcher_name': task.researcher.get_full_name(),
                'status': task.status,
                'task_note': task.task_note,
                'assigned_at': task.assigned_at.strftime('%Y-%m-%d %H:%M:%S'),
                'created_at': task.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return JsonResponse({
            'success': True,
            'tasks': tasks_data
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})
