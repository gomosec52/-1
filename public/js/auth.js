// ============================================================
//  AUTH.JS — Авторизация (Discord OAuth2 + обычная через Supabase)
// ============================================================

// ---------- Supabase клиент ----------
const SUPA_URL   = CONFIG.SUPABASE_URL;
const SUPA_KEY   = CONFIG.SUPABASE_ANON;

async function supaFetch(path, method = 'GET', body = null, extraHeaders = {}) {
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extraHeaders,
  };
  const res = await fetch(`${SUPA_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ---------- Глобальный стейт ----------
window.currentUser = null;

function saveSession(user) {
  localStorage.setItem('gd_user', JSON.stringify(user));
  window.currentUser = user;
}
function loadSession() {
  const s = localStorage.getItem('gd_user');
  if (s) { window.currentUser = JSON.parse(s); }
  return window.currentUser;
}
function clearSession() {
  localStorage.removeItem('gd_user');
  window.currentUser = null;
}

// ---------- UI обновление шапки ----------
function updateHeaderUI() {
  const user = window.currentUser;
  const panel     = document.getElementById('userPanel');
  const authBtns  = document.getElementById('authButtons');
  const adminBtn  = document.getElementById('adminBtn');
  if (!panel || !authBtns) return;

  if (user) {
    panel.style.display   = 'flex';
    authBtns.style.display= 'none';
    document.getElementById('userNick').textContent   = user.nick;
    document.getElementById('userId').textContent     = 'ID: ' + user.site_id;
    const avatarEl = document.getElementById('userAvatar');
    avatarEl.src = user.avatar_url || (CONFIG.DEFAULT_AVATAR + encodeURIComponent(user.nick));
    avatarEl.onerror = () => { avatarEl.src = CONFIG.DEFAULT_AVATAR + encodeURIComponent(user.nick); };

    // Проверяем админа
    const isAdmin = CONFIG.ADMIN_IDS.includes(user.site_id) || CONFIG.ADMIN_IDS.includes(user.discord_id);
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  } else {
    panel.style.display    = 'none';
    authBtns.style.display = 'flex';
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

// ---------- Генератор site_id ----------
function genSiteId() {
  return 'GD-' + Math.random().toString(36).substring(2, 9).toUpperCase();
}

// ---------- Хэш пароля (простой SHA-256) ----------
async function hashPass(pass) {
  const buf  = new TextEncoder().encode(pass);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- МОДАЛКИ ----------
function showRegisterForm() {
  // СКРИМЕР!
  triggerScreamer();
}
function showLoginForm() {
  document.getElementById('loginNick').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('modalLogin').style.display = 'flex';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ---------- СКРИМЕР ----------
function triggerScreamer() {
  const overlay = document.getElementById('screamer');
  overlay.style.display = 'flex';
  const snd = document.getElementById('screamerSound');
  snd.volume = 1;
  snd.play().catch(() => {});
  // После 2.5 сек — скример исчезает и открывается форма регистрации
  setTimeout(() => {
    overlay.style.display = 'none';
    snd.pause(); snd.currentTime = 0;
    document.getElementById('regNick').value = '';
    document.getElementById('regPass').value = '';
    document.getElementById('regError').textContent = '';
    document.getElementById('modalRegister').style.display = 'flex';
  }, 2500);
  // Клик убирает скример быстрее
  overlay.onclick = () => {
    overlay.style.display = 'none';
    snd.pause(); snd.currentTime = 0;
    document.getElementById('regNick').value = '';
    document.getElementById('regPass').value = '';
    document.getElementById('regError').textContent = '';
    document.getElementById('modalRegister').style.display = 'flex';
  };
}

// ---------- ОБЫЧНАЯ РЕГИСТРАЦИЯ ----------
async function doRegister() {
  const nick = document.getElementById('regNick').value.trim();
  const pass = document.getElementById('regPass').value;
  const errEl = document.getElementById('regError');

  if (!nick || nick.length < 2) { errEl.textContent = 'Ник слишком короткий'; return; }
  if (!pass || pass.length < 4) { errEl.textContent = 'Пароль минимум 4 символа'; return; }

  // Проверяем занят ли ник
  const check = await supaFetch(`/rest/v1/users?nick=eq.${encodeURIComponent(nick)}&select=id`);
  if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
    errEl.textContent = 'Этот ник уже занят'; return;
  }

  const hashed  = await hashPass(pass);
  const site_id = genSiteId();

  const res = await supaFetch('/rest/v1/users', 'POST', {
    nick, password_hash: hashed, site_id,
    auth_type: 'local',
    avatar_url: CONFIG.DEFAULT_AVATAR + encodeURIComponent(nick),
    created_at: new Date().toISOString(),
  });

  if (!res.ok) {
    errEl.textContent = 'Ошибка регистрации: ' + (res.data?.message || res.status); return;
  }

  const user = Array.isArray(res.data) ? res.data[0] : res.data;
  saveSession({ nick: user.nick, site_id: user.site_id, avatar_url: user.avatar_url, auth_type: 'local', db_id: user.id });
  closeModal('modalRegister');
  updateHeaderUI();
  window.dispatchEvent(new Event('userLoggedIn'));
  errEl.textContent = '';
}

// ---------- ОБЫЧНЫЙ ВХОД ----------
async function doLogin() {
  const nick = document.getElementById('loginNick').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');

  if (!nick || !pass) { errEl.textContent = 'Заполни все поля'; return; }

  const hashed = await hashPass(pass);
  const res = await supaFetch(`/rest/v1/users?nick=eq.${encodeURIComponent(nick)}&password_hash=eq.${hashed}&select=*`);

  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    errEl.textContent = 'Неверный ник или пароль'; return;
  }

  const user = res.data[0];
  saveSession({ nick: user.nick, site_id: user.site_id, avatar_url: user.avatar_url, auth_type: 'local', db_id: user.id });
  closeModal('modalLogin');
  updateHeaderUI();
  window.dispatchEvent(new Event('userLoggedIn'));
}

// ---------- DISCORD OAuth2 ----------
function loginDiscord() {
  const redirectUri = encodeURIComponent(window.location.origin + '/pages/discord-callback.html');
  const scope = encodeURIComponent('identify');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
  window.location.href = url;
}

// ---------- ВЫХОД ----------
function logout() {
  clearSession();
  updateHeaderUI();
  window.dispatchEvent(new Event('userLoggedOut'));
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener('DOMContentLoaded', () => {
  loadSession();
  updateHeaderUI();
});
