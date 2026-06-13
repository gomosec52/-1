'use client';

import { useEffect, useState } from 'react';

const emptyForm = {
  id: '',
  pack: '1',
  video_url: '',
  title: '',
  size: '',
  multiplayer: '',
  genre: '',
  description: ''
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Ошибка');
  return json;
}

export default function AdminPage() {
  const [games, setGames] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState('');
  const [denied, setDenied] = useState(false);

  async function loadGames() {
    try {
      const data = await api('/api/admin/games');
      setGames(data.games);
      setDenied(false);
    } catch (error) {
      setDenied(true);
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadGames();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function editGame(game) {
    setForm({
      id: String(game.id),
      pack: String(game.pack || 1),
      video_url: game.video_url || '',
      title: game.title || '',
      size: game.size || '',
      multiplayer: game.multiplayer || '',
      genre: game.genre || '',
      description: game.description || ''
    });
    setStatus(`Редактируешь: ${game.title}`);
    scrollTo(0, 0);
  }

  async function deleteGame(id) {
    if (!confirm('Удалить игру?')) return;
    await api(`/api/admin/games/${id}`, { method: 'DELETE' });
    setStatus('Игра удалена');
    await loadGames();
  }

  async function saveGame(event) {
    event.preventDefault();
    const payload = { ...form };
    try {
      if (payload.id) {
        await api(`/api/admin/games/${payload.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setStatus('Игра обновлена');
      } else {
        await api('/api/admin/games', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setStatus('Игра добавлена');
      }
      setForm(emptyForm);
      await loadGames();
    } catch (error) {
      setStatus(error.message);
    }
  }

  if (denied) {
    return (
      <>
        <div className="bgFallback" />
        <div className="shade" />
        <main className="panel hero">
          <p><a href="/">← на сайт</a></p>
          <h1>Нет доступа</h1>
          <p>
            Сначала войди на сайт, скопируй свой <code>Site ID</code>,
            впиши его в <code>ADMIN_IDS</code> на Vercel/Supabase env и перезапусти деплой.
          </p>
          {status && <p className="status error">{status}</p>}
        </main>
      </>
    );
  }

  return (
    <>
      <div className="bgFallback" />
      <div className="shade" />
      <main className="admin panel">
        <p><a href="/">← на сайт</a></p>
        <p className="eyebrow">панель владельца</p>
        <h1>Админ-панель</h1>
        <p className="subtitle">
          Добавляй игры в любой пак, редактируй карточки и удаляй то, что уже не нужно.
          Для YouTube можно вставить обычную ссылку или embed-ссылку.
        </p>
        {status && <p className="status">{status}</p>}

        <form className="adminForm" onSubmit={saveGame}>
          <input type="hidden" name="id" value={form.id} onChange={updateField} />
          <label>
            Пак
            <select name="pack" value={form.pack} onChange={updateField}>
              <option>1</option>
              <option>2</option>
              <option>3</option>
              <option>4</option>
              <option>5</option>
            </select>
          </label>
          <label>
            Видео URL
            <input name="video_url" value={form.video_url} onChange={updateField} placeholder="https://www.youtube.com/watch?v=..." />
          </label>
          <label>
            Название
            <input name="title" value={form.title} onChange={updateField} maxLength={80} required />
          </label>
          <label>
            Вес
            <input name="size" value={form.size} onChange={updateField} maxLength={40} placeholder="12 GB" />
          </label>
          <label>
            Мультиплеер
            <input name="multiplayer" value={form.multiplayer} onChange={updateField} maxLength={80} placeholder="до 4 игроков" />
          </label>
          <label>
            Жанр
            <input name="genre" value={form.genre} onChange={updateField} maxLength={80} placeholder="Co-op / Horror" />
          </label>
          <label className="wide">
            Описание
            <textarea name="description" value={form.description} onChange={updateField} maxLength={1200} />
          </label>
          <button>Сохранить игру</button>
          <button type="button" onClick={() => { setForm(emptyForm); setStatus('Форма очищена'); }}>Очистить</button>
        </form>

        <h2>Игры</h2>
        {games.length ? games.map((game) => (
          <div className="adminCard" key={game.id}>
            <div>
              <b>[Пак {game.pack}] {game.title}</b><br />
              <span className="small">{game.genre || 'без жанра'} · {game.size || 'без веса'} · {game.multiplayer || 'без мультиплеера'}</span>
            </div>
            <div className="adminActions">
              <button type="button" onClick={() => editGame(game)}>Редактировать</button>
              <button className="danger" type="button" onClick={() => deleteGame(game.id)}>Удалить</button>
            </div>
          </div>
        )) : (
          <p className="empty">Игры пока не добавлены.</p>
        )}
      </main>
    </>
  );
}
