// 睿涵音乐后台管理系统 - 运营模块JavaScript

// 全局变量
let currentPage = 1;
let currentFilter = 'all';
let searchQuery = '';
let studentsData = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeOperations();
    loadStudentsList();
    setupEventListeners();
});

// 初始化运营模块
function initializeOperations() {
    console.log('运营模块初始化完成');
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索输入框
    const searchInput = document.getElementById('student-search');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchQuery = e.target.value.trim();
            currentPage = 1;
            loadStudentsList();
        });
    }
    
    // 筛选标签
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有active类
            filterTabs.forEach(t => t.classList.remove('active'));
            // 添加active类到当前标签
            this.classList.add('active');
            
            currentFilter = this.dataset.filter;
            currentPage = 1;
            loadStudentsList();
        });
    });
}

// 加载学员列表
function loadStudentsList() {
    const params = new URLSearchParams({
        page: currentPage,
        filter: currentFilter,
        search: searchQuery
    });
    
    fetch(`/operations/students/api/?${params}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                studentsData = data.data;  // 注意：后端返回的是data.data
                renderStudentsList(data.data);
                renderPagination(data.pagination);
                updateStats(data.stats);
            } else {
                showError('加载学员列表失败：' + data.message);  // 修复：error -> message
            }
        })
        .catch(error => {
            showError('网络错误：' + error.message);
        });
}

// 查看学员详情
function viewStudentDetail(studentId) {
    fetch(`/operations/students/${studentId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showStudentDetailModal(data.data);  // 修复：student -> data
            } else {
                showError('获取学员详情失败：' + data.message);  // 修复：error -> message
            }
        })
        .catch(error => {
            showError('网络错误：' + error.message);
        });
}

// 渲染学员列表
function renderStudentsList(students) {
    const container = document.getElementById('students-list');
    if (!container) return;
    
    if (students.length === 0) {
        container.innerHTML = '<div class="operations-empty-state">暂无学员数据</div>';
        return;
    }
    
    let html = '';
    students.forEach(student => {
        const statusClass = getStatusClass(student.status);
        html += `
            <div class="student-item" data-student-id="${student.id}">
                <div class="student-info">
                    <div class="student-name">${student.name}</div>
                    <div class="student-details">
                        ID: ${student.student_id} | 
                        分组: ${student.groups.join(', ')} | 
                        状态: <span class="${statusClass}">${student.status}</span>
                    </div>
                    <div class="student-details">
                        进度: ${student.current_progress} | 
                        学习时长: ${student.total_study_time}小时
                    </div>
                    ${student.operation_note ? `<div class="student-details">运营备注: ${student.operation_note}</div>` : ''}
                </div>
                <div class="student-actions">
                    <button class="operations-btn operations-btn-primary" onclick="viewStudentDetail('${student.id}')">详情</button>
                    <button class="operations-btn operations-btn-warning" onclick="editStudent('${student.id}')">编辑</button>
                    <button class="operations-btn operations-btn-success" onclick="addNote('${student.id}')">备注</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 获取状态样式类
function getStatusClass(status) {
    switch(status) {
        case '正常': return 'status-normal';
        case '暂停': return 'status-paused';
        case '困难': return 'status-difficult';
        default: return 'status-unknown';
    }
}

// 渲染分页
function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container || !pagination) return;
    
    let html = '';
    
    // 上一页
    if (pagination.has_previous) {
        html += `<button class="pagination-btn" onclick="changePage(${pagination.previous_page_number})">上一页</button>`;
    }
    
    // 页码
    for (let i = 1; i <= pagination.num_pages; i++) {
        const activeClass = i === pagination.current_page ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="changePage(${i})">${i}</button>`;
    }
    
    // 下一页
    if (pagination.has_next) {
        html += `<button class="pagination-btn" onclick="changePage(${pagination.next_page_number})">下一页</button>`;
    }
    
    container.innerHTML = html;
}

// 更新统计信息
function updateStats(stats) {
    if (!stats) return;
    
    const totalElement = document.getElementById('total-students');
    const activeElement = document.getElementById('active-students');
    const pausedElement = document.getElementById('paused-students');
    
    if (totalElement) totalElement.textContent = stats.total || 0;
    if (activeElement) activeElement.textContent = stats.active || 0;
    if (pausedElement) pausedElement.textContent = stats.paused || 0;
}

// 切换页面
function changePage(page) {
    currentPage = page;
    loadStudentsList();
}

// 显示学员详情模态框
function showStudentDetailModal(student) {
    const detailHtml = `
        学员ID：${student.student_id}\n
        姓名：${student.name}\n
        别名：${student.nickname || '无'}\n
        分组：${student.groups.join(', ')}\n
        当前进度：${student.current_progress}\n
        状态：${student.status}\n
        总学习时长：${student.total_study_time}小时\n
        创建时间：${student.created_at}\n
        运营备注：${student.operation_note || '无'}
    `;
    alert(detailHtml);
}

// 打开添加学员模态框
function openAddStudentModal() {
    const modal = document.getElementById('studentModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('studentForm');
    
    if (!modal || !modalTitle || !form) {
        console.error('模态框元素未找到');
        return;
    }
    
    // 设置标题
    modalTitle.textContent = '添加学员';
    
    // 清空表单
    form.reset();
    document.getElementById('studentId').value = '';
    
    // 显示模态框
    modal.style.display = 'block';
    
    // 设置表单提交事件
    form.onsubmit = function(e) {
        e.preventDefault();
        submitStudentForm(false); // false表示新增
    };
}

// 打开编辑学员模态框
function openEditStudentModal(studentId) {
    const modal = document.getElementById('studentModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('studentForm');
    
    if (!modal || !modalTitle || !form) {
        console.error('模态框元素未找到');
        return;
    }
    
    // 设置标题
    modalTitle.textContent = '编辑学员';
    
    // 获取学员详情并填充表单
    fetch(`/operations/students/${studentId}/`, {
        method: 'GET',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const student = data.student;
            document.getElementById('studentId').value = student.id;
            document.getElementById('studentName').value = student.student_name || '';
            document.getElementById('aliasName').value = student.alias_name || '';
            document.getElementById('groupName').value = student.groups ? student.groups.join(', ') : '';
            document.getElementById('status').value = student.status || 'active';
            
            // 显示模态框
            modal.style.display = 'block';
            
            // 设置表单提交事件
            form.onsubmit = function(e) {
                e.preventDefault();
                submitStudentForm(true); // true表示编辑
            };
        } else {
            showError('获取学员信息失败：' + data.message);
        }
    })
    .catch(error => {
        showError('网络错误：' + error.message);
    });
}

// 关闭学员模态框
function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 提交学员表单
function submitStudentForm(isEdit) {
    const form = document.getElementById('studentForm');
    const formData = new FormData(form);
    
    // 构建请求数据
    const data = {
        student_name: formData.get('student_name'),
        alias_name: formData.get('alias_name'),
        groups: formData.get('group_name') ? formData.get('group_name').split(',').map(g => g.trim()) : [],
        status: formData.get('status')
    };
    
    // 如果是编辑模式，添加external_user_id
    if (isEdit) {
        const studentId = formData.get('student_id');
        data.external_user_id = formData.get('external_user_id') || '';
    } else {
        // 新增模式需要external_user_id
        data.external_user_id = prompt('请输入用户ID（必填）：');
        if (!data.external_user_id) {
            showError('用户ID为必填项');
            return;
        }
    }
    
    // 验证必填字段
    if (!data.student_name) {
        showError('学员昵称为必填项');
        return;
    }
    
    // 发送请求
    const url = isEdit ? `/operations/students/${formData.get('student_id')}/update/` : '/operations/students/create/';
    
    fetch(url, {
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
            showSuccess(isEdit ? '学员信息更新成功' : '学员创建成功');
            closeStudentModal();
            loadStudentsList(); // 重新加载学员列表
        } else {
            showError((isEdit ? '更新' : '创建') + '学员失败：' + data.message);
        }
    })
    .catch(error => {
        showError('网络错误：' + error.message);
    });
}

// 打开批量导入模态框
function openBatchImportModal() {
    // 这里可以实现批量导入功能
    alert('批量导入功能待实现');
}

// 导出学员数据
function exportStudents() {
    // 这里可以实现导出功能
    alert('导出功能待实现');
}

// 点击模态框外部关闭模态框
window.onclick = function(event) {
    const modal = document.getElementById('studentModal');
    if (event.target === modal) {
        closeStudentModal();
    }
};

// 修改现有的editStudent函数，将其替换为：
function editStudent(studentId) {
    openEditStudentModal(studentId);
}

// 添加备注
function addNote(studentId) {
    const note = prompt('请输入运营备注：');
    if (!note) return;
    
    const data = {
        operation_note: note
    };
    
    fetch(`/operations/students/${studentId}/note/`, {
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
            showSuccess('备注添加成功');
            loadStudentsList();
        } else {
            showError('添加备注失败：' + data.error);
        }
    })
    .catch(error => {
        showError('网络错误：' + error.message);
    });
}

// 显示成功信息
function showSuccess(message) {
    alert('成功：' + message);
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