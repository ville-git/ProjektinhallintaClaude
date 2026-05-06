/* ── Storage key ── */
const STORAGE_KEY = 'merch_tracker_data';

/* ── UUID helper ── */
function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ── Date helpers ── */
function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetween(dateStr) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d   = new Date(dateStr + 'T00:00:00');
  return Math.round((d - now) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ══════════════════════════════════════════
   DATA LAYER
══════════════════════════════════════════ */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load data', e);
  }
  return { projects: [] };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ── Projects ── */

function getProjects() {
  return loadData().projects;
}

function getProject(id) {
  return loadData().projects.find(p => p.id === id) || null;
}

function createProject({ name, deadline, status }) {
  const data = loadData();
  const project = {
    id:        uuid(),
    name,
    deadline,
    status,
    createdAt: today(),
    tasks:     [],
  };
  data.projects.push(project);
  saveData(data);
  return project;
}

function updateProject(id, fields) {
  const data = loadData();
  const idx  = data.projects.findIndex(p => p.id === id);
  if (idx === -1) return null;
  data.projects[idx] = { ...data.projects[idx], ...fields };
  saveData(data);
  return data.projects[idx];
}

function deleteProject(id) {
  const data = loadData();
  data.projects = data.projects.filter(p => p.id !== id);
  saveData(data);
}

/* ── Tasks ── */

function createTask(projectId, { name, status, dueDate }) {
  const data = loadData();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return null;
  const task = {
    id:      uuid(),
    name,
    status,
    dueDate: dueDate || '',
  };
  project.tasks.push(task);
  saveData(data);
  return task;
}

function updateTask(projectId, taskId, fields) {
  const data    = loadData();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return null;
  const idx = project.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  project.tasks[idx] = { ...project.tasks[idx], ...fields };
  saveData(data);
  return project.tasks[idx];
}

function deleteTask(projectId, taskId) {
  const data    = loadData();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  project.tasks = project.tasks.filter(t => t.id !== taskId);
  saveData(data);
}

/* ── Attention logic ── */

function attentionReasons(project) {
  const reasons = [];

  if (project.status === 'Done') return reasons;

  if (project.status === 'Blocked') {
    reasons.push('Status is Blocked');
  }

  if (project.deadline) {
    const days = daysBetween(project.deadline);
    if (days >= 0 && days <= 7) {
      reasons.push(days === 0
        ? 'Deadline is today'
        : `Deadline in ${days} day${days === 1 ? '' : 's'}`);
    } else if (days < 0) {
      reasons.push('Deadline has passed');
    }
  }

  const overdue = project.tasks.filter(
    t => t.dueDate && t.status !== 'Done' && daysBetween(t.dueDate) < 0
  );
  if (overdue.length > 0) {
    reasons.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);
  }

  return reasons;
}

function needsAttention(project) {
  return attentionReasons(project).length > 0;
}

/* ── Export / Import ── */

function exportData() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `merch-tracker-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed.projects || !Array.isArray(parsed.projects)) {
    throw new Error('Invalid file format');
  }
  saveData(parsed);
}

/* ══════════════════════════════════════════
   UI STATE
══════════════════════════════════════════ */

let currentProjectId = null;
let editingProjectId = null;
let editingTaskId    = null;

/* Command Center filter/sort state */
let _ccFilterStatus  = 'all';   // 'all' | 'Not Started' | 'In Progress' | 'Done'
let _ccFilterProject = 'all';   // 'all' | project id
let _ccSort          = 'due';   // 'due' | 'project' | 'status' | 'name'

/* ══════════════════════════════════════════
   RENDER HELPERS
══════════════════════════════════════════ */

function statusBadgeClass(status) {
  return {
    'Not Started': 'badge-not-started',
    'In Progress':  'badge-in-progress',
    'Blocked':      'badge-blocked',
    'Done':         'badge-done',
  }[status] || 'badge-not-started';
}

/* ══════════════════════════════════════════
   DASHBOARD VIEW
══════════════════════════════════════════ */

function renderDashboard() {
  const projects  = getProjects();
  const grid      = document.getElementById('project-grid');
  const empty     = document.getElementById('empty-state');
  const countEl   = document.getElementById('project-count');
  const attnBar   = document.getElementById('attention-bar');
  const attnText  = document.getElementById('attention-text');

  /* attention bar */
  const attnProjects = projects.filter(needsAttention);
  if (attnProjects.length > 0) {
    attnText.textContent = `${attnProjects.length} project${attnProjects.length > 1 ? 's' : ''} need${attnProjects.length === 1 ? 's' : ''} attention`;
    attnBar.classList.remove('hidden');
  } else {
    attnBar.classList.add('hidden');
  }

  /* empty state */
  const commandCenter = document.getElementById('command-center');
  if (projects.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    countEl.textContent = '';
    if (commandCenter) commandCenter.classList.add('hidden');
    return;
  }
  if (commandCenter) commandCenter.classList.remove('hidden');
  empty.classList.add('hidden');
  countEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

  /* cards */
  grid.innerHTML = projects.map((p, idx) => {
    const attention  = needsAttention(p);
    const doneTasks  = p.tasks.filter(t => t.status === 'Done').length;
    const totalTasks = p.tasks.length;
    const pct        = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const allDone    = totalTasks > 0 && doneTasks === totalTasks;

    const daysLeft       = p.deadline ? daysBetween(p.deadline) : null;
    const deadlineUrgent = daysLeft !== null && daysLeft <= 7 && p.status !== 'Done';
    const deadlineLabel  = p.deadline
      ? (daysLeft < 0 ? `Overdue · ${formatDate(p.deadline)}` : formatDate(p.deadline))
      : 'No deadline';

    /* task dot class */
    const dotClass = s => s === 'Done' ? 'done' : s === 'In Progress' ? 'in-progress' : '';

    /* tasks preview — up to 3 */
    const preview   = p.tasks.slice(0, 3);
    const extraCount = p.tasks.length - preview.length;
    const tasksHtml = p.tasks.length === 0
      ? '<div class="card-tasks-empty">No tasks yet</div>'
      : preview.map(t => `
          <div class="card-task-item${t.status === 'Done' ? ' is-done' : ''}">
            <span class="card-task-dot ${dotClass(t.status)}"></span>
            <span class="card-task-name">${escHtml(t.name)}</span>
          </div>`).join('')
        + (extraCount > 0 ? `<div class="card-task-more">+${extraCount} more</div>` : '');

    /* progress label */
    const progressLabel = totalTasks > 0 ? `${doneTasks}/${totalTasks}` : '—';

    return `
      <div class="project-card${attention ? ' needs-attention' : ''}" data-id="${p.id}" style="animation-delay:${idx * 40}ms">
        ${attention ? '<span class="attention-dot" title="${escHtml(attentionReasons(p).join(\" · \"))}"></span>' : ''}
        <div class="card-top">
          <div class="card-name">${escHtml(p.name)}</div>
          <div class="card-meta">
            <span class="badge ${statusBadgeClass(p.status)} editable-badge"
                  data-action="edit-status"
                  data-id="${p.id}"
                  title="Click to change status"
                  role="button"
                  tabindex="0">${p.status}</span>
            <span class="card-deadline${deadlineUrgent ? ' urgent' : ''} editable-deadline"
                  data-action="edit-deadline"
                  data-id="${p.id}"
                  title="Click to change deadline"
                  role="button"
                  tabindex="0">${deadlineLabel}</span>
          </div>
        </div>
        <div class="card-divider"></div>
        <div class="card-tasks-list">${tasksHtml}</div>
        <div class="card-footer">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill${allDone ? ' done' : ''}" style="width:${pct}%"></div>
          </div>
          <span class="card-progress-label">${progressLabel}</span>
          <span class="card-open-hint">Open →</span>
        </div>
      </div>`;
  }).join('');

  /* Delegated click: intercept inline edits before opening detail */
  grid.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      e.stopPropagation();
      const { action, id } = actionEl.dataset;
      if (action === 'edit-status')   openStatusDropdown(actionEl, id);
      if (action === 'edit-deadline') openDeadlineEditor(actionEl, id);
      return;
    }
    const card = e.target.closest('.project-card');
    if (card) showDetail(card.dataset.id);
  });

  /* Keyboard: Enter/Space on editable elements */
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      e.preventDefault();
      e.stopPropagation();
      const { action, id } = actionEl.dataset;
      if (action === 'edit-status')   openStatusDropdown(actionEl, id);
      if (action === 'edit-deadline') openDeadlineEditor(actionEl, id);
    }
  });

  /* also refresh command center */
  renderCommandCenter();
}

/* ══════════════════════════════════════════
   COMMAND CENTER
══════════════════════════════════════════ */

function renderCommandCenter() {
  const projects = getProjects();
  const controlsEl = document.getElementById('command-center-controls');
  const bodyEl     = document.getElementById('command-center-body');
  if (!controlsEl || !bodyEl) return;

  /* build flat list: { project, task } */
  const allRows = [];
  projects.forEach(p => {
    p.tasks.forEach(t => allRows.push({ project: p, task: t }));
  });

  /* ── controls ── */
  const projectOptions = projects.map(p =>
    `<option value="${p.id}"${_ccFilterProject === p.id ? ' selected' : ''}>${escHtml(p.name)}</option>`
  ).join('');

  controlsEl.innerHTML = `
    <div class="cc-filter-pills">
      ${['all','Not Started','In Progress','Done'].map(s => `
        <button class="cc-pill${_ccFilterStatus === s ? ' active' : ''}"
                data-cc-status="${s}">${s === 'all' ? 'All statuses' : s}</button>
      `).join('')}
    </div>
    <div class="cc-selects">
      <select class="cc-select" id="cc-project-filter">
        <option value="all"${_ccFilterProject === 'all' ? ' selected' : ''}>All projects</option>
        ${projectOptions}
      </select>
      <select class="cc-select" id="cc-sort-select">
        <option value="due"${_ccSort === 'due'     ? ' selected' : ''}>Sort: Due date</option>
        <option value="project"${_ccSort === 'project' ? ' selected' : ''}>Sort: Project</option>
        <option value="status"${_ccSort === 'status'  ? ' selected' : ''}>Sort: Status</option>
        <option value="name"${_ccSort === 'name'    ? ' selected' : ''}>Sort: Task name</option>
      </select>
    </div>`;

  /* wire controls */
  controlsEl.querySelectorAll('.cc-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _ccFilterStatus = btn.dataset.ccStatus;
      renderCommandCenter();
    });
  });
  controlsEl.querySelector('#cc-project-filter').addEventListener('change', e => {
    _ccFilterProject = e.target.value;
    renderCommandCenter();
  });
  controlsEl.querySelector('#cc-sort-select').addEventListener('change', e => {
    _ccSort = e.target.value;
    renderCommandCenter();
  });

  /* ── filter ── */
  let rows = allRows.filter(({ project, task }) => {
    if (_ccFilterStatus !== 'all' && task.status !== _ccFilterStatus) return false;
    if (_ccFilterProject !== 'all' && project.id !== _ccFilterProject) return false;
    return true;
  });

  /* ── sort ── */
  const statusOrder = { 'Not Started': 0, 'In Progress': 1, 'Done': 2 };
  rows.sort((a, b) => {
    switch (_ccSort) {
      case 'due': {
        const da = a.task.dueDate || '9999';
        const db = b.task.dueDate || '9999';
        return da < db ? -1 : da > db ? 1 : 0;
      }
      case 'project':
        return a.project.name.localeCompare(b.project.name);
      case 'status':
        return (statusOrder[a.task.status] ?? 9) - (statusOrder[b.task.status] ?? 9);
      case 'name':
        return a.task.name.localeCompare(b.task.name);
      default: return 0;
    }
  });

  /* ── render table ── */
  if (rows.length === 0) {
    bodyEl.innerHTML = `
      <div class="cc-empty">
        <span class="cc-empty-icon">✓</span>
        <p>${allRows.length === 0 ? 'No tasks yet. Add tasks to your projects.' : 'No tasks match the current filters.'}</p>
      </div>`;
    return;
  }

  bodyEl.innerHTML = `
    <div class="cc-table">
      <div class="cc-thead">
        <div class="cc-th cc-col-project">Project</div>
        <div class="cc-th cc-col-task">Task</div>
        <div class="cc-th cc-col-status">Status</div>
        <div class="cc-th cc-col-due">Due date</div>
        <div class="cc-th cc-col-actions"></div>
      </div>
      <div class="cc-tbody">
        ${rows.map(({ project, task }) => {
          const daysLeft  = task.dueDate ? daysBetween(task.dueDate) : null;
          const isOverdue = daysLeft !== null && daysLeft < 0 && task.status !== 'Done';
          const dueLabel  = task.dueDate
            ? (isOverdue ? `Overdue · ${formatDate(task.dueDate)}` : formatDate(task.dueDate))
            : '—';

          return `
            <div class="cc-row${isOverdue ? ' is-overdue' : ''}${task.status === 'Done' ? ' is-done' : ''}"
                 data-project-id="${project.id}" data-task-id="${task.id}">
              <div class="cc-col-project">
                <button class="cc-project-link" data-open-project="${project.id}">${escHtml(project.name)}</button>
              </div>
              <div class="cc-col-task">
                <span class="cc-task-name${task.status === 'Done' ? ' done-text' : ''}">${escHtml(task.name)}</span>
              </div>
              <div class="cc-col-status">
                <span class="badge ${statusBadgeClass(task.status)} cc-task-status"
                      data-action="cc-cycle-status"
                      data-project-id="${project.id}"
                      data-task-id="${task.id}"
                      title="Click to change status"
                      role="button" tabindex="0">${task.status}</span>
              </div>
              <div class="cc-col-due">
                <span class="cc-due-label${isOverdue ? ' overdue' : ''}">${dueLabel}</span>
              </div>
              <div class="cc-col-actions">
                <button class="btn btn-icon cc-btn-edit"
                        data-action="cc-edit-task"
                        data-project-id="${project.id}"
                        data-task-id="${task.id}"
                        title="Edit task">✎</button>
                <button class="btn btn-icon cc-btn-delete"
                        data-action="cc-delete-task"
                        data-project-id="${project.id}"
                        data-task-id="${task.id}"
                        title="Delete task">✕</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;

  /* wire row interactions */
  bodyEl.querySelectorAll('[data-open-project]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showDetail(btn.dataset.openProject);
    });
  });

  bodyEl.querySelectorAll('[data-action="cc-cycle-status"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const order = ['Not Started', 'In Progress', 'Done'];
      const task  = getProject(el.dataset.projectId)?.tasks.find(t => t.id === el.dataset.taskId);
      if (!task) return;
      const next = order[(order.indexOf(task.status) + 1) % order.length];
      updateTask(el.dataset.projectId, el.dataset.taskId, { status: next });
      renderDashboard();
      if (currentProjectId === el.dataset.projectId) renderSidePanel();
    });
  });

  bodyEl.querySelectorAll('[data-action="cc-edit-task"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const prevProjectId = currentProjectId;
      currentProjectId    = btn.dataset.projectId;
      editingTaskId       = null;
      openEditTask(btn.dataset.taskId);
      if (!prevProjectId) currentProjectId = btn.dataset.projectId;
    });
  });

  bodyEl.querySelectorAll('[data-action="cc-delete-task"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const project = getProject(btn.dataset.projectId);
      const task    = project?.tasks.find(t => t.id === btn.dataset.taskId);
      if (!task) return;
      if (!confirm(`Delete task "${task.name}"?`)) return;
      deleteTask(btn.dataset.projectId, btn.dataset.taskId);
      renderDashboard();
      if (currentProjectId === btn.dataset.projectId) renderSidePanel();
    });
  });
}

/* ══════════════════════════════════════════
   INLINE EDITING — STATUS
══════════════════════════════════════════ */

let _statusDropdownProjectId = null;

function openStatusDropdown(triggerEl, projectId) {
  _statusDropdownProjectId = projectId;
  const dropdown = document.getElementById('inline-status-dropdown');
  const rect     = triggerEl.getBoundingClientRect();

  /* position below the trigger */
  dropdown.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  dropdown.style.left = `${rect.left  + window.scrollX}px`;
  dropdown.classList.remove('hidden');

  /* mark the current selection */
  const current = getProject(projectId)?.status;
  dropdown.querySelectorAll('.inline-dropdown-item').forEach(item => {
    item.classList.toggle('is-active', item.dataset.value === current);
  });

  /* focus first item */
  dropdown.querySelector('.inline-dropdown-item')?.focus();
}

function closeStatusDropdown() {
  document.getElementById('inline-status-dropdown').classList.add('hidden');
  _statusDropdownProjectId = null;
}

function handleStatusSelect(value) {
  if (!_statusDropdownProjectId) return;
  updateProject(_statusDropdownProjectId, { status: value });
  closeStatusDropdown();
  renderDashboard();
  if (currentProjectId) renderSidePanel();
}

/* ══════════════════════════════════════════
   INLINE EDITING — DEADLINE
══════════════════════════════════════════ */

function openDeadlineEditor(triggerEl, projectId) {
  const project = getProject(projectId);
  if (!project) return;

  const input = document.createElement('input');
  input.type      = 'date';
  input.className = 'card-deadline-input';
  input.value     = project.deadline || '';
  input.dataset.id = projectId;

  triggerEl.replaceWith(input);
  input.focus();
  try { input.showPicker(); } catch (_) { /* not supported in all browsers */ }

  let saved = false;

  function save() {
    if (saved) return;
    saved = true;
    updateProject(projectId, { deadline: input.value });
    renderDashboard();
  }

  function cancel() {
    if (saved) return;
    saved = true;
    renderDashboard();
  }

  input.addEventListener('change', save);
  input.addEventListener('blur',   cancel);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
}

/* ══════════════════════════════════════════
   SIDE PANEL — open / close
══════════════════════════════════════════ */

let _activePanelTab = 'tasks';

function showDetail(projectId) {
  currentProjectId = projectId;
  _activePanelTab  = 'tasks';
  renderSidePanel();
  document.getElementById('panel-overlay').classList.remove('hidden');
  document.getElementById('side-panel').classList.remove('hidden');
}

function closePanel() {
  document.getElementById('panel-overlay').classList.add('hidden');
  document.getElementById('side-panel').classList.add('hidden');
  currentProjectId = null;
}

/* keep legacy showDashboard working (back-button, delete) */
function showDashboard() {
  closePanel();
  renderDashboard();
}

/* ══════════════════════════════════════════
   SIDE PANEL — render
══════════════════════════════════════════ */

function renderSidePanel() {
  const project = getProject(currentProjectId);
  if (!project) { closePanel(); return; }

  const reasons  = attentionReasons(project);
  const daysLeft = project.deadline ? daysBetween(project.deadline) : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 7 && project.status !== 'Done';
  const deadlineLabel  = project.deadline
    ? (daysLeft < 0 ? `Overdue · ${formatDate(project.deadline)}` : formatDate(project.deadline))
    : 'No deadline';

  const attentionHtml = reasons.length > 0
    ? `<div class="panel-attention">⚠ ${escHtml(reasons.join(' · '))}</div>`
    : '';

  const tasksHtml  = renderPanelTasks(project);
  const autoHtml   = `
    <div class="agent-placeholder" style="padding: var(--space-8) 0">
      <div class="agent-placeholder-graphic">
        <div class="agent-dot"></div>
        <div class="agent-dot"></div>
        <div class="agent-dot"></div>
      </div>
      <p class="agent-placeholder-title">Automation coming soon</p>
      <p class="agent-placeholder-desc">
        Future automations for this project will appear here —
        deadline alerts, status nudges, and more.
      </p>
    </div>`;

  document.getElementById('side-panel').innerHTML = `
    <div class="side-panel-inner">

      <!-- Panel header row -->
      <div class="panel-header">
        <div class="panel-tabs">
          <button class="panel-tab${_activePanelTab === 'tasks' ? ' active' : ''}"
                  data-panel-tab="tasks">Tasks</button>
          <button class="panel-tab${_activePanelTab === 'automation' ? ' active' : ''}"
                  data-panel-tab="automation">Automation ✦</button>
        </div>
        <button class="btn btn-ghost btn-icon panel-close-btn" id="btn-close-panel" title="Close">✕</button>
      </div>

      <!-- Project name & meta -->
      <div class="panel-project-info">
        <h2 class="panel-project-name">${escHtml(project.name)}</h2>
        <div class="panel-project-meta">
          <span class="badge ${statusBadgeClass(project.status)} editable-badge"
                data-action="edit-status"
                data-id="${project.id}"
                title="Click to change status"
                role="button" tabindex="0">${project.status}</span>
          <span class="card-deadline${deadlineUrgent ? ' urgent' : ''} editable-deadline"
                data-action="edit-deadline"
                data-id="${project.id}"
                title="Click to change deadline"
                role="button" tabindex="0">${deadlineLabel}</span>
        </div>
        <div class="panel-project-actions">
          <button class="btn btn-secondary btn-sm" id="btn-panel-edit-project">Edit name</button>
          <button class="btn btn-danger btn-sm" id="btn-panel-delete-project">Delete project</button>
        </div>
      </div>

      ${attentionHtml}

      <!-- Tab: Tasks -->
      <div class="panel-tab-content${_activePanelTab === 'tasks' ? '' : ' hidden'}" id="panel-tab-tasks">
        <div class="panel-tasks-header">
          <h3>Tasks <span class="task-count-chip">${project.tasks.length}</span></h3>
          <button class="btn btn-primary btn-sm" id="btn-panel-add-task">+ Add Task</button>
        </div>
        <div class="panel-task-list" id="panel-task-list">
          ${tasksHtml}
        </div>
      </div>

      <!-- Tab: Automation -->
      <div class="panel-tab-content${_activePanelTab === 'automation' ? '' : ' hidden'}" id="panel-tab-automation">
        ${autoHtml}
      </div>

    </div>`;

  wirePanelEvents();
}

function renderPanelTasks(project) {
  if (project.tasks.length === 0) {
    return `<div class="panel-empty-tasks">No tasks yet. Add one above.</div>`;
  }
  return project.tasks.map(t => {
    const isDone    = t.status === 'Done';
    const daysLeft  = t.dueDate ? daysBetween(t.dueDate) : null;
    const isOverdue = daysLeft !== null && daysLeft < 0 && !isDone;
    const dueLabel  = t.dueDate
      ? (isOverdue ? `Overdue · ${formatDate(t.dueDate)}` : formatDate(t.dueDate))
      : '';

    return `
      <div class="panel-task-row" data-task-id="${t.id}">
        <span class="badge ${statusBadgeClass(t.status)} panel-task-status"
              data-action="cycle-task-status"
              data-task-id="${t.id}"
              title="Click to change status"
              role="button" tabindex="0">${t.status}</span>
        <div class="panel-task-body">
          <span class="panel-task-name${isDone ? ' done-text' : ''}">${escHtml(t.name)}</span>
          ${dueLabel ? `<span class="panel-task-due${isOverdue ? ' overdue' : ''}">${dueLabel}</span>` : ''}
        </div>
        <div class="panel-task-actions">
          <button class="btn btn-icon" data-action="edit-task" data-task-id="${t.id}" title="Edit">✎</button>
          <button class="btn btn-icon" data-action="delete-task" data-task-id="${t.id}" title="Delete">✕</button>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   SIDE PANEL — event wiring (called after each render)
══════════════════════════════════════════ */

function wirePanelEvents() {
  const panel = document.getElementById('side-panel');

  /* close */
  panel.querySelector('#btn-close-panel')
    ?.addEventListener('click', closePanel);

  /* tabs */
  panel.querySelectorAll('[data-panel-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activePanelTab = btn.dataset.panelTab;
      renderSidePanel();
    });
  });

  /* project actions */
  panel.querySelector('#btn-panel-edit-project')
    ?.addEventListener('click', openEditProject);
  panel.querySelector('#btn-panel-delete-project')
    ?.addEventListener('click', confirmDeleteProject);
  panel.querySelector('#btn-panel-add-task')
    ?.addEventListener('click', openAddTask);

  /* inline status / deadline on the panel */
  panel.querySelectorAll('[data-action="edit-status"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      openStatusDropdown(el, el.dataset.id);
    });
  });
  panel.querySelectorAll('[data-action="edit-deadline"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      openDeadlineEditorPanel(el, el.dataset.id);
    });
  });

  /* task actions */
  panel.querySelectorAll('[data-action="cycle-task-status"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      cycleTaskStatus(currentProjectId, el.dataset.taskId);
    });
  });
  panel.querySelectorAll('[data-action="edit-task"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openEditTask(btn.dataset.taskId);
    });
  });
  panel.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmDeleteTask(btn.dataset.taskId);
    });
  });
}

/* ══════════════════════════════════════════
   TASK STATUS CYCLE (panel)
══════════════════════════════════════════ */

function cycleTaskStatus(projectId, taskId) {
  const project = getProject(projectId);
  const task    = project?.tasks.find(t => t.id === taskId);
  if (!task) return;
  const order = ['Not Started', 'In Progress', 'Done'];
  const next  = order[(order.indexOf(task.status) + 1) % order.length];
  updateTask(projectId, taskId, { status: next });
  renderSidePanel();
  renderDashboard();
}

/* ══════════════════════════════════════════
   DEADLINE INLINE EDITOR — panel variant
  (replaces text in-place, re-renders panel on save)
══════════════════════════════════════════ */

function openDeadlineEditorPanel(triggerEl, projectId) {
  const project = getProject(projectId);
  if (!project) return;

  const input = document.createElement('input');
  input.type       = 'date';
  input.className  = 'card-deadline-input';
  input.value      = project.deadline || '';
  input.dataset.id = projectId;

  triggerEl.replaceWith(input);
  input.focus();
  try { input.showPicker(); } catch (_) { /* not all browsers support this */ }

  let done = false;

  function save() {
    if (done) return; done = true;
    updateProject(projectId, { deadline: input.value });
    renderSidePanel();
    renderDashboard();
  }
  function cancel() {
    if (done) return; done = true;
    renderSidePanel();
  }

  input.addEventListener('change', save);
  input.addEventListener('blur',   cancel);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
}

/* ══════════════════════════════════════════
   PROJECT MODAL
══════════════════════════════════════════ */

function openNewProject() {
  editingProjectId = null;
  document.getElementById('modal-project-title').textContent = 'New Project';
  document.getElementById('input-project-name').value        = '';
  document.getElementById('input-project-deadline').value    = '';
  document.getElementById('input-project-status').value      = 'Not Started';
  document.getElementById('modal-project').classList.remove('hidden');
  document.getElementById('input-project-name').focus();
}

function openEditProject() {
  const project = getProject(currentProjectId);
  if (!project) return;
  editingProjectId = project.id;
  document.getElementById('modal-project-title').textContent = 'Edit Project';
  document.getElementById('input-project-name').value        = project.name;
  document.getElementById('input-project-deadline').value    = project.deadline || '';
  document.getElementById('input-project-status').value      = project.status;
  document.getElementById('modal-project').classList.remove('hidden');
  document.getElementById('input-project-name').focus();
}

function closeProjectModal() {
  document.getElementById('modal-project').classList.add('hidden');
}

function saveProject() {
  const name     = document.getElementById('input-project-name').value.trim();
  const deadline = document.getElementById('input-project-deadline').value;
  const status   = document.getElementById('input-project-status').value;
  if (!name) { document.getElementById('input-project-name').focus(); return; }

  if (editingProjectId) {
    updateProject(editingProjectId, { name, deadline, status });
    closeProjectModal();
    renderSidePanel();
    renderDashboard();
  } else {
    const project = createProject({ name, deadline, status });
    closeProjectModal();
    renderDashboard();
    showDetail(project.id);
  }
}

/* ══════════════════════════════════════════
   TASK MODAL
══════════════════════════════════════════ */

function openAddTask() {
  editingTaskId = null;
  document.getElementById('modal-task-title').textContent = 'New Task';
  document.getElementById('input-task-name').value        = '';
  document.getElementById('input-task-status').value      = 'Not Started';
  document.getElementById('input-task-due').value         = '';
  document.getElementById('modal-task').classList.remove('hidden');
  document.getElementById('input-task-name').focus();
}

function openEditTask(taskId) {
  const project = getProject(currentProjectId);
  const task    = project?.tasks.find(t => t.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  document.getElementById('modal-task-title').textContent = 'Edit Task';
  document.getElementById('input-task-name').value        = task.name;
  document.getElementById('input-task-status').value      = task.status;
  document.getElementById('input-task-due').value         = task.dueDate || '';
  document.getElementById('modal-task').classList.remove('hidden');
  document.getElementById('input-task-name').focus();
}

function closeTaskModal() {
  document.getElementById('modal-task').classList.add('hidden');
}

function saveTask() {
  const name    = document.getElementById('input-task-name').value.trim();
  const status  = document.getElementById('input-task-status').value;
  const dueDate = document.getElementById('input-task-due').value;
  if (!name) { document.getElementById('input-task-name').focus(); return; }

  if (editingTaskId) {
    updateTask(currentProjectId, editingTaskId, { name, status, dueDate });
  } else {
    createTask(currentProjectId, { name, status, dueDate });
  }
  closeTaskModal();
  renderSidePanel();
  renderDashboard();
  renderCommandCenter();
}

/* ══════════════════════════════════════════
   DELETE
══════════════════════════════════════════ */

function confirmDeleteProject() {
  const project = getProject(currentProjectId);
  if (!project) return;
  if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
  deleteProject(currentProjectId);
  showDashboard();
}

function confirmDeleteTask(taskId) {
  const project = getProject(currentProjectId);
  const task    = project?.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!confirm(`Delete task "${task.name}"?`)) return;
  deleteTask(currentProjectId, taskId);
  renderSidePanel();
  renderDashboard();
  renderCommandCenter();
}

/* ══════════════════════════════════════════
   SECURITY HELPER
══════════════════════════════════════════ */

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ══════════════════════════════════════════
   AGENT PANEL
══════════════════════════════════════════ */

function openAgentPanel() {
  document.getElementById('agent-panel').classList.remove('hidden');
  document.getElementById('workspace').classList.add('panel-open');
}

function closeAgentPanel() {
  document.getElementById('agent-panel').classList.add('hidden');
  document.getElementById('workspace').classList.remove('panel-open');
}

/* ══════════════════════════════════════════
   OVERFLOW MENU
══════════════════════════════════════════ */

function toggleOverflow() {
  document.getElementById('overflow-dropdown').classList.toggle('hidden');
}

function closeOverflow() {
  document.getElementById('overflow-dropdown').classList.add('hidden');
}

/* ══════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════ */

function initTheme() {
  const saved = localStorage.getItem('merch_tracker_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButton(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('merch_tracker_theme', next);
  updateThemeButton(next);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<span class="theme-icon">☀</span><span class="theme-label">Light</span>'
    : '<span class="theme-icon">☾</span><span class="theme-label">Dark</span>';
}

/* ══════════════════════════════════════════
   IMPORT / EXPORT WIRING
══════════════════════════════════════════ */

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      importData(e.target.result);
      renderDashboard();
      alert('Data imported successfully.');
    } catch {
      alert('Import failed: invalid file format.');
    }
  };
  reader.readAsText(file);
}

/* ══════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* theme */
  initTheme();
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  /* agent panel */
  document.getElementById('btn-agent-panel').addEventListener('click', openAgentPanel);
  document.getElementById('btn-close-agent').addEventListener('click', closeAgentPanel);

  /* overflow menu */
  document.getElementById('btn-overflow').addEventListener('click', e => {
    e.stopPropagation();
    toggleOverflow();
  });
  document.addEventListener('click', closeOverflow);

  /* inline status dropdown */
  document.getElementById('inline-status-dropdown').addEventListener('click', e => {
    const item = e.target.closest('.inline-dropdown-item');
    if (item) handleStatusSelect(item.dataset.value);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#inline-status-dropdown') &&
        !e.target.closest('[data-action="edit-status"]')) {
      closeStatusDropdown();
    }
  });

  /* header */
  document.getElementById('btn-new-project').addEventListener('click', openNewProject);
  document.getElementById('btn-export').addEventListener('click', () => { closeOverflow(); exportData(); });
  document.getElementById('btn-import').addEventListener('click', () => {
    closeOverflow();
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', e => {
    if (e.target.files[0]) handleImport(e.target.files[0]);
    e.target.value = '';
  });

  /* dashboard */
  document.getElementById('btn-empty-new').addEventListener('click', openNewProject);

  /* legacy detail view buttons (hidden, kept for safety) */
  document.getElementById('btn-back').addEventListener('click', showDashboard);
  document.getElementById('btn-edit-project').addEventListener('click', openEditProject);
  document.getElementById('btn-delete-project').addEventListener('click', confirmDeleteProject);
  document.getElementById('btn-add-task').addEventListener('click', openAddTask);

  /* side panel overlay — click outside to close */
  document.getElementById('panel-overlay').addEventListener('click', closePanel);

  /* Escape key closes panel */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (currentProjectId) { closePanel(); return; }
      closeStatusDropdown();
    }
  });

  /* project modal */
  document.getElementById('btn-save-project').addEventListener('click', saveProject);
  document.getElementById('btn-cancel-project').addEventListener('click', closeProjectModal);
  document.getElementById('btn-close-project-modal').addEventListener('click', closeProjectModal);
  document.getElementById('input-project-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveProject();
  });

  /* task modal */
  document.getElementById('btn-save-task').addEventListener('click', saveTask);
  document.getElementById('btn-cancel-task').addEventListener('click', closeTaskModal);
  document.getElementById('btn-close-task-modal').addEventListener('click', closeTaskModal);
  document.getElementById('input-task-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveTask();
  });

  /* close modals on overlay click */
  document.getElementById('modal-project').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeProjectModal();
  });
  document.getElementById('modal-task').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaskModal();
  });

  /* initial render */
  renderDashboard();
});
