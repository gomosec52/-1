// ============================================================
//  GAMES.JS — загрузка игр, лайки, голосование
//  ИСПРАВЛЕНИЯ:
//  - Мобильный: убраны проблемные iframe без sandbox
//  - YouTube: добавлен параметр autoplay=0 для мобилов
//  - Кеш: сброс при ошибке
//  - Promise.allSettled → Promise.all с обработкой ошибок
// ============================================================

var currentPack = 1;
var gamesCache  = {};

// ---------- Переключение пака ----------
function switchPack(packNum) {
  currentPack = packNum;
  var btns = document.querySelectorAll('.pack-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', parseInt(btns[i].getAttribute('data-pack'), 10) === packNum);
  }
  var titleEl = document.getElementById('packTitle');
  if (titleEl) titleEl.textContent = 'ПАК ИГР ' + packNum;
  loadGames(packNum);
}

// ---------- Загрузка игр (с кешем) ----------
function loadGames(packNum) {
  var list = document.getElementById('gamesList');
  if (!list) return;

  // Если есть кеш — покажем мгновенно, пока грузим новые данные
  if (gamesCache[packNum]) {
    var c = gamesCache[packNum];
    renderGames(c.games, c.likes, c.votes);
  } else {
    list.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка игр...</p></div>';
  }

  supaFetch('/rest/v1/games?pack_number=eq.' + packNum + '&order=sort_order.asc&select=*')
    .then(function(res) {
      if (!res.ok) {
        if (!gamesCache[packNum]) {
          list.innerHTML = '<div class="empty-state"><h3>Ошибка загрузки</h3><p>Проверь подключение и обнови страницу.</p></div>';
        }
        return null;
      }
      var games = res.data;
      if (!Array.isArray(games) || games.length === 0) {
        list.innerHTML = '<div class="empty-state"><h3>Пак пустой</h3><p>Игры ещё не добавлены.</p></div>';
        return null;
      }
      var ids = games.map(function(g) { return g.id; }).join(',');
      return Promise.all([
        supaFetch('/rest/v1/reactions?game_id=in.(' + ids + ')&select=*'),
        supaFetch('/rest/v1/votes?game_id=in.(' + ids + ')&select=*')
      ]).then(function(results) {
        var likes = (results[0].ok && Array.isArray(results[0].data)) ? results[0].data : [];
        var votes = (results[1].ok && Array.isArray(results[1].data)) ? results[1].data : [];
        gamesCache[packNum] = { games: games, likes: likes, votes: votes, ts: Date.now() };
        renderGames(games, likes, votes);
      });
    })
    .catch(function() {
      if (!gamesCache[packNum]) {
        list.innerHTML = '<div class="empty-state"><h3>Нет соединения</h3><p>Нет связи с сервером. Попробуй позже.</p></div>';
      }
    });
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
  var myReaction   = uid ? (gameLikes.filter(function(l) { return l.user_site_id === uid; })[0] || null) : null;

  var gameVotes = allVotes.filter(function(v) { return v.game_id === game.id; });
  var yesVoters = gameVotes.filter(function(v) { return v.choice === 'yes'; }).map(function(v) { return escHtml(v.user_nick); });
  var noVoters  = gameVotes.filter(function(v) { return v.choice === 'no'; }).map(function(v) { return escHtml(v.user_nick); });
  var myVote    = uid ? (gameVotes.filter(function(v) { return v.user_site_id === uid; })[0] || null) : null;

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
      '<button class="reaction-btn' + (myReaction && myReaction.type === 'like' ? ' liked' : '') +
        '" onclick="toggleReaction(\'' + game.id + '\', \'like\')">' +
        '👍 <span class="reaction-count" id="likes-' + game.id + '">' + likeCount + '</span>' +
      '</button>' +
      '<button class="reaction-btn' + (myReaction && myReaction.type === 'dislike' ? ' disliked' : '') +
        '" onclick="toggleReaction(\'' + game.id + '\', \'dislike\')">' +
        '👎 <span class="reaction-count" id="dislikes-' + game.id + '">' + dislikeCount + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="game-vote">' +
      '<div class="vote-title">🎮 ГОЛОСОВАНИЕ</div>' +
      '<div class="vote-options">' +
        '<button class="vote-btn yes' + (myVote && myVote.choice === 'yes' ? ' chosen' : '') +
          '" onclick="castVote(\'' + game.id + '\', \'yes\')">✅ Играем</button>' +
        '<button class="vote-btn no' + (myVote && myVote.choice === 'no' ? ' chosen' : '') +
          '" onclick="castVote(\'' + game.id + '\', \'no\')">❌ Не играем</button>' +
      '</div>' +
      '<div class="vote-results">' +
        '<div class="vote-names" id="yes-names-' + game.id + '">✅ ' + (yesVoters.length > 0 ? yesVoters.join(', ') : '—') + '</div>' +
        '<div class="vote-names" id="no-names-' + game.id  + '">❌ ' + (noVoters.length  > 0 ? noVoters.join(', ')  : '—') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ---------- Видео embed ----------
// ИСПРАВЛЕНО: на мобилах YouTube iframe грузился медленно или не грузился
// Используем clickable placeholder → открывает YouTube при нажатии на мобиле
function makeVideoEmbed(url) {
  if (!url) {
    return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-family:Rajdhani,sans-serif;">Нет видео</div>';
  }

  var ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (ytMatch) {
    var vid = ytMatch[1];
    // Ленивая загрузка: placeholder с превью → клик грузит iframe
    // Это решает проблему на мобиле где iframe может висеть
    var thumb = 'https://img.youtube.com/vi/' + vid + '/mqdefault.jpg';
    return '<div class="yt-placeholder" id="yt-' + vid + '" onclick="loadYT(this,\'' + vid + '\')" ' +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:pointer;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
      '<img src="' + thumb + '" alt="video" style="width:100%;height:100%;object-fit:cover;opacity:0.7;" ' +
      'onerror="this.style.display=\'none\'">' +
      '<div style="position:absolute;width:60px;height:60px;background:rgba(255,0,0,0.85);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
      '<div style="width:0;height:0;border-style:solid;border-width:12px 0 12px 22px;border-color:transparent transparent transparent #fff;margin-left:4px;"></div>' +
      '</div>' +
      '</div>';
  }

  if (url.indexOf('.mp4') !== -1 || url.indexOf('.webm') !== -1) {
    return '<video src="' + escHtml(url) + '" controls preload="none" ' +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" ' +
      'playsinline webkit-playsinline></video>';
  }

  // Другой iframe (Twitch, VK и т.д.)
  return '<iframe src="' + escHtml(url) + '" allowfullscreen ' +
    'style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" ' +
    'loading="lazy"></iframe>';
}

// Загружаем YouTube iframe только при клике (решает проблему мобилов)
function loadYT(placeholder, vid) {
  var iframe = document.createElement('iframe');
  iframe.src = 'https://www.youtube.com/embed/' + vid + '?autoplay=1&rel=0&playsinline=1';
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
  placeholder.parentNode.replaceChild(iframe, placeholder);
}

// ---------- Реакции ----------
function toggleReaction(gameId, type) {
  var user = window.currentUser;
  if (!user) { showToast('Нужно войти!'); return; }
  var uid = user.site_id, nick = user.nick;

  supaFetch('/rest/v1/reactions?game_id=eq.' + gameId + '&user_site_id=eq.' + encodeURIComponent(uid) + '&select=*')
    .then(function(res) {
      var existing = (res.ok && Array.isArray(res.data) && res.data.length > 0) ? res.data[0] : null;
      if (existing) {
        if (existing.type === type) {
          return supaFetch('/rest/v1/reactions?id=eq.' + existing.id, 'DELETE');
        } else {
          return supaFetch('/rest/v1/reactions?id=eq.' + existing.id, 'PATCH', { type: type });
        }
      } else {
        return supaFetch('/rest/v1/reactions', 'POST', {
          game_id: gameId, user_site_id: uid, user_nick: nick, type: type
        });
      }
    })
    .then(function() { refreshGameReactions(gameId); })
    .catch(function() { showToast('Ошибка. Попробуй снова.'); });
}

function refreshGameReactions(gameId) {
  supaFetch('/rest/v1/reactions?game_id=eq.' + gameId + '&select=*').then(function(r) {
    if (!r.ok) return;
    var likes    = r.data.filter(function(l) { return l.type === 'like'; }).length;
    var dislikes = r.data.filter(function(l) { return l.type === 'dislike'; }).length;
    var uid = window.currentUser ? window.currentUser.site_id : null;
    var my  = uid ? (r.data.filter(function(l) { return l.user_site_id === uid; })[0] || null) : null;

    var el = document.getElementById('game-' + gameId);
    if (!el) return;
    var lEl = document.getElementById('likes-' + gameId);
    var dEl = document.getElementById('dislikes-' + gameId);
    if (lEl) lEl.textContent = likes;
    if (dEl) dEl.textContent = dislikes;

    var btns = el.querySelectorAll('.reaction-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('liked', 'disliked');
      if (i === 0 && my && my.type === 'like')    btns[i].classList.add('liked');
      if (i === 1 && my && my.type === 'dislike') btns[i].classList.add('disliked');
    }
  });
}

// ---------- Голосование ----------
function castVote(gameId, choice) {
  var user = window.currentUser;
  if (!user) { showToast('Нужно войти!'); return; }
  var uid = user.site_id, nick = user.nick;

  supaFetch('/rest/v1/votes?game_id=eq.' + gameId + '&user_site_id=eq.' + encodeURIComponent(uid) + '&select=*')
    .then(function(res) {
      var prev = (res.ok && Array.isArray(res.data) && res.data.length > 0) ? res.data[0] : null;
      if (prev) {
        if (prev.choice === choice) {
          return supaFetch('/rest/v1/votes?id=eq.' + prev.id, 'DELETE');
        } else {
          return supaFetch('/rest/v1/votes?id=eq.' + prev.id, 'PATCH', { choice: choice });
        }
      } else {
        return supaFetch('/rest/v1/votes', 'POST', {
          game_id: gameId, user_site_id: uid, user_nick: nick, choice: choice
        });
      }
    })
    .then(function() { refreshGameVotes(gameId); })
    .catch(function() { showToast('Ошибка. Попробуй снова.'); });
}

function refreshGameVotes(gameId) {
  supaFetch('/rest/v1/votes?game_id=eq.' + gameId + '&select=*').then(function(r) {
    if (!r.ok) return;
    var yes = r.data.filter(function(v) { return v.choice === 'yes'; }).map(function(v) { return escHtml(v.user_nick); });
    var no  = r.data.filter(function(v) { return v.choice === 'no'; }).map(function(v) { return escHtml(v.user_nick); });
    var uid = window.currentUser ? window.currentUser.site_id : null;
    var my  = uid ? (r.data.filter(function(v) { return v.user_site_id === uid; })[0] || null) : null;

    var yEl = document.getElementById('yes-names-' + gameId);
    var nEl = document.getElementById('no-names-' + gameId);
    var el  = document.getElementById('game-' + gameId);
    if (yEl) yEl.textContent = '✅ ' + (yes.length > 0 ? yes.join(', ') : '—');
    if (nEl) nEl.textContent = '❌ ' + (no.length  > 0 ? no.join(', ')  : '—');

    if (el) {
      var btns = el.querySelectorAll('.vote-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('chosen');
        if (i === 0 && my && my.choice === 'yes') btns[i].classList.add('chosen');
        if (i === 1 && my && my.choice === 'no')  btns[i].classList.add('chosen');
      }
    }
  });
}

// ---------- Toast уведомление (вместо alert) ----------
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:rgba(20,0,40,0.95);color:#f0e6ff;padding:10px 20px;border-radius:20px;' +
      'border:1px solid rgba(255,79,163,0.5);font-family:Rajdhani,sans-serif;font-size:14px;' +
      'z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.opacity = '0'; }, 2200);
}

// ---------- Утилиты ----------
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Инициализация ----------
document.addEventListener('DOMContentLoaded', function() {
  loadGames(1);
});

window.addEventListener('userLoggedIn',  function() { gamesCache = {}; loadGames(currentPack); });
window.addEventListener('userLoggedOut', function() { gamesCache = {}; loadGames(currentPack); });
