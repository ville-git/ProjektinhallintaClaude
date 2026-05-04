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
  if (projects.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    countEl.textContent = '';
    return;
  }
  empty.classList.add('hidden');
  countEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

  /* cards */
  grid.innerHTML = projects.map(p => {
    const attention = needsAttention(p);
    const doneTasks = p.tasks.filter(t => t.status === 'Done').length;
    const totalTasks = p.tasks.length;
    const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const allDone = totalTasks > 0 && doneTasks === totalTasks;

    const daysLeft = p.deadline ? daysBetween(p.deadline) : null;
    const deadlineUrgent = daysLeft !== null && daysLeft <= 7 && p.status !== 'Done';

    const deadlineStr = p.deadline
      ? `${deadlineUrgent && daysLeft < 0 ? 'Overdue · ' : ''}${formatDate(p.deadline)}`
      : 'No deadline';

    return `
      <div class="project-card${attention ? ' needs-attention' : ''}" data-id="${p.id}">
        ${attention ? '<span class="card-attention-tag">⚠ Needs attention</span>' : ''}
        <div class="card-name">${escHtml(p.name)}</div>
        <div class="card-meta">
          <span class="badge ${statusBadgeClass(p.status)}">${p.status}</span>
          <span class="card-deadline${deadlineUrgent ? ' urgent' : ''}">${deadlineStr}</span>
        </div>
        <div class="card-tasks">${totalTasks === 0 ? 'No tasks' : `${doneTasks} / ${totalTasks} tasks done`}</div>
        <div class="card-footer">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill${allDone ? ' done' : ''}" style="width:${pct}%"></div>
          </div>
          <span class="card-open-btn">Open →</span>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => showDetail(card.dataset.id));
  });
}

/* ══════════════════════════════════════════
   DETAIL VIEW
══════════════════════════════════════════ */

function showDetail(projectId) {
  currentProjectId = projectId;
  renderDetail();
  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-detail').classList.remove('hidden');
}

function showDashboard() {
  currentProjectId = null;
  document.getElementById('view-detail').classList.add('hidden');
  document.getElementById('view-dashboard').classList.remove('hidden');
  renderDashboard();
}

function renderDetail() {
  const project = getProject(currentProjectId);
  if (!project) { showDashboard(); return; }

  document.getElementById('detail-title').textContent        = project.name;
  document.getElementById('detail-deadline').textContent     = project.deadline ? `Deadline: ${formatDate(project.deadline)}` : 'No deadline';
  const badge = document.getElementById('detail-status-badge');
  badge.textContent  = project.status;
  badge.className    = `badge ${statusBadgeClass(project.status)}`;

  /* inline attention */
  const attn     = document.getElementById('detail-attention');
  const reasons  = attentionReasons(project);
  if (reasons.length > 0) {
    attn.textContent = `⚠ ${reasons.join(' · ')}`;
    attn.classList.remove('hidden');
  } else {
    attn.classList.add('hidden');
  }

  renderTasks(project);
}

function renderTasks(project) {
  const list  = document.getElementById('task-list');
  const empty = document.getElementById('empty-tasks');

  if (project.tasks.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = project.tasks.map(t => {
    const isDone     = t.status === 'Done';
    const daysLeft   = t.dueDate ? daysBetween(t.dueDate) : null;
    const isOverdue  = daysLeft !== null && daysLeft < 0 && !isDone;
    const dueLabel   = t.dueDate
      ? (isOverdue ? `Overdue · ${formatDate(t.dueDate)}` : formatDate(t.dueDate))
      : '';

    return `
      <div class="task-row" data-task-id="${t.id}">
        <span class="badge ${statusBadgeClass(t.status)}">${t.status}</span>
        <span class="task-name${isDone ? ' done-text' : ''}">${escHtml(t.name)}</span>
        ${dueLabel ? `<span class="task-due${isOverdue ? ' overdue' : ''}">${dueLabel}</span>` : ''}
        <div class="task-actions">
          <button class="btn btn-icon btn-task-edit" data-task-id="${t.id}" title="Edit">✎</button>
          <button class="btn btn-icon btn-task-delete" data-task-id="${t.id}" title="Delete">✕</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.btn-task-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditTask(btn.dataset.taskId); });
  });
  list.querySelectorAll('.btn-task-delete').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); confirmDeleteTask(btn.dataset.taskId); });
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
    renderDetail();
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
  renderDetail();
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
  renderDetail();
}

/* ══════════════════════════════════════════
   SECURITY HELPER
══════════════════════════════════════════ */

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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

  /* header */
  document.getElementById('btn-new-project').addEventListener('click', openNewProject);
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', e => {
    if (e.target.files[0]) handleImport(e.target.files[0]);
    e.target.value = '';
  });

  /* dashboard */
  document.getElementById('btn-empty-new').addEventListener('click', openNewProject);

  /* detail */
  document.getElementById('btn-back').addEventListener('click', showDashboard);
  document.getElementById('btn-edit-project').addEventListener('click', openEditProject);
  document.getElementById('btn-delete-project').addEventListener('click', confirmDeleteProject);
  document.getElementById('btn-add-task').addEventListener('click', openAddTask);

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
