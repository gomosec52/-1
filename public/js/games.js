// ============================================================
//  GAMES.JS — загрузка игр, лайки, голосование
//  Оптимизировано: кеш, параллельные запросы, кроссбраузерность
// ============================================================

var currentPack = 1;
var gamesCache = {}; // Кеш игр по пакам

// ---------- Переключение пака ----------
function switchPack(packNum) {
  currentPack = packNum;
  var btns = document.querySelectorAll('.pack-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', parseInt(btns[i].getAttribute('data-pack')) === packNum);
  }
  document.getElementById('packTitle').textContent = 'ПАК ИГР ' + packNum;
  loadGames(packNum);
}

// ---------- Загрузка игр (с кешем) ----------
async function loadGames(packNum) {
  var list = document.getElementById('gamesList');
  list.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка игр...</p></div>';

  // Используем кеш если есть (обновляем в фоне)
  if (gamesCache[packNum]) {
    renderGames(gamesCache[packNum].games, gamesCache[packNum].likes, gamesCache[packNum].votes);
  }

  try {
    var res = await supaFetch('/rest/v1/games?pack_number=eq.' + packNum + '&order=sort_order.asc&select=*');
    if (!res.ok) {
      if (!gamesCache[packNum]) {
        list.innerHTML = '<div class="empty-state"><h3>Ошибка загрузки</h3><p>Проверь подключение к интернету и обнови страницу.</p></div>';
      }
      return;
    }

    var games = res.data;
    if (!Array.isArray(games) || games.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Пак пустой</h3><p>Игры ещё не добавлены. Загляни позже!</p></div>';
      return;
    }

    // Загружаем лайки и голоса параллельно
    var ids = games.map(function(g) { return g.id; }).join(',');
    var results = await Promise.all([
      supaFetch('/rest/v1/reactions?game_id=in.(' + ids + ')&select=*'),
      supaFetch('/rest/v1/votes?game_id=in.(' + ids + ')&select=*')
    ]);

    var likes = results[0].ok && Array.isArray(results[0].data) ? results[0].data : [];
    var votes = results[1].ok && Array.isArray(results[1].data) ? results[1].data : [];

    // Сохраняем в кеш
    gamesCache[packNum] = { games: games, likes: likes, votes: votes, ts: Date.now() };
    renderGames(games, likes, votes);

  } catch(e) {
    if (!gamesCache[packNum]) {
      list.innerHTML = '<div class="empty-state"><h3>Ошибка загрузки</h3><p>Нет соединения с сервером.</p></div>';
    }
  }
}

function renderGames(games, likes, votes) {
  var list = document.getElementById('gamesList');
  if (!list) return;
  list.innerHTML = games.map(function(g) { return renderGameCard(g, likes, votes); }).join('');
}

// ---------- Рендер карточки ----------
function renderGameCard(game, allLikes, allVotes) {
  var user = window.currentUser;
  var uid  = user ? user.site_id : null;

  var gameLikes    = allLikes.filter(function(l) { return l.game_id === game.id; });
  var likeCount    = gameLikes.filter(function(l) { return l.type === 'like'; }).length;
  var dislikeCount = gameLikes.filter(function(l) { return l.type === 'dislike'; }).length;
  var myReaction   = uid ? gameLikes.filter(function(l) { return l.user_site_id === uid; })[0] : null;

  var gameVotes = allVotes.filter(function(v) { return v.game_id === game.id; });
  var yesVoters = gameVotes.filter(function(v) { return v.choice === 'yes'; }).map(function(v) { return v.user_nick; });
  var noVoters  = gameVotes.filter(function(v) { return v.choice === 'no'; }).map(function(v) { return v.user_nick; });
  var myVote    = uid ? gameVotes.filter(function(v) { return v.user_site_id === uid; })[0] : null;

  var videoEmbed = makeVideoEmbed(game.video_url);

  return '<div class="game-card" id="game-' + game.id + '">' +
    '<div class="game-video-wrap">' + videoEmbed + '</div>' +
    '<h2 class="game-title">' + escHtml(game.title) + '</h2>' +
    '<div class="game-meta">' +
      '<div class="meta-item"><div class="meta-label">Размер</div><div class="meta-value">' + escHtml(game.size || '—') + '</div></div>' +
      '<div class="meta-item"><div class="meta-label">Мультиплеер</div><div class="meta-value">' + escHtml(game.multiplayer || '—') + '</div></div>' +
      '<div class="meta-item"><div class="meta-label">Жанр</div><div class="meta-value">' + escHtml(game.genre || '—') + '</div></div>' +
    '</div>' +
    '<p class="game-desc">' + escHtml(game.description || '') + '</p>' +
    '<div class="game-reactions">' +
      '<button class="reaction-btn' + (myReaction && myReaction.type === 'like' ? ' liked' : '') + '" onclick="toggleReaction(\'' + game.id + '\', \'like\')">' +
        '👍 <span class="reaction-count" id="likes-' + game.id + '">' + likeCount + '</span>' +
      '</button>' +
      '<button class="reaction-btn' + (myReaction && myReaction.type === 'dislike' ? ' disliked' : '') + '" onclick="toggleReaction(\'' + game.id + '\', \'dislike\')">' +
        '👎 <span class="reaction-count" id="dislikes-' + game.id + '">' + dislikeCount + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="game-vote">' +
      '<div class="vote-title">🎮 ГОЛОСОВАНИЕ</div>' +
      '<div class="vote-options">' +
        '<button class="vote-btn yes' + (myVote && myVote.choice === 'yes' ? ' chosen' : '') + '" onclick="castVote(\'' + game.id + '\', \'yes\')">✅ Играем</button>' +
        '<button class="vote-btn no' + (myVote && myVote.choice === 'no' ? ' chosen' : '') + '" onclick="castVote(\'' + game.id + '\', \'no\')">❌ Не играем</button>' +
      '</div>' +
      '<div class="vote-results">' +
        '<div class="vote-names" id="yes-names-' + game.id + '">✅ ' + (yesVoters.length > 0 ? yesVoters.join(', ') : '—') + '</div>' +
        '<div class="vote-names" id="no-names-' + game.id + '">❌ ' + (noVoters.length > 0 ? noVoters.join(', ') : '—') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ---------- Видео embed (с lazy loading) ----------
function makeVideoEmbed(url) {
  if (!url) return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555">Нет видео</div>';
  var ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) {
    // loading="lazy" для YouTube — не грузим пока не нужно
    return '<iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0" allowfullscreen allow="autoplay" loading="lazy"></iframe>';
  }
  if (url.indexOf('.mp4') !== -1) {
    return '<video src="' + url + '" controls preload="none" style="width:100%;height:100%;object-fit:cover"></video>';
  }
  return '<iframe src="' + url + '" allowfullscreen loading="lazy"></iframe>';
}

// ---------- Реакции ----------
async function toggleReaction(gameId, type) {
  var user = window.currentUser;
  if (!user) { alert('Нужно войти!'); return; }
  var uid = user.site_id, nick = user.nick;

  var res = await supaFetch('/rest/v1/reactions?game_id=eq.' + gameId + '&user_site_id=eq.' + encodeURIComponent(uid) + '&select=*');
  var existing = res.ok && Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;

  if (existing) {
    if (existing.type === type) {
      await supaFetch('/rest/v1/reactions?id=eq.' + existing.id, 'DELETE');
    } else {
      await supaFetch('/rest/v1/reactions?id=eq.' + existing.id, 'PATCH', { type: type });
    }
  } else {
    await supaFetch('/rest/v1/reactions', 'POST', { game_id: gameId, user_site_id: uid, user_nick: nick, type: type });
  }
  refreshGameReactions(gameId);
}

async function refreshGameReactions(gameId) {
  var r = await supaFetch('/rest/v1/reactions?game_id=eq.' + gameId + '&select=*');
  if (!r.ok) return;
  var likes    = r.data.filter(function(l) { return l.type === 'like'; }).length;
  var dislikes = r.data.filter(function(l) { return l.type === 'dislike'; }).length;
  var uid = window.currentUser ? window.currentUser.site_id : null;
  var my  = uid ? r.data.filter(function(l) { return l.user_site_id === uid; })[0] : null;

  var el = document.getElementById('game-' + gameId);
  if (!el) return;
  var likesEl    = document.getElementById('likes-' + gameId);
  var dislikesEl = document.getElementById('dislikes-' + gameId);
  if (likesEl)    likesEl.textContent    = likes;
  if (dislikesEl) dislikesEl.textContent = dislikes;

  var btns = el.querySelectorAll('.reaction-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove('liked', 'disliked');
    if (i === 0 && my && my.type === 'like')    btns[i].classList.add('liked');
    if (i === 1 && my && my.type === 'dislike') btns[i].classList.add('disliked');
  }
}

// ---------- Голосование ----------
async function castVote(gameId, choice) {
  var user = window.currentUser;
  if (!user) { alert('Нужно войти!'); return; }
  var uid = user.site_id, nick = user.nick;

  var existing = await supaFetch('/rest/v1/votes?game_id=eq.' + gameId + '&user_site_id=eq.' + encodeURIComponent(uid) + '&select=*');
  var prev = existing.ok && Array.isArray(existing.data) && existing.data.length > 0 ? existing.data[0] : null;

  if (prev) {
    if (prev.choice === choice) { await supaFetch('/rest/v1/votes?id=eq.' + prev.id, 'DELETE'); }
    else { await supaFetch('/rest/v1/votes?id=eq.' + prev.id, 'PATCH', { choice: choice }); }
  } else {
    await supaFetch('/rest/v1/votes', 'POST', { game_id: gameId, user_site_id: uid, user_nick: nick, choice: choice });
  }
  refreshGameVotes(gameId);
}

async function refreshGameVotes(gameId) {
  var r = await supaFetch('/rest/v1/votes?game_id=eq.' + gameId + '&select=*');
  if (!r.ok) return;
  var yes = r.data.filter(function(v) { return v.choice === 'yes'; }).map(function(v) { return v.user_nick; });
  var no  = r.data.filter(function(v) { return v.choice === 'no'; }).map(function(v) { return v.user_nick; });
  var uid = window.currentUser ? window.currentUser.site_id : null;
  var my  = uid ? r.data.filter(function(v) { return v.user_site_id === uid; })[0] : null;

  var yEl = document.getElementById('yes-names-' + gameId);
  var nEl = document.getElementById('no-names-' + gameId);
  var el  = document.getElementById('game-' + gameId);
  if (yEl) yEl.textContent = '✅ ' + (yes.length > 0 ? yes.join(', ') : '—');
  if (nEl) nEl.textContent = '❌ ' + (no.length  > 0 ? no.join(', ') : '—');
  if (el) {
    var btns = el.querySelectorAll('.vote-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('chosen');
      if (i === 0 && my && my.choice === 'yes') btns[i].classList.add('chosen');
      if (i === 1 && my && my.choice === 'no')  btns[i].classList.add('chosen');
    }
  }
}

// ---------- Утилиты ----------
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------- Инициализация ----------
document.addEventListener('DOMContentLoaded', function() {
  loadGames(1);
});

window.addEventListener('userLoggedIn',  function() { gamesCache = {}; loadGames(currentPack); });
window.addEventListener('userLoggedOut', function() { gamesCache = {}; loadGames(currentPack); });
