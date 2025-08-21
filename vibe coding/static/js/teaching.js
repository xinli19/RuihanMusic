// 睿涵音乐后台管理系统 - 教学模块JavaScript

// 全局变量
let selectedStudents = new Set();
let allTasks = [];
async function addStudentToToday(studentId) {
  try {
    const resp = await fetch("/teaching/tasks/add/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ student_id: studentId }),
    });
    const data = await resp.json();
    if (data.success) {
      alert(data.message || "已添加到今日任务");

      // UX 优化：清空顶部搜索框和结果列表
      const inputEl = document.getElementById("today-add-search-input");
      const resultBox = document.getElementById("today-add-search-result");
      if (inputEl) inputEl.value = "";
      if (resultBox) {
        resultBox.innerHTML = "";
        resultBox.style.display = "none"; // 隐藏白框
      }

      // 刷新今日任务列表
      if (typeof refreshTasks === "function") {
        refreshTasks();
      }
    } else {
      alert("添加失败：" + (data.error || "未知错误"));
    }
  } catch (err) {
    alert("网络错误：" + err.message);
  }
}
// 刷新任务列表
function refreshTasks() {
    fetch('/teaching/tasks/today/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allTasks = data.tasks || [];
                renderTaskList(allTasks);
            } else {
                showError('加载任务失败：' + (data.error || '未知错误'));
            }
        })
        .catch(error => {
            showError('网络错误：' + error.message);
        });
}

// 渲染今日任务为表格
function renderTaskList(tasks) {
    const tbody = document.querySelector('#today-task-table tbody');
    if (!tbody) return;

    if (!tasks || tasks.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="empty-state">暂无今日任务</td></tr>';
        updateToolbarState();
        return;
    }

    let html = '';
    tasks.forEach(task => {
        const difficultTag = task.is_difficult ? '<span style="color:#d32f2f;font-weight:bold;">[困难]</span>' : '';
        const researchCell = task.research_note ? task.research_note : '<span class="placeholder">—</span>';
        const opsCell = task.ops_note ? task.ops_note : '<span class="placeholder">—</span>';

        html += `
            <tr data-student-id="${task.student_id}"${task.is_difficult ? ' class="difficult-row"' : ''}>
                <td><input type="checkbox" class="row-select"></td>
                <td>
                    <div class="title-row">
                        <a href="javascript:void(0)" class="student-link" data-student-id="${task.student_id}">
                            ${difficultTag} ${task.student_name || task.student_id}
                        </a>
                    </div>
                    <div class="subtext" style="font-size:12px;color:#666;">分组：${(task.student_groups || []).join(', ')}</div>
                </td>
                <td>
                    <input type="text" class="input-progress form-input" placeholder="如：6.1, 6.2">
                </td>
                <td>
                    <textarea class="input-comment form-input form-textarea" placeholder="请填写教师评语"></textarea>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // 行内事件绑定
    tbody.querySelectorAll('.row-select').forEach(cb => {
        cb.addEventListener('change', onRowSelectChange);
    });
    // 点击昵称查看详情（请求后端并弹模态）
    tbody.querySelectorAll('.student-link').forEach(a => {
        a.addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            showStudentDetail(studentId);
        });
    });

    updateToolbarState();
}

// 单行选择变化
function onRowSelectChange(e) {
    const tr = e.target.closest('tr');
    const studentId = tr ? tr.getAttribute('data-student-id') : null;
    if (!studentId) return;
    if (e.target.checked) {
        selectedStudents.add(studentId);
    } else {
        selectedStudents.delete(studentId);
    }
    updateToolbarState();
}

// 全选变化
function onSelectAllChange(e) {
    const checked = e.target.checked;
    const rows = document.querySelectorAll('#today-task-table tbody tr');
    rows.forEach(row => {
        const cb = row.querySelector('.row-select');
        if (cb) {
            cb.checked = checked;
            const sid = row.getAttribute('data-student-id');
            if (checked) {
                selectedStudents.add(sid);
            } else {
                selectedStudents.delete(sid);
            }
        }
    });
    updateToolbarState();
}

// 更新工具栏按钮状态
function updateToolbarState() {
    const count = selectedStudents.size;
    const canOperate = count > 0;

    const btns = [
        document.getElementById('btn-push-research'),
        document.getElementById('btn-push-ops'),
        document.getElementById('btn-batch-submit'),
        document.getElementById('btn-batch-delete'),
    ];
    btns.forEach(btn => {
        if (btn) btn.disabled = !canOperate;
    });

    // 同步全选勾选态（当全部选中时，自动勾上）
    const selectAll = document.getElementById('today-select-all');
    if (selectAll) {
        const rows = document.querySelectorAll('#today-task-table tbody tr');
        const totalRows = Array.from(rows).filter(r => r.querySelector('.row-select')).length;
        selectAll.checked = (totalRows > 0 && count === totalRows);
    }
}

// 获取当前选中的学员ID列表
function getSelectedStudentIds() {
    return Array.from(selectedStudents);
}

// 读取某行的输入（进度、评语）
function getRowInputs(studentId) {
    const row = document.querySelector(`#today-task-table tbody tr[data-student-id="${studentId}"]`);
    if (!row) return { progress: '', comment: '' };
    const progressInput = row.querySelector('.input-progress');
    const commentInput = row.querySelector('.input-comment');
    return {
        progress: (progressInput ? progressInput.value.trim() : ''),
        comment: (commentInput ? commentInput.value.trim() : '')
    };
}

// 批量提交点评
function submitSelectedFeedbacks() {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) {
        alert('请先选择要提交点评的学员');
        return;
    }

    // 校验每行必填
    const feedbacks = [];
    for (const sid of ids) {
        const { progress, comment } = getRowInputs(sid);
        if (!progress || !comment) {
            alert('存在未填写「本次进度」或「教师评语」的选中行，请补充后再提交');
            return;
        }
        feedbacks.push({
            student_id: sid,
            lesson_progress: progress,
            teacher_comment: comment
        });
    }

    fetch('/teaching/feedback/submit/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ feedbacks })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // 标记为已提交：禁用输入、样式标识、但不移除行
            ids.forEach(sid => {
                const row = document.querySelector(`#today-task-table tbody tr[data-student-id="${sid}"]`);
                if (!row) return;
                row.classList.add('submitted');
                const cb = row.querySelector('.row-select');
                if (cb) cb.checked = false;
                const progressInput = row.querySelector('.input-progress');
                const commentInput = row.querySelector('.input-comment');
                if (progressInput) progressInput.disabled = true;
                if (commentInput) commentInput.disabled = true;
            });
            selectedStudents.clear();
            updateToolbarState();
            alert(data.message || '提交成功');
        } else {
            alert('提交失败：' + (data.error || '未知错误'));
        }
    })
    .catch(err => {
        alert('网络错误：' + err.message);
    });
}

// 批量删除任务
function batchDeleteTasks() {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) {
        alert('请先选择要删除的任务');
        return;
    }
    if (!confirm(`确定删除 ${ids.length} 个任务吗？`)) return;

    fetch('/teaching/tasks/delete/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ student_ids: ids })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // 删除对应行
            ids.forEach(sid => {
                const row = document.querySelector(`#today-task-table tbody tr[data-student-id="${sid}"]`);
                if (row) row.remove();
            });
            selectedStudents.clear();

            // 若为空，显示空态
            const tbody = document.querySelector('#today-task-table tbody');
            if (tbody && tbody.children.length === 0) {
                tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="empty-state">暂无今日任务</td></tr>';
            }
            updateToolbarState();
            alert(data.message || '删除成功');
        } else {
            alert('删除失败：' + (data.error || '未知错误'));
        }
    })
    .catch(err => {
        alert('网络错误：' + err.message);
    });
}

// 使用模态框批量推送
let currentPushType = null; // 'research' | 'operation'
function openPushModal(type) {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) {
        alert('请先选择要推送的学员');
        return;
    }
    currentPushType = type;
    const modal = document.getElementById('pushModal');
    const title = document.getElementById('pushModalTitle');
    const note = document.getElementById('pushNote');

    if (title) title.textContent = type === 'research' ? '推送至教研部门' : '推送至运营部门';
    if (note) note.value = '';
    if (modal) modal.style.display = 'block';
}

function closePushModal() {
    const modal = document.getElementById('pushModal');
    if (modal) modal.style.display = 'none';
}

function confirmPush() {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) {
        alert('请先选择要推送的学员');
        return;
    }
    const noteInput = document.getElementById('pushNote');
    const note = noteInput ? noteInput.value.trim() : '';
    if (!note) {
        alert('请输入备注信息');
        return;
    }

    const url = currentPushType === 'research' ? '/teaching/push/research/' : '/teaching/push/operation/';
    const payload = currentPushType === 'research'
        ? { student_ids: ids, research_note: note }
        : { student_ids: ids, operation_note: note };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            closePushModal();
            selectedStudents.clear();
            updateToolbarState();
            alert(data.message || '推送成功');
        } else {
            alert('推送失败：' + (data.error || '未知错误'));
        }
    })
    .catch(err => {
        alert('网络错误：' + err.message);
    });
}

// 学员详情（使用模态框，按字段要求渲染）
function showStudentDetail(studentId) {
    fetch(`/teaching/students/${studentId}/`)
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert('获取学员详情失败：' + (data.error || '未知错误'));
                return;
            }
            const info = data.student;
            const content = document.getElementById('studentModalContent');
            const modal = document.getElementById('studentModal');

            function renderProgress(progress) {
                if (!progress || progress.length === 0) return '—';
                if (typeof progress[0] === 'object') {
                    return '<ul style="margin-left:16px;">' + progress.map((p) => {
                        const kv = Object.entries(p || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
                        return `<li>${kv || '[空]'}</li>`;
                    }).join('') + '</ul>';
                }
                return Array.isArray(progress) ? progress.join(', ') : String(progress);
            }

            // 最近点评：优先 feedback_comments（仅评论内容），回退 recent_feedbacks
            let feedbackListHtml = '';
            if (Array.isArray(info.feedback_comments) && info.feedback_comments.length > 0) {
                feedbackListHtml = '<ul style="margin-left:16px;">' +
                    info.feedback_comments.map(c => `<li>${c || ''}</li>`).join('') + '</ul>';
            } else if (Array.isArray(info.recent_feedbacks) && info.recent_feedbacks.length > 0) {
                feedbackListHtml = '<ul style="margin-left:16px;">' +
                    info.recent_feedbacks.map(f =>
                        `<li>【${f.feedback_time}】第${f.lesson_progress} - ${f.teacher_name}：${f.teacher_comment || ''}</li>`
                    ).join('') + '</ul>';
            } else {
                feedbackListHtml = '<ul style="margin-left:16px;"><li>暂无</li></ul>';
            }

            // 回访记录
            let visitListHtml = '';
            if (Array.isArray(info.visit_notes) && info.visit_notes.length > 0) {
                visitListHtml = '<ul style="margin-left:16px;">' +
                    info.visit_notes.map(n => `<li>${n || ''}</li>`).join('') + '</ul>';
            } else {
                visitListHtml = '<ul style="margin-left:16px;"><li>暂无</li></ul>';
            }

            if (content) {
                content.innerHTML = `
                    <div><strong>ID：</strong>${info.student_id}</div>
                    <div><strong>姓名：</strong>${info.student_name || info.name}（${info.nickname || info.alias_name || '无别名'}）</div>
                    <div><strong>分组：</strong>${Array.isArray(info.groups) ? info.groups.join(', ') : (info.groups || '')}</div>
                    <div><strong>进度：</strong>${renderProgress(info.progress)}</div>
                    <div><strong>状态：</strong>${info.status || '—'}</div>
                    <div><strong>学习时长：</strong>${info.learning_hours ?? 0} 小时</div>
                    <div><strong>教研备注：</strong>${info.research_note || info.research_notes || '—'}</div>
                    <div><strong>运营备注：</strong>${info.ops_note || info.operation_notes || '—'}</div>
                    <div style="margin-top:10px;"><strong>最近点评（teacher_comment）：</strong></div>
                    ${feedbackListHtml}
                    <div style="margin-top:10px;"><strong>回访记录（visit_note）：</strong></div>
                    ${visitListHtml}
                `;
            }
            if (modal) modal.style.display = 'block';
        })
        .catch(err => {
            alert('网络错误：' + err.message);
        });
}

function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.style.display = 'none';
}

// 兼容旧函数名（按钮未直接使用时也能正常工作）
function pushToResearch() { openPushModal('research'); }
function pushToOperation() { openPushModal('operation'); }

// 用于CSRF
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

// 统一的初始化函数（无论 DOM 是否已就绪都能执行）
function initTeachingModule() {
    console.log('[teaching.js] init');

    // 先做一次状态归一化：若没有 active 或存在多个 active，只保留一个
    const tabButtons = document.querySelectorAll('.tab-button');
    const panes = document.querySelectorAll('.tab-pane');
    let activeBtn = document.querySelector('.tab-button.active');
    if (!activeBtn && tabButtons.length > 0) {
        activeBtn = tabButtons[0];
        activeBtn.classList.add('active');
    }
    let targetId = activeBtn ? activeBtn.getAttribute('data-tab') : null;
    if (!targetId && panes.length > 0) {
        targetId = panes[0].id;
    }
    panes.forEach(p => {
        if (p.id === targetId) p.classList.add('active');
        else p.classList.remove('active');
    });

    // Tab 切换初始化（移除旧逻辑，统一用该函数控制）
    (function initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const panes = document.querySelectorAll('.tab-pane');
        if (!tabButtons.length || !panes.length) return;
    
        function activateTab(tabId) {
            // 切换按钮 active
            tabButtons.forEach(b => {
                const isActive = b.getAttribute('data-tab') === tabId;
                b.classList.toggle('active', isActive);
            });
            // 切换面板 active（确保只有一个激活）
            panes.forEach(p => {
                const isActive = p.id === tabId;
                p.classList.toggle('active', isActive);
            });

            // 根据激活的面板按需加载数据
            if (tabId === 'todayTasks') {
                refreshTasks();
            } else if (tabId === 'completedComments') {
                loadCompletedFeedbacks(1);
            }
        }
    
        // 初始状态：若没有按钮处于 active，则激活第一个
        let activeBtn = Array.from(tabButtons).find(b => b.classList.contains('active')) || tabButtons[0];
        if (activeBtn) {
            activateTab(activeBtn.getAttribute('data-tab'));
        }
    
        // 点击切换
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = btn.getAttribute('data-tab');
                if (!target) return;
                activateTab(target);
            });
        });
    })();

    // 绑定全选
    const selectAll = document.getElementById('today-select-all');
    if (selectAll) {
        selectAll.addEventListener('change', onSelectAllChange);
    }

    // 批量操作按钮
    const btnPushResearch = document.getElementById('btn-push-research');
    if (btnPushResearch) {
        btnPushResearch.addEventListener('click', () => openPushModal('research'));
    }
    const btnPushOps = document.getElementById('btn-push-ops');
    if (btnPushOps) {
        btnPushOps.addEventListener('click', () => openPushModal('operation'));
    }
    const btnBatchSubmit = document.getElementById('btn-batch-submit');
    if (btnBatchSubmit) {
        btnBatchSubmit.addEventListener('click', submitSelectedFeedbacks);
    }
    const btnBatchDelete = document.getElementById('btn-batch-delete');
    if (btnBatchDelete) {
        btnBatchDelete.addEventListener('click', batchDeleteTasks);
    }

    // 加载“已点评记录”
    function loadCompletedFeedbacks(page = 1) {
        fetch(`/teaching/feedback/completed/?page=${page}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    showError('加载已点评记录失败：' + (data.error || '未知错误'));
                    return;
                }
                renderCompletedFeedbacks(data);
            })
            .catch(err => showError('网络错误：' + err.message));
    }

    // 渲染“已点评记录”
    function renderCompletedFeedbacks(data) {
        const tbody = document.querySelector('#completed-table tbody');
        const pager = document.getElementById('completed-pagination');
        if (!tbody) return;
    
        const list = data.feedbacks || [];
        if (list.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="empty-state">暂无记录</td></tr>';
        } else {
            const rows = list.map(item => {
                const progressText = Array.isArray(item.progress) ? item.progress.join(', ') : (item.progress || '');
                return `
                    <tr>
                        <td>${item.reply_time || ''}</td>
                        <td>${item.student_name || ''}</td>
                        <td>${progressText}</td>
                        <td>${item.teacher_name || ''}</td>
                        <td>${item.teacher_comment || ''}</td>
                        <td>${item.push_research ? '<span title="'+item.push_research+'">有备注</span>' : '—'}</td>
                        <td>${item.push_ops ? '<span title="'+item.push_ops+'">有备注</span>' : '—'}</td>
                    </tr>
                `;
            }).join('');
            tbody.innerHTML = rows;
        }
    
        if (pager) {
            const prevDisabled = !data.has_previous;
            const nextDisabled = !data.has_next;
            pager.innerHTML = `
                <button class="btn btn-secondary" data-page="${data.current_page - 1}" ${prevDisabled ? 'disabled' : ''}>上一页</button>
                <span style="margin:0 8px;">第 ${data.current_page} / ${data.total_pages} 页</span>
                <button class="btn btn-secondary" data-page="${data.current_page + 1}" ${nextDisabled ? 'disabled' : ''}>下一页</button>
            `;
            pager.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const p = parseInt(e.currentTarget.getAttribute('data-page'), 10);
                    if (!isNaN(p)) loadCompletedFeedbacks(p);
                });
            });
        }
    }

    // 移除旧版本中对 loadRecentFeedbacks / 手动点评表单的绑定，按新骨架处理
    // 手动点评 - 搜索与结果渲染、选择
    const manualSearchInput = document.getElementById('manual-search-input');
    const manualSearchBtn = document.getElementById('manual-search-btn');
    const manualResultTbody = document.querySelector('#manual-search-result tbody');
    const manualSelectedSpan = document.getElementById('manual-selected-student');
    const manualSubmitBtn = document.getElementById('manual-submit');
    let manualSelected = null;

    function renderManualSearchResults(list) {
        if (!manualResultTbody) return;
        if (!list || list.length === 0) {
            manualResultTbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="empty-state">未找到匹配学员</td></tr>';
            return;
        }
        const rows = list.map(item => {
            const groupsText = Array.isArray(item.groups) ? item.groups.join(', ') : (item.groups || '');
            return `
                <tr data-student-id="${item.student_id}" data-student-name="${item.student_name}">
                    <td style="width:40px;">
                        <input type="radio" name="manual-select" class="manual-select" data-student-id="${item.student_id}" data-student-name="${item.student_name}">
                    </td>
                    <td>${item.student_name || ''}</td>
                    <td>${groupsText}</td>
                    <td>${item.status || ''}</td>
                    <td>${item.current_progress || '—'}</td>
                </tr>
            `;
        }).join('');
        manualResultTbody.innerHTML = rows;

        // 绑定选择事件
        manualResultTbody.querySelectorAll('.manual-select').forEach(r => {
            r.addEventListener('change', (e) => {
                const sid = e.target.getAttribute('data-student-id');
                const sname = e.target.getAttribute('data-student-name');
                manualSelected = { student_id: sid, student_name: sname };
                if (manualSelectedSpan) {
                    manualSelectedSpan.textContent = `${sname}（ID: ${sid}）`;
                }
                if (manualSubmitBtn) {
                    manualSubmitBtn.disabled = false; // 选择后允许提交
                }
            });
        });
    }

    function manualSearch() {
        if (!manualSearchInput) return;
        const q = manualSearchInput.value.trim();
        if (q.length < 2) {
            renderManualSearchResults([]);
            return;
        }
        fetch(`/teaching/students/search/?q=${encodeURIComponent(q)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    showError('搜索学员失败：' + (data.error || '未知错误'));
                    return;
                }
                renderManualSearchResults(data.students || []);
            })
            .catch(err => showError('网络错误：' + err.message));
    }

    if (manualSearchBtn) {
        manualSearchBtn.addEventListener('click', manualSearch);
    }
    if (manualSearchInput) {
        manualSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                manualSearch();
            }
        });
    }
}

// 在脚本解析时立即打点，确认 teaching.js 被正确加载
console.log('[teaching.js] loaded');

// 如果 DOM 还在加载，监听 DOMContentLoaded；否则立即初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeachingModule);
} else {
    initTeachingModule();
}

// 搜索并添加到今日任务（今日任务面板顶部）
(function initTodayAddSearch() {
    const input = document.getElementById('today-add-search-input');
    const btn = document.getElementById('today-add-search-btn');
    const resultBox = document.getElementById('today-add-search-result');

    function renderTodayAddSearchResults(list) {
        if (!resultBox) return;
        // 有发起搜索（无论是否有结果）都显示容器
        resultBox.style.display = 'block';

        if (!list || list.length === 0) {
            resultBox.innerHTML = '<div class="empty-state" style="padding:8px;color:#666;">未找到匹配学员</div>';
            return;
        }
        const rows = list.map(item => {
            const displayName = item.student_name || item.alias_name || item.student_id;
            const groups = (item.groups || []).join(', ');
            return `
                <div class="search-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;">
                    <div>
                        <strong>${displayName}</strong>
                        <span style="color:#888;margin-left:6px;">ID: ${item.student_id}</span>
                        <span style="color:#888;margin-left:6px;">分组：${groups || '—'}</span>
                    </div>
                    <button class="btn btn-sm btn-primary btn-add-today" data-student-id="${item.student_id}">添加到今日任务</button>
                </div>
            `;
        }).join('');
        resultBox.innerHTML = rows;

        resultBox.querySelectorAll('.btn-add-today').forEach(b => {
            b.addEventListener('click', async (e) => {
                const sid = e.currentTarget.getAttribute('data-student-id');
                await addStudentToToday(sid);
            });
        });
    }

    async function todayAddSearch() {
        const q = (input && input.value || '').trim();
        if (!resultBox) return;
        // 改为：小于1（即为空）才隐藏
        if (q.length < 1) {
            resultBox.innerHTML = '';
            resultBox.style.display = 'none';
            return;
        }
        try {
            const resp = await fetch(`/teaching/students/search/?q=${encodeURIComponent(q)}`);
            const data = await resp.json();
            renderTodayAddSearchResults((data && data.students) || []);
        } catch (err) {
            // 搜索失败也显示容器提示
            resultBox.style.display = 'block';
            resultBox.innerHTML = '<div class="empty-state" style="padding:8px;color:#c00;">搜索失败，请稍后重试</div>';
        }
    }

    // 防抖函数
    function debounce(fn, delay) {
        let timer = null;
        return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), delay);
        };
    }

    // 输入框：300ms 防抖搜索（非空就搜索，空则隐藏）
    const debouncedSearch = debounce(() => {
        const q = (input && input.value || '').trim();
        if (!q) {
            if (resultBox) {
                resultBox.innerHTML = '';
                resultBox.style.display = 'none'; // 输入清空时隐藏
            }
            return;
        }
        // 只要有1个字符就搜索
        todayAddSearch();
    }, 300);

    if (btn) btn.addEventListener('click', todayAddSearch);
    if (input) {
        input.addEventListener('input', debouncedSearch);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                todayAddSearch();
            }
        });
    }
})();

// 新增/更新：添加学员到今日任务（成功后清空搜索输入和结果）


// ... existing code ...