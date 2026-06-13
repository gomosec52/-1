const socket = io();
let me = null;
let pack = 1;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);

async function api(url, opt = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opt
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Ошибка');
  return json;
}

function safeImageUrl(url) {
  const value = String(url || '');
  if (value.startsWith('/api/avatar/')) return value;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '/api/avatar/user';
  } catch {
    return '/api/avatar/user';
  }
}

function embed(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.includes('youtube.com/watch?v=')) return value.replace('watch?v=', 'embed/');
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function showScreamer() {
  const screamer = $('#screamer');
  const audio = $('#screamAudio');
  screamer.classList.remove('hidden');
  if (audio) {
    audio.currentTime = 0;
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }
  setTimeout(() => screamer.classList.add('hidden'), 1700);
}

async function loadMe() {
  const data = await api('/api/me');
  me = data.user;
  renderProfile(data.isAdmin);
  $('#auth').classList.toggle('hidden', !!me);
  $('#content').classList.toggle('hidden', !me);
  $('#chat').classList.toggle('hidden', !me);
  if (me) {
    renderPacks();
    await Promise.all([loadGames(), loadChat()]);
  }
}

function renderProfile(isAdmin) {
  const profile = $('#profile');
  if (!me) {
    profile.innerHTML = '';
    return;
  }
  profile.innerHTML = `
    <img class="avatar" src="${escapeHtml(safeImageUrl(me.avatar_url))}" alt="Аватар ${escapeHtml(me.username)}">
    <div class="profileText">
      <b>${escapeHtml(me.username)}</b>
      <div class="small">Твой Site ID: <code>${escapeHtml(me.public_id)}</code></div>
      <div class="profileLinks">
        ${isAdmin ? '<a href="/admin">Админка</a>' : ''}
        <button class="linkButton" id="copyId" type="button">Скопировать ID</button>
        <a href="#" id="logout">Выйти</a>
      </div>
    </div>`;
  $('#copyId')?.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(me.public_id).catch(() => {});
    $('#copyId').textContent = 'ID скопирован';
  });
  $('#logout')?.addEventListener('click', async (event) => {
    event.preventDefault();
    await api('/api/auth/logout', { method: 'POST' });
    location.reload();
  });
}

function renderPacks() {
  const nav = $('#packs');
  nav.innerHTML = '';
  for (let i = 1; i <= 5; i += 1) {
    const button = document.createElement('button');
    button.textContent = `пак игр ${i}`;
    button.className = i === pack ? 'active' : '';
    button.style.setProperty('--art-pos', `${(i - 1) * 22}%`);
    button.onclick = () => {
      pack = i;
      renderPacks();
      loadGames();
    };
    nav.append(button);
  }
}

function renderVoteNames(votes, choice) {
  const names = votes.filter((voteItem) => voteItem.choice === choice).map((voteItem) => escapeHtml(voteItem.username));
  return names.length ? names.join(', ') : 'никого';
}

async function loadGames() {
  const data = await api(`/api/games/${pack}`);
  $('#packTitle').textContent = `Пак игр ${pack}`;
  $('#games').innerHTML = data.games.map((game) => {
    const video = embed(game.video_url);
    return `
      <article class="game">
        ${video ? `<iframe class="video" src="${escapeHtml(video)}" allowfullscreen loading="lazy"></iframe>` : '<div class="video videoEmpty">Видео появится после добавления ссылки</div>'}
        <h2>${escapeHtml(game.title)}</h2>
        <div class="meta">
          <span class="tag">Вес: ${escapeHtml(game.size || '-')}</span>
          <span class="tag">Мультиплеер: ${escapeHtml(game.multiplayer || '-')}</span>
          <span class="tag">Жанр: ${escapeHtml(game.genre || '-')}</span>
        </div>
        <p>${escapeHtml(game.description || '')}</p>
        <div class="actions">
          <button type="button" onclick="react(${Number(game.id)},1)">Лайк ${Number(game.likes) || 0}</button>
          <button type="button" onclick="react(${Number(game.id)},-1)">Дизлайк ${Number(game.dislikes) || 0}</button>
        </div>
        <div class="votes">
          <button type="button" onclick="vote(${Number(game.id)},'yes')">играем</button>
          <button type="button" onclick="vote(${Number(game.id)},'no')">не играем</button>
        </div>
        <div class="voteList">
          <b>Играем:</b> ${renderVoteNames(game.votes || [], 'yes')}<br>
          <b>Не играем:</b> ${renderVoteNames(game.votes || [], 'no')}
        </div>
      </article>`;
  }).join('') || '<p class="empty">В этом паке пока нет игр. Админ может добавить их через панель.</p>';
}

async function react(id, value) {
  await api(`/api/games/${id}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ value })
  });
  loadGames();
}

async function vote(id, choice) {
  await api(`/api/games/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ choice })
  });
  loadGames();
}

window.react = react;
window.vote = vote;

socket.on('dataChanged', () => {
  if (me) loadGames();
});
socket.on('chat', (message) => addMsg(message));

async function loadChat() {
  const data = await api('/api/chat');
  $('#chatMessages').innerHTML = '';
  data.messages.forEach(addMsg);
}

function addMsg(message) {
  const wrapper = document.createElement('div');
  const author = document.createElement('b');
  const text = document.createElement('p');
  wrapper.className = 'msg';
  author.textContent = message.username;
  text.textContent = message.message;
  wrapper.append(author, text);
  $('#chatMessages').append(wrapper);
  $('#chatMessages').scrollTop = 99999;
}

$('#chatForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = event.target.message.value.trim();
  if (!value) return;
  socket.emit('chat', value);
  event.target.reset();
});

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.target)))
    });
    location.reload();
  } catch (error) {
    $('#authMsg').textContent = error.message;
  }
});

$('#regForm').addEventListener('submit', (event) => {
  event.preventDefault();
  showScreamer();
  setTimeout(async () => {
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(event.target)))
      });
      location.reload();
    } catch (error) {
      $('#authMsg').textContent = error.message;
    }
  }, 900);
});

loadMe();
