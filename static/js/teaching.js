// 睿涵音乐后台管理系统 - 教学模块JavaScript

// 全局变量
let selectedStudents = new Set();
let allTasks = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    refreshTasks();
    loadRecentFeedbacks();
    
    // 手动点评表单提交
    const manualForm = document.getElementById('manual-feedback-form');
    if (manualForm) {
        manualForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitManualFeedback();
        });
    }
});

// 刷新任务列表
function refreshTasks() {
    fetch('/teaching/tasks/today/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allTasks = data.tasks;
                renderTaskList(data.tasks);
            } else {
                showError('加载任务失败：' + data.error);
            }
        })
        .catch(error => {
            showError('网络错误：' + error.message);
        });
}

// 渲染任务列表
function renderTaskList(tasks) {
    const taskList = document.getElementById('task-list');
    
    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="empty-state">暂无待处理任务</div>';
        return;
    }
    
    let html = '';
    tasks.forEach(task => {
        const isSelected = selectedStudents.has(task.student_id);
        const difficultyBadge = task.is_difficult ? '<span style="color: red; font-weight: bold;">[困难学员]</span>' : '';
        
        html += `
            <div class="task-item" data-student-id="${task.student_id}">
                <div class="task-info">
                    <div class="student-name">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleStudent('${task.student_id}')">
                        ${task.student_name} ${difficultyBadge}
                    </div>
                    <div class="task-details">
                        分组：${task.student_groups.join(', ')} | 进度：${task.current_progress}
                    </div>
                    ${task.research_note ? `<div class="task-details">教研备注：${task.research_note}</div>` : ''}
                    ${task.operation_note ? `<div class="task-details">运营备注：${task.operation_note}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="btn btn-primary" onclick="showStudentDetail('${task.student_id}')">详情</button>
                </div>
            </div>
        `;
    });
    
    taskList.innerHTML = html;
}

// 切换学员选择状态
function toggleStudent(studentId) {
    if (selectedStudents.has(studentId)) {
        selectedStudents.delete(studentId);
    } else {
        selectedStudents.add(studentId);
    }
    updateSelectedCount();
}

// 更新选中数量显示
function updateSelectedCount() {
    const countElement = document.getElementById('selected-count');
    if (countElement) {
        countElement.textContent = selectedStudents.size;
    }
}

// 批量提交点评
function submitSelectedFeedbacks() {
    if (selectedStudents.size === 0) {
        alert('请先选择要点评的学员');
        return;
    }
    
    // 这里可以打开一个模态框来输入点评信息
    // 简化版本：直接提示用户使用手动点评
    alert('请使用手动点评功能为选中的学员逐一添加点评');
}

// 提交手动点评
function submitManualFeedback() {
    const studentName = document.getElementById('student-name').value.trim();
    const lessonProgress = document.getElementById('lesson-progress').value.trim();
    const teacherComment = document.getElementById('teacher-comment').value.trim();
    
    if (!studentName || !lessonProgress || !teacherComment) {
        alert('请填写所有必填项');
        return;
    }
    
    const data = {
        student_name: studentName,
        lesson_progress: lessonProgress,
        teacher_comment: teacherComment
    };
    
    fetch('/teaching/feedback/manual/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('手动点评提交成功');
            document.getElementById('manual-feedback-form').reset();
            refreshTasks();
            loadRecentFeedbacks();
        } else {
            alert('提交失败：' + data.error);
        }
    })
    .catch(error => {
        alert('网络错误：' + error.message);
    });
}

// 推送到教研
function pushToResearch() {
    if (selectedStudents.size === 0) {
        alert('请先选择要推送的学员');
        return;
    }
    
    const note = prompt('请输入教研备注：');
    if (!note) return;
    
    const data = {
        student_ids: Array.from(selectedStudents),
        research_note: note
    };
    
    fetch('/teaching/push/research/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            selectedStudents.clear();
            updateSelectedCount();
        } else {
            alert('推送失败：' + data.error);
        }
    })
    .catch(error => {
        alert('网络错误：' + error.message);
    });
}

// 推送到运营
function pushToOperation() {
    if (selectedStudents.size === 0) {
        alert('请先选择要推送的学员');
        return;
    }
    
    const note = prompt('请输入运营备注：');
    if (!note) return;
    
    const data = {
        student_ids: Array.from(selectedStudents),
        operation_note: note
    };
    
    fetch('/teaching/push/operation/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            selectedStudents.clear();
            updateSelectedCount();
        } else {
            alert('推送失败：' + data.error);
        }
    })
    .catch(error => {
        alert('网络错误：' + error.message);
    });
}

// 显示学员详情
function showStudentDetail(studentId) {
    fetch(`/teaching/students/${studentId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const student = data.student;
                let detailHtml = `
                    学员ID：${student.student_id}\n
                    姓名：${student.name}\n
                    别名：${student.nickname || '无'}\n
                    分组：${student.groups.join(', ')}\n
                    当前进度：${student.current_progress}\n
                    状态：${student.status}\n
                    总学习时长：${student.total_study_time}小时\n
                    教研备注：${student.research_note || '无'}\n
                    运营备注：${student.operation_note || '无'}
                `;
                alert(detailHtml);
            } else {
                alert('获取学员详情失败：' + data.error);
            }
        })
        .catch(error => {
            alert('网络错误：' + error.message);
        });
}

// 加载最近点评记录
function loadRecentFeedbacks() {
    fetch('/teaching/feedback/completed/?page=1')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderRecentFeedbacks(data.feedbacks.slice(0, 5)); // 只显示最近5条
            } else {
                const container = document.getElementById('recent-feedbacks');
                if (container) {
                    container.innerHTML = '<div class="empty-state">加载失败</div>';
                }
            }
        })
        .catch(error => {
            const container = document.getElementById('recent-feedbacks');
            if (container) {
                container.innerHTML = '<div class="empty-state">网络错误</div>';
            }
        });
}

// 渲染最近点评记录
function renderRecentFeedbacks(feedbacks) {
    const container = document.getElementById('recent-feedbacks');
    if (!container) return;
    
    if (feedbacks.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无点评记录</div>';
        return;
    }
    
    let html = '';
    feedbacks.forEach(feedback => {
        html += `
            <div class="announcement-item">
                <div style="font-weight: bold;">${feedback.student_name}</div>
                <div style="font-size: 12px; color: #666;">${feedback.lesson_progress} - ${feedback.feedback_time}</div>
                <div style="margin-top: 5px;">${feedback.teacher_comment}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 显示错误信息
function showError(message) {
    alert('错误：' + message);
}

// 获取CSRF Token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}