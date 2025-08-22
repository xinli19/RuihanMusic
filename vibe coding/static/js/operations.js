// 睿涵音乐后台管理系统 - 运营模块JavaScript（重写版）

// -------------------- 全局状态 --------------------
let hasInitStudentMgr = false;
let hasInitOpsTab = false;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
});

// -------------------- 工具函数 --------------------
function showSuccess(msg) {
  alert("成功：" + msg);
}
function showError(msg) {
  alert("错误：" + msg);
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function formatArrayText(val) {
  if (!val) return "—";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

// -------------------- Tab 初始化 --------------------
function initTabs() {
  const header = document.querySelector(".tab-header");
  if (!header) return;

  const activate = (id, btn) => {
    document
      .querySelectorAll(".tab-button")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-pane")
      .forEach((p) => p.classList.remove("active"));
    if (btn) btn.classList.add("active");
    const pane = document.getElementById(id);
    if (pane) pane.classList.add("active");

    if (id === "studentManagement" && !hasInitStudentMgr) {
      initStudentManagement();
      hasInitStudentMgr = true;
    }
    if (id === "opsTaskManagement" && !hasInitOpsTab) {
      initOpsTaskTab();
      hasInitOpsTab = true;
    }
  };

  header.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-button");
    if (!btn) return;
    const id = btn.getAttribute("data-tab");
    if (!id) return;
    activate(id, btn);
  });

  header.addEventListener("keydown", (e) => {
    const btn = e.target.closest(".tab-button");
    if (!btn) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const id = btn.getAttribute("data-tab");
      if (!id) return;
      activate(id, btn);
    }
  });

  // 默认激活当前已有的 active
  const activeBtn = header.querySelector(".tab-button.active");
  if (activeBtn) {
    activate(activeBtn.getAttribute("data-tab"), activeBtn);
  }
}

// -------------------- 学员信息管理 --------------------
function initStudentManagement() {
  const input = document.getElementById("student-mgr-search");
  const btn = document.getElementById("student-mgr-search-btn");
  const box = document.getElementById("student-mgr-results");
  if (!input || !btn || !box) return;

  // 初始化：未搜索时隐藏结果容器
  box.style.display = "none";

  const doSearch = async () => {
    const q = input.value.trim();

    // 搜索中：显示加载态
    box.style.display = "block";
    box.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>搜索中...</p></div>';

    try {
      const list = await fetchStudents(q);
      // 成功后：渲染结果并保持容器可见
      renderStudentMgrResults(list);
      box.style.display = "block";
    } catch (e) {
      // 失败：显示错误但保持容器可见，便于用户反馈
      box.innerHTML = `<div class="operations-empty-state">搜索失败：${e.message}</div>`;
      box.style.display = "block";
    }
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

async function fetchStudents(query) {
  const params = new URLSearchParams({ page: 1, page_size: 20 });
  if (query) params.set("search", query);
  const res = await fetch(`/operations/students/api/?${params.toString()}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "获取学员失败");
  return Array.isArray(data.data) ? data.data : [];
}

function renderStudentMgrResults(students) {
  const box = document.getElementById("student-mgr-results");
  if (!box) return;
  if (!students.length) {
    box.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>未找到匹配的学员</p>
            </div>
        `;
    return;
  }

  let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>学员昵称</th>
                    <th>ID</th>
                    <th>备注名</th>
                    <th>分组</th>
                    <th>创建时间</th>
                    <th style="width:260px;">操作</th>
                </tr>
            </thead>
            <tbody>
    `;
  students.forEach((s) => {
    html += `
            <tr>
                <td><a href="javascript:void(0)" class="js-stu-name" data-id="${s.id}" style="color:#1677ff; text-decoration:none; cursor:pointer;">${s.student_name || s.name || "—"}</a></td>
                <td>${s.id || s.student_id || "—"}</td>
                <td>${s.alias_name || "—"}</td>
                <td>${formatArrayText(s.groups)}</td>
                <td>${s.created_at || "—"}</td>
                <td>
                    <button class="btn btn-warning js-edit-stu" data-id="${s.id}" style="margin-left:6px;">编辑</button>
                    <button class="btn btn-success js-add-task" data-id="${s.id}" style="margin-left:6px;">手动增加任务</button>
                </td>
            </tr>
        `;
  });
  html += "</tbody></table>";
  box.innerHTML = html;

  // 学员昵称点击打开详情抽屉
  box.querySelectorAll(".js-stu-name").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      viewStudentDetail(id);
    });
  });

  box.querySelectorAll(".js-edit-stu").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      openEditStudentModal(id);
    });
  });
  box.querySelectorAll(".js-add-task").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      await addOpsTaskForStudent(id);
    });
  });
}

// 学员详情（模态框展示）
function viewStudentDetail(studentId) {
  fetch(`/operations/students/${studentId}/`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message || "获取学员详情失败");
      const s = data.student || data.data || data.student_payload || {};
      // 改为使用“抽屉式侧滑”而非弹窗
      showStudentDetailDrawer(s);
    })
    .catch((e) => showError("获取学员详情失败：" + e.message));
}

function showStudentDetailModal(student) {
  const modal = document.getElementById("studentDetailModal");
  const content = document.getElementById("studentDetailModalContent");
  if (!modal || !content) {
    showError("学员详情模态框未找到");
    return;
  }

  const groups = Array.isArray(student.groups)
    ? student.groups.join(", ")
    : student.groups || "—";
  const progress = (() => {
    const p = student.progress || student.learning_progress || [];
    if (!p || !p.length) return "—";
    if (typeof p[0] === "object") {
      return (
        '<ul style="margin-left:16px;">' +
        p
          .map((o) => {
            const kv = Object.entries(o || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            return `<li>${kv || ""}</li>`;
          })
          .join("") +
        "</ul>"
      );
    }
    return Array.isArray(p) ? p.join(", ") : String(p);
  })();
  const feedbackListHtml =
    Array.isArray(student.feedback_comments) && student.feedback_comments.length
      ? '<ul style="margin-left:16px;">' +
        student.feedback_comments.map((c) => `<li>${c || ""}</li>`).join("") +
        "</ul>"
      : Array.isArray(student.recent_feedbacks) &&
        student.recent_feedbacks.length
      ? '<ul style="margin-left:16px;">' +
        student.recent_feedbacks
          .map(
            (f) =>
              `<li>【${f.feedback_time}】第${f.lesson_progress} - ${
                f.teacher_name
              }：${f.teacher_comment || ""}</li>`
          )
          .join("") +
        "</ul>"
      : '<ul style="margin-left:16px;"><li>暂无</li></ul>';
  const visitListHtml =
    Array.isArray(student.visit_notes) && student.visit_notes.length
      ? '<ul style="margin-left:16px;">' +
        student.visit_notes.map((n) => `<li>${n || ""}</li>`).join("") +
        "</ul>"
      : '<ul style="margin-left:16px;"><li>暂无</li></ul>';

  content.innerHTML = `
        <div><strong>ID：</strong>${
          student.student_id || student.id || ""
        }</div>
        <div><strong>姓名：</strong>${
          student.student_name || student.name || ""
        }（${student.alias_name || student.nickname || "无别名"}）</div>
        <div><strong>分组：</strong>${groups}</div>
        <div><strong>进度：</strong>${progress}</div>
        <div><strong>状态：</strong>${student.status || "—"}</div>
        <div><strong>学习时长：</strong>${
          student.learning_hours ?? student.total_study_time ?? 0
        } 小时</div>
        <div><strong>教研备注：</strong>${
          student.research_note || student.research_notes || "—"
        }</div>
        <div><strong>运营备注：</strong>${
          student.ops_note ||
          student.operation_notes ||
          student.operation_note ||
          "—"
        }</div>
        <div style="margin-top:10px;"><strong>最近点评：</strong></div>
        ${feedbackListHtml}
        <div style="margin-top:10px;"><strong>回访记录（摘要）：</strong></div>
        ${visitListHtml}
    `;

  modal.style.display = "block";
}

function closeStudentDetailModal() {
  const modal = document.getElementById("studentDetailModal");
  if (modal) modal.style.display = "none";
}

// -------------------- 添加/编辑学员（模态） --------------------
function openAddStudentModal() {
  const modal = document.getElementById("studentModal");
  const modalTitle = document.getElementById("modalTitle");
  const form = document.getElementById("studentForm");
  if (!modal || !modalTitle || !form) return;

  modalTitle.textContent = "添加学员";
  form.reset();
  document.getElementById("studentId").value = "";

  modal.style.display = "block";
  form.onsubmit = (e) => {
    e.preventDefault();
    submitStudentForm(false);
  };
}

function openEditStudentModal(studentId) {
  const modal = document.getElementById("studentModal");
  const modalTitle = document.getElementById("modalTitle");
  const form = document.getElementById("studentForm");
  if (!modal || !modalTitle || !form) return;

  modalTitle.textContent = "编辑学员";
  fetch(`/operations/students/${studentId}/`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message || "获取学员失败");
      const s = data.student || data.data || {};
      document.getElementById("studentId").value = s.id || "";
      document.getElementById("studentName").value = s.student_name || "";
      document.getElementById("aliasName").value = s.alias_name || "";
      document.getElementById("groupName").value = Array.isArray(s.groups)
        ? s.groups.join(", ")
        : s.groups || "";
      document.getElementById("status").value = s.status || "active";
      modal.style.display = "block";
      form.onsubmit = (e) => {
        e.preventDefault();
        submitStudentForm(true);
      };
    })
    .catch((e) => showError("获取学员失败：" + e.message));
}

function closeStudentModal() {
  const modal = document.getElementById("studentModal");
  if (modal) modal.style.display = "none";
}

function submitStudentForm(isEdit) {
  const form = document.getElementById("studentForm");
  const fd = new FormData(form);
  const data = {
    student_name: fd.get("student_name"),
    alias_name: fd.get("alias_name"),
    groups: fd.get("group_name")
      ? fd
          .get("group_name")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    status: fd.get("status"),
  };
  let url = "";
  if (isEdit) {
    const studentId = fd.get("student_id");
    url = `/operations/students/${studentId}/update/`;
    // 可选：更新 external_user_id（如果有该字段）
    const ext = fd.get("external_user_id");
    if (ext) data.external_user_id = ext;
  } else {
    const ext = prompt("请输入用户ID（必填）：");
    if (!ext) {
      showError("用户ID为必填项");
      return;
    }
    data.external_user_id = ext;
    url = "/operations/students/create/";
  }

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken"),
    },
    body: JSON.stringify(data),
  })
    .then((r) => r.json())
    .then((d) => {
      if (!d.success) throw new Error(d.message || "保存失败");
      showSuccess(isEdit ? "学员信息更新成功" : "学员创建成功");
      closeStudentModal();
    })
    .catch((e) => showError("保存失败：" + e.message));
}

// -------------------- 学员批量导入（与搜索、导出分离） --------------------
function openBatchImportModal() {
  const modal = document.getElementById("batchImportModal");
  const resBox = document.getElementById("batchImportResult");
  const file = document.getElementById("importFile");
  if (resBox) resBox.innerHTML = "";
  if (file) file.value = "";
  if (modal) modal.style.display = "block";
}

function closeBatchImportModal() {
  const modal = document.getElementById("batchImportModal");
  if (modal) modal.style.display = "none";
}

async function submitBatchImport() {
  const fileInput = document.getElementById("importFile");
  const resBox = document.getElementById("batchImportResult");
  if (!fileInput || !fileInput.files || !fileInput.files.length) {
    showError("请选择要上传的 .xlsx 文件");
    return;
  }
  const file = fileInput.files[0];
  const fd = new FormData();
  fd.append("file", file);

  resBox.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>导入中...</p></div>';
  try {
    const resp = await fetch("/operations/students/batch-import/", {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") },
      body: fd
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.message || "导入失败");

    const r = data.result || {};
    const logs = Array.isArray(r.error_logs) ? r.error_logs : [];
    resBox.innerHTML = `
      <div class="operations-empty-state" style="text-align:left;">
        <p>导入完成：新增 ${r.success_count || 0}，更新 ${r.update_count || 0}，失败 ${r.error_count || 0}</p>
        ${logs.length ? `<details><summary>错误日志（${logs.length}）</summary><ul style="margin-top:6px;">${logs.map(x=>`<li>${x}</li>`).join("")}</ul></details>` : ""}
      </div>
    `;
    showSuccess("批量导入成功");
  } catch (e) {
    resBox.innerHTML = `<div class="operations-empty-state">导入失败：${e.message}</div>`;
    showError("导入失败：" + e.message);
  }
}

// -------------------- 学员导出（与搜索、导入分离） --------------------
async function exportStudents() {
  try {
    const input = document.getElementById("student-mgr-search");
    const q = input ? input.value.trim() : "";
    const pageSize = 200;
    let page = 1;
    let totalPages = 1;
    const rows = [];
    // 表头
    rows.push(["ID","用户ID","昵称","备注名","分组","创建时间","状态","累计学习时长(分钟)"]); 

    do {
      const params = new URLSearchParams({
        page: page,
        page_size: pageSize,
        sort: "created_at",
        order: "desc"
      });
      if (q) params.set("search", q);

      const resp = await fetch(`/operations/students/api/?${params.toString()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || "获取学员列表失败");

      const list = Array.isArray(data.data) ? data.data : [];
      list.forEach(s => {
        rows.push([
          s.id || "",
          s.external_user_id || "",
          s.student_name || s.name || "",
          s.alias_name || "",
          Array.isArray(s.groups) ? s.groups.join("|") : (s.groups || ""),
          s.created_at || "",
          s.status || "",
          (s.total_study_time || 0)
        ]);
      });

      const p = data.pagination || {};
      totalPages = p.total_pages || 1;
      page = (p.current_page || page) + 1;
    } while (page <= totalPages);

    // 生成 CSV
    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    a.href = url;
    a.download = `students_export_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("导出完成");
  } catch (e) {
    showError("导出失败：" + e.message);
  }
}

// -------------------- 运营任务管理 --------------------
function initOpsTaskTab() {
  // 仅初始化运营任务列表 + 批量操作
  loadOpsTasks(1);

  // 批量“删除”（实际为批量关闭）
  const btnDelete = document.getElementById("ops-batch-delete");
  const btnExport = document.getElementById("ops-export");
  if (btnDelete) btnDelete.addEventListener("click", () => batchUpdateOpsTasks("已关闭"));
  if (btnExport)
    btnExport.addEventListener("click", () => {
      const ids = getSelectedTaskIds();
      if (!ids.length) return;
      const blob = new Blob([ids.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ops_tasks_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
}

function renderOpsStudentSearchResults(students) {
  const box = document.getElementById("ops-student-results");
  if (!box) return;
  if (!students.length) {
    box.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>未找到匹配的学员</p>
            </div>
        `;
    return;
  }
  let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>学员昵称</th>
                    <th>ID</th>
                    <th>分组</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;
  students.forEach((s) => {
    html += `
            <tr>
                <td>${s.student_name || s.name || "—"}</td>
                <td>${s.id || s.student_id || "—"}</td>
                <td>${formatArrayText(s.groups)}</td>
                <td><button class="btn btn-success js-add-task" data-id="${
                  s.id
                }">手动增加任务</button></td>
            </tr>
        `;
  });
  html += "</tbody></table>";
  box.innerHTML = html;

  box.querySelectorAll(".js-add-task").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      await addOpsTaskForStudent(id);
      // 成功后清空搜索区
      const input = document.getElementById("ops-student-search");
      if (input) input.value = "";
      box.innerHTML = "";
      // 刷新任务列表
      loadOpsTasks(1);
    });
  });
}

async function addOpsTaskForStudent(studentId) {
  try {
    const res = await fetch("/operations/tasks/manual/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ student_id: studentId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "添加失败");
    showSuccess("已添加到运营任务");
  } catch (e) {
    showError("添加失败：" + e.message);
  }
}

function loadOpsTasks(page = 1, search = "", status = "") {
  const params = new URLSearchParams({ page, page_size: 20 });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  fetch(`/operations/tasks/api/?${params.toString()}`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message || "加载失败");
      renderOpsTasks(Array.isArray(data.data) ? data.data : []);
      renderOpsTaskPagination(data.pagination || null);
    })
    .catch((e) => showError("加载运营任务失败：" + e.message));
}

function renderOpsTasks(tasks) {
  const container = document.getElementById("ops-task-list");
  if (!container) return;
  if (!tasks.length) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🗂️</div>
                <p>暂无运营任务</p>
            </div>
        `;
    return;
  }
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
                    <th>回访备注</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;
  tasks.forEach((t) => {
    const groups = formatArrayText(t.student_groups);
    const progress = formatArrayText(t.student_progress);
    html += `
            <tr>
                <td><input type="checkbox" class="ops-task-select" data-id="${
                  t.id
                }"></td>
                <td><a href="javascript:void(0)" onclick="viewStudentDetail('${
                  t.student_id
                }')">${t.student_nickname || t.student_id}</a></td>
                <td>${groups}</td>
                <td>
                    <select id="ops-status-${
                      t.id
                    }" class="form-input" style="min-width:100px;">
                        <option value="待办" ${
                          t.status === "待办" ? "selected" : ""
                        }>待办</option>
                        <option value="已联系" ${
                          t.status === "已联系" ? "selected" : ""
                        }>已联系</option>
                        <option value="未回复" ${
                          t.status === "未回复" ? "selected" : ""
                        }>未回复</option>
                        <option value="已关闭" ${
                          t.status === "已关闭" ? "selected" : ""
                        }>已关闭</option>
                    </select>
                </td>
                <td>${progress || "—"}</td>
                <td>${t.visit_count ?? 0}</td>
                <td>${t.source || "—"}</td>
                <td>${t.assigned_by || "—"}</td>
                <td>${t.created_at || "—"}</td>
                <td><input id="ops-note-${
                  t.id
                }" type="text" class="form-input" placeholder="填写回访备注" value="${
      t.notes || ""
    }" /></td>
                <td><button class="btn btn-primary" onclick="saveOpsTaskEdit(${
                  t.id
                })">保存</button></td>
            </tr>
        `;
  });
  html += "</tbody></table>";
  container.innerHTML = html;

  initOpsTaskSelection();
  updateOpsToolbarState();
}

function renderOpsTaskPagination(pagination) {
  const container = document.getElementById("ops-task-pagination");
  if (!container) return;
  if (!pagination) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  if (pagination.has_previous) {
    html += `<button class="pagination-btn" onclick="opsChangePage(${
      pagination.current_page - 1
    })">上一页</button>`;
  }
  for (
    let i = 1;
    i <= (pagination.total_pages || pagination.num_pages || 1);
    i++
  ) {
    const active = i === pagination.current_page ? "active" : "";
    html += `<button class="pagination-btn ${active}" onclick="opsChangePage(${i})">${i}</button>`;
  }
  if (pagination.has_next) {
    html += `<button class="pagination-btn" onclick="opsChangePage(${
      pagination.current_page + 1
    })">下一页</button>`;
  }
  container.innerHTML = html;
}
function opsChangePage(p) {
  loadOpsTasks(p);
}

// 多选逻辑
const selectedOpsTaskIds = new Set();
function initOpsTaskSelection() {
  const selectAll = document.getElementById("ops-task-select-all");
  const checkboxes = document.querySelectorAll(".ops-task-select");

  checkboxes.forEach((cb) => {
    const id = cb.getAttribute("data-id");
    cb.checked = selectedOpsTaskIds.has(id);
    cb.addEventListener("change", () => {
      if (cb.checked) selectedOpsTaskIds.add(id);
      else selectedOpsTaskIds.delete(id);
      updateOpsToolbarState();
    });
  });

  if (selectAll) {
    const allChecked =
      checkboxes.length > 0 && Array.from(checkboxes).every((cb) => cb.checked);
    selectAll.checked = allChecked;
    selectAll.addEventListener("change", () => {
      const checked = selectAll.checked;
      checkboxes.forEach((cb) => {
        cb.checked = checked;
        const id = cb.getAttribute("data-id");
        if (checked) selectedOpsTaskIds.add(id);
        else selectedOpsTaskIds.delete(id);
      });
      updateOpsToolbarState();
    });
  }
}
function updateOpsToolbarState() {
  const count = selectedOpsTaskIds.size;
  const btnDelete = document.getElementById("ops-batch-delete");
  const btnExport = document.getElementById("ops-export");
  if (btnDelete) btnDelete.disabled = count === 0;
  if (btnExport) btnExport.disabled = count === 0;
}
function getSelectedTaskIds() {
  return Array.from(selectedOpsTaskIds);
}

async function batchUpdateOpsTasks(newStatusCN) {
  const ids = getSelectedTaskIds();
  if (!ids.length) return;
  try {
    await Promise.all(
      ids.map((id) =>
        fetch(`/operations/tasks/${id}/update/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          body: JSON.stringify({ status: newStatusCN }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (!d.success) throw new Error(d.message || "更新失败");
          })
      )
    );
    showSuccess("批量更新成功");
    selectedOpsTaskIds.clear();
    loadOpsTasks(1);
  } catch (e) {
    showError("批量更新失败：" + e.message);
  }
}

async function saveOpsTaskEdit(taskId) {
  const statusEl = document.getElementById(`ops-status-${taskId}`);
  const noteEl = document.getElementById(`ops-note-${taskId}`);
  if (!statusEl || !noteEl) return;

  try {
    const res = await fetch(`/operations/tasks/${taskId}/update/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({
        status: statusEl.value,
        notes: noteEl.value.trim(),
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "更新失败");
    showSuccess("保存成功");
    loadOpsTasks(1);
  } catch (e) {
    showError("保存失败：" + e.message);
  }
}

// -------------------- 回访记录管理（点击学员 -> 下方展示信息+历史记录） --------------------
function initVisitRecordsTab() {
  const input = document.getElementById("visit-mgr-search");
  const btn = document.getElementById("visit-mgr-search-btn");
  const box = document.getElementById("visit-mgr-results");
  if (!input || !btn || !box) return;

  const doSearch = async () => {
    const q = input.value.trim();
    box.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>搜索中...</p></div>';
    try {
      const list = await fetchStudents(q);
      renderVisitMgrStudentResults(list);
    } catch (e) {
      box.innerHTML = `<div class="operations-empty-state">搜索失败：${e.message}</div>`;
    }
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

function renderVisitMgrStudentResults(students) {
  const box = document.getElementById("visit-mgr-results");
  if (!box) return;
  if (!students.length) {
    box.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>未找到匹配的学员</p>
            </div>
        `;
    return;
  }
  let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>学员昵称</th>
                    <th>ID</th>
                    <th>备注名</th>
                    <th>分组</th>
                    <th style="width:160px;">操作</th>
                </tr>
            </thead>
            <tbody>
    `;
  students.forEach((s) => {
    html += `
            <tr>
                <td>${s.student_name || s.name || "—"}</td>
                <td>${s.id || s.student_id || "—"}</td>
                <td>${s.alias_name || "—"}</td>
                <td>${formatArrayText(s.groups)}</td>
                <td><button class="btn btn-primary js-visit-detail" data-id="${
                  s.id
                }" data-name="${
      s.student_name || s.name || ""
    }">查看详情</button></td>
            </tr>
        `;
  });
  html += "</tbody></table>";
  box.innerHTML = html;

  box.querySelectorAll(".js-visit-detail").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const sid = e.currentTarget.getAttribute("data-id");
      const sname = e.currentTarget.getAttribute("data-name") || "";
      await loadVisitStudentPanel(sid, sname);
    });
  });
}

async function loadVisitStudentPanel(studentId, studentNameHint = "") {
  const box = document.getElementById("visit-mgr-results");
  if (!box) return;

  // 1) 学员详情
  let student;
  try {
    const r = await fetch(`/operations/students/${studentId}/`);
    const d = await r.json();
    if (!d.success) throw new Error(d.message || "获取学员失败");
    student = d.student || d.data || d.student_payload || {};
  } catch (e) {
    showError("获取学员详情失败：" + e.message);
    return;
  }

  const nickname =
    student.student_name || student.name || studentNameHint || "";
  const groups = Array.isArray(student.groups)
    ? student.groups.join(", ")
    : student.groups || "—";
  const progress = (() => {
    const p = student.progress || student.learning_progress || [];
    if (!p || !p.length) return "—";
    if (typeof p[0] === "object") {
      return (
        '<ul style="margin-left:16px;">' +
        p
          .map((o) => {
            const kv = Object.entries(o || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            return `<li>${kv || ""}</li>`;
          })
          .join("") +
        "</ul>"
      );
    }
    return Array.isArray(p) ? p.join(", ") : String(p);
  })();

  // 2) 历史回访记录（后端不支持 student_id 查询，这里用昵称搜索再前端用 student_id 精确过滤）
  let visitRecords = [];
  try {
    const ps = new URLSearchParams({ page: 1, page_size: 100 });
    if (nickname) ps.set("search", nickname);
    const rr = await fetch(`/operations/visits/?${ps.toString()}`);
    const rd = await rr.json();
    if (!rd.success) throw new Error(rd.message || "获取回访记录失败");
    const all = Array.isArray(rd.data) ? rd.data : [];
    visitRecords = all.filter(
      (v) => String(v.student_id) === String(studentId)
    );
  } catch (e) {
    showError("获取回访记录失败：" + e.message);
  }

  // 3) 渲染学员信息 + 回访记录列表
  let visitsHtml = "";
  if (!visitRecords.length) {
    visitsHtml = `
            <div class="empty-state">
                <div class="empty-state-icon">📒</div>
                <p>暂无回访记录</p>
            </div>
        `;
  } else {
    visitsHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>回访时间</th>
                        <th>状态</th>
                        <th>回访次数</th>
                        <th>老师</th>
                        <th>备注</th>
                        <th>创建时间</th>
                    </tr>
                </thead>
                <tbody>
                    ${visitRecords
                      .map(
                        (r) => `
                        <tr>
                            <td>${r.visit_time || "—"}</td>
                            <td>${r.status || "—"}</td>
                            <td>${r.visit_count ?? 0}</td>
                            <td>${r.teacher_name || "—"}</td>
                            <td>${r.notes || "—"}</td>
                            <td>${r.created_at || "—"}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        `;
  }

  box.innerHTML = `
        <div style="margin:8px 0;">
            <button class="btn btn-secondary" id="visit-back">返回搜索结果</button>
        </div>
        <div class="card" style="margin-top:8px;">
            <div class="card-header"><strong>学员信息</strong></div>
            <div class="card-body">
                <div><strong>ID：</strong>${
                  student.student_id || student.id || ""
                }</div>
                <div><strong>姓名：</strong>${nickname}（${
    student.alias_name || "无别名"
  }）</div>
                <div><strong>分组：</strong>${groups}</div>
                <div><strong>进度：</strong>${progress}</div>
                <div><strong>状态：</strong>${student.status || "—"}</div>
                <div><strong>学习时长：</strong>${
                  student.learning_hours ?? student.total_study_time ?? 0
                } 小时</div>
                <div><strong>教研备注：</strong>${
                  student.research_note || student.research_notes || "—"
                }</div>
                <div><strong>运营备注：</strong>${
                  student.ops_note ||
                  student.operation_notes ||
                  student.operation_note ||
                  "—"
                }</div>
            </div>
        </div>
        <div class="card" style="margin-top:12px;">
            <div class="card-header"><strong>历史回访记录</strong></div>
            <div class="card-body">
                ${visitsHtml}
            </div>
        </div>
    `;

  const backBtn = document.getElementById("visit-back");
  if (backBtn) {
    backBtn.addEventListener("click", async () => {
      // 返回时，复用当前输入框的关键词重新搜索
      const input = document.getElementById("visit-mgr-search");
      const q = input ? input.value.trim() : "";
      const list = await fetchStudents(q);
      renderVisitMgrStudentResults(list);
    });
  }
}

// -------------------- 关闭编辑回访记录弹窗（若未来启用） --------------------
function closeVisitEditModal() {
  const modal = document.getElementById("visitEditModal");
  if (modal) modal.style.display = "none";
}

function showStudentDetailDrawer(student) {
    const mask = document.getElementById("studentDetailDrawerMask");
    const drawer = document.getElementById("studentDetailDrawer");
    const content = document.getElementById("studentDetailDrawerContent");
    if (!mask || !drawer || !content) {
        showError("未找到学员详情抽屉容器");
        return;
    }

    const sid = student.id || student.student_id || "";
    const nickname = student.student_name || student.name || "";
    const alias = student.alias_name || student.nickname || "无别名";
    const groups = Array.isArray(student.groups) ? student.groups.join(", ") : (student.groups || "—");
    const progress = (() => {
        const p = student.progress || student.learning_progress || [];
        if (!p || !p.length) return "—";
        if (typeof p[0] === "object") {
            return (
                '<ul style="margin-left:16px;">' +
                p.map((o) => {
                    const kv = Object.entries(o || {})
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                    return `<li>${kv || ""}</li>`;
                }).join("") +
                "</ul>"
            );
        }
        return Array.isArray(p) ? p.join(", ") : String(p);
    })();

    const researchNote = student.research_note || student.research_notes || "—";
    const opsNote = student.ops_note || student.operation_notes || student.operation_note || "—";
    const status = student.status || "—";
    const hours = student.learning_hours ?? student.total_study_time ?? 0;

    content.innerHTML = `
        <div class="drawer-header" style="position:sticky; top:0; z-index:10; background:#fff; padding:12px 16px; border-bottom:1px solid #eee;">
            <div style="font-weight:600; font-size:16px;">学员详情 - ${nickname}（${alias}）</div>
            <div style="margin-top:8px;">
                <button class="btn btn-secondary" onclick="closeStudentDetailDrawer()">关闭</button>
            </div>
        </div>

        <div class="drawer-tabs" style="padding:10px 16px; border-bottom:1px solid #eee;">
            <button class="tab-btn active" data-tab="drawer-overview" style="margin-right:8px;">概览</button>
            <button class="tab-btn" data-tab="drawer-visits">回访记录</button>
        </div>

        <div id="drawer-overview" class="drawer-tab active" style="padding:12px 16px;">
            <div><strong>ID：</strong>${sid}</div>
            <div><strong>姓名：</strong>${nickname}（${alias}）</div>
            <div><strong>分组：</strong>${groups}</div>
            <div><strong>进度：</strong>${progress}</div>
            <div><strong>状态：</strong>${status}</div>
            <div><strong>学习时长：</strong>${hours} 小时</div>
            <div><strong>教研备注：</strong>${researchNote}</div>
            <div><strong>运营备注：</strong>${opsNote}</div>
        </div>

        <div id="drawer-visits" class="drawer-tab" style="display:none; padding:12px 16px;">
            <div class="filter-row" style="margin-bottom:10px; display:flex; gap:8px; align-items:center;">
                <select id="drawer-visit-status" class="form-input" style="min-width:120px;">
                    <option value="">全部状态</option>
                    <option value="待办">待办</option>
                    <option value="已联系">已联系</option>
                    <option value="未回复">未回复</option>
                    <option value="已关闭">已关闭</option>
                </select>
                <input id="drawer-visit-search" type="text" class="search-input" placeholder="搜索备注/老师名..." style="flex:1;">
                <button id="drawer-visit-filter-btn" class="btn btn-primary">筛选</button>
            </div>
            <div id="drawer-visit-list"></div>
            <div id="drawer-visit-pagination" style="margin-top:12px;"></div>
        </div>
    `;

    // Tab 切换
    content.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            content.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.getAttribute("data-tab");
            content.querySelectorAll(".drawer-tab").forEach((el) => (el.style.display = "none"));
            const pane = content.querySelector(`#${tab}`);
            if (pane) pane.style.display = "block";
            if (tab === "drawer-visits") {
                // 首次或切换时加载回访记录
                const st = document.getElementById("drawer-visit-status").value || "";
                const kw = (document.getElementById("drawer-visit-search").value || "").trim();
                loadStudentVisitRecords(sid, 1, st, kw);
            }
        });
    });

    // 回访筛选按钮/回车绑定
    const btnFilter = document.getElementById("drawer-visit-filter-btn");
    const inputSearch = document.getElementById("drawer-visit-search");
    if (btnFilter) btnFilter.addEventListener("click", () => {
        const st = document.getElementById("drawer-visit-status").value || "";
        const kw = (document.getElementById("drawer-visit-search").value || "").trim();
        loadStudentVisitRecords(sid, 1, st, kw);
    });
    if (inputSearch) inputSearch.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const st = document.getElementById("drawer-visit-status").value || "";
            const kw = (document.getElementById("drawer-visit-search").value || "").trim();
            loadStudentVisitRecords(sid, 1, st, kw);
        }
    });

    // 打开抽屉
    mask.style.display = "block";
    drawer.style.display = "block";

    // ESC 关闭
    const escHandler = (e) => {
        if (e.key === "Escape") {
            closeStudentDetailDrawer();
        }
    };
    document.addEventListener("keydown", escHandler);
    // 保存 handler 以便移除
    window._drawerEscHandler = escHandler;

    // 点击遮罩关闭
    mask.onclick = () => closeStudentDetailDrawer();

    // 默认进入“回访记录”分页加载一次数据，提升可见性
    const visitsTabBtn = content.querySelector('.tab-btn[data-tab="drawer-visits"]');
    if (visitsTabBtn) visitsTabBtn.click();
}

function closeStudentDetailDrawer() {
    const mask = document.getElementById("studentDetailDrawerMask");
    const drawer = document.getElementById("studentDetailDrawer");
    if (mask) mask.style.display = "none";
    if (drawer) drawer.style.display = "none";
    if (window._drawerEscHandler) {
        document.removeEventListener("keydown", window._drawerEscHandler);
        window._drawerEscHandler = null;
    }
}

// 新增：按 student_id 拉取并分页渲染回访记录，支持状态与关键词筛选
async function loadStudentVisitRecords(studentId, page = 1, status = "", keyword = "") {
    const listBox = document.getElementById("drawer-visit-list");
    const pagerBox = document.getElementById("drawer-visit-pagination");
    if (!listBox || !pagerBox) return;

    // 保存当前筛选状态，供分页点击复用
    window._drawerVisitState = { studentId, status, keyword };

    listBox.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>加载中...</p></div>';
    pagerBox.innerHTML = "";

    try {
        const ps = new URLSearchParams({ page, page_size: 10, student_id: String(studentId) });
        if (status) ps.set("status", status);
        if (keyword) ps.set("search", keyword);
        const res = await fetch(`/operations/visits/?${ps.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "获取回访记录失败");
        const rows = Array.isArray(data.data) ? data.data : [];
        if (!rows.length) {
            listBox.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📒</div>
                    <p>暂无回访记录</p>
                </div>
            `;
        } else {
            listBox.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>回访时间</th>
                            <th>状态</th>
                            <th>回访次数</th>
                            <th>老师</th>
                            <th>备注</th>
                            <th>创建时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.visit_time || "—"}</td>
                                <td>${r.status || "—"}</td>
                                <td>${r.visit_count ?? 0}</td>
                                <td>${r.teacher_name || "—"}</td>
                                <td>${r.notes || "—"}</td>
                                <td>${r.created_at || "—"}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        }

        // 渲染分页
        const p = data.pagination || {};
        let html = "";
        if (p.has_previous) {
            html += `<button class="pagination-btn" onclick="drawerVisitChangePage(${p.current_page - 1})">上一页</button>`;
        }
        const totalPages = p.total_pages || p.num_pages || 1;
        for (let i = 1; i <= totalPages; i++) {
            const active = i === p.current_page ? "active" : "";
            html += `<button class="pagination-btn ${active}" onclick="drawerVisitChangePage(${i})">${i}</button>`;
        }
        if (p.has_next) {
            html += `<button class="pagination-btn" onclick="drawerVisitChangePage(${p.current_page + 1})">下一页</button>`;
        }
        pagerBox.innerHTML = html;
    } catch (e) {
        listBox.innerHTML = `<div class="operations-empty-state">加载失败：${e.message}</div>`;
    }
}

// 供分页按钮调用，复用上一次的筛选条件
function drawerVisitChangePage(page) {
    const s = window._drawerVisitState || {};
    if (!s.studentId) return;
    loadStudentVisitRecords(s.studentId, page, s.status || "", s.keyword || "");
}
