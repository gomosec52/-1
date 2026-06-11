// ============================================================
//  AUTH.JS — Авторизация (Discord OAuth2 + обычная через Supabase)
//  ИСПРАВЛЕНИЯ:
//  - Мобильный: fetch без AbortController fallback
//  - Регистрация: правильный Content-Type и обработка ошибок
//  - Кроссбраузерность: IE11+, Яндекс.Браузер, Opera Mini
// ============================================================

var SUPA_URL = CONFIG.SUPABASE_URL;
var SUPA_KEY = CONFIG.SUPABASE_ANON;

// -------------------------------------------------------
// Универсальный fetch с таймаутом (12 сек)
// ВАЖНО: на мобилах AbortController часто не работает
// -------------------------------------------------------
function supaFetch(path, method, body, extraHeaders) {
  method = method || 'GET';
  extraHeaders = extraHeaders || {};
  var headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  // Объединяем заголовки
  for (var k in extraHeaders) {
    if (extraHeaders.hasOwnProperty(k)) headers[k] = extraHeaders[k];
  }

  var opts = {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  };

  // AbortController — только если реально поддерживается
  var controller = null;
  var timeoutId  = null;
  if (typeof AbortController !== 'undefined') {
    try {
      controller = new AbortController();
      opts.signal = controller.signal;
      timeoutId = setTimeout(function() { controller.abort(); }, 12000);
    } catch(e) {
      controller = null;
    }
  }

  return fetch(SUPA_URL + path, opts)
    .then(function(res) {
      if (timeoutId) clearTimeout(timeoutId);
      return res.text().then(function(text) {
        var data;
        try { data = JSON.parse(text); } catch(e) { data = text; }
        return { ok: res.ok, status: res.status, data: data };
      });
    })
    .catch(function(e) {
      if (timeoutId) clearTimeout(timeoutId);
      // AbortError — таймаут
      var msg = (e && e.name === 'AbortError') ? 'Превышено время ожидания' : ('Ошибка сети: ' + (e.message || String(e)));
      return { ok: false, status: 0, data: { message: msg } };
    });
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
  var user     = window.currentUser;
  var panel    = document.getElementById('userPanel');
  var authBtns = document.getElementById('authButtons');
  var adminBtn = document.getElementById('adminBtn');
  if (!panel || !authBtns) return;

  if (user) {
    panel.style.display    = 'flex';
    authBtns.style.display = 'none';
    var nickEl   = document.getElementById('userNick');
    var idEl     = document.getElementById('userId');
    var avatarEl = document.getElementById('userAvatar');
    if (nickEl)   nickEl.textContent = user.nick || '';
    if (idEl)     idEl.textContent   = 'ID: ' + (user.site_id || '');
    if (avatarEl) {
      avatarEl.src = user.avatar_url || (CONFIG.DEFAULT_AVATAR + encodeURIComponent(user.nick || 'user'));
      avatarEl.onerror = function() {
        avatarEl.onerror = null;
        avatarEl.src = CONFIG.DEFAULT_AVATAR + encodeURIComponent(user.nick || 'user');
      };
    }
    var isAdmin = (CONFIG.ADMIN_IDS.indexOf(user.site_id) !== -1) ||
                  (user.discord_id && CONFIG.ADMIN_IDS.indexOf(user.discord_id) !== -1);
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

// Хэш пароля — SHA-256 если доступен, иначе простой fallback
function hashPass(pass) {
  if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
    var buf = new TextEncoder().encode(pass);
    return window.crypto.subtle.digest('SHA-256', buf).then(function(hash) {
      return Array.from(new Uint8Array(hash))
        .map(function(b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    });
  }
  // Fallback для старых браузеров
  return Promise.resolve((function(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'fb_' + Math.abs(h).toString(16);
  })(pass));
}

// ---------- МОДАЛКИ ----------
function showRegisterForm() {
  var el = document.getElementById('modalRegister');
  if (!el) return;
  document.getElementById('regNick').value  = '';
  document.getElementById('regPass').value  = '';
  document.getElementById('regError').textContent = '';
  el.style.display = 'flex';
}
function showLoginForm() {
  var el = document.getElementById('modalLogin');
  if (!el) return;
  document.getElementById('loginNick').value  = '';
  document.getElementById('loginPass').value  = '';
  document.getElementById('loginError').textContent = '';
  el.style.display = 'flex';
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Закрытие модалки кликом по фону
document.addEventListener('DOMContentLoaded', function() {
  ['modalRegister', 'modalLogin'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function(e) {
      if (e.target === el) closeModal(id);
    });
  });
});

// ---------- ОБЫЧНАЯ РЕГИСТРАЦИЯ ----------
function doRegister() {
  var nick  = (document.getElementById('regNick').value || '').trim();
  var pass  = document.getElementById('regPass').value || '';
  var errEl = document.getElementById('regError');

  if (!nick || nick.length < 2) { errEl.textContent = 'Ник слишком короткий (минимум 2 символа)'; return; }
  if (nick.length > 20)         { errEl.textContent = 'Ник слишком длинный (максимум 20 символов)'; return; }
  if (!pass || pass.length < 4) { errEl.textContent = 'Пароль минимум 4 символа'; return; }

  errEl.textContent = 'Проверяем...';

  // Кнопку блокируем чтобы не было двойного сабмита
  var btn = document.querySelector('#modalRegister .modal-btn');
  if (btn) btn.disabled = true;

  supaFetch('/rest/v1/users?nick=eq.' + encodeURIComponent(nick) + '&select=id')
    .then(function(check) {
      if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
        errEl.textContent = 'Этот ник уже занят';
        if (btn) btn.disabled = false;
        return null;
      }
      errEl.textContent = 'Регистрируем...';
      return hashPass(pass);
    })
    .then(function(hashed) {
      if (!hashed) return; // уже обработано
      var site_id = genSiteId();
      return supaFetch('/rest/v1/users', 'POST', {
        nick: nick,
        password_hash: hashed,
        site_id: site_id,
        auth_type: 'local',
        avatar_url: CONFIG.DEFAULT_AVATAR + encodeURIComponent(nick),
        created_at: new Date().toISOString()
      });
    })
    .then(function(res) {
      if (!res) return;
      if (btn) btn.disabled = false;
      if (!res.ok) {
        var msg = (res.data && res.data.message) ? res.data.message : ('Ошибка ' + res.status);
        // Частая ошибка: дубликат ника на стороне БД
        if (msg && msg.indexOf('duplicate') !== -1) {
          errEl.textContent = 'Этот ник уже занят';
        } else {
          errEl.textContent = 'Ошибка: ' + msg;
        }
        return;
      }
      var user = Array.isArray(res.data) ? res.data[0] : res.data;
      if (!user || !user.nick) {
        errEl.textContent = 'Ошибка: неверный ответ сервера';
        return;
      }
      saveSession({
        nick:      user.nick,
        site_id:   user.site_id,
        avatar_url: user.avatar_url,
        auth_type: 'local',
        db_id:     user.id
      });
      closeModal('modalRegister');
      updateHeaderUI();
      window.dispatchEvent(new Event('userLoggedIn'));
    })
    .catch(function(e) {
      if (btn) btn.disabled = false;
      errEl.textContent = 'Ошибка соединения';
    });
}

// ---------- ОБЫЧНЫЙ ВХОД ----------
function doLogin() {
  var nick  = (document.getElementById('loginNick').value || '').trim();
  var pass  = document.getElementById('loginPass').value || '';
  var errEl = document.getElementById('loginError');

  if (!nick || !pass) { errEl.textContent = 'Заполни все поля'; return; }
  errEl.textContent = 'Входим...';

  var btn = document.querySelector('#modalLogin .modal-btn');
  if (btn) btn.disabled = true;

  hashPass(pass).then(function(hashed) {
    return supaFetch('/rest/v1/users?nick=eq.' + encodeURIComponent(nick) +
      '&password_hash=eq.' + encodeURIComponent(hashed) + '&select=*');
  }).then(function(res) {
    if (btn) btn.disabled = false;
    if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
      errEl.textContent = 'Неверный ник или пароль';
      return;
    }
    var user = res.data[0];
    saveSession({
      nick:      user.nick,
      site_id:   user.site_id,
      avatar_url: user.avatar_url,
      auth_type: 'local',
      db_id:     user.id
    });
    closeModal('modalLogin');
    updateHeaderUI();
    window.dispatchEvent(new Event('userLoggedIn'));
  }).catch(function() {
    if (btn) btn.disabled = false;
    errEl.textContent = 'Ошибка соединения';
  });
}

// ---------- Enter в полях формы ----------
document.addEventListener('DOMContentLoaded', function() {
  function addEnterHandler(inputId, handler) {
    var el = document.getElementById(inputId);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) handler();
    });
  }
  addEnterHandler('regNick',  doRegister);
  addEnterHandler('regPass',  doRegister);
  addEnterHandler('loginNick', doLogin);
  addEnterHandler('loginPass', doLogin);
});

// ---------- DISCORD OAuth2 ----------
function loginDiscord() {
  var redirectUri = encodeURIComponent(window.location.origin + '/pages/discord-callback.html');
  var scope = encodeURIComponent('identify');
  var url = 'https://discord.com/api/oauth2/authorize' +
    '?client_id=' + CONFIG.DISCORD_CLIENT_ID +
    '&redirect_uri=' + redirectUri +
    '&response_type=token' +
    '&scope=' + scope;
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
