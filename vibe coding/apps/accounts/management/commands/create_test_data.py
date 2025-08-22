from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import datetime, timedelta
import random
import json

from apps.accounts.models import User
from apps.students.models import Student
from apps.teaching.models import Feedback
from apps.research.models import TeachingTask
from apps.operations.models import OpsTask, VisitRecord

class Command(BaseCommand):
    help = '创建测试数据'

    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            type=int,
            default=10,
            help='创建用户数量（默认10个）'
        )
        parser.add_argument(
            '--students',
            type=int,
            default=50,
            help='创建学员数量（默认50个）'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='清除现有测试数据'
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_test_data()
            
        self.create_users(options['users'])
        self.create_students(options['students'])
        self.create_teaching_tasks()
        self.create_feedbacks()
        self.create_ops_tasks()
        self.create_visit_records()
        
        self.stdout.write(
            self.style.SUCCESS('测试数据创建完成！')
        )

    def clear_test_data(self):
        """清除测试数据"""
        self.stdout.write('清除现有测试数据...')
        
        # 删除测试数据（保留超级用户）
        VisitRecord.objects.all().delete()
        OpsTask.objects.all().delete()
        Feedback.objects.all().delete()
        TeachingTask.objects.all().delete()
        Student.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        
        self.stdout.write(self.style.SUCCESS('测试数据已清除'))

    def create_users(self, count):
        """创建测试用户"""
        self.stdout.write(f'创建 {count} 个测试用户...')
        
        # 角色配置
        roles_config = [
            (['teacher'], '教师'),
            (['researcher'], '教研'),
            (['operator'], '运营'),
            (['teacher', 'researcher'], '教师+教研'),
            (['operator', 'researcher'], '运营+教研'),
        ]
        
        users_created = 0
        
        for i in range(count):
            roles, role_desc = random.choice(roles_config)
            
            # 生成用户名
            username = f'test_user_{i+1:03d}'
            
            # 检查用户是否已存在
            if User.objects.filter(username=username).exists():
                continue
                
            user = User.objects.create(
                username=username,
                email=f'{username}@example.com',
                password=make_password('password123'),
                real_name=f'测试用户{i+1:03d}',
                phone=f'138{random.randint(10000000, 99999999)}',
                roles_json=json.dumps(roles),
                is_active=True
            )
            users_created += 1
            
        self.stdout.write(
            self.style.SUCCESS(f'成功创建 {users_created} 个用户')
        )

    def create_students(self, count):
        """创建测试学员"""
        self.stdout.write(f'创建 {count} 个测试学员...')
        
        # 获取教师用户
        teachers = User.objects.filter(roles_json__contains='"teacher"')
        if not teachers.exists():
            self.stdout.write(
                self.style.WARNING('没有找到教师用户，将创建未分配教师的学生')
            )
        
        students_created = 0
        
        for i in range(count):
            student_id = f'STU{i+1:06d}'
            
            # 检查学员是否已存在
            if Student.objects.filter(student_id=student_id).exists():
                continue
                
            student = Student.objects.create(
                student_id=student_id,
                external_user_id=f'ext_{i+1:06d}',
                student_name=f'学员{i+1:03d}',
                alias_name=f'别名{i+1:03d}',
                status=random.choice(['joined', 'active', 'graduated', 'archived']),
                learning_status=random.choice(['normal', 'attention', 'excellent', 'new']),
                learning_progress=random.randint(0, 100),
                total_study_time=random.uniform(10.0, 500.0),
                is_difficult=random.choice([True, False]),
                assigned_teacher=random.choice(teachers) if teachers.exists() else None,
                difficulty_source=random.choice(['system', 'teacher', 'manual']) if random.choice([True, False]) else '',
                research_note=f'教研备注{i+1}' if random.choice([True, False]) else '',
                ops_note=f'运营备注{i+1}' if random.choice([True, False]) else ''
            )
            students_created += 1
            
        self.stdout.write(
            self.style.SUCCESS(f'成功创建 {students_created} 个学员')
        )

    def create_teaching_tasks(self):
        """创建教学任务"""
        self.stdout.write('创建教学任务...')
        
        teachers = User.objects.filter(roles_json__contains='"teacher"')
        researchers = User.objects.filter(roles_json__contains='"researcher"')
        students = Student.objects.all()
        
        if not all([teachers.exists(), researchers.exists(), students.exists()]):
            self.stdout.write(
                self.style.WARNING('缺少必要的用户或学员数据，跳过教学任务创建')
            )
            return
            
        tasks_created = 0
        
        # 为每个学员创建1-3个教学任务
        for student in students[:20]:  # 限制前20个学员
            task_count = random.randint(1, 3)
            
            for j in range(task_count):
                task_id = f'TASK_{student.student_id}_{j+1}'
                
                if TeachingTask.objects.filter(task_id=task_id).exists():
                    continue
                    
                TeachingTask.objects.create(
                    task_id=task_id,
                    student=student,
                    teacher=random.choice(teachers),
                    researcher=random.choice(researchers),
                    task_note=f'教学任务备注 - {student.student_name}',
                    status=random.choice(['pending', 'in_progress', 'completed', 'cancelled']),
                    assigned_at=timezone.now() - timedelta(days=random.randint(1, 30))
                )
                tasks_created += 1
                
        self.stdout.write(
            self.style.SUCCESS(f'成功创建 {tasks_created} 个教学任务')
        )

    def create_feedbacks(self):
        """创建教学反馈"""
        self.stdout.write('创建教学反馈...')
        
        teachers = User.objects.filter(roles_json__contains='"teacher"')
        students = Student.objects.all()
        
        if not all([teachers.exists(), students.exists()]):
            self.stdout.write(
                self.style.WARNING('缺少必要的教师或学员数据，跳过反馈创建')
            )
            return
            
        feedbacks_created = 0
        
        # 为每个学员创建1-5个反馈
        for student in students[:15]:  # 限制前15个学员
            feedback_count = random.randint(1, 5)
            
            for j in range(feedback_count):
                teacher = random.choice(teachers)
                
                # 生成学习进度JSON
                progress_data = [
                    {
                        'course': f'课程{k+1}',
                        'progress': random.randint(0, 100),
                        'completed': random.choice([True, False])
                    } for k in range(random.randint(1, 5))
                ]
                
                Feedback.objects.create(
                    user_id=student.student_id,
                    student=student,
                    student_name=student.student_name,
                    teacher=teacher,
                    teacher_name=teacher.real_name,
                    teacher_comment=f'教师评语 - {student.student_name} 在本周的学习中表现良好，建议继续保持。',
                    push_research=f'推送教研备注 - {student.student_name}' if random.choice([True, False]) else '',
                    push_ops=f'推送运营备注 - {student.student_name}' if random.choice([True, False]) else '',
                    course_name=f'音乐基础课程{random.randint(1, 10)}',
                    course_progress=random.randint(0, 100),
                    is_featured=random.choice([True, False]),
                    progress_json=json.dumps(progress_data),
                    reply_time=timezone.now() - timedelta(days=random.randint(1, 30))
                )
                feedbacks_created += 1
                
        self.stdout.write(
            self.style.SUCCESS(f'成功创建 {feedbacks_created} 个教学反馈')
        )

    def create_ops_tasks(self):
        """创建运营任务"""
        self.stdout.write('创建运营任务...')
        
        students = Student.objects.all()
        
        if not students.exists():
            self.stdout.write(
                self.style.WARNING('没有学员数据，跳过运营任务创建')
            )
            return
            
        tasks_created = 0
        
        # 为部分学员创建运营任务
        for student in students[:25]:  # 限制前25个学员
            if random.choice([True, False]):  # 50%概率创建任务
                task_id = f'OPS_{student.student_id}_{random.randint(1000, 9999)}'
                
                if OpsTask.objects.filter(task_id=task_id).exists():
                    continue
                    
                OpsTask.objects.create(
                    task_id=task_id,
                    student=student,
                    student_name=student.student_name,
                    visit_count=random.randint(0, 5),
                    source=random.choice(['teacher', 'system', 'research', 'manual']),
                    task_status=random.choice(['pending', 'contacted', 'no_reply', 'closed']),
                    created_at=timezone.now() - timedelta(days=random.randint(1, 30))
                )
                tasks_created += 1
                
        self.stdout.write(
            self.style.SUCCESS(f'成功创建 {tasks_created} 个运营任务')
        )

    def create_visit_records(self):
        """创建回访记录"""
        self.stdout.write('创建回访记录...')
        
        students = Student.objects.all()
        teachers = User.objects.filter(roles_json__contains='"teacher"')
        
        if not all([students.exists(), teachers.exists()]):
            self.stdout.write(
                self.style.WARNING('缺少必要的学员或教师数据，跳过回访记录创建')
            )
            return
            
        records_created = 0
        
        # 为部分学员创建回访记录
        for student in students[:20]:  # 限制前20个学员
            record_count = random.randint(0, 3)
            
            for j in range(record_count):
                record_id = f'VISIT_{student.student_id}_{j+1}_{random.randint(100, 999)}'
                
                if VisitRecord.objects.filter(record_id=record_id).exists():
                    continue
                    
                teacher = random.choice(teachers)
                
                VisitRecord.objects.create(
                    record_id=record_id,
                    student=student,
                    student_name=student.student_name,
                    visit_status=random.choice(['pending', 'contacted', 'no_reply', 'closed']),
                    visit_count=random.randint(1, 10),
                    teacher_name=teacher.real_name,
                    visit_note=f'回访记录 - {student.student_name}：学员学习状态良好，建议继续关注学习进度。',
                    visit_time=timezone.now() - timedelta(days=random.randint(1, 30))
                )
                records_created += 1
                
        self.stdout.write(
            self.style.SUCCESS(f'成功创建 {records_created} 个回访记录')
        )