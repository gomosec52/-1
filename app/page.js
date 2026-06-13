'use client';

import { useEffect, useRef, useState } from 'react';
import { LOCAL_BACKGROUND_VIDEO, cleanBackgroundVideoUrl } from '@/lib/backgroundVideo';

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Ошибка');
  return json;
}

function embedUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    if (value.includes('youtube.com/watch?v=')) return value.replace('watch?v=', 'embed/');
    if (value.includes('youtu.be/')) {
      const parsed = new URL(value);
      return `https://www.youtube.com/embed/${parsed.pathname.replace('/', '')}`;
    }
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function voteNames(votes, choice) {
  const names = votes.filter((vote) => vote.choice === choice).map((vote) => vote.username);
  return names.length ? names.join(', ') : 'никого';
}

const initialBackgroundVideoUrl = cleanBackgroundVideoUrl(process.env.NEXT_PUBLIC_BACKGROUND_VIDEO_URL) || LOCAL_BACKGROUND_VIDEO;

export default function HomePage() {
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pack, setPack] = useState(1);
  const [games, setGames] = useState([]);
  const [messages, setMessages] = useState([]);
  const [authMsg, setAuthMsg] = useState('');
  const [status, setStatus] = useState('');
  const [chatStatus, setChatStatus] = useState('');
  const [showScreamer, setShowScreamer] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState(initialBackgroundVideoUrl);
  const [backgroundVideoError, setBackgroundVideoError] = useState('');
  const [backgroundSoundEnabled, setBackgroundSoundEnabled] = useState(false);
  const [visibleGameplayVideos, setVisibleGameplayVideos] = useState({});
  const audioRef = useRef(null);
  const backgroundVideoRef = useRef(null);

  async function loadMe() {
    const data = await api('/api/me');
    setMe(data.user);
    setIsAdmin(Boolean(data.isAdmin));
    return data.user;
  }

  async function loadGames(nextPack = pack) {
    const data = await api(`/api/games?pack=${nextPack}`);
    setGames(data.games);
  }

  async function loadChat() {
    const data = await api('/api/chat');
    setMessages(data.messages);
  }

  useEffect(() => {
    loadMe().then((user) => {
      if (user) {
        loadGames(1).catch((error) => setStatus(error.message));
        loadChat().catch((error) => setChatStatus(error.message));
      }
    }).catch((error) => setAuthMsg(error.message));

    const url = new URL(window.location.href);
    if (url.searchParams.get('authError')) {
      setAuthMsg('Discord авторизация не прошла. Проверь настройки Redirect URI и Client Secret.');
    }

    api('/api/site-config')
      .then((config) => {
        const nextUrl = cleanBackgroundVideoUrl(config.backgroundVideoUrl);
        if (nextUrl) {
          setBackgroundVideoUrl(nextUrl);
          setBackgroundVideoError('');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!me) return undefined;
    loadGames(pack).catch((error) => setStatus(error.message));
    const timer = setInterval(() => loadGames(pack).catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [pack, me]);

  useEffect(() => {
    if (!me) return undefined;
    const timer = setInterval(() => loadChat().catch((error) => setChatStatus(error.message)), 3000);
    return () => clearInterval(timer);
  }, [me]);

  async function submitLogin(event) {
    event.preventDefault();
    if (authLoading) return;
    setAuthMsg('');
    setAuthLoading(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
      });
      const user = await loadMe();
      if (user) {
        await Promise.all([
          loadGames(pack).catch((error) => setStatus(error.message)),
          loadChat().catch((error) => setStatus(error.message))
        ]);
      }
    } catch (error) {
      setAuthMsg(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function playScreamer() {
    setShowScreamer(true);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.7;
      audioRef.current.play().catch(() => {});
    }
    setTimeout(() => setShowScreamer(false), 1700);
  }

  function submitRegister(event) {
    event.preventDefault();
    if (authLoading) return;
    const form = event.currentTarget;
    setAuthMsg('Регистрирую аккаунт...');
    setAuthLoading(true);
    playScreamer();
    setTimeout(async () => {
      try {
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(new FormData(form)))
        });
        const user = await loadMe();
        if (user) {
          setAuthMsg('');
          await Promise.all([
            loadGames(pack).catch((error) => setStatus(error.message)),
            loadChat().catch((error) => setStatus(error.message))
          ]);
        } else {
          setAuthMsg('Аккаунт создан, но сессия не загрузилась. Обнови страницу.');
        }
      } catch (error) {
        setAuthMsg(error.message);
      } finally {
        setAuthLoading(false);
      }
    }, 900);
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setIsAdmin(false);
    setGames([]);
    setMessages([]);
  }

  async function copyId() {
    if (!me) return;
    await navigator.clipboard?.writeText(me.public_id).catch(() => {});
    setStatus('Site ID скопирован');
  }

  async function react(gameId, value) {
    if (actionLoading) return;
    setStatus(value === 1 ? 'Ставлю лайк...' : 'Ставлю дизлайк...');
    setActionLoading(`reaction-${gameId}`);
    try {
      await api(`/api/games/${gameId}/reaction`, {
        method: 'POST',
        body: JSON.stringify({ value })
      });
      await loadGames(pack);
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setActionLoading('');
    }
  }

  async function vote(gameId, choice) {
    if (actionLoading) return;
    setStatus('Сохраняю голос...');
    setActionLoading(`vote-${gameId}`);
    try {
      await api(`/api/games/${gameId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ choice })
      });
      await loadGames(pack);
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setActionLoading('');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (actionLoading === 'chat') return;
    const form = event.currentTarget;
    const message = form.message.value.trim();
    if (!message) return;
    setChatStatus('Отправляю сообщение...');
    setActionLoading('chat');
    try {
      await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      form.reset();
      await loadChat();
      setChatStatus('');
    } catch (error) {
      setChatStatus(error.message);
    } finally {
      setActionLoading('');
    }
  }

  async function toggleBackgroundSound() {
    const video = backgroundVideoRef.current;
    if (!video) return;

    if (backgroundSoundEnabled) {
      video.muted = true;
      setBackgroundSoundEnabled(false);
      return;
    }

    video.muted = false;
    video.volume = 0.45;
    try {
      await video.play();
      setBackgroundSoundEnabled(true);
      setBackgroundVideoError('');
    } catch {
      video.muted = true;
      setBackgroundSoundEnabled(false);
      setBackgroundVideoError('Браузер не дал включить звук автоматически. Нажми кнопку звука еще раз после любого клика по странице.');
    }
  }

  function toggleGameplayVideo(gameId) {
    setVisibleGameplayVideos((current) => ({
      ...current,
      [gameId]: !current[gameId]
    }));
  }

  return (
    <>
      <video
        ref={backgroundVideoRef}
        key={backgroundVideoUrl}
        className="bgVideo"
        src={backgroundVideoUrl}
        autoPlay
        muted={!backgroundSoundEnabled}
        loop
        playsInline
        preload="auto"
        onCanPlay={() => setBackgroundVideoError('')}
        onError={(event) => {
          if (backgroundVideoUrl !== LOCAL_BACKGROUND_VIDEO) {
            setBackgroundSoundEnabled(false);
            setBackgroundVideoUrl(LOCAL_BACKGROUND_VIDEO);
            setBackgroundVideoError('Внешнее фоновое видео не загрузилось без VPN, поэтому сайт переключился на локальный файл.');
            return;
          }
          event.currentTarget.remove();
          setBackgroundVideoError('Фоновое видео не загрузилось даже из локального файла /assets/anime-bg.mp4.');
        }}
      />
      <div className="bgFallback" />
      <div className="shade" />
      <button className="bgSoundControl" type="button" onClick={toggleBackgroundSound}>
        {backgroundSoundEnabled ? 'выключить звук фона' : 'включить звук фона'}
      </button>

      <header className="topbar">
        {me && (
          <nav className="packs" aria-label="Паки игр">
            {[1, 2, 3, 4, 5].map((number) => (
              <button
                key={number}
                className={number === pack ? 'active' : ''}
                style={{ '--art-pos': `${(number - 1) * 22}%` }}
                onClick={() => setPack(number)}
                type="button"
              >
                пак игр {number}
              </button>
            ))}
          </nav>
        )}

        {me && (
          <div className="profile">
            <img className="avatar" src={me.avatar_url || '/api/avatar/user'} alt={`Аватар ${me.username}`} />
            <div>
              <b>{me.username}</b>
              <div className="small">Твой Site ID: <code>{me.public_id}</code></div>
              <div className="profileLinks">
                {isAdmin && <a href="/admin">Админка</a>}
                <button className="linkButton" type="button" onClick={copyId}>Скопировать ID</button>
                <button className="linkButton" type="button" onClick={logout}>Выйти</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {!me ? (
          <section className="panel hero">
            <p className="eyebrow">сайт для друзей</p>
            <h1>Anime Game Packs</h1>
            <p className="subtitle">
              Предложка игр: вход через Discord или ник/пароль, паки игр, лайки,
              голосование, чат и админка для владельца сервера.
            </p>
            <a className="btn" href="/api/auth/discord">Войти через Discord</a>

            <div className="grid2">
              <form onSubmit={submitLogin}>
                <h3>Вход</h3>
                <input name="username" placeholder="ник" autoComplete="username" required />
                <input name="password" type="password" placeholder="пароль" autoComplete="current-password" required />
                <button disabled={authLoading}>{authLoading ? 'Подожди...' : 'Войти'}</button>
              </form>

              <form onSubmit={submitRegister}>
                <h3>Регистрация</h3>
                <input name="username" placeholder="ник" minLength={2} maxLength={32} autoComplete="username" required />
                <input name="password" type="password" placeholder="пароль" minLength={4} autoComplete="new-password" required />
                <button disabled={authLoading}>{authLoading ? 'Регистрирую...' : 'Зарегистрироваться'}</button>
              </form>
            </div>

            {authMsg && <p className="status error">{authMsg}</p>}
            {backgroundVideoError && <p className="status error">{backgroundVideoError}</p>}
          </section>
        ) : (
          <section>
            <p className="eyebrow">выбери пак и голосуй</p>
            <h1 className="contentTitle">Пак игр {pack}</h1>
            {status && <p className="status">{status}</p>}
            {backgroundVideoError && <p className="status error">{backgroundVideoError}</p>}

            {games.length ? games.map((game) => {
              const video = embedUrl(game.video_url);
              const isGameplayVisible = Boolean(visibleGameplayVideos[game.id]);
              return (
                <article className="gameCard" key={game.id}>
                  <div className="gameVideoControls">
                    {video ? (
                      <button className="miniVideoButton" type="button" onClick={() => toggleGameplayVideo(game.id)}>
                        {isGameplayVisible ? 'скрыть видео' : 'посмотреть видео геймплея игры'}
                      </button>
                    ) : (
                      <span className="small">Видео появится после добавления ссылки</span>
                    )}
                  </div>
                  {video && isGameplayVisible && (
                    <iframe className="video" src={video} allowFullScreen loading="lazy" title={`Видео ${game.title}`} />
                  )}
                  <h2>{game.title}</h2>
                  <div className="meta">
                    <span className="tag">Вес: {game.size || '-'}</span>
                    <span className="tag">Мультиплеер: {game.multiplayer || '-'}</span>
                    <span className="tag">Жанр: {game.genre || '-'}</span>
                  </div>
                  <p>{game.description}</p>
                  <div className="actions">
                    <button type="button" disabled={Boolean(actionLoading)} onClick={() => react(game.id, 1)}>Лайк {game.likes || 0}</button>
                    <button type="button" disabled={Boolean(actionLoading)} onClick={() => react(game.id, -1)}>Дизлайк {game.dislikes || 0}</button>
                  </div>
                  <div className="votes">
                    <button type="button" disabled={Boolean(actionLoading)} onClick={() => vote(game.id, 'yes')}>играем</button>
                    <button type="button" disabled={Boolean(actionLoading)} onClick={() => vote(game.id, 'no')}>не играем</button>
                  </div>
                  <div className="voteList">
                    <b>Играем:</b> {voteNames(game.votes || [], 'yes')}<br />
                    <b>Не играем:</b> {voteNames(game.votes || [], 'no')}
                  </div>
                </article>
              );
            }) : (
              <p className="empty">В этом паке пока нет игр. Админ может добавить их через панель.</p>
            )}
          </section>
        )}
      </main>

      {me && (
        <aside className="chat">
          <b>Чат друзей</b>
          <div className="chatMessages">
            {messages.map((message) => (
              <div className="message" key={message.id}>
                <b>{message.username}</b>
                <p>{message.message}</p>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage}>
            <input name="message" maxLength={300} placeholder="Написать..." autoComplete="off" />
            <button disabled={actionLoading === 'chat'} aria-label="Отправить">{actionLoading === 'chat' ? '...' : '➤'}</button>
          </form>
          {chatStatus && <p className="status error">{chatStatus}</p>}
        </aside>
      )}

      <div className={`screamer ${showScreamer ? '' : 'hidden'}`}>
        <img src="/assets/screamer.gif" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <div className="screamText">БУ!</div>
        <audio ref={audioRef} src="/assets/scream.mp3" />
      </div>
    </>
  );
}
