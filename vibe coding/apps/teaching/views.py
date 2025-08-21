from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
import json
import time

from apps.accounts.models import User
from apps.students.models import Student
from apps.teaching.models import Feedback
from apps.research.models import TeachingTask
from apps.operations.models import OpsTask
from apps.common.models import SystemConfig


def has_teacher_permission(user):
    """检查用户是否有教师权限"""
    return user.is_authenticated and user.has_role('teacher')


@login_required
def teacher_dashboard(request):
    """教师点评主页"""
    if not has_teacher_permission(request.user):
        return render(request, 'common/permission_denied.html')
    
    # 获取公告信息
    announcements = {
        'teaching_tips': SystemConfig.objects.filter(
            key__startswith='teaching_tip_'  # 修复：config_key -> key
        ).values_list('value', flat=True),  # 修复：config_value -> value
        'student_notes': SystemConfig.objects.filter(
            key__startswith='student_note_'  # 修复：config_key -> key
        ).values_list('value', flat=True)  # 修复：config_value -> value
    }
    
    # 获取今日任务统计（按 assigned_at 口径，状态包含待处理与进行中）
    today_tasks = TeachingTask.objects.filter(
        teacher=request.user,
        status__in=['pending', 'in_progress'],
        assigned_at__date=timezone.now().date()
    ).count()
    
    # 获取已完成点评统计（按 reply_time 日期）
    completed_feedbacks = Feedback.objects.filter(
        teacher=request.user,
        reply_time__date=timezone.now().date()
    ).count()
    
    context = {
        'announcements': announcements,
        'today_tasks': today_tasks,
        'completed_feedbacks': completed_feedbacks,
    }
    
    return render(request, 'teaching/feedback.html', context)


@login_required
@require_http_methods(["GET"])
def get_today_tasks(request):
    """获取今日教学任务"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    # 获取分配给当前教师的待处理任务
    tasks = TeachingTask.objects.filter(
        teacher=request.user,  # 修复：assigned_teacher -> teacher
        status__in=['pending', 'in_progress']  # 修复：task_status -> status
    ).select_related('student').order_by('-assigned_at')
    
    task_list = []
    for task in tasks:
        student = task.student
        task_list.append({
            'task_id': task.task_id,
            'student_id': student.student_id,
            'student_name': student.student_name,  # 修复：nickname or name -> student_name
            'student_groups': student.groups,
            'current_progress': student.current_progress,
            'is_difficult': student.is_difficult,  # 修复：原先是 status == 'difficult'
            'research_note': student.research_note,
            'operation_note': getattr(student, 'ops_note', ''),  # 修复：原先是 operation_note
        })
    
    return JsonResponse({
        'success': True,
        'tasks': task_list
    })


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def submit_feedback(request):
    """提交点评"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    try:
        data = json.loads(request.body)
        feedbacks = data.get('feedbacks', [])
        
        if not feedbacks:
            return JsonResponse({'error': '没有点评数据'}, status=400)
        
        created_feedbacks = []
        
        for feedback_data in feedbacks:
            student_id = feedback_data.get('student_id')
            lesson_progress = feedback_data.get('lesson_progress')
            teacher_comment = feedback_data.get('teacher_comment')
            
            if not all([student_id, lesson_progress, teacher_comment]):
                continue
            
            # 获取学员信息
            try:
                student = Student.objects.get(student_id=student_id)
            except Student.DoesNotExist:
                continue
            
            # 处理学习进度（支持 "5" 或 "5,7"）
            try:
                if ',' in lesson_progress:
                    progress_list = [x.strip() for x in lesson_progress.split(',') if x.strip()]
                else:
                    progress_list = [lesson_progress.strip()]
            except Exception:
                continue
            
            # 创建点评记录（使用 Feedback 模型字段）
            feedback = Feedback.objects.create(
                user_id=student.student_id,
                student=student,
                student_name=student.student_name,
                teacher_name=request.user.real_name or request.user.username,
                teacher=request.user,
                teacher_comment=teacher_comment
            )
            feedback.progress = progress_list
            feedback.save()
            
            # 更新相关教学任务状态
            TeachingTask.objects.filter(
                student=student,
                teacher=request.user,
                status__in=['pending', 'in_progress']
            ).update(
                status='completed',
                completed_at=timezone.now()
            )
        
        return JsonResponse({
            'success': True,
            'message': f'成功提交{len(created_feedbacks)}条点评',
            'created_count': len(created_feedbacks)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '数据格式错误'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def manual_feedback(request):
    """手动点评"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    try:
        data = json.loads(request.body)
        student_name = data.get('student_name')
        lesson_progress = data.get('lesson_progress')
        teacher_comment = data.get('teacher_comment')
        
        if not all([student_name, lesson_progress, teacher_comment]):
            return JsonResponse({'error': '请填写所有必填项'}, status=400)
        
        # 查找学员
        student = Student.objects.filter(
            Q(student_name__icontains=student_name) | Q(alias_name__icontains=student_name)  # 修复：name/nickname -> student_name/alias_name
        ).first()
        
        if not student:
            return JsonResponse({'error': '未找到匹配的学员'}, status=404)
        
        # 处理学习进度
        try:
            if ',' in lesson_progress:
                progress_list = [x.strip() for x in lesson_progress.split(',') if x.strip()]
            else:
                progress_list = [lesson_progress.strip()]
        except Exception:
            return JsonResponse({'error': '课程进度格式错误'}, status=400)
        
        # 创建点评记录（使用 Feedback 模型字段）
        feedback = Feedback.objects.create(
            user_id=student.student_id,
            student=student,
            student_name=student.student_name,
            teacher_name=request.user.real_name or request.user.username,
            teacher=request.user,
            teacher_comment=teacher_comment
        )
        feedback.progress = progress_list
        feedback.save()
        
        return JsonResponse({
            'success': True,
            'message': '手动点评提交成功',
            'feedback_id': feedback.id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '数据格式错误'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def get_completed_feedbacks(request):
    """获取已完成的点评记录"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    # 获取当前教师的点评记录
    feedbacks = Feedback.objects.filter(
        teacher=request.user
    ).order_by('-reply_time')
    
    page = request.GET.get('page', 1)
    paginator = Paginator(feedbacks, 20)
    page_obj = paginator.get_page(page)
    
    feedback_list = []
    for feedback in page_obj:
        feedback_list.append({
            'id': feedback.id,
            'reply_time': feedback.reply_time.strftime('%Y-%m-%d %H:%M'),
            'student_name': feedback.student_name,
            'progress': feedback.progress,  # 原始列表
            'teacher_name': feedback.teacher_name,
            'teacher_comment': feedback.teacher_comment,
            'push_research': feedback.push_research,
            'push_ops': feedback.push_ops,
        })
    
    return JsonResponse({
        'success': True,
        'feedbacks': feedback_list,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous(),
        'current_page': page_obj.number,
        'total_pages': paginator.num_pages,
    })


@login_required
@require_http_methods(["GET"])
def search_students(request):
    """搜索学员"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    query = request.GET.get('q', '').strip()
    
    if len(query) < 2:
        return JsonResponse({
            'success': True,
            'students': []
        })
    
    # 搜索学员
    students = Student.objects.filter(
        Q(student_name__icontains=query) | Q(alias_name__icontains=query)  # 修复：name/nickname -> student_name/alias_name
    ).filter(status__in=['active', 'difficult'])[:10]
    
    student_list = []
    for student in students:
        student_list.append({
            'student_id': student.student_id,
            'student_name': student.student_name,  # 修复：name -> student_name
            'alias_name': student.alias_name,      # 修复：nickname -> alias_name
            'groups': student.groups,
            'current_progress': student.current_progress,
            'status': student.status,
        })
    
    return JsonResponse({
        'success': True,
        'students': student_list
    })


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def push_to_research(request):
    """推送到教研"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    try:
        data = json.loads(request.body)
        student_ids = data.get('student_ids', [])
        research_note = data.get('research_note', '')
        
        if not student_ids or not research_note:
            return JsonResponse({'error': '请选择学员并填写教研备注'}, status=400)
        
        # 更新点评记录的教研备注
        updated_count = Feedback.objects.filter(
            teacher=request.user,
            student__student_id__in=student_ids,  # 修复：通过外键字段匹配业务学号
            push_research=''
        ).update(
            push_research=research_note
        )
        return JsonResponse({
            'success': True,
            'message': f'成功推送{updated_count}条记录到教研部门'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '数据格式错误'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def push_to_operation(request):
    """推送到运营"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    try:
        data = json.loads(request.body)
        student_ids = data.get('student_ids', [])
        operation_note = data.get('operation_note', '')
        
        if not student_ids or not operation_note:
            return JsonResponse({'error': '请选择学员并填写运营备注'}, status=400)
        
        # 更新点评记录的运营备注
        updated_count = Feedback.objects.filter(
            teacher=request.user,
            student__student_id__in=student_ids,  # 修复：通过外键字段匹配业务学号
            push_ops=''
        ).update(
            push_ops=operation_note
        )
        
        # 创建运营任务（避免冲突，生成简单唯一ID）
        for sid in student_ids:
            try:
                student = Student.objects.get(student_id=sid)
                OpsTask.objects.create(
                    task_id=f"OPS-{sid}-{int(time.time()*1000)}",
                    student=student,
                    student_name=student.student_name,
                    source='teacher',
                    task_status='pending'
                )
            except Student.DoesNotExist:
                continue
        
        return JsonResponse({
            'success': True,
            'message': f'成功推送{updated_count}条记录到运营部门'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '数据格式错误'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def batch_delete_tasks(request):
    """批量删除任务"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    try:
        data = json.loads(request.body)
        student_ids = data.get('student_ids', [])
        
        if not student_ids:
            return JsonResponse({'error': '请选择要删除的任务'}, status=400)
        
        # 删除教学任务（只能删除自己的任务）
        deleted_count = TeachingTask.objects.filter(
            teacher=request.user,
            student__student_id__in=student_ids,
            status__in=['pending', 'in_progress']
        ).update(
            status='cancelled',
            updated_at=timezone.now()
        )
        return JsonResponse({
            'success': True,
            'message': f'成功删除{deleted_count}个任务'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '数据格式错误'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def get_student_detail(request, student_id):
    """获取学员详细信息"""
    if not has_teacher_permission(request.user):
        return JsonResponse({'error': '权限不足'}, status=403)
    
    try:
        student = get_object_or_404(Student, student_id=student_id)
        
        # 获取该学员的最近点评记录
        recent_feedbacks = Feedback.objects.filter(
            student=student
        ).order_by('-reply_time')[:5]
        
        feedback_list = []
        for feedback in recent_feedbacks:
            progress_str = ','.join(map(str, feedback.progress))
            feedback_list.append({
                'teacher_name': feedback.teacher_name,
                'lesson_progress': progress_str,
                'teacher_comment': feedback.teacher_comment,
                'feedback_time': feedback.reply_time.strftime('%Y-%m-%d %H:%M'),
            })
        
        return JsonResponse({
            'success': True,
            'student': {
                'student_id': student.student_id,
                'name': student.student_name,      # 修复：name -> student_name
                'nickname': student.alias_name,    # 修复：nickname -> alias_name
                'groups': student.groups,
                'current_progress': student.current_progress,
                'status': student.status,
                'total_study_time': student.total_study_time,
                'research_note': student.research_note,
                'operation_note': student.operation_note,
                'recent_feedbacks': feedback_list,
            }
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)