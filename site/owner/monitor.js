const state = {
  data: null,
  query: '',
  filterStatus: 'all',
  selectedActivityUser: 'all',
  selectedUserId: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message;
  node.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.className = 'toast', 2800);
}

function timeAgo(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Unknown';
  const diffSec = Math.floor((new Date() - date) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function metricCard(label, value, icon, sub, iconBg = '#ecfdf5') {
  return `
    <article class="metric-card">
      <div class="metric-head">
        <span class="metric-label">${escapeHtml(label)}</span>
        <div class="metric-icon" style="background-color: ${iconBg};">${icon}</div>
      </div>
      <strong class="metric-value">${Number(value || 0).toLocaleString()}</strong>
      <div class="metric-sub">${sub}</div>
    </article>
  `;
}

function renderTrendChart(trendData = []) {
  const wrap = $('#activity-chart-wrap');
  if (!wrap) return;
  
  if (!trendData.length) {
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:12px;">No activity data recorded in the last 7 days.</div>';
    return;
  }

  const maxVal = Math.max(...trendData.map(d => Math.max(d.events, d.users)), 5);
  const width = wrap.clientWidth || 500;
  const height = 130;
  const padding = 20;

  const pointsEvents = trendData.map((d, i) => {
    const x = padding + (i / Math.max(trendData.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (d.events / maxVal) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const pointsUsers = trendData.map((d, i) => {
    const x = padding + (i / Math.max(trendData.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (d.users / maxVal) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const svg = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${height - padding}" x2="${width}" y2="${height - padding}" stroke="#e2e8f0" stroke-dasharray="4"/>
      <line x1="0" y1="${padding}" x2="${width}" y2="${padding}" stroke="#f1f5f9" stroke-dasharray="4"/>
      <polygon points="${padding},${height - padding} ${pointsUsers} ${width - padding},${height - padding}" fill="url(#chartGrad)"/>
      <polyline points="${pointsEvents}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
      <polyline points="${pointsUsers}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
      ${trendData.map((d, i) => {
        const x = padding + (i / Math.max(trendData.length - 1, 1)) * (width - padding * 2);
        const yU = height - padding - (d.users / maxVal) * (height - padding * 2);
        return `<circle cx="${x}" cy="${yU}" r="4" fill="#10b981" stroke="#ffffff" stroke-width="2"><title>${d.day}: ${d.users} active users, ${d.events} events</title></circle>`;
      }).join('')}
    </svg>
  `;

  wrap.innerHTML = svg;
}

function updateActivityUserFilterOptions() {
  const select = $('#activity-user-filter');
  if (!select || !state.data) return;

  const currentVal = select.value || 'all';
  const options = ['<option value="all">All Users</option>'];

  (state.data.users || []).forEach(u => {
    const label = u.displayName ? `${u.displayName} (${u.userId.substring(0, 8)}...)` : u.userId.substring(0, 16);
    options.push(`<option value="${escapeHtml(u.userId)}">${escapeHtml(label)}</option>`);
  });

  select.innerHTML = options.join('');
  select.value = currentVal;
}

function render() {
  const data = state.data;
  if (!data) return;

  $('#owner-email').textContent = data.owner.email;

  // Render Metric Cards
  $('#metrics').innerHTML = [
    metricCard('Total Users', data.summary.totalUsers, '👥', '↑ Active User Base', '#e0f2fe'),
    metricCard('Active · 24 Hours', data.summary.active24h, '⚡', `${Math.round((data.summary.active24h / (data.summary.totalUsers || 1)) * 100)}% engagement`, '#ecfdf5'),
    metricCard('Suspended', data.summary.suspendedUsers, '🛡️', data.summary.suspendedUsers === 0 ? '0 access restrictions' : 'Access Restricted', '#fef2f2'),
    metricCard('Expense Records', data.summary.totalExpenses, '💳', 'Stored in Turso DB', '#f5f3ff'),
    metricCard('Events · 24 Hours', data.summary.events24h, '📈', 'System activity log', '#fff7ed')
  ].join('');

  // Render Trend Chart
  renderTrendChart(data.trend || []);

  // Update Activity Filter Options
  updateActivityUserFilterOptions();

  // Filter Users
  let filteredUsers = data.users || [];
  if (state.filterStatus === 'active') {
    filteredUsers = filteredUsers.filter(u => u.status !== 'suspended');
  } else if (state.filterStatus === 'suspended') {
    filteredUsers = filteredUsers.filter(u => u.status === 'suspended');
  }

  if (state.query) {
    const q = state.query.toLowerCase();
    filteredUsers = filteredUsers.filter(u => u.userId.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q));
  }

  $('#user-count').textContent = `${filteredUsers.length} account${filteredUsers.length === 1 ? '' : 's'} shown · updated ${timeAgo(data.generatedAt)}`;

  // Render User Table
  $('#users').innerHTML = filteredUsers.length ? filteredUsers.map(user => `
    <tr data-user-id="${escapeHtml(user.userId)}">
      <td>
        <div class="user-cell" onclick="window.openUserModal('${escapeHtml(user.userId)}')">
          ${user.profilePhotoUrl ? 
            `<img class="avatar" src="${escapeHtml(user.profilePhotoUrl)}" alt="">` : 
            `<span class="avatar avatar-fallback">${escapeHtml((user.displayName || 'U')[0].toUpperCase())}</span>`
          }
          <div>
            <div class="user-name">${escapeHtml(user.displayName || 'Unnamed User')}</div>
            <div class="user-id" title="${escapeHtml(user.userId)}">${escapeHtml(user.userId)}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge ${user.status}">
          ${user.status === 'suspended' ? '● Suspended' : '● Active'}
        </span>
        ${user.statusReason ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escapeHtml(user.statusReason)}</div>` : ''}
      </td>
      <td><strong>${user.expenseCount.toLocaleString()}</strong></td>
      <td>
        <button class="action-btn-sm" style="font-size:11px;padding:3px 8px;" onclick="window.filterActivityByUser('${escapeHtml(user.userId)}')">
          ⚡ ${user.activityCount.toLocaleString()}
        </button>
      </td>
      <td><span style="font-size:12px;font-weight:600;color:#475569;">${escapeHtml(timeAgo(user.lastActiveAt || user.lastDataAt))}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="action-btn-sm ${user.status === 'suspended' ? 'restore' : 'suspend'}" data-user="${escapeHtml(user.userId)}" data-action="${user.status === 'suspended' ? 'restore' : 'suspend'}">
            ${user.status === 'suspended' ? 'Restore' : 'Suspend'}
          </button>
          <button class="action-btn-sm" onclick="window.openUserModal('${escapeHtml(user.userId)}')">Details</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;">No users match your criteria.</td></tr>`;

  // Render Activity Feed (Filtered by user if selected) with Rich User Info
  let activityItems = data.activity || [];
  if (state.selectedActivityUser && state.selectedActivityUser !== 'all') {
    activityItems = activityItems.filter(a => a.userId === state.selectedActivityUser);
  }

  renderActivityFeed('#activity', activityItems);

  // Render Audit Trail
  renderFeed('#audit', data.audit,
    item => `${item.action.replaceAll('_', ' ')} · <span style="color:#0f172a;font-weight:700;">${item.targetUserId || 'system'}</span>`,
    item => `Actor: ${item.actor} · ${timeAgo(item.createdAt)}`
  );
}

function renderActivityFeed(selector, items) {
  $(selector).innerHTML = items.length ? items.map(item => {
    const displayName = item.displayName || 'Unnamed User';
    const initial = (displayName[0] || 'U').toUpperCase();
    const eventName = item.eventType.replaceAll('_', ' ');
    const userShort = item.userId ? (item.userId.length > 16 ? item.userId.substring(0, 14) + '...' : item.userId) : 'system';

    return `
      <div class="event-item" style="padding: 10px 0;">
        <div style="cursor: pointer; flex-shrink: 0;" onclick="window.openUserModal('${escapeHtml(item.userId)}')">
          ${item.profilePhotoUrl ? 
            `<img style="width:28px;height:28px;border-radius:8px;object-fit:cover;" src="${escapeHtml(item.profilePhotoUrl)}" alt="">` :
            `<div style="width:28px;height:28px;border-radius:8px;background:#dbeafe;color:#2563eb;font-weight:800;font-size:12px;display:grid;place-items:center;">${escapeHtml(initial)}</div>`
          }
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="cursor: pointer; color: #0f172a; text-decoration: underline; text-decoration-color: #cbd5e1;" onclick="window.openUserModal('${escapeHtml(item.userId)}')" title="View user details: ${escapeHtml(item.userId)}">
                ${escapeHtml(displayName)}
              </span>
              <span style="font-size: 11px; font-weight: 600; color: #3b82f6; margin-left: 4px; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">${escapeHtml(eventName)}</span>
            </div>
            <span style="font-size: 10.5px; color: #94a3b8; font-weight: 600; flex-shrink: 0;">${timeAgo(item.createdAt)}</span>
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
            <span style="font-family: monospace; color: #94a3b8;" title="${escapeHtml(item.userId)}">${escapeHtml(userShort)}</span> · ${escapeHtml(item.source)}
          </div>
        </div>
      </div>
    `;
  }).join('') : '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px;">No activity recorded for this selection.</div>';
}

function renderFeed(selector, items, title, detail) {
  $(selector).innerHTML = items.length ? items.map(item => `
    <div class="event-item">
      <span class="event-dot"></span>
      <div>
        <div class="event-title">${title(item)}</div>
        <div class="event-meta">${detail(item)}</div>
      </div>
    </div>
  `).join('') : '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px;">No activity recorded for this selection.</div>';
}

window.filterActivityByUser = function (userId) {
  state.selectedActivityUser = userId;
  const select = $('#activity-user-filter');
  if (select) select.value = userId;
  render();
  toast(`Filtered activity feed for user`);
};

async function request(url, options) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.replace('/owner/login');
    throw new Error('Owner session expired.');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function load() {
  try {
    const query = state.query ? `?q=${encodeURIComponent(state.query)}` : '';
    state.data = await request(`/api/owner-monitor${query}`);
    render();
  } catch (error) {
    toast(error.message, true);
  }
}

/* USER DETAIL MODAL DRAWER WITH PER-USER ACTIVITY TIMELINE */
window.openUserModal = function (userId) {
  if (!state.data) return;
  const user = state.data.users.find(u => u.userId === userId);
  if (!user) return;

  state.selectedUserId = userId;
  const backdrop = $('#user-modal-backdrop');
  const body = $('#modal-body-content');
  const foot = $('#modal-foot-actions');

  const userActivities = (state.data.activity || []).filter(a => a.userId === userId);

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;">
      ${user.profilePhotoUrl ? 
        `<img style="width:52px;height:52px;border-radius:14px;" src="${escapeHtml(user.profilePhotoUrl)}" alt="">` : 
        `<div style="width:52px;height:52px;border-radius:14px;background:#dbeafe;color:#2563eb;display:grid;place-items:center;font-size:22px;font-weight:800;">${escapeHtml((user.displayName || 'U')[0].toUpperCase())}</div>`
      }
      <div>
        <h4 style="margin:0;font-size:18px;font-weight:800;">${escapeHtml(user.displayName || 'Unnamed User')}</h4>
        <div style="font-size:11.5px;color:#64748b;font-family:monospace;margin-top:2px;">ID: ${escapeHtml(user.userId)}</div>
        <div style="margin-top:6px;"><span class="badge ${user.status}">${user.status === 'suspended' ? '● Suspended' : '● Active'}</span></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;color:#64748b;font-weight:700;">Expense Records</div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:2px;">${user.expenseCount.toLocaleString()}</div>
      </div>
      <div style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;color:#64748b;font-weight:700;">Budgets Configured</div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:2px;">${user.budgetCount.toLocaleString()}</div>
      </div>
      <div style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;color:#64748b;font-weight:700;">Total Activity Events</div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:2px;">${user.activityCount.toLocaleString()}</div>
      </div>
      <div style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;color:#64748b;font-weight:700;">Last Active</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:6px;">${escapeHtml(timeAgo(user.lastActiveAt || user.lastDataAt))}</div>
      </div>
    </div>

    ${user.statusReason ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:10px;margin-bottom:20px;">
        <div style="font-size:11.5px;font-weight:800;color:#b91c1c;">Suspension Reason</div>
        <div style="font-size:12px;color:#7f1d1d;margin-top:2px;">${escapeHtml(user.statusReason)}</div>
      </div>
    ` : ''}

    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h5 style="margin:0;font-size:14px;font-weight:800;color:#0f172a;">⚡ Activity History Timeline (${userActivities.length})</h5>
        <button id="modal-export-user-act" class="secondary-btn" style="height:28px;padding:0 8px;font-size:11px;">📥 Export Log</button>
      </div>

      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;max-height:220px;overflow-y:auto;padding:8px 14px;">
        ${userActivities.length ? userActivities.map(act => `
          <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:10px;align-items:flex-start;">
            <div style="width:6px;height:6px;border-radius:50%;background:#10b981;margin-top:6px;flex-shrink:0;"></div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml(act.eventType.replaceAll('_', ' '))}</div>
              <div style="font-size:10.5px;color:#64748b;margin-top:1px;">${escapeHtml(act.source)} · ${escapeHtml(timeAgo(act.createdAt))}</div>
            </div>
          </div>
        `).join('') : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:11.5px;">No activity events recorded for this user yet.</div>'}
      </div>
    </div>

    <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:14px;border-radius:12px;">
      <div style="font-size:12px;font-weight:800;color:#047857;">✉️ Send Test AI Report Email</div>
      <div style="font-size:11px;color:#166534;margin-top:2px;margin-bottom:10px;">Dispatch an AI monthly report preview to test system email delivery.</div>
      <button id="modal-send-email-btn" class="primary-btn" style="width:100%;height:36px;font-size:12.5px;">Send Test Email Report</button>
    </div>
  `;

  foot.innerHTML = `
    <button class="action-btn-sm ${user.status === 'suspended' ? 'restore' : 'suspend'}" style="padding:8px 16px;font-size:13px;" onclick="window.handleSuspendAction('${escapeHtml(user.userId)}', '${user.status}')">
      ${user.status === 'suspended' ? 'Restore User Access' : 'Suspend Account'}
    </button>
  `;

  backdrop.classList.add('active');

  $('#modal-send-email-btn').addEventListener('click', async () => {
    try {
      toast('Dispatching test report email…');
      await request('/api/owner-monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'send_test_email', userId })
      });
      toast('Test email report dispatched successfully!');
    } catch (err) {
      toast(err.message, true);
    }
  });

  const exportUserActBtn = $('#modal-export-user-act');
  if (exportUserActBtn) {
    exportUserActBtn.addEventListener('click', () => {
      const rows = userActivities.map(a => ({
        id: a.id,
        user_id: a.userId,
        event_type: a.eventType,
        source: a.source,
        created_at: a.createdAt
      }));
      exportCSV(`activity_user_${userId.substring(0, 10)}.csv`, rows);
    });
  }
};

window.handleSuspendAction = async function (userId, currentStatus) {
  let reason = '';
  const action = currentStatus === 'suspended' ? 'restore' : 'suspend';

  if (action === 'suspend') {
    reason = prompt('Reason for suspending this user:', 'Policy or security review') || '';
    if (!reason) return;
  } else if (!confirm('Restore this user’s access?')) return;

  try {
    await request('/api/owner-monitor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, userId, reason })
    });
    toast(action === 'suspend' ? 'User suspended.' : 'User restored.');
    $('#user-modal-backdrop').classList.remove('active');
    await load();
  } catch (error) {
    toast(error.message, true);
  }
};

/* CSV EXPORTS */
function exportCSV(filename, rows) {
  if (!rows || !rows.length) return toast('No data available to export.', true);
  const keys = Object.keys(rows[0]);
  const csvContent = [
    keys.join(','),
    ...rows.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast(`Exported ${filename}`);
}

/* EVENT LISTENERS */
$('#close-modal').addEventListener('click', () => $('#user-modal-backdrop').classList.remove('active'));
$('#user-modal-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#user-modal-backdrop')) $('#user-modal-backdrop').classList.remove('active');
});

const actFilter = $('#activity-user-filter');
if (actFilter) {
  actFilter.addEventListener('change', (e) => {
    state.selectedActivityUser = e.target.value;
    render();
  });
}

$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filterStatus = btn.dataset.filter;
    render();
  });
});

$('#export-users').addEventListener('click', () => {
  if (!state.data) return;
  const rows = state.data.users.map(u => ({
    user_id: u.userId,
    display_name: u.displayName,
    status: u.status,
    expense_count: u.expenseCount,
    budget_count: u.budgetCount,
    activity_count: u.activityCount,
    last_active: u.lastActiveAt
  }));
  exportCSV(`users_export_${new Date().toISOString().slice(0, 10)}.csv`, rows);
});

$('#export-audit').addEventListener('click', () => {
  if (!state.data) return;
  const rows = state.data.audit.map(a => ({
    id: a.id,
    actor: a.actor,
    action: a.action,
    target_user: a.targetUserId,
    created_at: a.createdAt
  }));
  exportCSV(`audit_log_export_${new Date().toISOString().slice(0, 10)}.csv`, rows);
});

$('#users').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const userId = button.dataset.user;
  window.handleSuspendAction(userId, action === 'suspend' ? 'active' : 'suspended');
});

$('#search').addEventListener('input', (e) => {
  state.query = e.target.value.trim();
  render();
});

$('#refresh').addEventListener('click', load);
$('#logout').addEventListener('click', async () => {
  await fetch('/api/owner-auth', { method: 'DELETE', credentials: 'same-origin' });
  location.replace('/owner/login');
});

load();
