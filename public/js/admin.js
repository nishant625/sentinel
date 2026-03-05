const API = '';  // same origin
let adminSecret = '';

// ── Auth ───────────────────────────────────────────────────────────────────

async function login() {
  const secret = document.getElementById('secret-input').value.trim();
  if (!secret) return;

  const res = await fetch(`${API}/admin/clients`, {
    headers: { 'x-admin-secret': secret }
  });

  if (res.status === 401) {
    document.getElementById('login-error').textContent = 'Invalid secret';
    return;
  }

  adminSecret = secret;
  sessionStorage.setItem('adminSecret', secret);
  showMain();
  loadClients();
}

function logout() {
  sessionStorage.removeItem('adminSecret');
  adminSecret = '';
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('secret-input').value = '';
}

function showMain() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'block';
}

// Auto-restore session
window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('adminSecret');
  if (saved) {
    adminSecret = saved;
    showMain();
    loadClients();
  }

  document.getElementById('secret-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});

// ── Clients ────────────────────────────────────────────────────────────────

async function loadClients() {
  const res = await fetch(`${API}/admin/clients`, {
    headers: { 'x-admin-secret': adminSecret }
  });

  if (!res.ok) { logout(); return; }

  const clients = await res.json();
  const list = document.getElementById('client-list');

  if (!clients.length) {
    return;
  }

  list.innerHTML = clients.map(c => `
    <div class="client-item">
      <div class="client-info">
        <div class="client-name">${esc(c.name)}</div>
        <div class="client-id">${esc(c.clientId)}</div>
        <div class="client-meta">
          <span class="badge ${c.isPublic ? 'badge-public' : 'badge-confidential'}">

            ${c.isPublic ? 'Public' : 'Confidential'}
          </span>
          <span class="badge badge-jwt">${esc(c.tokenFormat)}</span>
          <span class="badge badge-scope">${esc(c.scopes)}</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#444">
          ${c.redirectUris.map(u => `<div>${esc(u)}</div>`).join('')}
        </div>
      </div>
      <button class="btn-danger" onclick="deleteClient('${esc(c.clientId)}', '${esc(c.name)}')">Delete</button>
    </div>
  `).join('');
}

async function createClient() {
  const name      = document.getElementById('f-name').value.trim();
  const uris      = document.getElementById('f-uris').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
  const scopes    = document.getElementById('f-scopes').value.trim();
  const isPublic  = document.getElementById('f-public').checked;
  const format    = document.getElementById('f-format').value;
  const errEl     = document.getElementById('create-error');

  errEl.textContent = '';

  if (!name)        { errEl.textContent = 'Name is required'; return; }
  if (!uris.length) { errEl.textContent = 'At least one redirect URI is required'; return; }

  const res = await fetch(`${API}/admin/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': adminSecret,
    },
    body: JSON.stringify({ name, isPublic, redirectUris: uris, scopes, tokenFormat: format }),
  });

  const data = await res.json();

  if (!res.ok) {
    errEl.textContent = data.error || 'Failed to create client';
    return;
  }

  // Reset form
  document.getElementById('f-name').value   = '';
  document.getElementById('f-uris').value   = '';
  document.getElementById('f-scopes').value = 'openid';
  document.getElementById('f-public').checked = true;

  // Show secret if confidential
  if (data.clientSecret) {
    document.getElementById('secret-reveal-value').textContent = data.clientSecret;
    document.getElementById('secret-reveal').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  loadClients();
}

async function deleteClient(clientId, name) {
  if (!confirm(`Delete client "${name}"?\n\nThis cannot be undone.`)) return;

  const res = await fetch(`${API}/admin/clients/${clientId}`, {
    method: 'DELETE',
    headers: { 'x-admin-secret': adminSecret },
  });

  if (res.ok) loadClients();
}

function copySecret() {
  const val = document.getElementById('secret-reveal-value').textContent;
  navigator.clipboard.writeText(val);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
