// 教研模块JavaScript功能

// 全局变量
let selectedTeacher = null;
let selectedStudents = [];
let assignmentHistory = [];
let selectedHistoryId = null;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeTeacherSelection();
    initializeStudentInput();
    initializeHistorySelection();
    loadAssignmentHistory();
});

// 初始化标签页功能
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 添加活动状态
            this.classList.add('active');
            document.getElementById(targetTab + '-tab').classList.add('active');
        });
    });
}

// 初始化教师选择功能
function initializeTeacherSelection() {
    const teacherButtons = document.querySelectorAll('.teacher-btn');
    
    teacherButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 移除其他教师的选中状态
            teacherButtons.forEach(btn => btn.classList.remove('active'));
            
            // 选中当前教师
            this.classList.add('active');
            selectedTeacher = this.getAttribute('data-teacher');
            
            // 更新界面显示
            updateTeacherStats();
        });
    });
}

// 初始化学员输入功能
function initializeStudentInput() {
    const studentInput = document.getElementById('studentInput');
    const suggestions = document.getElementById('studentSuggestions');
    
    if (studentInput) {
        studentInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length > 0) {
                searchStudents(query);
            } else {
                suggestions.style.display = 'none';
            }
        });
        
        // 点击外部隐藏建议列表
        document.addEventListener('click', function(e) {
            if (!studentInput.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
            }
        });
    }
}

// 搜索学员 - 更新API调用
function searchStudents(query) {
    if (!query.trim()) {
        document.getElementById('studentSuggestions').style.display = 'none';
        return;
    }
    
    fetch(`/research/students/search/?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayStudentSuggestions(data.students);
            } else {
                console.error('搜索失败:', data.message);
            }
        })
        .catch(error => {
            console.error('搜索错误:', error);
        });
}

// 加载分配历史 - 更新API调用
function loadAssignmentHistory() {
    fetch('/research/tasks/history/api/')  // 更改为新的API端点
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                assignmentHistory = data.tasks;
                displayAssignmentHistory();
            } else {
                console.error('加载历史记录失败:', data.message);
            }
        })
        .catch(error => {
            console.error('加载历史记录错误:', error);
        });
}

// 使用历史记录 - 更新API调用
function useHistoryRecord(recordId) {
    fetch(`/research/tasks/use-history/${recordId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 切换到手动分配标签页
                document.querySelector('[data-tab="manual"]').click();
                
                // 设置教师
                selectedTeacher = data.data.teacher_id;
                const teacherBtn = document.querySelector(`[data-teacher="${data.data.teacher_id}"]`);
                if (teacherBtn) {
                    document.querySelectorAll('.teacher-btn').forEach(btn => btn.classList.remove('active'));
                    teacherBtn.classList.add('active');
                }
                
                // 设置学员列表
                selectedStudents = data.data.students;
                updateSelectedStudentsList();
                
                // 设置备注
                document.getElementById('taskRemarks').value = data.data.remarks || '';
                
                alert(`已应用 ${data.data.teacher_name} 的历史分配方案`);
            } else {
                alert('应用历史记录失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('应用历史记录错误:', error);
            alert('应用历史记录时发生错误');
        });
}

// 保存分配方案 - 更新API调用
function saveAssignment() {
    if (!selectedTeacher || selectedStudents.length === 0) {
        alert('请完善分配信息');
        return;
    }
    
    const formData = {
        teacher_id: selectedTeacher,
        student_ids: selectedStudents.map(s => s.id),
        task_note: document.getElementById('taskRemarks').value || ''
    };
    
    fetch('/research/tasks/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('分配方案已保存');
            loadAssignmentHistory();
            clearAssignment();
        } else {
            alert('保存失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('保存错误:', error);
        alert('保存时发生错误');
    });
}

// 获取教师统计信息 - 更新API调用
function updateTeacherStats() {
    fetch('/research/teachers/stats/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 更新教师统计显示
                const statsContainer = document.querySelector('.teacher-stats .stats-grid');
                if (statsContainer) {
                    statsContainer.innerHTML = data.data.map(stat => `
                        <div class="stat-card">
                            <div class="stat-title">${stat.teacher_name}</div>
                            <div class="stat-value">${stat.total_tasks}</div>
                            <div class="stat-label">总任务数</div>
                        </div>
                    `).join('');
                }
            }
        })
        .catch(error => {
            console.error('获取教师统计错误:', error);
        });
}

// 显示学员建议列表
// 修复displayStudentSuggestions函数 - 使用正确的字段名
function displayStudentSuggestions(students) {
    const suggestions = document.getElementById('studentSuggestions');
    suggestions.innerHTML = '';
    
    students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <strong>${student.student_name}</strong> - ${student.status} - ${student.learning_status}
        `;
        item.addEventListener('click', () => addStudent(student));
        suggestions.appendChild(item);
    });
    
    suggestions.style.display = 'block';
}

// 修复addStudent函数 - 使用正确的字段名
function addStudent(student) {
    // 检查是否已经添加过该学员
    if (selectedStudents.find(s => s.id === student.id)) {
        alert('该学员已经在选择列表中');
        return;
    }
    
    // 添加学员到选择列表（使用正确的字段名）
    selectedStudents.push({
        id: student.id,
        name: student.student_name,
        student_id: student.student_id,
        status: student.status,
        learning_status: student.learning_status,
        remark: ''
    });
    
    updateSelectedStudentsList();
    document.getElementById('studentInput').value = '';
    document.getElementById('studentSuggestions').style.display = 'none';
}

// 修复updateSelectedStudentsList函数 - 使用正确的容器ID
function updateSelectedStudentsList() {
    const container = document.getElementById('selectedStudents');
    
    if (!container) {
        console.error('Selected students container not found');
        return;
    }
    
    if (selectedStudents.length === 0) {
        container.innerHTML = '<div class="no-students">暂无选中学员</div>';
        return;
    }
    
    container.innerHTML = '';
    selectedStudents.forEach((student, index) => {
        const item = document.createElement('div');
        item.className = 'student-item';
        item.innerHTML = `
            <span class="student-name" onclick="showStudentDetail(${student.id})">${student.name}</span>
            <input type="text" class="task-remark" placeholder="任务备注" 
                   value="${student.remark}" 
                   onchange="updateStudentRemark(${index}, this.value)">
            <button class="remove-btn" onclick="removeStudent(${index})">移除</button>
        `;
        container.appendChild(item);
    });
}

// 修复displayAssignmentHistory函数 - 使用正确的字段名
function displayAssignmentHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) {
        console.error('History list container not found');
        return;
    }
    
    if (assignmentHistory.length === 0) {
        historyList.innerHTML = '<div class="no-records">暂无历史记录</div>';
        return;
    }
    
    historyList.innerHTML = '';
    assignmentHistory.forEach(record => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.recordId = record.id;
        // 如果当前记录是选中记录，恢复高亮
        if (String(selectedHistoryId) === String(record.id)) {
            item.classList.add('selected');
        }
        item.innerHTML = `
            <div class="history-teacher">${record.teacher_name}</div>
            <div class="history-date">${record.created_at}</div>
            <div class="history-students">
                <span class="history-student-tag">${record.student_name} (${record.student_id})</span>
            </div>
            <div class="history-status">
                <span class="status-badge status-${record.status}">${getStatusText(record.status)}</span>
            </div>
            <div class="history-note">${record.task_note || '无备注'}</div>
            <div class="history-actions">
                <button class="btn-edit" onclick="editHistoryRecord(${record.id})">编辑</button>
                <button class="btn-use" onclick="useHistoryRecord(${record.id})">使用</button>
            </div>
        `;
        
        item.addEventListener('click', () => selectHistoryRecord(record.id));
        historyList.appendChild(item);
    });
}

// 状态文本工具函数（兼容数字/字符串）
function getStatusText(status) {
    const s = String(status).toLowerCase();
    switch (s) {
        case 'pending':
        case '0':
            return '待分配';
        case 'assigned':
        case '1':
            return '已分配';
        case 'completed':
        case '2':
            return '已完成';
        default:
            return '未知';
    }
}

// 修复saveAssignment函数 - 使用正确的字段名
function saveAssignment() {
    if (!selectedTeacher || selectedStudents.length === 0) {
        alert('请完善分配信息');
        return;
    }
    
    const formData = {
        teacher_id: selectedTeacher,
        student_ids: selectedStudents.map(s => s.id),
        task_note: document.getElementById('taskRemarks').value || ''
    };
    
    fetch('/research/tasks/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('分配方案已保存');
            loadAssignmentHistory();
            clearAssignment();
        } else {
            alert('保存失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('保存错误:', error);
        alert('保存时发生错误');
    });
}

// 修复useHistoryRecord函数 - 使用正确的字段名
function useHistoryRecord(recordId) {
    fetch(`/research/tasks/use-history/${recordId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 切换到手动分配标签页
                document.querySelector('[data-tab="manual"]').click();
                
                // 设置教师
                selectedTeacher = data.data.teacher_id;
                const teacherBtn = document.querySelector(`[data-teacher="${data.data.teacher_id}"]`);
                if (teacherBtn) {
                    document.querySelectorAll('.teacher-btn').forEach(btn => btn.classList.remove('active'));
                    teacherBtn.classList.add('active');
                }
                
                // 设置学员列表
                selectedStudents = data.data.students;
                updateSelectedStudentsList();
                
                // 设置备注
                document.getElementById('taskRemarks').value = data.data.task_note || '';
                
                alert(`已应用 ${data.data.teacher_name} 的历史分配方案`);
            } else {
                alert('应用历史记录失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('应用历史记录错误:', error);
            alert('应用历史记录时发生错误');
        });
}

// 编辑历史记录
function editHistoryRecord(recordId) {
    alert(`编辑历史记录 ${recordId}`);
}

// 更新教师统计信息
function updateTeacherStats() {
    // 这里应该调用后端API获取教师统计信息
    // 暂时显示模拟数据
}

// 批量分配功能
function batchAssign() {
    if (!selectedTeacher) {
        alert('请先选择教师');
        return;
    }
    
    if (selectedStudents.length === 0) {
        alert('请先选择学员');
        return;
    }
    
    // 这里应该调用后端API进行批量分配
    const assignmentData = {
        teacher: selectedTeacher,
        students: selectedStudents
    };
    
    console.log('批量分配数据:', assignmentData);
    alert(`成功为 ${selectedTeacher} 分配 ${selectedStudents.length} 名学员`);
    
    // 清空选择
    selectedStudents = [];
    updateSelectedStudentsList();
}

// 保存分配方案
function saveAssignment() {
    if (!selectedTeacher || selectedStudents.length === 0) {
        alert('请完善分配信息');
        return;
    }
    
    const formData = {
        teacher_id: selectedTeacher,
        student_ids: selectedStudents.map(s => s.id),
        task_note: document.getElementById('taskRemarks').value || ''
    };
    
    fetch('/research/tasks/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('分配方案已保存');
            loadAssignmentHistory();
            clearAssignment();
        } else {
            alert('保存失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('保存错误:', error);
        alert('保存时发生错误');
    });
}

// 预览分配结果
function previewAssignment() {
    if (!selectedTeacher || selectedStudents.length === 0) {
        alert('请完善分配信息');
        return;
    }
    
    const preview = `
        教师: ${selectedTeacher}
        学员数量: ${selectedStudents.length}
        学员列表: ${selectedStudents.map(s => s.name).join(', ')}
    `;
    
    alert(preview);
}

// 清空当前分配
function clearAssignment() {
    selectedTeacher = null;
    selectedStudents = [];
    
    // 清除教师选择
    document.querySelectorAll('.teacher-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 清空学员列表
    updateSelectedStudentsList();
    
    alert('已清空当前分配');
}

// 模态框控制
function openAssignModal() {
    document.getElementById('assignModal').style.display = 'block';
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
}

// 关闭模态框（点击外部）
window.onclick = function(event) {
    const modal = document.getElementById('assignModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// 表单提交处理
function handleAssignForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    // 这里应该调用后端API提交表单
    console.log('表单数据:', Object.fromEntries(formData));
    
    closeAssignModal();
    alert('任务创建成功');
}

// 初始化历史记录选择（避免未定义报错，并设置加载占位）
function initializeHistorySelection() {
    const historyList = document.getElementById('historyList');
    if (historyList) {
        historyList.innerHTML = '<div class="loading">正在加载历史记录…</div>';
    }
}

// 选择历史记录并高亮
function selectHistoryRecord(recordId) {
    selectedHistoryId = recordId;
    const items = document.querySelectorAll('.history-item');
    items.forEach(item => {
        if (item.dataset.recordId === String(recordId)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// 编辑当前选中的历史记录（供HTML按钮 onclick 调用）
function editSelectedHistory() {
    if (!selectedHistoryId) {
        alert('请先选择一条历史记录');
        return;
    }
    editHistoryRecord(selectedHistoryId);
}

// 更新教师统计信息
function updateTeacherStats() {
    // 这里应该调用后端API获取教师统计信息
    // 暂时显示模拟数据
}

// 批量分配功能
function batchAssign() {
    if (!selectedTeacher) {
        alert('请先选择教师');
        return;
    }
    
    if (selectedStudents.length === 0) {
        alert('请先选择学员');
        return;
    }
    
    // 这里应该调用后端API进行批量分配
    const assignmentData = {
        teacher: selectedTeacher,
        students: selectedStudents
    };
    
    console.log('批量分配数据:', assignmentData);
    alert(`成功为 ${selectedTeacher} 分配 ${selectedStudents.length} 名学员`);
    
    // 清空选择
    selectedStudents = [];
    updateSelectedStudentsList();
}

// 保存分配方案
function saveAssignment() {
    if (!selectedTeacher || selectedStudents.length === 0) {
        alert('请完善分配信息');
        return;
    }
    
    const formData = {
        teacher_id: selectedTeacher,
        student_ids: selectedStudents.map(s => s.id),
        task_note: document.getElementById('taskRemarks').value || ''
    };
    
    fetch('/research/tasks/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('分配方案已保存');
            loadAssignmentHistory();
            clearAssignment();
        } else {
            alert('保存失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('保存错误:', error);
        alert('保存时发生错误');
    });
}

// 预览分配结果
function previewAssignment() {
    if (!selectedTeacher || selectedStudents.length === 0) {
        alert('请完善分配信息');
        return;
    }
    
    const preview = `
        教师: ${selectedTeacher}
        学员数量: ${selectedStudents.length}
        学员列表: ${selectedStudents.map(s => s.name).join(', ')}
    `;
    
    alert(preview);
}

// 清空当前分配
function clearAssignment() {
    selectedTeacher = null;
    selectedStudents = [];
    
    // 清除教师选择
    document.querySelectorAll('.teacher-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 清空学员列表
    updateSelectedStudentsList();
    
    alert('已清空当前分配');
}

// 模态框控制
function openAssignModal() {
    document.getElementById('assignModal').style.display = 'block';
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
}

// 关闭模态框（点击外部）
window.onclick = function(event) {
    const modal = document.getElementById('assignModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// 表单提交处理
function handleAssignForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    // 这里应该调用后端API提交表单
    console.log('表单数据:', Object.fromEntries(formData));
    
    closeAssignModal();
    alert('任务创建成功');
}