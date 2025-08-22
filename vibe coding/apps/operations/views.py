from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
# from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
import json
import pandas as pd
import os
from datetime import datetime, timedelta
import uuid

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
                'student_name': student.student_name,
                'alias_name': student.alias_name,
                'groups': student.groups,
                'learning_progress': student.learning_progress,
                'featured_count': featured_count,
                'total_study_time': student.total_study_time or 0,
                'status': student.status,
                # 正式字段
                'research_note': student.research_note or '',
                'ops_note': student.ops_note or '',
                # 兼容旧前端键（值取自正式字段）
                'research_notes': student.research_note or '',
                'operation_notes': student.ops_note or '',
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
        
        # 创建学员（不传 status，采用模型默认 'joined'）
        student = Student.objects.create(
            external_user_id=external_user_id,
            student_name=student_name,
            alias_name=data.get('alias_name', ''),
            groups=data.get('groups', ['基础班']),
            # 统一写 ops_note（B 阶段将移除 operation_notes）
            ops_note=data.get('operation_notes', '') or data.get('ops_note', '')
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
def update_student(request, student_id):
    """更新学员信息"""
    try:
        student = get_object_or_404(Student, id=student_id)
        data = json.loads(request.body)
        # 更新字段
        student.student_name = data.get('student_name', student.student_name)
        student.alias_name = data.get('alias_name', student.alias_name)
        student.groups = data.get('groups', student.groups)
        student.status = data.get('status', student.status)
        # 统一写 ops_note（B 阶段将移除 operation_notes）
        if 'ops_note' in data or 'operation_notes' in data:
            student.ops_note = data.get('ops_note', data.get('operation_notes', student.ops_note))
        student.save()
        return JsonResponse({'success': True, 'message': '学员信息更新成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'更新学员信息失败: {str(e)}'})


@login_required
@role_required(['运营'])
def get_student_detail(request, student_id):
    """获取学员详细信息（统一结构 + 向后兼容）"""
    try:
        student = get_object_or_404(Student, id=student_id)

        # 最近5条点评（使用 teaching.Feedback）
        recent_feedbacks = Feedback.objects.filter(student=student).order_by('-reply_time')[:5]
        feedback_list = []
        for fb in recent_feedbacks:
            progress_str = ','.join(map(str, fb.progress))
            feedback_list.append({
                'teacher_name': fb.teacher_name,
                'lesson_progress': progress_str,
                'teacher_comment': fb.teacher_comment,
                'feedback_time': fb.reply_time.strftime('%Y-%m-%d %H:%M'),
            })
        # 仅评论文本（优先用于展示）
        feedback_comments = [fb.teacher_comment for fb in recent_feedbacks if fb.teacher_comment][:5]

        # 最近5条回访记录（仅文本）
        visit_notes = list(
            VisitRecord.objects.filter(student=student)
            .order_by('-visit_time')
            .values_list('visit_note', flat=True)[:5]
        )

        # 备注：仅用正式字段
        research_note = student.research_note or ''
        ops_note = student.ops_note or ''
        # 统一结构
        student_payload = {
            # 新结构
            'student_name': student.student_name,
            'groups': student.groups,
            'progress': student.progress,
            'status': student.status,
            'learning_hours': student.learning_hours,
            'feedback_comments': feedback_comments,
            'research_note': research_note,
            'ops_note': ops_note,
            'visit_notes': visit_notes,
        # 旧字段（向后兼容）
        'student_id': student.student_id,
        'name': student.student_name,
        'nickname': student.alias_name,
        'current_progress': student.current_progress,
        'total_study_time': getattr(student, 'total_study_time', 0.0),
        'operation_note': ops_note,
        'research_notes': research_note,
        'operation_notes': ops_note,
        'created_at': student.created_at.strftime('%Y-%m-%d %H:%M'),
        }

        # 同时提供 student 与 data 键，兼容旧前端
        return JsonResponse({
            'success': True,
            'student': student_payload,
            'data': student_payload
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取学员详情失败: {str(e)}'
        })


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
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
                student_name = str(row['昵称']).strip()
                if not external_user_id or external_user_id == 'nan':
                    error_count += 1
                    error_logs.append(f'第{index+2}行: 用户ID为空')
                    continue
                
                if not student_name or student_name == 'nan':
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
        
        # 基础查询（移除无效的 assigned_by）
        tasks = OpsTask.objects.select_related('student').all()
        # 默认排除“已关闭”的任务
        tasks = tasks.exclude(task_status='closed')
        
        # 状态筛选：兼容中文或枚举值
        if status_filter:
            status_map = {
                '待办': 'pending',
                '已联系': 'contacted',
                '未回复': 'no_reply',
                '已关闭': 'closed',
            }
            code = status_map.get(status_filter, status_filter)
            tasks = tasks.filter(task_status=code)
        
        # 搜索功能（检索学员昵称/备注名）
        if search_term:
            tasks = tasks.filter(
                Q(student__student_name__icontains=search_term) |
                Q(student__alias_name__icontains=search_term)
            )
        
        # 排序
        tasks = tasks.order_by('-created_at')
        
        # 分页
        paginator = Paginator(tasks, page_size)
        page_obj = paginator.get_page(page)
        
        # 构建返回数据
        tasks_data = []
        for task in page_obj:
            tasks_data.append({
                'id': task.id,
                'student_id': task.student.id,
                'student_nickname': task.student.student_name,
                'student_groups': task.student.groups,
                'student_status': task.student.status,
                'student_progress': task.student.learning_progress,
                'visit_count': task.visit_count,
                'source': task.get_source_display() if hasattr(task, 'get_source_display') else task.source,
                'status': task.get_task_status_display() if hasattr(task, 'get_task_status_display') else task.task_status,
                'notes': '',
                'assigned_by': '系统',
                'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
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
def update_task_status(request, task_id):
    """更新任务状态（支持行内备注），如状态变更为已关闭，前端会刷新列表自动移除"""
    try:
        task = get_object_or_404(OpsTask, id=task_id)
        data = json.loads(request.body)
        
        new_status_cn = data.get('status')
        if new_status_cn not in ['待办', '已联系', '未回复', '已关闭']:
            return JsonResponse({
                'success': False,
                'message': '无效的状态值'
            })
        notes = (data.get('notes') or '').strip()
        
        # 映射中文 -> 枚举
        status_map = {
            '待办': 'pending',
            '已联系': 'contacted',
            '未回复': 'no_reply',
            '已关闭': 'closed',
        }
        code = status_map[new_status_cn]
        
        # 更新任务状态
        task.task_status = code
        
        # 若携带备注，则写入回访记录，并自增任务回访次数
        if notes:
            # 生成唯一记录ID
            record_id = f"VR{int(timezone.now().timestamp()*1000)}"
            # 学员与老师信息
            student = task.student
            teacher_name = getattr(student, 'assigned_teacher_name', None)
            if callable(teacher_name):
                teacher_name = student.assigned_teacher_name
            teacher_name = teacher_name or '未分配'
            task.visit_count = (task.visit_count or 0) + 1
            VisitRecord.objects.create(
                record_id=record_id,
                student=student,
                student_name=student.student_name,
                visit_status=code,
                visit_count=task.visit_count,
                teacher_name=teacher_name,
                visit_note=notes
            )
        task.save()
        return JsonResponse({'success': True, 'message': '状态更新成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'更新失败: {str(e)}'})


@login_required
@role_required(['运营'])
@require_http_methods(["POST"])
def create_visit_record(request):
    """创建回访记录"""
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        if not student_id:
            return JsonResponse({'success': False, 'message': '缺少 student_id'}, status=400)
        student = get_object_or_404(Student, id=student_id)

        # 中文状态 -> 枚举
        status_cn = (data.get('status') or '').strip() or '已联系'
        status_map = {
            '待办': 'pending',
            '已联系': 'contacted',
            '未回复': 'no_reply',
            '已关闭': 'closed',
        }
        status_code = status_map.get(status_cn, status_cn)

        # 生成唯一记录ID
        record_id = f"VR{int(timezone.now().timestamp()*1000)}"

        # 任课老师名称（尽量复用学员的 assigned_teacher_name 逻辑）
        teacher_name = getattr(student, 'assigned_teacher_name', None)
        if callable(teacher_name):
            teacher_name = student.assigned_teacher_name
        teacher_name = teacher_name or '未分配'

        # 计算累计回访次数（简单按该学员已有记录数+1）
        visit_count = VisitRecord.objects.filter(student=student).count() + 1

        visit_record = VisitRecord.objects.create(
            record_id=record_id,
            student=student,
            student_name=student.student_name,
            visit_status=status_code,
            visit_count=visit_count,
            teacher_name=teacher_name,
            visit_note=data.get('notes', '').strip(),
            # visit_time 使用模型的 auto_now_add
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
        student_id = request.GET.get('student_id', '').strip()
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # 基础查询
        records = VisitRecord.objects.select_related('student').all()

        # 按学员过滤
        if student_id:
            records = records.filter(student__id=student_id)
        
        # 状态筛选：兼容中文或枚举值
        if status_filter:
            status_map = {
                '待办': 'pending',
                '已联系': 'contacted',
                '未回复': 'no_reply',
                '已关闭': 'closed',
            }
            code = status_map.get(status_filter, status_filter)
            records = records.filter(visit_status=code)
        
        # 搜索（学员名/别名/备注）
        if search_term:
            records = records.filter(
                Q(student__student_name__icontains=search_term) |
                Q(student__alias_name__icontains=search_term) |
                Q(visit_note__icontains=search_term)
            )
        
        # 排序
        records = records.order_by('-visit_time')
        
        # 分页
        paginator = Paginator(records, page_size)
        page_obj = paginator.get_page(page)
        
        # 构建返回数据
        records_data = []
        for record in page_obj:
            records_data.append({
                'id': record.id,
                'student_id': record.student.id,
                'student_nickname': record.student.student_name,
                'visit_time': record.visit_time.strftime('%Y-%m-%d %H:%M'),
                'status': getattr(record, 'get_visit_status_display', lambda: record.visit_status)(),
                'visit_count': record.visit_count,
                'teacher_name': record.teacher_name,
                'operator': '—',
                'notes': record.visit_note,
                'created_at': record.created_at.strftime('%Y-%m-%d %H:%M'),
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
def add_manual_task(request):
    """手动添加运营任务"""
    try:
        data = json.loads(request.body)
        
        student_id = data.get('student_id')
        student = get_object_or_404(Student, id=student_id)
        
        # 检查是否已存在未完成的运营任务
        existing_task = OpsTask.objects.filter(
            student=student,
            task_status__in=['pending', 'contacted', 'no_reply']
        ).first()
        
        if existing_task:
            return JsonResponse({
                'success': False,
                'message': '该学员已存在未完成的运营任务'
            })
        
        # 生成唯一的任务ID：OPS-学员编码-随机片段
        task_id_val = f"OPS-{getattr(student, 'student_id', student.id)}-{uuid.uuid4().hex[:8].upper()}"
        # 极低概率冲突，再做一次兜底检查
        while OpsTask.objects.filter(task_id=task_id_val).exists():
            task_id_val = f"OPS-{getattr(student, 'student_id', student.id)}-{uuid.uuid4().hex[:8].upper()}"

        # 创建任务，使用现有字段
        task = OpsTask.objects.create(
            task_id=task_id_val,
            student=student,
            student_name=student.student_name,
            source='manual',          # 使用枚举值
            task_status='pending',    # 使用枚举值
            visit_count=0
        )
        
        return JsonResponse({
            'success': True,
            'message': '运营任务添加成功',
            'id': task.id,
            'task_id': task.task_id
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


def get_visit_records(request):
    # 构建查询集
    qs = VisitRecord.objects.select_related("student").all()
    # 新增：支持按 student_id 精确过滤（与现有参数兼容）
    student_id = request.GET.get("student_id")
    if student_id:
        qs = qs.filter(student__id=student_id)
    # 继续处理 status / search 等筛选与分页
    return JsonResponse({'success': True, 'message': '任务状态已更新'})