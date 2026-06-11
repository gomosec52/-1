// ============================================================
//  CHAT.JS — Чат (polling каждые 4 сек)
//  ИСПРАВЛЕНИЕ: убрана дублирующая функция escHtml
//  (используется из games.js)
// ============================================================

var chatOpen = true;
var lastChatId = 0;
var chatPollInterval = null;

function toggleChat() {
  chatOpen = !chatOpen;
  var body = document.getElementById('chatBody');
  var icon = document.getElementById('chatToggleIcon');
  if (body) body.style.display = chatOpen ? 'flex' : 'none';
  if (icon) icon.textContent = chatOpen ? '▲' : '▼';
}

function loadChatMessages() {
  supaFetch('/rest/v1/chat_messages?order=id.asc&limit=60&select=*')
    .then(function(res) {
      if (!res.ok || !Array.isArray(res.data)) return;
      var msgs = res.data;
      if (msgs.length === 0) return;
      var newMsgs = msgs.filter(function(m) { return m.id > lastChatId; });
      if (newMsgs.length === 0) return;
      lastChatId = msgs[msgs.length - 1].id;
      var container = document.getElementById('chatMessages');
      if (!container) return;
      newMsgs.forEach(function(m) {
        var div = document.createElement('div');
        div.className = 'chat-msg';
        var t  = new Date(m.created_at);
        var hh = ('0' + t.getHours()).slice(-2);
        var mm = ('0' + t.getMinutes()).slice(-2);
        var nick = escHtml ? escHtml(m.user_nick) : String(m.user_nick || '').replace(/</g,'&lt;');
        var text = escHtml ? escHtml(m.message)   : String(m.message || '').replace(/</g,'&lt;');
        div.innerHTML =
          '<span class="nick">' + nick + '</span>' +
          '<span style="color:#b39ddb;font-size:10px">[' + hh + ':' + mm + ']</span> ' +
          text;
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
    })
    .catch(function() {}); // тихо проглатываем ошибки сети
}

function sendChat() {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var msg = (input.value || '').trim();
  if (!msg) return;
  var user = window.currentUser;
  if (!user) {
    if (typeof showToast === 'function') showToast('Нужно войти чтобы писать в чат!');
    else alert('Нужно войти чтобы писать в чат!');
    return;
  }
  input.value = '';
  supaFetch('/rest/v1/chat_messages', 'POST', {
    user_site_id: user.site_id,
    user_nick:    user.nick,
    message:      msg.substring(0, 200),
    created_at:   new Date().toISOString()
  }).then(function() {
    loadChatMessages();
  }).catch(function() {});
}

function startChatPolling() {
  loadChatMessages();
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(loadChatMessages, 4000);
}

document.addEventListener('DOMContentLoaded', function() {
  startChatPolling();
});
