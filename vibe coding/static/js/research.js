// 教研模块JavaScript功能

// 全局变量
let selectedTeacher = null;
let selectedStudents = [];
let assignmentHistory = [];

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
        remarks: document.getElementById('taskRemarks').value || ''
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
            loadAssignmentHistory(); // 重新加载历史记录
            clearAssignment(); // 清空当前分配
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
// 修复 displayStudentSuggestions 函数（第228行）
function displayStudentSuggestions(students) {
    const suggestions = document.getElementById('student-suggestions');
    suggestions.innerHTML = '';
    
    students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <strong>${student.name || student.student_name}</strong> - ${student.status} - ${student.learning_status}
        `;
        item.addEventListener('click', () => addStudent(student));
        suggestions.appendChild(item);
    });
    
    suggestions.style.display = 'block';
}

// 同时需要修复其他可能使用这些字段的地方
function addStudent(student) {
    // 检查是否已经添加过该学员
    if (selectedStudents.find(s => s.id === student.id)) {
        alert('该学员已经在选择列表中');
        return;
    }
    
    // 添加学员到选择列表（使用正确的字段名）
    selectedStudents.push({
        id: student.id,
        name: student.student_name || student.name,
        student_id: student.student_id,
        status: student.status,
        learning_status: student.learning_status,
        remark: ''
    });
    
    updateSelectedStudentsList();
    document.getElementById('student-input').value = '';
    document.getElementById('student-suggestions').style.display = 'none';
}

// 更新已选学员列表显示
function updateSelectedStudentsList() {
    const container = document.getElementById('selected-students'); // 修复：使用正确的ID
    
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

// 移除学员
function removeStudent(index) {
    selectedStudents.splice(index, 1);
    updateSelectedStudentsList();
}

// 更新学员备注
function updateStudentRemark(index, remark) {
    selectedStudents[index].remark = remark;
}

// 显示学员详情
function showStudentDetail(studentId) {
    // 这里应该调用后端API获取学员详情
    // 暂时显示模拟数据
    const modal = document.getElementById('studentDetailModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 初始化历史记录选择
function initializeHistorySelection() {
    // 历史记录相关功能
}

// 显示分配历史
// 修复 displayAssignmentHistory 函数中的容器ID
function displayAssignmentHistory() {
    const historyList = document.getElementById('history-list');
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

// 添加状态文本转换函数
function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'in_progress': '进行中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

// 选择历史记录
function selectHistoryRecord(recordId) {
    const items = document.querySelectorAll('.history-item');
    items.forEach(item => item.classList.remove('selected'));
    
    event.currentTarget.classList.add('selected');
}

// 使用历史记录
// 删除第361-394行的重复函数定义
// 只保留第119-151行的正确版本

// 删除这个重复的函数：
// function useHistoryRecord(recordId) {
//     const record = assignmentHistory.find(r => r.id === recordId);
//     if (!record) {
//         alert('未找到历史记录');
//         return;
//     }
//     
//     // 根据历史记录设置当前分配
//     // 找到对应的教师按钮并选中
//     const teacherButtons = document.querySelectorAll('.teacher-btn');
//     teacherButtons.forEach(btn => {
//         if (btn.textContent.includes(record.teacher_name)) {
//             btn.click(); // 触发教师选择
//         }
//     });
//     
//     // 添加学员到当前选择列表
//     const student = {
//         id: record.student_id,
//         student_name: record.student_name,
//         student_id: record.student_id
//     };
//     
//     // 检查学员是否已经在选择列表中
//     if (!selectedStudents.find(s => s.id === student.id)) {
//         selectedStudents.push(student);
//         updateSelectedStudentsList();
//     }
//     
//     // 切换到分配标签页
//     document.querySelector('[data-tab="assignment"]').click();
//     
//     alert('已应用历史分配记录');
// }

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
    
    // 这里应该调用后端API保存分配方案
    alert('分配方案已保存');
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