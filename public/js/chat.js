// ============================================================
//  CHAT.JS — Чат (кроссбраузерный, polling каждые 4 сек)
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

async function loadChatMessages() {
  try {
    var res = await supaFetch('/rest/v1/chat_messages?order=created_at.asc&limit=60&select=*');
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
      var t = new Date(m.created_at);
      var hh = ('0' + t.getHours()).slice(-2);
      var mm = ('0' + t.getMinutes()).slice(-2);
      div.innerHTML = '<span class="nick">' + escHtml(m.user_nick) + '</span>' +
        '<span style="color:#b39ddb;font-size:10px">[' + hh + ':' + mm + ']</span> ' +
        escHtml(m.message);
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

async function sendChat() {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var msg = input.value.trim();
  if (!msg) return;
  var user = window.currentUser;
  if (!user) { alert('Нужно войти чтобы писать в чат!'); return; }
  input.value = '';
  try {
    await supaFetch('/rest/v1/chat_messages', 'POST', {
      user_site_id: user.site_id,
      user_nick:    user.nick,
      message:      msg.substring(0, 200),
      created_at:   new Date().toISOString()
    });
    loadChatMessages();
  } catch(e) {}
}

function startChatPolling() {
  loadChatMessages();
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(loadChatMessages, 4000);
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', function() {
  startChatPolling();
});
