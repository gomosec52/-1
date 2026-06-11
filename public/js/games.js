// ============================================================
//  GAMES.JS — загрузка игр, лайки, голосование
// ============================================================

let currentPack = 1;

// ---------- Переключение пака ----------
function switchPack(packNum) {
  currentPack = packNum;
  document.querySelectorAll('.pack-btn').forEach(b => b.classList.toggle('active', +b.dataset.pack === packNum));
  document.getElementById('packTitle').textContent = `ПАК ИГР ${packNum}`;
  loadGames(packNum);
}

// ---------- Загрузка игр ----------
async function loadGames(packNum) {
  const list = document.getElementById('gamesList');
  list.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Загрузка игр...</p></div>`;

  const res = await supaFetch(`/rest/v1/games?pack_number=eq.${packNum}&order=sort_order.asc&select=*`);
  if (!res.ok) { list.innerHTML = `<div class="empty-state"><h3>Ошибка загрузки</h3><p>${res.data?.message || res.status}</p></div>`; return; }

  const games = res.data;
  if (!Array.isArray(games) || games.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>Пак пустой</h3><p>Игры ещё не добавлены. Загляни позже!</p></div>`;
    return;
  }

  // Загружаем лайки и голоса одним запросом
  const ids = games.map(g => g.id);
  const [likesRes, votesRes] = await Promise.all([
    supaFetch(`/rest/v1/reactions?game_id=in.(${ids.join(',')})&select=*`),
    supaFetch(`/rest/v1/votes?game_id=in.(${ids.join(',')})&select=*`),
  ]);

  const likes  = likesRes.ok  && Array.isArray(likesRes.data)  ? likesRes.data  : [];
  const votes  = votesRes.ok  && Array.isArray(votesRes.data)  ? votesRes.data  : [];

  list.innerHTML = games.map(g => renderGameCard(g, likes, votes)).join('');
}

// ---------- Рендер карточки игры ----------
function renderGameCard(game, allLikes, allVotes) {
  const user = window.currentUser;
  const uid  = user ? user.site_id : null;

  // Лайки / дизлайки
  const gameLikes   = allLikes.filter(l => l.game_id === game.id);
  const likeCount   = gameLikes.filter(l => l.type === 'like').length;
  const dislikeCount= gameLikes.filter(l => l.type === 'dislike').length;
  const myReaction  = uid ? gameLikes.find(l => l.user_site_id === uid) : null;

  // Голоса
  const gameVotes = allVotes.filter(v => v.game_id === game.id);
  const yesVoters = gameVotes.filter(v => v.choice === 'yes').map(v => v.user_nick);
  const noVoters  = gameVotes.filter(v => v.choice === 'no').map(v => v.user_nick);
  const myVote    = uid ? gameVotes.find(v => v.user_site_id === uid) : null;

  // Видео embed
  const videoEmbed = makeVideoEmbed(game.video_url);

  return `
  <div class="game-card" id="game-${game.id}">
    <div class="game-video-wrap">${videoEmbed}</div>
    <h2 class="game-title">${escHtml(game.title)}</h2>
    <div class="game-meta">
      <div class="meta-item"><div class="meta-label">Размер</div><div class="meta-value">${escHtml(game.size || '—')}</div></div>
      <div class="meta-item"><div class="meta-label">Мультиплеер</div><div class="meta-value">${escHtml(game.multiplayer || '—')}</div></div>
      <div class="meta-item"><div class="meta-label">Жанр</div><div class="meta-value">${escHtml(game.genre || '—')}</div></div>
    </div>
    <p class="game-desc">${escHtml(game.description || '')}</p>

    <div class="game-reactions">
      <button class="reaction-btn ${myReaction?.type === 'like' ? 'liked' : ''}"
              onclick="toggleReaction('${game.id}', 'like')">
        👍 <span class="reaction-count" id="likes-${game.id}">${likeCount}</span>
      </button>
      <button class="reaction-btn ${myReaction?.type === 'dislike' ? 'disliked' : ''}"
              onclick="toggleReaction('${game.id}', 'dislike')">
        👎 <span class="reaction-count" id="dislikes-${game.id}">${dislikeCount}</span>
      </button>
    </div>

    <div class="game-vote">
      <div class="vote-title">🎮 ГОЛОСОВАНИЕ</div>
      <div class="vote-options">
        <button class="vote-btn yes ${myVote?.choice === 'yes' ? 'chosen' : ''}"
                onclick="castVote('${game.id}', 'yes')">✅ Играем</button>
        <button class="vote-btn no  ${myVote?.choice === 'no' ? 'chosen' : ''}"
                onclick="castVote('${game.id}', 'no')">❌ Не играем</button>
      </div>
      <div class="vote-results">
        <div class="vote-names" id="yes-names-${game.id}">
          ✅ ${yesVoters.length > 0 ? yesVoters.join(', ') : '—'}
        </div>
        <div class="vote-names" id="no-names-${game.id}">
          ❌ ${noVoters.length > 0 ? noVoters.join(', ') : '—'}
        </div>
      </div>
    </div>
  </div>`;
}

// ---------- Видео embed ----------
function makeVideoEmbed(url) {
  if (!url) return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555">Нет видео</div>';

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen allow="autoplay"></iframe>`;

  // Прямая ссылка на mp4
  if (url.endsWith('.mp4') || url.includes('.mp4')) {
    return `<video src="${url}" controls preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`;
  }

  return `<iframe src="${url}" allowfullscreen></iframe>`;
}

// ---------- Реакции ----------
async function toggleReaction(gameId, type) {
  const user = window.currentUser;
  if (!user) { alert('Нужно войти!'); return; }

  const uid  = user.site_id;
  const nick = user.nick;

  // Получаем текущую реакцию
  const res = await supaFetch(`/rest/v1/reactions?game_id=eq.${gameId}&user_site_id=eq.${encodeURIComponent(uid)}&select=*`);
  const existing = res.ok && Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;

  if (existing) {
    if (existing.type === type) {
      // Убираем реакцию
      await supaFetch(`/rest/v1/reactions?id=eq.${existing.id}`, 'DELETE');
    } else {
      // Меняем реакцию
      await supaFetch(`/rest/v1/reactions?id=eq.${existing.id}`, 'PATCH', { type });
    }
  } else {
    // Добавляем
    await supaFetch('/rest/v1/reactions', 'POST', { game_id: gameId, user_site_id: uid, user_nick: nick, type });
  }

  // Перезагружаем только эту игру
  refreshGameReactions(gameId);
}

async function refreshGameReactions(gameId) {
  const r = await supaFetch(`/rest/v1/reactions?game_id=eq.${gameId}&select=*`);
  if (!r.ok) return;
  const likes    = r.data.filter(l => l.type === 'like').length;
  const dislikes = r.data.filter(l => l.type === 'dislike').length;
  const uid = window.currentUser?.site_id;
  const my  = uid ? r.data.find(l => l.user_site_id === uid) : null;

  const el = document.getElementById(`game-${gameId}`);
  if (!el) return;

  document.getElementById(`likes-${gameId}`).textContent    = likes;
  document.getElementById(`dislikes-${gameId}`).textContent = dislikes;

  el.querySelectorAll('.reaction-btn').forEach((btn, i) => {
    btn.classList.remove('liked', 'disliked');
    if (i === 0 && my?.type === 'like')    btn.classList.add('liked');
    if (i === 1 && my?.type === 'dislike') btn.classList.add('disliked');
  });
}

// ---------- Голосование ----------
async function castVote(gameId, choice) {
  const user = window.currentUser;
  if (!user) { alert('Нужно войти!'); return; }

  const uid  = user.site_id;
  const nick = user.nick;

  const existing = await supaFetch(`/rest/v1/votes?game_id=eq.${gameId}&user_site_id=eq.${encodeURIComponent(uid)}&select=*`);
  const prev = existing.ok && Array.isArray(existing.data) && existing.data.length > 0 ? existing.data[0] : null;

  if (prev) {
    if (prev.choice === choice) {
      await supaFetch(`/rest/v1/votes?id=eq.${prev.id}`, 'DELETE');
    } else {
      await supaFetch(`/rest/v1/votes?id=eq.${prev.id}`, 'PATCH', { choice });
    }
  } else {
    await supaFetch('/rest/v1/votes', 'POST', { game_id: gameId, user_site_id: uid, user_nick: nick, choice });
  }

  refreshGameVotes(gameId);
}

async function refreshGameVotes(gameId) {
  const r = await supaFetch(`/rest/v1/votes?game_id=eq.${gameId}&select=*`);
  if (!r.ok) return;
  const yes = r.data.filter(v => v.choice === 'yes').map(v => v.user_nick);
  const no  = r.data.filter(v => v.choice === 'no').map(v => v.user_nick);
  const uid = window.currentUser?.site_id;
  const my  = uid ? r.data.find(v => v.user_site_id === uid) : null;

  const yEl = document.getElementById(`yes-names-${gameId}`);
  const nEl = document.getElementById(`no-names-${gameId}`);
  const el  = document.getElementById(`game-${gameId}`);

  if (yEl) yEl.textContent = '✅ ' + (yes.length > 0 ? yes.join(', ') : '—');
  if (nEl) nEl.textContent = '❌ ' + (no.length  > 0 ? no.join(', ') : '—');

  if (el) {
    el.querySelectorAll('.vote-btn').forEach((btn, i) => {
      btn.classList.remove('chosen');
      if (i === 0 && my?.choice === 'yes') btn.classList.add('chosen');
      if (i === 1 && my?.choice === 'no')  btn.classList.add('chosen');
    });
  }
}

// ---------- Утилиты ----------
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------- Инициализация ----------
document.addEventListener('DOMContentLoaded', () => {
  loadGames(1);
});

window.addEventListener('userLoggedIn',  () => loadGames(currentPack));
window.addEventListener('userLoggedOut', () => loadGames(currentPack));
