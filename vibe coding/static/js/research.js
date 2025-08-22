(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function getCookie(name) {
    const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }

  // 跨页 Tab 导航高亮（仍保留当前页高亮逻辑）
  function initCrossPageNav() {
    const cross = document.querySelector(".tab-header.cross-page");
    if (!cross) return;
    const anchors = cross.querySelectorAll("a.tab-button");
    anchors.forEach((a) => a.classList.remove("active"));
    const path = window.location.pathname || "";
    const isQuality = path.indexOf("/research/quality") === 0;
    const activeEl = isQuality ? anchors[1] : anchors[0];
    if (activeEl) activeEl.classList.add("active");
  }

  // 页内 Tab 组件：.tabs 内部 .tab-header -> .tab-button[data-tab], 对应 #id.tab-pane
  function initTabs() {
    const tabContainers = document.querySelectorAll(".tabs");
    tabContainers.forEach((container) => {
      const header = container.querySelector(".tab-header");
      if (!header) return;
      header.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-button");
        if (!btn) return;
        const targetId = btn.getAttribute("data-tab");
        if (!targetId) return;

        // 激活按钮
        header
          .querySelectorAll(".tab-button")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // 激活内容
        const panes = container.querySelectorAll(".tab-pane");
        panes.forEach((p) => p.classList.remove("active"));
        const pane = container.querySelector("#" + targetId);
        if (pane) pane.classList.add("active");
      });
    });
  }

  // ===== 质量监控：AJAX 与渲染（保留） =====
  window.getWeeklyFeedback = function () {
    fetch("/research/quality/feedback/?ajax=1")
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.success)
          throw new Error((data && data.message) || "获取失败");
        window.renderFeedbackTable(data.feedbacks || []);
      })
      .catch((err) => {
        console.error(err);
        alert("获取数据失败");
      });
  };

  window.searchStudents = function () {
    const input = document.getElementById("studentSearchInput");
    const q = ((input && input.value) || "").trim();
    if (q.length < 1) {
      alert("请输入至少1个字符");
      return;
    }
    fetch(`/research/quality/students/search/?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        window.renderSearchResults((data && data.students) || []);
      })
      .catch((err) => {
        console.error(err);
        alert("搜索失败");
      });
  };

  window.updateResearchNote = function (studentId, note) {
    fetch(`/research/quality/students/${studentId}/note/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ note: note }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.success === false) {
          alert("更新失败：" + ((data && data.message) || "未知错误"));
        }
      })
      .catch((err) => {
        console.error(err);
        alert("更新失败");
      });
  };

  window.renderFeedbackTable = function (feedbacks) {
    const tbody = document.getElementById("feedbackTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!feedbacks || feedbacks.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9"><div class="empty-state"><p>暂无点评记录</p></div></td></tr>';
      return;
    }
    feedbacks.forEach((fb) => {
      const tr = document.createElement("tr");
      const date = fb.reply_time
        ? new Date(fb.reply_time).toLocaleDateString()
        : "";
      const groups =
        fb.student && fb.student.groups ? fb.student.groups.join(", ") : "";
      tr.innerHTML = `
        <td><input type="checkbox" value="${fb.id}"></td>
        <td>${(fb.student && fb.student.student_id) || ""}</td>
        <td>${(fb.student && fb.student.student_name) || ""}</td>
        <td>${groups}</td>
        <td>${(fb.teacher && fb.teacher.real_name) || ""}</td>
        <td>${fb.teacher_comment || ""}</td>
        <td>第${fb.progress || 0}课</td>
        <td>${date}</td>
        <td><button class="btn btn-sm btn-warning" onclick="addToAttention(${
          (fb.student && fb.student.id) || 0
        })">加入关注</button></td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.renderSearchResults = function (students) {
    const tbody = document.getElementById("searchResultsBody");
    const table = document.getElementById("searchResultsTable");
    const info = document.getElementById("searchInfo");
    const actions = document.getElementById("searchActions");
    const count = document.getElementById("searchResultCount");

    if (!tbody) return;

    tbody.innerHTML = "";
    if (!students || students.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8"><div class="empty-state"><p>未找到匹配的学员</p></div></td></tr>';
      if (table) table.style.display = "table";
      if (info) info.style.display = "block";
      if (actions) actions.style.display = "none";
      if (count) count.textContent = "找到 0 个学员";
      return;
    }

    students.forEach((st) => {
      const tr = document.createElement("tr");
      const groups = st.groups ? st.groups.join(", ") : "";
      const status = st.get_learning_status_display || "正常学习";
      tr.innerHTML = `
        <td><input type="checkbox" value="${st.id}"></td>
        <td>${st.student_id || ""}</td>
        <td><a href="#" onclick="viewStudentDetail(${st.id})">${
        st.student_name || ""
      }</a></td>
        <td>${groups}</td>
        <td>第${st.course_progress || 0}课</td>
        <td>${st.assigned_teacher_name || "未分配"}</td>
        <td><span class="source-badge source-${
          st.learning_status || "normal"
        }">${status}</span></td>
        <td><button class="btn btn-sm btn-warning" onclick="addToAttention(${
          st.id
        })">加入关注</button></td>
      `;
      tbody.appendChild(tr);
    });

    if (table) table.style.display = "table";
    if (info) info.style.display = "block";
    if (actions) actions.style.display = "block";
    if (count) count.textContent = `找到 ${students.length} 个学员`;
  };

  // 质量监控：轻交互占位（保留）
  window.addToDiscussion = function () {
    alert("加入需讨论名单：待实现");
  };
  window.generateQualityReport = function () {
    alert("生成质量报告：待实现");
  };
  window.removeFromList = function () {
    alert("移除学员：待实现");
  };
  window.clearAllList = function () {
    alert("一键清空：待实现");
  };
  window.exportToPDF = function () {
    alert("导出PDF：待实现");
  };
  window.addToAttention = function () {
    alert("加入关注：待实现");
  };
  window.addSelectedToAttention = function () {
    alert("加入需关注名单：待实现");
  };
  window.clearSearch = function () {
    const input = document.getElementById("studentSearchInput");
    if (input) input.value = "";
    const table = document.getElementById("searchResultsTable");
    const info = document.getElementById("searchInfo");
    const actions = document.getElementById("searchActions");
    const tbody = document.getElementById("searchResultsBody");
    if (tbody) tbody.innerHTML = "";
    if (table) table.style.display = "none";
    if (info) info.style.display = "none";
    if (actions) actions.style.display = "none";
  };
  window.viewStudentDetail = function (id) {
    if (!id) return;
    window.location.href = `/research/quality/students/${id}/`;
  };

  // ===== 任务分配页：新版交互 =====
  function initAssignmentSearchBar() {
    if (!window.createSearchBar) return;
    const urls = (window.djangoData && window.djangoData.urls) || {};
    const searchUrl = urls.searchStudents || "/research/students/search/";
    const resultBox = document.querySelector("#assignment-search-results");

    window.createSearchBar({
      inputSelector: "#assignment-search",
      buttonSelector: "#assignment-search-btn",
      resultContainerSelector: "#assignment-search-results",
      minChars: 1,
      debounceMs: 300,
      search: async (q) => {
        if (q.length < 1) {
          const btn = document.getElementById("assignment-search-btn");
          if (btn && btn._clickedOnce) {
            alert("请输入至少1个字符进行搜索");
          }
          return [];
        }
        if (q.length < 2) {
          // 按钮点击时的友好提示
          const btn = document.getElementById("assignment-search-btn");
          if (btn && btn._clickedOnce) {
            alert("请输入至少2个字符进行搜索");
          }
          return [];
        }
        // 加载态
        if (resultBox) {
          resultBox.style.display = "block";
          resultBox.innerHTML =
            '<div style="padding:12px;color:#666;">正在搜索...</div>';
        }
        const res = await fetch(`${searchUrl}?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        return (data && data.students) || [];
      },
      renderItems: (list) => {
        const rows = list
          .map((st) => {
            const groups = Array.isArray(st.groups) ? st.groups.join(", ") : "";
            return `
            <tr>
              <td style="width:120px;">${st.student_id || ""}</td>
              <td style="width:220px;">${st.student_name || ""}</td>
              <td>${groups}</td>
              <td style="width:120px;">
                <button class="btn btn-sm btn-primary" data-action="add-student" data-id="${
                  st.id
                }" data-name="${st.student_name || ""}" data-sid="${
              st.student_id || ""
            }">添加</button>
              </td>
            </tr>
          `;
          })
          .join("");
        return `
          <table class="table">
            <thead>
              <tr>
                <th>用户ID</th><th>昵称</th><th>分组</th><th>操作</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      },
      onBind: (box) => {
        // 标记用户按过“搜索”按钮
        const btn = document.getElementById("assignment-search-btn");
        if (btn) { btn._clickedOnce = true; }
        box.style.display = "block";
        box.querySelectorAll('button[data-action="add-student"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const name = btn.getAttribute("data-name");
            const sid = btn.getAttribute("data-sid");
            addStudentToSelection({ id, name, sid });
            // 添加后收起结果列表
            if (box) { box.style.display = "none"; box.innerHTML = ""; }
          });
        });
      },
    });
  }

  function addStudentToSelection({ id, name, sid }) {
    const container = document.getElementById("selectedStudents");
    if (!container) return;

    // 若为空态，清除
    const empty = container.querySelector(
      '.no-records, [style*="text-align: center"]'
    );
    if (empty) container.innerHTML = "";

    // 去重：已存在则忽略（按用户ID+昵称去重以提高稳健性）
    if (
      sid &&
      container.querySelector(
        `.student-item[data-sid="${CSS.escape(String(sid))}"]`
      )
    )
      return;

    const detailClick = id ? `onclick="viewStudentDetail(${id})"` : "";
    const row = document.createElement("div");
    row.className = "student-item";
    if (sid) row.setAttribute("data-sid", String(sid));
    if (id) row.setAttribute("data-id", String(id));
    row.innerHTML = `
      <div class="student-name" title="${id ? "点击查看学员详情" : "学员"}" ${detailClick}>${name || ""}</div>
      <div class="task-meta">
        <div style="margin-top:6px;">
          <textarea class="task-remark" placeholder="为该学员填写任务备注..."></textarea>
        </div>
      </div>
      <button class="remove-btn" title="移除该任务">&times;</button>
    `;
    row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
    container.appendChild(row);
  }

  // 增加：分配记录与历史聚合的前端状态
  // 与原型一致：assignmentRecords 用于在页面底部“分配记录”列表渲染
  window.assignmentRecords = window.assignmentRecords || [];
  const assignmentRecords = window.assignmentRecords;
  let historyGroupsCache = {}; // key: teacherId, value: {...}
  let selectedHistoryKey = null; // 当前选中的老师分组（单选）

  // 兼容选择器：支持 id="historyList" 或 id="history-list"，records 同理
  function getHistoryListEl() {
    return (
      document.getElementById("historyList") ||
      document.getElementById("history-list")
    );
  }
  function getRecordsListEl() {
    return (
      document.getElementById("recordsList") ||
      document.getElementById("records-list")
    );
  }

  // 更新“分配记录”列表（原型中的 updateRecordsTable）
  window.updateRecordsTable = function () {
    const recordsList = getRecordsListEl();
    if (!recordsList) return;

    if (!assignmentRecords.length) {
      recordsList.innerHTML = '<div class="no-records">暂无分配记录</div>';
      return;
    }

    // 按老师排序
    const sorted = [...assignmentRecords].sort((a, b) =>
      (a.teacher || "").localeCompare(b.teacher || "")
    );

    recordsList.innerHTML = sorted
      .map((record, recordIndex) => {
        const studentsHtml = (record.students || [])
          .map(
            (st, studentIndex) =>
              `<span class="student-item-record">
           ${st.name || ""}
           <span class="delete-btn" onclick="removeStudentFromRecord(${recordIndex}, ${studentIndex})" title="删除学员">×</span>
         </span>`
          )
          .join("");

        const remarksHtml = (record.students || [])
          .map((st) => `${st.name || ""}: ${st.taskRemark || "无备注"}`)
          .join("<br>");

        return `
        <div class="record-item">
          <div class="record-header">
            <div class="record-teacher">${record.teacher || ""}</div>
            <div class="record-date">${record.date || ""}</div>
          </div>
          <div class="record-students">
            <div class="record-students-label">分配学员：</div>
            ${studentsHtml}
          </div>
          <div class="record-remarks">
            <div class="record-remarks-label">任务备注：</div>
            ${remarksHtml}
          </div>
        </div>
      `;
      })
      .join("");
  };

  // 从分配记录中删除某个学员（原型中的 removeStudentFromRecord）
  window.removeStudentFromRecord = function (recordIndex, studentIndex) {
    if (!Array.isArray(assignmentRecords) || !assignmentRecords[recordIndex])
      return;
    if (!confirm("确定要删除这个学员的任务分配吗？")) return;

    assignmentRecords[recordIndex].students.splice(studentIndex, 1);
    if (assignmentRecords[recordIndex].students.length === 0) {
      assignmentRecords.splice(recordIndex, 1);
    }
    window.updateRecordsTable();
  };

  // 清空“分配记录”
  window.clearAllRecords = function () {
    if (!assignmentRecords.length) {
      alert("暂无分配记录！");
      return;
    }
    if (!confirm("确定要清空所有分配记录吗？此操作不可撤销！")) return;

    assignmentRecords = [];
    window.updateRecordsTable();
    alert("已清空所有分配记录！");
  };

  // 导出结果（参考原型）
  window.exportResults = function () {
    if (!assignmentRecords.length) {
      alert("暂无分配记录可导出！");
      return;
    }
    let exportData = "教学任务分配结果\n\n";
    assignmentRecords.forEach((record, idx) => {
      exportData += `分配 ${idx + 1}：\n`;
      exportData += `老师：${record.teacher || ""}\n`;
      exportData += `时间：${record.date || ""}\n`;
      exportData += `学员列表：\n`;
      (record.students || []).forEach((st) => {
        exportData += `  - ${st.name || ""} (${st.group || ""}) - 备注：${
          st.taskRemark || "无"
        }\n`;
      });
      exportData += "\n";
    });

    const blob = new Blob([exportData], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `教学任务分配结果_${today}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 历史分配记录：按老师聚合展示（使用后端真实字段，移除原型字段）
  function fetchHistoryGrouped() {
    const urls = (window.djangoData && window.djangoData.urls) || {};
    const api = urls.taskHistoryApi || "/research/tasks/history/api/";
    const listBox = getHistoryListEl();
    if (!listBox) return;

    listBox.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #999;">正在加载历史记录...</div>';

    fetch(api)
      .then((r) => r.json())
      .then((data) => {
        const tasks = (data && data.tasks) || [];
        if (!tasks.length) {
          listBox.innerHTML = '<div class="empty-state">暂无历史记录</div>';
          historyGroupsCache = {};
          selectedHistoryKey = null;
          return;
        }

        // 按老师聚合（严格使用后端字段）
        const groups = {};
        tasks.forEach((t) => {
          const teacherId = String(t.teacher_id || "");
          const teacherName = t.teacher_name || "";
          if (!teacherId) return;

          if (!groups[teacherId]) {
            groups[teacherId] = {
              teacherId,
              teacherName,
              students: [],
              _seen: new Set(),
            };
          }
          const g = groups[teacherId];

          const sid = String(t.student_id || "");
          const sname = t.student_name || "";
          if (!sid || g._seen.has(sid)) return;
          g._seen.add(sid);

          g.students.push({
            // 历史接口无学员 pk，仅保存业务用户ID与昵称以用于展示
            student_id: sid,
            student_name: sname,
            // 备注字段统一为 task_note
            task_note: t.task_note || "",
          });
        });

        // 缓存到全局
        historyGroupsCache = {};
        Object.values(groups).forEach((g) => {
          delete g._seen;
          historyGroupsCache[g.teacherId] = g;
        });

        // 渲染
        const html = Object.values(historyGroupsCache)
          .map((g) => {
            const previewTags = (g.students || [])
              .slice(0, 12)
              .map(
                (st) =>
                  `<span class="history-student-tag">${
                    st.student_name || ""
                  }</span>`
              )
              .join("");
            return `
            <div class="history-item ${
              selectedHistoryKey === g.teacherId ? "selected" : ""
            }"
                 data-key="${g.teacherId}"
                 onclick="selectHistoryGroup('${g.teacherId}')">
              <div class="history-teacher">${g.teacherName || ""}</div>
              <div class="history-date">共 ${g.students.length} 名学员</div>
              <div class="history-students">
                <strong>学员列表：</strong><br>
                ${previewTags}
              </div>
            </div>
          `;
          })
          .join("");

        listBox.innerHTML =
          html || '<div class="empty-state">暂无历史记录</div>';
      })
      .catch(() => {
        listBox.innerHTML = '<div class="empty-state">历史记录加载失败</div>';
      });
  }

  // 历史列表：选择 & 高亮（原型的 selectedHistoryIndex 对应为 selectedHistoryKey）
  window.selectHistoryGroup = function (teacherKey) {
    selectedHistoryKey = teacherKey || null;
    window.updateHistorySelection();
  };

  window.updateHistorySelection = function () {
    const listBox = getHistoryListEl();
    if (!listBox) return;
    listBox.querySelectorAll(".history-item").forEach((item) => {
      const key = item.getAttribute("data-key");
      if (key && key === selectedHistoryKey) item.classList.add("selected");
      else item.classList.remove("selected");
    });
  };

  // 使用选中记录（仅以真实字段生成记录）
  window.useSelectedHistory = function () {
    if (!selectedHistoryKey || !historyGroupsCache[selectedHistoryKey]) {
      alert("请先选择一个历史记录！");
      return;
    }
    const grp = historyGroupsCache[selectedHistoryKey];
    const today = new Date().toISOString().split("T")[0];

    assignmentRecords.push({
      teacher: grp.teacherName,
      students: (grp.students || []).map((st) => ({
        // 输出展示：用户ID+昵称+备注（不使用原型命名）
        student_id: st.student_id,
        name: st.student_name,
        taskRemark: st.task_note || "",
      })),
      date: today,
    });

    window.updateRecordsTable();
    alert(
      `已成功使用历史记录，将 ${grp.students.length} 名学员分配给 ${grp.teacherName}！`
    );
  };

  // 编辑后使用（将历史记录载入“手动批量分配”，以真实字段回填）
  window.editSelectedHistory = function () {
    if (!selectedHistoryKey || !historyGroupsCache[selectedHistoryKey]) {
      alert("请先选择一个历史记录！");
      return;
    }
    const grp = historyGroupsCache[selectedHistoryKey];

    // 切回“手动批量分配”tab
    const manualBtn = document.querySelector(
      '.tab-header .tab-button[data-tab="manualTab"]'
    );
    if (manualBtn) manualBtn.click();

    // 选中对应老师
    const teacherBtns = document.querySelectorAll(".teacher-btn");
    let matchedBtn = null;
    teacherBtns.forEach((b) => b.classList.remove("active"));
    teacherBtns.forEach((b) => {
      if (String(b.getAttribute("data-teacher")) === String(grp.teacherId)) {
        matchedBtn = b;
      }
    });
    if (matchedBtn) {
      matchedBtn.classList.add("active");
      const display = document.getElementById("selectedTeacherDisplay");
      const name =
        matchedBtn.getAttribute("data-teacher-name") ||
        grp.teacherName ||
        "已选择老师";
      if (display) display.textContent = `已选择老师：${name}`;
    }

    // 清空当前任务列表并加载该历史的学员为任务项
    const box = document.getElementById("selectedStudents");
    if (box) box.innerHTML = "";
    (grp.students || []).forEach((st) => {
      // 历史数据没有学员 pk，这里不绑定点击跳详情，id 传空
      addStudentToSelection({
        id: "",
        name: st.student_name,
        sid: st.student_id,
      });
      // 回填备注（进度无数据）
      const selector = `#selectedStudents .student-item[data-sid="${CSS.escape(
        String(st.student_id)
      )}"]`;
      const row = document.querySelector(selector);
      if (row) {
        const note = row.querySelector(".task-remark");
        if (note) note.value = st.task_note || "";
      }
    });

    alert("已加载历史记录到编辑模式，您可以进行修改后再分配！");
  };

  // 老的“统计信息获取”逻辑（已删除）
  // function tryFetchTeacherStats() { ... } 以及所有调用均移除

  // 初始化
  function initTaskAssignmentPage() {
    const display = document.getElementById("selectedTeacherDisplay");
    const teacherBtns = document.querySelectorAll(".teacher-btn");
    teacherBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        teacherBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const name = btn.getAttribute("data-teacher-name") || "已选择老师";
        if (display) display.textContent = `已选择老师：${name}`;
      });
    });

    // 标准搜索栏（参考教学/运营）
    initAssignmentSearchBar();

    // 切换到历史 Tab 时加载按老师聚合的记录（原型风格）
    const historyBtn = document.querySelector(
      '.tab-header .tab-button[data-tab="historyTab"]'
    );
    if (historyBtn) {
      historyBtn.addEventListener("click", fetchHistoryGrouped);
    }
  }

  ready(function () {
    initCrossPageNav();
    initTabs();
    initTaskAssignmentPage();
  });
})();

// 保存分配：提交到后端并同步到“分配记录”
window.saveAssignment = async function () {
  try {
    const teacherBtn = document.querySelector(".teacher-btn.active");
    if (!teacherBtn) {
      alert("请先选择分配老师");
      return;
    }
    const teacherId = teacherBtn.getAttribute("data-teacher");
    const teacherName =
      teacherBtn.getAttribute("data-teacher-name") || "已选择老师";

    const rows = Array.from(
      document.querySelectorAll("#selectedStudents .student-item")
    );
    if (!rows.length) {
      alert("请先添加学员任务");
      return;
    }

    const urls = (window.djangoData && window.djangoData.urls) || {};
    const searchUrl = urls.searchStudents || "/research/students/search/";
    const createUrl = urls.createTask || "/research/tasks/create/";

    // 先补齐缺失的 pk（data-id），通过用户ID精确查找
    const resolveRowPk = async (row) => {
      let pk = row.getAttribute("data-id");
      if (pk) return pk;

      const sid = row.getAttribute("data-sid");
      if (!sid) return "";

      // 用用户ID作为精确查询关键字
      const resp = await fetch(`${searchUrl}?q=${encodeURIComponent(sid)}`);
      const data = await resp.json();
      const list = (data && data.students) || [];
      const found = list.find((s) => String(s.student_id) === String(sid));
      return found ? String(found.id) : "";
    };

    // 并行解析所有行的 pk
    const pks = await Promise.all(rows.map(resolveRowPk));
    const unresolved = [];
    rows.forEach((row, idx) => {
      if (pks[idx]) row.setAttribute("data-id", pks[idx]);
      else unresolved.push(row.getAttribute("data-sid") || "(未知ID)");
    });
    if (unresolved.length) {
      alert(
        `以下学员未能解析为系统ID（请通过搜索重新添加）：\n${unresolved.join(
          "\n"
        )}`
      );
    }

    // 组装提交 payload（仅提交后端需要的字段）
    const assignments = rows
      .map((row) => {
        const pk = row.getAttribute("data-id");
        if (!pk) return null;
        const note = row.querySelector(".task-remark")?.value || "";
        return {
          student_id: Number(pk),
          task_note: note,
        };
      })
      .filter(Boolean);

    if (!assignments.length) {
      alert("没有可提交的学员任务（可能都缺少系统ID）");
      return;
    }

    const res = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({
        teacher_id: Number(teacherId),
        assignments,
      }),
    });
    const result = await res.json();
    if (!result || result.success === false) {
      throw new Error((result && result.message) || "保存失败");
    }

    // 同步到“分配记录”
    const today = new Date().toISOString().split("T")[0];
    const recordStudents = rows
      .map((row) => {
        const pk = row.getAttribute("data-id");
        if (!pk) return null; // 仅记录已成功提交的
        const name = row.querySelector(".student-name")?.textContent || "";
        const note = row.querySelector(".task-remark")?.value || "";
        return { name, taskRemark: note };
      })
      .filter(Boolean);

    if (recordStudents.length) {
      window.assignmentRecords.push({
        teacher: teacherName,
        students: recordStudents,
        date: today,
      });
      window.updateRecordsTable && window.updateRecordsTable();
    }

    // 清空左侧任务列表
    window.clearAssignment();

    alert(result.message || `成功分配 ${assignments.length} 个任务`);
  } catch (e) {
    console.error(e);
    alert(`保存失败：${e.message || e}`);
  }
};

// 清空分配：清空左侧任务列表并恢复空态
window.clearAssignment = function () {
  const box = document.getElementById("selectedStudents");
  if (!box) return;
  box.innerHTML =
    '<div style="padding: 20px; text-align: center; color: #999;">暂无选择的任务</div>';
};
