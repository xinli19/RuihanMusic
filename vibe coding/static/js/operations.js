// 睿涵音乐后台管理系统 - 运营模块JavaScript

// 全局变量
let currentPage = 1;
let currentFilter = 'all';
let searchQuery = '';
let studentsData = [];
let hasLoadedOpsTasks = false;   // 新增：运营任务是否已加载
let hasLoadedVisits = false;     // 新增：回访记录是否已加载

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initOperationsTabs(); // 新增：初始化运营模块Tab切换
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
    // 绑定回访搜索框回车直接搜索
    const visitSearch = document.getElementById('visit-search');
    if (visitSearch) {
        visitSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadVisitRecords(1, visitSearch.value.trim());
            }
        });
    }
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
                const student = data.student || data.data;  // 新旧结构兼容
                showStudentDetailModal(student);
            } else {
                showError('获取学员详情失败：' + (data.message || data.error || '未知错误'));
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
    // 渲染进度：对象数组 -> k:v 列表；字符串数组 -> 逗号拼接
    function renderProgressText(progress) {
        if (!progress || progress.length === 0) return '—';
        if (typeof progress[0] === 'object') {
            return '<ul style="margin-left:16px;">' + progress.map((p) => {
                const kv = Object.entries(p || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
                return `<li>${kv || '[空]'}</li>`;
            }).join('') + '</ul>';
        }
        return Array.isArray(progress) ? progress.join(', ') : String(progress);
    }

    // 最近点评（仅 teacher_comment）
    let feedbackListHtml = '';
    if (Array.isArray(student.feedback_comments) && student.feedback_comments.length > 0) {
        feedbackListHtml = '<ul style="margin-left:16px;">' + student.feedback_comments.map(c => `<li>${c || ''}</li>`).join('') + '</ul>';
    } else if (Array.isArray(student.recent_feedbacks) && student.recent_feedbacks.length > 0) {
        feedbackListHtml = '<ul style="margin-left:16px;">' + student.recent_feedbacks.map(f =>
            `<li>【${f.feedback_time}】第${f.lesson_progress} - ${f.teacher_name}：${f.teacher_comment || ''}</li>`
        ).join('') + '</ul>';
    } else {
        feedbackListHtml = '<ul style="margin-left:16px;"><li>暂无</li></ul>';
    }

    // 回访记录（visit_note）
    let visitListHtml = '';
    if (Array.isArray(student.visit_notes) && student.visit_notes.length > 0) {
        visitListHtml = '<ul style="margin-left:16px;">' + student.visit_notes.map(n => `<li>${n || ''}</li>`).join('') + '</ul>';
    } else {
        visitListHtml = '<ul style="margin-left:16px;"><li>暂无</li></ul>';
    }

    const modal = document.getElementById('studentDetailModal');
    const content = document.getElementById('studentDetailModalContent');
    if (!modal || !content) {
        alert('模态框元素未找到');
        return;
    }

    content.innerHTML = `
        <div><strong>ID：</strong>${student.student_id || ''}</div>
        <div><strong>姓名：</strong>${student.student_name || student.name || ''}（${student.nickname || student.alias_name || '无别名'}）</div>
        <div><strong>分组：</strong>${Array.isArray(student.groups) ? student.groups.join(', ') : (student.groups || '')}</div>
        <div><strong>进度：</strong>${renderProgressText(student.progress)}</div>
        <div><strong>状态：</strong>${student.status || '—'}</div>
        <div><strong>学习时长：</strong>${student.learning_hours ?? student.total_study_time ?? 0} 小时</div>
        <div><strong>教研备注：</strong>${student.research_note || student.research_notes || '—'}</div>
        <div><strong>运营备注：</strong>${student.ops_note || student.operation_notes || student.operation_note || '—'}</div>
        <div style="margin-top:10px;"><strong>最近点评（teacher_comment）：</strong></div>
        ${feedbackListHtml}
        <div style="margin-top:10px;"><strong>回访记录（visit_note）：</strong></div>
        ${visitListHtml}
    `;

    modal.style.display = 'block';
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

// 关闭学员详情模态框
function closeStudentDetailModal() {
    const modal = document.getElementById('studentDetailModal');
    if (modal) modal.style.display = 'none';
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
    const editModal = document.getElementById('studentModal');
    const detailModal = document.getElementById('studentDetailModal');
    if (event.target === editModal) {
        closeStudentModal();
    }
    if (event.target === detailModal) {
        closeStudentDetailModal();
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


// 新增：通用Tab切换（复用teaching的交互）
function initOperationsTabs() {
    const header = document.querySelector('.tab-header');
    const panes = document.querySelectorAll('.tab-pane');
    if (!header || !panes.length) return;

    const activate = (targetId, btn) => {
        // 切换激活态
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');

        // 懒加载两个新Tab的数据
        if (targetId === 'opsTaskManagement' && !hasLoadedOpsTasks) {
            loadOpsTasks(1);
            hasLoadedOpsTasks = true;

            // 仅初始化一次事件绑定
            const searchInput = document.getElementById('ops-task-search');
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        loadOpsTasks(1, searchInput.value.trim());
                    }
                });
            }
            const btnComplete = document.getElementById('ops-batch-complete');
            if (btnComplete) {
                btnComplete.addEventListener('click', () => batchUpdateOpsTasks('已关闭')); // 批量完成 = 已关闭
            }
            const btnDelete = document.getElementById('ops-batch-delete');
            if (btnDelete) {
                btnDelete.addEventListener('click', () => batchUpdateOpsTasks('已关闭')); // 暂无删除接口，等同关闭
            }
            const btnExport = document.getElementById('ops-export');
            if (btnExport) {
                btnExport.addEventListener('click', () => {
                    // 简单导出：导出选中 ID
                    const ids = getSelectedTaskIds();
                    if (ids.length === 0) return;
                    const blob = new Blob([ids.join('\n')], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ops_tasks_${Date.now()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }
        } else if (targetId === 'visitRecords' && !hasLoadedVisits) {
            loadVisitRecords(1);
            hasLoadedVisits = true;
        }
    };

    // 点击事件委托
    header.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-button');
        if (!btn) return;
        const target = btn.getAttribute('data-tab');
        if (!target) return;
        activate(target, btn);
    });

    // 键盘可达性：Enter/Space 切换
    header.addEventListener('keydown', (e) => {
        const btn = e.target.closest('.tab-button');
        if (!btn) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const target = btn.getAttribute('data-tab');
            if (!target) return;
            activate(target, btn);
        }
    });
}

// ==================== 学员列表（保留现有） ====================
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

// ==================== 运营任务管理 - 列表与分页 ====================
function loadOpsTasks(page = 1, search = '', status = '') {
    const params = new URLSearchParams({
        page,
        page_size: 20,
        search,
        status
    });
    fetch(`/operations/tasks/api/?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                showError('加载运营任务失败：' + (data.message || '未知错误'));
                return;
            }
            renderOpsTasks(data.data || []);
            renderOpsTaskPagination(data.pagination || null);
        })
        .catch(err => showError('网络错误：' + err.message));
}

function renderOpsTasks(tasks) {
    // ... existing code ...
    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th style="width:32px;"><input type="checkbox" id="ops-task-select-all"></th>
                    <th>学员昵称</th>
                    <th>分组</th>
                    <th>状态</th>
                    <th>进度</th>
                    <th>回访数</th>
                    <th>来源</th>
                    <th>指派人</th>
                    <th>创建时间</th>
                    <th>备注</th>
                </tr>
            </thead>
            <tbody>
    `;
    tasks.forEach(t => {
        const groups = Array.isArray(t.student_groups) ? t.student_groups.join(', ') : (t.student_groups || '');
        const progress = Array.isArray(t.student_progress) ? t.student_progress.join(', ') : (t.student_progress || '—');
        html += `
            <tr>
                <td><input type="checkbox" class="ops-task-select" data-id="${t.id}"></td>
                <td><a href="javascript:void(0)" onclick="viewStudentDetail('${t.student_id}')">${t.student_nickname || t.student_id}</a></td>
                <td>${groups || '—'}</td>
                <td>${t.status || '—'}</td>
                <td>${progress}</td>
                <td>${t.visit_count ?? 0}</td>
                <td>${t.source || '—'}</td>
                <td>${t.assigned_by || '—'}</td>
                <td>${t.created_at || '—'}</td>
                <td>${t.notes || '—'}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    const container = document.getElementById('ops-task-list');
    if (!container) return;
    container.innerHTML = html;

    // 绑定选择逻辑
    initOpsTaskSelection();
    updateOpsToolbarState();
}

function renderOpsTaskPagination(pagination) {
    const container = document.getElementById('ops-task-pagination');
    if (!container || !pagination) { if (container) container.innerHTML = ''; return; }

    let html = '';
    if (pagination.has_previous) {
        html += `<button class="pagination-btn" onclick="opsChangePage(${pagination.current_page - 1})">上一页</button>`;
    }
    for (let i = 1; i <= pagination.total_pages; i++) {
        const activeClass = i === pagination.current_page ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="opsChangePage(${i})">${i}</button>`;
    }
    if (pagination.has_next) {
        html += `<button class="pagination-btn" onclick="opsChangePage(${pagination.current_page + 1})">下一页</button>`;
    }
    container.innerHTML = html;
}

function opsChangePage(p) {
    loadOpsTasks(p);
}

// ==================== 回访记录管理 - 列表与分页 ====================
function loadVisitRecords(page = 1, search = '', status = '') {
    const params = new URLSearchParams({
        page,
        page_size: 20,
        search,
        status
    });
    fetch(`/operations/visits/?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                showError('加载回访记录失败：' + (data.message || '未知错误'));
                return;
            }
            renderVisitRecords(data.data || []);
            renderVisitPagination(data.pagination || null);
        })
        .catch(err => showError('网络错误：' + err.message));
}

function renderVisitRecords(records) {
    const container = document.getElementById('visit-records-list');
    if (!container) return;
    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📒</div>
                <p>暂无回访记录</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>回访时间</th>
                    <th>学员昵称</th>
                    <th>状态</th>
                    <th>回访次数</th>
                    <th>老师</th>
                    <th>运营</th>
                    <th>备注</th>
                    <th>创建时间</th>
                </tr>
            </thead>
            <tbody>
    `;
    records.forEach(r => {
        html += `
            <tr>
                <td>${r.visit_time || '—'}</td>
                <td><a href="javascript:void(0)" onclick="viewStudentDetail('${r.student_id}')">${r.student_nickname || r.student_id}</a></td>
                <td>${r.status || '—'}</td>
                <td>${r.visit_count ?? 0}</td>
                <td>${r.teacher_name || '—'}</td>
                <td>${r.operator || '—'}</td>
                <td>${r.notes || '—'}</td>
                <td>${r.created_at || '—'}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderVisitPagination(pagination) {
    const container = document.getElementById('visit-pagination');
    if (!container || !pagination) { if (container) container.innerHTML = ''; return; }

    let html = '';
    if (pagination.has_previous) {
        html += `<button class="pagination-btn" onclick="visitsChangePage(${pagination.current_page - 1})">上一页</button>`;
    }
    for (let i = 1; i <= pagination.total_pages; i++) {
        const activeClass = i === pagination.current_page ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="visitsChangePage(${i})">${i}</button>`;
    }
    if (pagination.has_next) {
        html += `<button class="pagination-btn" onclick="visitsChangePage(${pagination.current_page + 1})">下一页</button>`;
    }
    container.innerHTML = html;
}

function visitsChangePage(p) {
    const search = (document.getElementById('visit-search')?.value || '').trim();
    loadVisitRecords(p, search);
}

// ==================== 其他保留逻辑（学员详情等） ====================
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

// 全局：运营任务多选集合（修复 ReferenceError）
const selectedOpsTaskIds = new Set();

function initOpsTaskSelection() {
    const selectAll = document.getElementById('ops-task-select-all');
    const checkboxes = document.querySelectorAll('.ops-task-select');

    // 初始化选中状态
    checkboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        cb.checked = selectedOpsTaskIds.has(id);
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedOpsTaskIds.add(id);
            } else {
                selectedOpsTaskIds.delete(id);
            }
            updateOpsToolbarState();
        });
    });

    // 表头全选
    if (selectAll) {
        // 根据当前行选中状态同步全选框
        const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        selectAll.checked = allChecked;

        selectAll.addEventListener('change', () => {
            const checked = selectAll.checked;
            checkboxes.forEach(cb => {
                cb.checked = checked;
                const id = cb.getAttribute('data-id');
                if (checked) {
                    selectedOpsTaskIds.add(id);
                } else {
                    selectedOpsTaskIds.delete(id);
                }
            });
            updateOpsToolbarState();
        });
    }
}

function updateOpsToolbarState() {
    const count = selectedOpsTaskIds.size;
    const btnComplete = document.getElementById('ops-batch-complete');
    const btnDelete = document.getElementById('ops-batch-delete');
    const btnExport = document.getElementById('ops-export');

    if (btnComplete) btnComplete.disabled = count === 0;
    if (btnDelete) btnDelete.disabled = count === 0;
    if (btnExport) btnExport.disabled = count === 0;
}

function getSelectedTaskIds() {
    return Array.from(selectedOpsTaskIds);
}

async function batchUpdateOpsTasks(newStatusCN) {
    const ids = getSelectedTaskIds();
    if (ids.length === 0) return;
    try {
        await Promise.all(ids.map(id => {
            return fetch(`/operations/tasks/${id}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ status: newStatusCN })
            }).then(res => res.json()).then(r => {
                if (!r.success) throw new Error(r.message || '更新失败');
            });
        }));
        showSuccess('批量更新成功');
        selectedOpsTaskIds.clear();
        loadOpsTasks(1, document.getElementById('ops-task-search')?.value?.trim() || '');
    } catch (e) {
        showError('批量更新失败：' + e.message);
    }
}