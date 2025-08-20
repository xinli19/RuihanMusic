from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
import json
import pandas as pd
import os
from datetime import datetime, timedelta

# 修复导入
from apps.accounts.models import User
from apps.students.models import Student
from apps.teaching.models import Feedback
from apps.operations.models import OpsTask, VisitRecord
from apps.common.decorators import role_required

# 修复字段引用
@login_required
@role_required(['运营'])
def get_students_list(request):
    """获取学员列表（AJAX接口）"""
    try:
        # 获取查询参数
        search_term = request.GET.get('search', '').strip()
        sort_by = request.GET.get('sort', 'created_at')
        sort_order = request.GET.get('order', 'desc')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # 基础查询 - 修复：user -> assigned_teacher
        students = Student.objects.select_related('assigned_teacher').all()
        
        # 搜索功能
        if search_term:
            students = students.filter(
                Q(student_name__icontains=search_term) |
                Q(alias_name__icontains=search_term) |
                Q(external_user_id__icontains=search_term)
            )
        
        # 排序
        if sort_by == 'progress':
            order_field = 'learning_progress'
        elif sort_by == 'featured':
            # 计算被精选数（点评中标记为精选的数量）
            students = students.annotate(
                featured_count=Count('feedback', filter=Q(feedback__is_featured=True))
            )
            order_field = 'featured_count'
        elif sort_by == 'study_time':
            order_field = 'total_study_time'
        else:
            order_field = 'created_at'
        
        if sort_order == 'desc':
            order_field = f'-{order_field}'
        
        students = students.order_by(order_field)
        
        # 分页
        paginator = Paginator(students, page_size)
        page_obj = paginator.get_page(page)
        
        # 构建返回数据
        students_data = []
        for student in page_obj:
            # 计算被精选数
            featured_count = student.feedback_set.filter(is_featured=True).count()
            
            students_data.append({
                'id': student.id,
                'external_user_id': student.external_user_id,
                'student_name': student.student_name,  # 修复：nickname -> student_name
                'alias_name': student.alias_name,      # 修复：remark_name -> alias_name
                'groups': student.groups,
                'learning_progress': student.learning_progress,
                'featured_count': featured_count,
                'total_study_time': student.total_study_time or 0,
                'status': student.status,
                'research_notes': student.research_notes or '',
                'operation_notes': student.operation_notes or '',
                'created_at': student.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return JsonResponse({
            'success': True,
            'data': students_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取学员列表失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
@csrf_exempt
def create_student(request):
    """创建新学员"""
    try:
        data = json.loads(request.body)
        
        # 验证必填字段
        external_user_id = data.get('external_user_id', '').strip()
        student_name = data.get('student_name', '').strip()  # 修复：nickname -> student_name
        
        if not external_user_id or not student_name:
            return JsonResponse({
                'success': False,
                'message': '用户ID和学员姓名为必填项'
            })
        
        # 检查用户ID是否已存在
        if Student.objects.filter(external_user_id=external_user_id).exists():
            return JsonResponse({
                'success': False,
                'message': '该用户ID已存在'
            })
        
        # 创建学员
        student = Student.objects.create(
            external_user_id=external_user_id,
            student_name=student_name,                    # 修复：nickname -> student_name
            alias_name=data.get('alias_name', ''),        # 修复：remark_name -> alias_name
            groups=data.get('groups', ['基础班']),
            status='加入',
            operation_notes=data.get('operation_notes', '')
        )
        
        return JsonResponse({
            'success': True,
            'message': '学员创建成功',
            'student_id': student.id
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'创建学员失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
@csrf_exempt
def update_student(request, student_id):
    """更新学员信息"""
    try:
        student = get_object_or_404(Student, id=student_id)
        data = json.loads(request.body)
        
        # 更新字段
        student.student_name = data.get('student_name', student.student_name)  # 修复：nickname -> student_name
        student.alias_name = data.get('alias_name', student.alias_name)        # 修复：remark_name -> alias_name
        student.groups = data.get('groups', student.groups)
        student.status = data.get('status', student.status)
        student.operation_notes = data.get('operation_notes', student.operation_notes)
        
        student.save()
        
        return JsonResponse({
            'success': True,
            'message': '学员信息更新成功'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'更新学员信息失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
def get_student_detail(request, student_id):
    """获取学员详细信息"""
    try:
        student = get_object_or_404(Student, id=student_id)
        
        # 获取历史点评记录
        feedbacks = student.feedback_set.select_related('teacher').order_by('-created_at')[:10]
        feedback_data = []
        for feedback in feedbacks:
            feedback_data.append({
                'id': feedback.id,
                'teacher_name': feedback.teacher.nickname if feedback.teacher else '未知',
                'course_name': feedback.course_name,
                'content': feedback.content,
                'is_featured': feedback.is_featured,
                'created_at': feedback.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        # 获取回访记录
        visit_records = student.visitrecord_set.order_by('-visit_time')[:5]
        visit_data = []
        for visit in visit_records:
            visit_data.append({
                'id': visit.id,
                'visit_time': visit.visit_time.strftime('%Y-%m-%d %H:%M'),
                'status': visit.status,
                'notes': visit.notes,
                'operator': visit.operator.nickname if visit.operator else '未知'
            })
        
        student_data = {
            'id': student.id,
            'external_user_id': student.external_user_id,
            'student_name': student.student_name,  # 修复：nickname -> student_name
            'alias_name': student.alias_name,      # 修复：remark_name -> alias_name
            'groups': student.groups,
            'learning_progress': student.learning_progress,
            'status': student.status,
            'research_notes': student.research_notes,
            'operation_notes': student.operation_notes,
            'total_study_time': student.total_study_time,
            'created_at': student.created_at.strftime('%Y-%m-%d %H:%M'),
            'feedbacks': feedback_data,
            'visit_records': visit_data
        }
        
        return JsonResponse({
            'success': True,
            'data': student_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取学员详情失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
@csrf_exempt
def batch_import_students(request):
    """批量导入学员"""
    try:
        if 'file' not in request.FILES:
            return JsonResponse({
                'success': False,
                'message': '请选择要导入的文件'
            })
        
        file = request.FILES['file']
        
        # 验证文件格式
        if not file.name.endswith('.xlsx'):
            return JsonResponse({
                'success': False,
                'message': '请上传XLSX格式的文件'
            })
        
        # 读取Excel文件
        try:
            df = pd.read_excel(file)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'文件读取失败: {str(e)}'
            })
        
        # 验证必要列
        required_columns = ['用户ID', '昵称']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return JsonResponse({
                'success': False,
                'message': f'文件缺少必要列: {", ".join(missing_columns)}'
            })
        
        # 处理数据
        success_count = 0
        update_count = 0
        error_count = 0
        error_logs = []
        
        for index, row in df.iterrows():
            try:
                external_user_id = str(row['用户ID']).strip()
                student_name = str(row['昵称']).strip()  # 修复：nickname -> student_name
                
                if not external_user_id or external_user_id == 'nan':
                    error_count += 1
                    error_logs.append(f'第{index+2}行: 用户ID为空')
                    continue
                
                if not nickname or nickname == 'nan':
                    error_count += 1
                    error_logs.append(f'第{index+2}行: 昵称为空')
                    continue
                
                # 检查是否已存在
                student, created = Student.objects.get_or_create(
                    external_user_id=external_user_id,
                    defaults={
                        'student_name': student_name,  # 修复：nickname -> student_name
                        'groups': ['基础班'],
                        'status': '加入'
                    }
                )
                
                if created:
                    success_count += 1
                else:
                    # 更新学员姓名（如果不同）
                    if student.student_name != student_name:  # 修复：nickname -> student_name
                        student.student_name = student_name    # 修复：nickname -> student_name
                        student.save()
                        update_count += 1
                
            except Exception as e:
                error_count += 1
                error_logs.append(f'第{index+2}行: {str(e)}')
        
        return JsonResponse({
            'success': True,
            'message': f'导入完成: 新增{success_count}个，更新{update_count}个，失败{error_count}个',
            'result': {
                'success_count': success_count,
                'update_count': update_count,
                'error_count': error_count,
                'error_logs': error_logs
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'批量导入失败: {str(e)}'
        })


# ==================== 运营任务管理模块 ====================

@login_required
@role_required(['运营'])
def task_management(request):
    """运营任务管理主页"""
    context = {
        'user': request.user,
        'current_module': 'task_management'
    }
    return render(request, 'operations/task_management.html', context)


@login_required
@role_required(['运营'])
def get_ops_tasks(request):
    """获取运营待办事项列表"""
    try:
        # 获取查询参数
        status_filter = request.GET.get('status', '')
        search_term = request.GET.get('search', '').strip()
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # 基础查询
        tasks = OpsTask.objects.select_related('student', 'assigned_by').all()
        
        # 状态筛选
        if status_filter:
            tasks = tasks.filter(status=status_filter)
        
        # 搜索功能
        if search_term:
            tasks = tasks.filter(
                Q(student__student_name__icontains=search_term) |  # 修复：nickname -> student_name
                Q(student__alias_name__icontains=search_term) |   # 修复：remark_name -> alias_name
                Q(notes__icontains=search_term)
            )
        
        # 排序
        tasks = tasks.order_by('-created_at')
        
        # 分页
        paginator = Paginator(tasks, page_size)
        page_obj = paginator.get_page(page)
        
        # 构建返回数据
        tasks_data = []
        for task in page_obj:
            # 获取回访次数
            visit_count = task.student.visitrecord_set.count()
            
            tasks_data.append({
                'id': task.id,
                'student_id': task.student.id,
                'student_nickname': task.student.student_name,  # 修复：nickname -> student_name
                'student_groups': task.student.groups,
                'student_status': task.student.status,
                'student_progress': task.student.learning_progress,
                'visit_count': visit_count,
                'source': task.source,
                'status': task.status,
                'notes': task.notes,
                'assigned_by': task.assigned_by.nickname if task.assigned_by else '系统',
                'created_at': task.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return JsonResponse({
            'success': True,
            'data': tasks_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取任务列表失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
@csrf_exempt
def update_task_status(request, task_id):
    """更新任务状态"""
    try:
        task = get_object_or_404(OpsTask, id=task_id)
        data = json.loads(request.body)
        
        new_status = data.get('status')
        if new_status not in ['待办', '已联系', '未回复', '已关闭']:
            return JsonResponse({
                'success': False,
                'message': '无效的状态值'
            })
        
        task.status = new_status
        task.save()
        
        return JsonResponse({
            'success': True,
            'message': '任务状态更新成功'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'更新任务状态失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
@csrf_exempt
def create_visit_record(request):
    """创建回访记录"""
    try:
        data = json.loads(request.body)
        
        student_id = data.get('student_id')
        student = get_object_or_404(Student, id=student_id)
        
        visit_record = VisitRecord.objects.create(
            student=student,
            operator=request.user,
            visit_time=timezone.now(),
            status=data.get('status', '已联系'),
            notes=data.get('notes', '')
        )
        
        return JsonResponse({
            'success': True,
            'message': '回访记录创建成功',
            'visit_id': visit_record.id
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'创建回访记录失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
def get_visit_records(request):
    """获取回访记录列表"""
    try:
        # 获取查询参数
        status_filter = request.GET.get('status', '')
        search_term = request.GET.get('search', '').strip()
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # 基础查询
        records = VisitRecord.objects.select_related('student', 'operator').all()
        
        # 状态筛选
        if status_filter:
            records = records.filter(status=status_filter)
        
        # 搜索功能
        if search_term:
            records = records.filter(
                Q(student__student_name__icontains=search_term) |  # 修复：nickname -> student_name
                Q(student__alias_name__icontains=search_term) |   # 修复：remark_name -> alias_name
                Q(notes__icontains=search_term)
            )
        
        # 排序
        records = records.order_by('-visit_time')
        
        # 分页
        paginator = Paginator(records, page_size)
        page_obj = paginator.get_page(page)
        
        # 构建返回数据
        records_data = []
        for record in page_obj:
            # 计算该学员的回访次数
            visit_count = VisitRecord.objects.filter(student=record.student).count()
            
            records_data.append({
                'id': record.id,
                'student_id': record.student.id,
                'student_nickname': record.student.student_name,  # 修复：nickname -> student_name
                'visit_time': record.visit_time.strftime('%Y-%m-%d %H:%M'),
                'status': record.status,
                'visit_count': visit_count,
                'teacher_name': getattr(record.student, 'current_teacher', '未分配'),
                'notes': record.notes,
                'operator': record.operator.nickname if record.operator else '未知',
                'created_at': record.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return JsonResponse({
            'success': True,
            'data': records_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取回访记录失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
@csrf_exempt
def add_manual_task(request):
    """手动添加运营任务"""
    try:
        data = json.loads(request.body)
        
        student_id = data.get('student_id')
        student = get_object_or_404(Student, id=student_id)
        
        # 检查是否已存在未关闭的任务
        existing_task = OpsTask.objects.filter(
            student=student,
            status__in=['待办', '已联系', '未回复']
        ).first()
        
        if existing_task:
            return JsonResponse({
                'success': False,
                'message': '该学员已存在未完成的运营任务'
            })
        
        task = OpsTask.objects.create(
            student=student,
            source='手动添加',
            status='待办',
            notes=data.get('notes', ''),
            assigned_by=request.user
        )
        
        return JsonResponse({
            'success': True,
            'message': '运营任务添加成功',
            'task_id': task.id
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'添加运营任务失败: {str(e)}'
        })

@login_required
@role_required(['运营'])
def student_list(request):
    """学员列表页面"""
    return render(request, 'operations/student_list.html')

# 添加缺失的类视图
from django.views.generic import ListView, DetailView, CreateView, TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy

class OperationsDashboardView(LoginRequiredMixin, TemplateView):
    """运营模块主页"""
    template_name = 'operations/dashboard.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 添加仪表板数据
        context.update({
            'total_students': Student.objects.count(),
            'active_tasks': OpsTask.objects.filter(status='pending').count(),
            'recent_visits': VisitRecord.objects.order_by('-visit_date')[:5],
        })
        return context

class OpsTaskListView(LoginRequiredMixin, ListView):
    """运营任务列表视图"""
    model = OpsTask
    template_name = 'operations/task_list.html'
    context_object_name = 'tasks'
    paginate_by = 20
    
    def get_queryset(self):
        queryset = OpsTask.objects.select_related('assigned_to', 'assigned_by').order_by('-created_at')
        
        # 搜索功能
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search)
            )
        
        # 状态筛选
        status = self.request.GET.get('status')
        if status:
            queryset = queryset.filter(status=status)
            
        return queryset

class OpsTaskDetailView(LoginRequiredMixin, DetailView):
    """运营任务详情视图"""
    model = OpsTask
    template_name = 'operations/task_detail.html'
    context_object_name = 'task'

class VisitRecordListView(LoginRequiredMixin, ListView):
    """回访记录列表视图"""
    model = VisitRecord
    template_name = 'operations/visit_list.html'
    context_object_name = 'visits'
    paginate_by = 20
    
    def get_queryset(self):
        queryset = VisitRecord.objects.select_related('student', 'visited_by').order_by('-visit_date')
        
        # 搜索功能
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(student__student_name__icontains=search) |
                Q(notes__icontains=search)
            )
            
        return queryset

class VisitRecordCreateView(LoginRequiredMixin, CreateView):
    """创建回访记录视图"""
    model = VisitRecord
    template_name = 'operations/visit_create.html'
    fields = ['student', 'visit_type', 'notes', 'next_visit_date']
    success_url = reverse_lazy('operations:visit_list')
    
    def form_valid(self, form):
        form.instance.visited_by = self.request.user
        form.instance.visit_date = timezone.now()
        return super().form_valid(form)