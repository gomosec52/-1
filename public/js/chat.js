// ============================================================
//  CHAT.JS — Чат (polling Supabase каждые 3 сек)
// ============================================================

let chatOpen = true;
let lastChatId = 0;
let chatPollInterval = null;

function toggleChat() {
  chatOpen = !chatOpen;
  const body = document.getElementById('chatBody');
  const icon = document.getElementById('chatToggleIcon');
  body.style.display = chatOpen ? 'flex' : 'none';
  if (icon) icon.textContent = chatOpen ? '▲' : '▼';
}

async function loadChatMessages() {
  const res = await supaFetch(`/rest/v1/chat_messages?order=created_at.asc&limit=60&select=*`);
  if (!res.ok || !Array.isArray(res.data)) return;

  const msgs = res.data;
  if (msgs.length === 0) return;

  const newMsgs = msgs.filter(m => m.id > lastChatId);
  if (newMsgs.length === 0) return;

  lastChatId = msgs[msgs.length - 1].id;
  const container = document.getElementById('chatMessages');
  if (!container) return;

  newMsgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const time = new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<span class="nick">${escHtml(m.user_nick)}</span><span style="color:#b39ddb;font-size:10px">[${time}]</span> ${escHtml(m.message)}`;
    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg) return;

  const user = window.currentUser;
  if (!user) { alert('Нужно войти чтобы писать в чат!'); return; }

  input.value = '';
  await supaFetch('/rest/v1/chat_messages', 'POST', {
    user_site_id: user.site_id,
    user_nick:    user.nick,
    message:      msg.substring(0, 200),
    created_at:   new Date().toISOString(),
  });

  loadChatMessages();
}

function startChatPolling() {
  loadChatMessages();
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(loadChatMessages, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  startChatPolling();
});
