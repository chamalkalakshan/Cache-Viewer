'use strict';

// ── State ────────────────────────────────────────────────
let allGroups = [];
let activeGroupId = null;
let activeChildId = null;
let currentFiles = [];       // full unfiltered list
let filteredFiles = [];      // currently displayed (may be subset)
let selectedPaths = new Set();
let currentChildPath = null;
let currentChild = null;
let currentGroup = null;

// ── Helpers ──────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes) || bytes < 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function getFileIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    js: '📜', ts: '📜', jsx: '📜', tsx: '📜',
    html: '🌐', htm: '🌐', css: '🎨',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼', ico: '🖼',
    mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬',
    mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵',
    pdf: '📄', doc: '📄', docx: '📄', txt: '📄',
    zip: '📦', rar: '📦', gz: '📦', tar: '📦',
    exe: '⚙️', dll: '⚙️', sys: '⚙️',
    dat: '💾', db: '💾', sqlite: '💾', log: '📋',
    json: '{ }', xml: '📋', csv: '📊',
  };
  return map[ext] || '📄';
}

function getGroupIcon(iconKey) {
  const icons = {
    browser: '🌐', chrome: '🌐', edge: '🔷', firefox: '🦊', brave: '🦁',
    opera: '🔴', vivaldi: '🎵',
    temp: '🗑️', windows: '🪟', apps: '📱', recycle: '♻️',
    dns: '🔗',
  };
  return icons[iconKey] || '📦';
}

function showToast(msg, type = 'default', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : '';
  el.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Confirm modal ─────────────────────────────────────────
function showConfirm(title, message) {
  return new Promise((resolve) => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onOverlay = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };

    function cleanup() {
      modal.classList.add('hidden');
      document.getElementById('confirm-ok').removeEventListener('click', onOk);
      document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
    }

    document.getElementById('confirm-ok').addEventListener('click', onOk);
    document.getElementById('confirm-cancel').addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
  });
}

// ── Window controls ──────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => windowControls.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => windowControls.maximize());
document.getElementById('btn-close').addEventListener('click', () => windowControls.close());

// ── Boot: scan ───────────────────────────────────────────
async function boot() {
  const fill = document.getElementById('scan-progress-fill');
  const statusText = document.getElementById('scan-status-text');

  cacheAPI.onScanProgress((data) => {
    const pct = Math.round((data.step / data.total) * 100);
    fill.style.width = pct + '%';
    statusText.textContent = data.label;
  });

  try {
    allGroups = await cacheAPI.scanAll();
    renderSidebar();
    selectGroup(allGroups[0]?.id);
  } catch (err) {
    statusText.textContent = 'Error: ' + err.message;
  }
}

// ── Sidebar ──────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('group-nav');
  const totalSize = allGroups.reduce((s, g) => s + (g.size || 0), 0);
  document.getElementById('total-size').textContent = formatBytes(totalSize);

  nav.innerHTML = '';
  for (const group of allGroups) {
    const el = document.createElement('div');
    el.className = 'nav-group';
    el.dataset.groupId = group.id;
    el.innerHTML = `
      <div class="nav-group-color" style="background:${group.color}"></div>
      <div class="nav-group-icon" style="background:${group.color}22">${getGroupIcon(group.icon)}</div>
      <div class="nav-group-text">
        <div class="nav-group-name">${group.name}</div>
        <div class="nav-group-size">${formatBytes(group.size)} · ${group.children?.length || 0} items</div>
      </div>
    `;
    el.addEventListener('click', () => selectGroup(group.id));
    nav.appendChild(el);
  }
}

// ── Group view ───────────────────────────────────────────
function selectGroup(groupId) {
  if (!groupId) return;
  activeGroupId = groupId;
  activeChildId = null;

  document.querySelectorAll('.nav-group').forEach(el => {
    el.classList.toggle('active', el.dataset.groupId === groupId);
  });

  const group = allGroups.find(g => g.id === groupId);
  if (!group) return;

  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('files-view').classList.add('hidden');
  document.getElementById('group-view').classList.remove('hidden');

  const color = group.color || '#4e9af1';
  document.getElementById('group-icon-large').textContent = getGroupIcon(group.icon);
  document.getElementById('group-icon-large').style.background = color + '22';
  document.getElementById('group-title').textContent = group.name;
  document.getElementById('group-desc').textContent = group.description || '';
  document.getElementById('group-size-stat').textContent = formatBytes(group.size);
  document.getElementById('group-count-stat').textContent = (group.children?.length || 0).toString();

  const grid = document.getElementById('subgroup-grid');
  grid.innerHTML = '';
  const maxSize = Math.max(...(group.children || []).map(c => c.size || 0), 1);

  for (const child of (group.children || [])) {
    const card = document.createElement('div');
    card.className = 'subgroup-card' + (child.size === 0 ? ' subgroup-card-zero' : '');
    const pct = Math.round(((child.size || 0) / maxSize) * 100);
    const iconKey = child.icon || child.id?.split('-')[1] || group.icon;

    card.innerHTML = `
      <div class="subgroup-card-header">
        <div class="subgroup-card-icon" style="background:${color}22">${getGroupIcon(iconKey)}</div>
        <div>
          <div class="subgroup-card-name">${child.name}</div>
          <div class="subgroup-card-files">${child.fileCount || 0} files</div>
        </div>
      </div>
      <div class="subgroup-card-size">${formatBytes(child.size)}</div>
      <div class="subgroup-card-bar">
        <div class="subgroup-card-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    `;

    if (child.size > 0 && !child.virtual) {
      card.addEventListener('click', () => openChild(child, group));
    } else if (child.virtual) {
      card.title = 'This cache type cannot be browsed directly';
    }
    grid.appendChild(card);
  }
}

// ── Files view ────────────────────────────────────────────
async function openChild(child, group) {
  activeChildId = child.id;
  currentChild = child;
  currentGroup = group;
  currentFiles = [];
  filteredFiles = [];
  selectedPaths.clear();
  currentChildPath = child.path || (child.paths && child.paths[0]);

  document.getElementById('group-view').classList.add('hidden');
  document.getElementById('files-view').classList.remove('hidden');
  document.getElementById('files-search').value = '';

  document.getElementById('files-breadcrumb').innerHTML =
    `${escHtml(group.name)} <span>›</span> <span>${escHtml(child.name)}</span>`;

  document.getElementById('btn-open-folder').onclick = () => {
    if (currentChildPath) cacheAPI.openFolder(currentChildPath);
  };

  const filesList = document.getElementById('files-list');
  filesList.innerHTML = '<div style="padding:24px;color:var(--text-muted);display:flex;align-items:center;gap:12px;"><div class="spinner"></div> Loading files...</div>';
  document.getElementById('files-empty').classList.add('hidden');
  document.getElementById('btn-delete-selected').classList.add('hidden');
  document.getElementById('btn-delete-all').classList.add('hidden');
  updateSelectionUI();

  try {
    const result = await cacheAPI.scanGroup(child.id);
    currentFiles = result.files || [];
    filteredFiles = currentFiles;
    renderFilesList(filteredFiles);
    if (currentFiles.length > 0) {
      document.getElementById('btn-delete-all').classList.remove('hidden');
    }
  } catch (err) {
    filesList.innerHTML = `<div style="padding:24px;color:var(--danger)">Error: ${escHtml(err.message)}</div>`;
  }
}

// ── Render file list ──────────────────────────────────────
function renderFilesList(files) {
  const filesList = document.getElementById('files-list');
  const empty = document.getElementById('files-empty');

  if (!files || files.length === 0) {
    filesList.innerHTML = '';
    empty.classList.remove('hidden');
    updateSelectionUI();
    return;
  }
  empty.classList.add('hidden');

  filesList.innerHTML = files.map((f, i) => {
    const p = f.path || '';
    const selected = selectedPaths.has(p);
    return `
      <div class="file-row${selected ? ' selected' : ''}" data-index="${i}" data-path="${escHtml(p)}">
        <div class="fl-check"><input type="checkbox" data-index="${i}" ${selected ? 'checked' : ''}/></div>
        <div class="fl-name">
          <span class="fl-name-icon">${getFileIcon(f.name, f.isDirectory)}</span>
          <span class="fl-name-text" title="${escHtml(p || f.name)}">${escHtml(f.name)}</span>
        </div>
        <div class="fl-type">${f.isDirectory ? 'Folder' : (f.name.split('.').pop() || '—').toUpperCase()}</div>
        <div class="fl-size">${formatBytes(f.size)}</div>
        <div class="fl-date">${formatDate(f.modified)}</div>
      </div>`;
  }).join('');

  filesList.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const cb = row.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      applyToggle(row, cb.checked);
    });
    row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      applyToggle(row, e.target.checked);
    });
  });

  updateSelectionUI();
}

function applyToggle(row, checked) {
  const p = row.dataset.path;
  if (!p) return;
  if (checked) { row.classList.add('selected'); selectedPaths.add(p); }
  else { row.classList.remove('selected'); selectedPaths.delete(p); }
  updateSelectionUI();
}

// ── Selection UI sync ─────────────────────────────────────
function updateSelectionUI() {
  const btnDel = document.getElementById('btn-delete-selected');
  const chkAll = document.getElementById('chk-select-all');
  const count = selectedPaths.size;

  if (count > 0) {
    btnDel.classList.remove('hidden');
    const totalSelSize = filteredFiles
      .filter(f => selectedPaths.has(f.path || ''))
      .reduce((s, f) => s + (f.size || 0), 0);
    btnDel.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Delete (${count}) · ${formatBytes(totalSelSize)}`;
  } else {
    btnDel.classList.add('hidden');
  }

  // Select-all checkbox state
  const visiblePaths = filteredFiles.map(f => f.path || '').filter(Boolean);
  if (visiblePaths.length === 0) {
    chkAll.checked = false;
    chkAll.indeterminate = false;
  } else {
    const selCount = visiblePaths.filter(p => selectedPaths.has(p)).length;
    if (selCount === 0) { chkAll.checked = false; chkAll.indeterminate = false; }
    else if (selCount === visiblePaths.length) { chkAll.checked = true; chkAll.indeterminate = false; }
    else { chkAll.checked = false; chkAll.indeterminate = true; }
  }
}

// ── Select All ────────────────────────────────────────────
document.getElementById('chk-select-all').addEventListener('change', (e) => {
  const selectAll = e.target.checked;
  filteredFiles.forEach(f => {
    if (!f.path) return;
    if (selectAll) selectedPaths.add(f.path);
    else selectedPaths.delete(f.path);
  });

  document.querySelectorAll('.file-row').forEach(row => {
    const p = row.dataset.path;
    const cb = row.querySelector('input[type="checkbox"]');
    if (selectAll) { row.classList.add('selected'); if (cb) cb.checked = true; }
    else { row.classList.remove('selected'); if (cb) cb.checked = false; }
  });

  updateSelectionUI();
});

// ── Search filter ────────────────────────────────────────
document.getElementById('files-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  filteredFiles = q ? currentFiles.filter(f => f.name.toLowerCase().includes(q)) : currentFiles;
  renderFilesList(filteredFiles);
});

// ── Back button ──────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', () => {
  document.getElementById('files-view').classList.add('hidden');
  document.getElementById('group-view').classList.remove('hidden');
  selectedPaths.clear();
  document.getElementById('btn-delete-selected').classList.add('hidden');
  document.getElementById('btn-delete-all').classList.add('hidden');
  document.getElementById('files-search').value = '';
});

// ── Delete Selected ───────────────────────────────────────
document.getElementById('btn-delete-selected').addEventListener('click', async () => {
  if (selectedPaths.size === 0) return;
  const paths = [...selectedPaths];
  const totalSize = filteredFiles
    .filter(f => selectedPaths.has(f.path || ''))
    .reduce((s, f) => s + (f.size || 0), 0);

  const ok = await showConfirm(
    `Delete ${paths.length} item${paths.length > 1 ? 's' : ''}?`,
    `This will permanently delete ${paths.length} item${paths.length > 1 ? 's' : ''} (${formatBytes(totalSize)}). This cannot be undone.`
  );
  if (!ok) return;

  await performDelete(paths);
});

// ── Delete All ────────────────────────────────────────────
document.getElementById('btn-delete-all').addEventListener('click', async () => {
  const allPaths = currentFiles.map(f => f.path).filter(Boolean);
  if (allPaths.length === 0) return;
  const totalSize = currentFiles.reduce((s, f) => s + (f.size || 0), 0);

  const ok = await showConfirm(
    `Delete all ${allPaths.length} files?`,
    `This will permanently delete ALL ${allPaths.length} files (${formatBytes(totalSize)}) in this cache folder. This cannot be undone.`
  );
  if (!ok) return;

  await performDelete(allPaths);
});

// ── Shared delete logic ───────────────────────────────────
async function performDelete(paths) {
  showToast('Deleting…', 'default', 60000);
  const results = await cacheAPI.deleteItems(paths);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  if (failed > 0) {
    showToast(`Deleted ${succeeded}, failed ${failed}`, 'error', 4000);
  } else {
    showToast(`Deleted ${succeeded} item${succeeded !== 1 ? 's' : ''}`, 'success');
  }

  selectedPaths.clear();
  document.getElementById('btn-delete-selected').classList.add('hidden');

  // Refresh the view
  if (currentChild && currentGroup) {
    await openChild(currentChild, currentGroup);
  }

  // Refresh sidebar sizes
  allGroups = await cacheAPI.scanAll();
  renderSidebar();
  // Re-select the active group nav item
  document.querySelectorAll('.nav-group').forEach(el => {
    el.classList.toggle('active', el.dataset.groupId === activeGroupId);
  });
}

// ── Start ────────────────────────────────────────────────
boot();
