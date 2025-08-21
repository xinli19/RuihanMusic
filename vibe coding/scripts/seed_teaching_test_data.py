from django.utils import timezone
from django.db import transaction
import json

from apps.accounts.models import User
from apps.students.models import Student
from apps.research.models import TeachingTask

TEACHER_USERNAME = 'admin'
RESEARCHER_USERNAME = 'admin'

def get_user_or_exit(username):
    try:
        return User.objects.get(username=username)
    except User.DoesNotExist:
        print(f"[seed] 未找到用户：{username}，请在后台创建该用户或修改脚本顶部用户名后重试。")
        raise SystemExit(1)

@transaction.atomic
def run():
    teacher = get_user_or_exit(TEACHER_USERNAME)
    researcher = get_user_or_exit(RESEARCHER_USERNAME)

    print(f"[seed] 使用老师: {teacher.username}, 教研: {researcher.username}")

    # 准备学员数据
    students_data = [
        {
            "student_id": "S0001", "external_user_id": "EX-1001", "student_name": "小明",
            "groups": ["基础班"], "progress": [1, 2, 3], "status": "active",
            "is_difficult": False, "research_note": "音准较好", "ops_note": "常规跟进"
        },
        {
            "student_id": "S0002", "external_user_id": "EX-1002", "student_name": "小红",
            "groups": ["中级班", "视唱练耳"], "progress": [1, 2], "status": "joined",
            "is_difficult": True, "research_note": "节奏稍弱", "ops_note": "重点关注"
        },
        {
            "student_id": "S0003", "external_user_id": "EX-1003", "student_name": "阿康",
            "groups": ["基础班"], "progress": [1, 2, 3, 4, 5], "status": "active",
            "is_difficult": False, "research_note": "学习积极", "ops_note": ""
        },
        {
            "student_id": "S0004", "external_user_id": "EX-1004", "student_name": "Luna",
            "groups": ["高级班"], "progress": [8], "status": "active",
            "is_difficult": True, "research_note": "高音控制待加强", "ops_note": "开课欢迎礼包未发"
        },
        {
            "student_id": "S0005", "external_user_id": "EX-1005", "student_name": "Yuki",
            "groups": ["中级班"], "progress": [2, 3, 4, 5, 6, 7, 8], "status": "active",
            "is_difficult": False, "research_note": "", "ops_note": "续费待提醒"
        },
    ]

    created_students = []
    for sd in students_data:
        stu, created = Student.objects.update_or_create(
            student_id=sd["student_id"],
            defaults={
                "external_user_id": sd["external_user_id"],
                "student_name": sd["student_name"],
                "status": sd["status"],
                "is_difficult": sd["is_difficult"],
                "research_note": sd["research_note"],
                "ops_note": sd["ops_note"],
                "groups_json": json.dumps(sd["groups"]),
                "progress_json": json.dumps(sd["progress"]),
            },
        )
        created_students.append((stu, created))
    print(f"[seed] 学员写入完成，共 {len(created_students)} 条（含更新）。")

    today_str = timezone.now().strftime("%Y%m%d")
    task_defs = [
        ("T%s-001" % today_str, "S0001", "pending", "系统测试任务 1"),
        ("T%s-002" % today_str, "S0002", "pending", "系统测试任务 2"),
        ("T%s-003" % today_str, "S0003", "in_progress", "系统测试任务 3"),
        ("T%s-004" % today_str, "S0004", "pending", "系统测试任务 4"),
        ("T%s-005" % today_str, "S0005", "in_progress", "系统测试任务 5"),
    ]

    created_tasks = []
    for task_id, stu_id, status, note in task_defs:
        student = Student.objects.get(student_id=stu_id)
        task, created = TeachingTask.objects.get_or_create(
            task_id=task_id,
            defaults={
                "student": student,
                "teacher": teacher,
                "researcher": researcher,
                "status": status,
                "task_note": note,
            }
        )
        # 如果已存在但老师或状态变了，做一次对齐
        changed = False
        if task.teacher_id != teacher.id:
            task.teacher = teacher
            changed = True
        if task.researcher_id != researcher.id:
            task.researcher = researcher
            changed = True
        if task.status != status:
            task.status = status
            changed = True
        if changed:
            task.save(update_fields=["teacher", "researcher", "status", "updated_at"])
        created_tasks.append((task, created))

    print(f"[seed] 任务写入完成，共 {len(created_tasks)} 条（含更新）。")
    print("[seed] 完成：刷新 /teaching/ 页面，或在“今日任务”点击刷新按钮查看。")

if __name__ == "__main__":
    run()