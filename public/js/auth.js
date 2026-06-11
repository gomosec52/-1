// ============================================================
//  AUTH.JS — Авторизация (Discord OAuth2 + обычная через Supabase)
//  Оптимизировано: убран скример, кроссбраузерность
// ============================================================

const SUPA_URL = CONFIG.SUPABASE_URL;
const SUPA_KEY = CONFIG.SUPABASE_ANON;

// Универсальный fetch с таймаутом (для медленных соединений в РФ)
async function supaFetch(path, method, body, extraHeaders) {
  method = method || 'GET';
  extraHeaders = extraHeaders || {};
  var headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  Object.assign(headers, extraHeaders);

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 12000) : null;

  try {
    var opts = { method: method, headers: headers, body: body ? JSON.stringify(body) : null };
    if (controller) opts.signal = controller.signal;
    var res = await fetch(SUPA_URL + path, opts);
    if (timeoutId) clearTimeout(timeoutId);
    var text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch(e) { return { ok: res.ok, status: res.status, data: text }; }
  } catch(e) {
    if (timeoutId) clearTimeout(timeoutId);
    return { ok: false, status: 0, data: { message: 'Ошибка сети: ' + (e.message || e) } };
  }
}

// ---------- Глобальный стейт ----------
window.currentUser = null;

function saveSession(user) {
  try { localStorage.setItem('gd_user', JSON.stringify(user)); } catch(e) {}
  window.currentUser = user;
}
function loadSession() {
  try {
    var s = localStorage.getItem('gd_user');
    if (s) window.currentUser = JSON.parse(s);
  } catch(e) {}
  return window.currentUser;
}
function clearSession() {
  try { localStorage.removeItem('gd_user'); } catch(e) {}
  window.currentUser = null;
}

// ---------- UI обновление шапки ----------
function updateHeaderUI() {
  var user = window.currentUser;
  var panel    = document.getElementById('userPanel');
  var authBtns = document.getElementById('authButtons');
  var adminBtn = document.getElementById('adminBtn');
  if (!panel || !authBtns) return;

  if (user) {
    panel.style.display    = 'flex';
    authBtns.style.display = 'none';
    document.getElementById('userNick').textContent = user.nick;
    document.getElementById('userId').textContent   = 'ID: ' + user.site_id;
    var avatarEl = document.getElementById('userAvatar');
    avatarEl.src = user.avatar_url || (CONFIG.DEFAULT_AVATAR + encodeURIComponent(user.nick));
    avatarEl.onerror = function() { avatarEl.src = CONFIG.DEFAULT_AVATAR + encodeURIComponent(user.nick); };
    var isAdmin = CONFIG.ADMIN_IDS.indexOf(user.site_id) !== -1 || CONFIG.ADMIN_IDS.indexOf(user.discord_id) !== -1;
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  } else {
    panel.style.display    = 'none';
    authBtns.style.display = 'flex';
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function genSiteId() {
  return 'GD-' + Math.random().toString(36).substring(2, 9).toUpperCase();
}

async function hashPass(pass) {
  if (window.crypto && window.crypto.subtle) {
    var buf  = new TextEncoder().encode(pass);
    var hash = await window.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  // Фоллбэк для старых браузеров — простой хэш
  var h = 0;
  for (var i = 0; i < pass.length; i++) { h = ((h << 5) - h) + pass.charCodeAt(i); h |= 0; }
  return 'fb_' + Math.abs(h).toString(16);
}

// ---------- МОДАЛКИ ----------
function showRegisterForm() {
  document.getElementById('regNick').value = '';
  document.getElementById('regPass').value = '';
  document.getElementById('regError').textContent = '';
  document.getElementById('modalRegister').style.display = 'flex';
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

// ---------- ОБЫЧНАЯ РЕГИСТРАЦИЯ ----------
async function doRegister() {
  var nick  = document.getElementById('regNick').value.trim();
  var pass  = document.getElementById('regPass').value;
  var errEl = document.getElementById('regError');

  if (!nick || nick.length < 2) { errEl.textContent = 'Ник слишком короткий'; return; }
  if (!pass || pass.length < 4) { errEl.textContent = 'Пароль минимум 4 символа'; return; }

  errEl.textContent = 'Проверяем...';
  var check = await supaFetch('/rest/v1/users?nick=eq.' + encodeURIComponent(nick) + '&select=id');
  if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
    errEl.textContent = 'Этот ник уже занят'; return;
  }

  var hashed  = await hashPass(pass);
  var site_id = genSiteId();
  errEl.textContent = 'Регистрируем...';

  var res = await supaFetch('/rest/v1/users', 'POST', {
    nick: nick, password_hash: hashed, site_id: site_id,
    auth_type: 'local',
    avatar_url: CONFIG.DEFAULT_AVATAR + encodeURIComponent(nick),
    created_at: new Date().toISOString()
  });

  if (!res.ok) { errEl.textContent = 'Ошибка: ' + (res.data && res.data.message ? res.data.message : res.status); return; }

  var user = Array.isArray(res.data) ? res.data[0] : res.data;
  saveSession({ nick: user.nick, site_id: user.site_id, avatar_url: user.avatar_url, auth_type: 'local', db_id: user.id });
  closeModal('modalRegister');
  updateHeaderUI();
  window.dispatchEvent(new Event('userLoggedIn'));
  errEl.textContent = '';
}

// ---------- ОБЫЧНЫЙ ВХОД ----------
async function doLogin() {
  var nick  = document.getElementById('loginNick').value.trim();
  var pass  = document.getElementById('loginPass').value;
  var errEl = document.getElementById('loginError');

  if (!nick || !pass) { errEl.textContent = 'Заполни все поля'; return; }
  errEl.textContent = 'Входим...';

  var hashed = await hashPass(pass);
  var res = await supaFetch('/rest/v1/users?nick=eq.' + encodeURIComponent(nick) + '&password_hash=eq.' + hashed + '&select=*');

  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    errEl.textContent = 'Неверный ник или пароль'; return;
  }

  var user = res.data[0];
  saveSession({ nick: user.nick, site_id: user.site_id, avatar_url: user.avatar_url, auth_type: 'local', db_id: user.id });
  closeModal('modalLogin');
  updateHeaderUI();
  window.dispatchEvent(new Event('userLoggedIn'));
}

// ---------- DISCORD OAuth2 ----------
function loginDiscord() {
  var redirectUri = encodeURIComponent(window.location.origin + '/pages/discord-callback.html');
  var scope = encodeURIComponent('identify');
  var url = 'https://discord.com/api/oauth2/authorize?client_id=' + CONFIG.DISCORD_CLIENT_ID + '&redirect_uri=' + redirectUri + '&response_type=token&scope=' + scope;
  window.location.href = url;
}

// ---------- ВЫХОД ----------
function logout() {
  clearSession();
  updateHeaderUI();
  window.dispatchEvent(new Event('userLoggedOut'));
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener('DOMContentLoaded', function() {
  loadSession();
  updateHeaderUI();
});
