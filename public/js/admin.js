const $ = (selector) => document.querySelector(selector);
let games = [];

async function api(url, opt = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opt
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Ошибка');
  return json;
}

function setStatus(message, isError = false) {
  const status = $('#adminStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function renderGames() {
  const list = $('#adminGames');
  list.innerHTML = '';
  if (!games.length) {
    list.textContent = 'Нет игр';
    return;
  }

  games.forEach((game) => {
    const card = document.createElement('div');
    const info = document.createElement('div');
    const title = document.createElement('b');
    const meta = document.createElement('span');
    const actions = document.createElement('div');
    const editButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    card.className = 'adminCard';
    title.textContent = `[Пак ${game.pack}] ${game.title}`;
    meta.className = 'small';
    meta.textContent = `${game.genre || 'без жанра'} · ${game.size || 'без веса'} · ${game.multiplayer || 'без мультиплеера'}`;
    editButton.type = 'button';
    editButton.textContent = 'Редактировать';
    editButton.onclick = () => edit(game);
    deleteButton.type = 'button';
    deleteButton.textContent = 'Удалить';
    deleteButton.onclick = () => del(game.id);

    info.append(title, document.createElement('br'), meta);
    actions.append(editButton, deleteButton);
    card.append(info, actions);
    list.append(card);
  });
}

async function load() {
  try {
    const data = await api('/api/admin/games');
    games = data.games;
    renderGames();
  } catch (error) {
    document.body.innerHTML = '<main class="panel"><h1>Нет доступа</h1><p>Сначала войди на сайт, скопируй свой Site ID, впиши его в ADMIN_IDS в .env и перезапусти сервер.</p><p><a href="/">На главную</a></p></main>';
  }
}

function edit(game) {
  const form = $('#gameForm');
  Object.entries(game).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value || '';
  });
  setStatus(`Редактируешь: ${game.title}`);
  scrollTo(0, 0);
}

async function del(id) {
  if (!confirm('Удалить игру?')) return;
  await api(`/api/admin/games/${id}`, { method: 'DELETE' });
  setStatus('Игра удалена');
  load();
}

$('#resetBtn').onclick = () => {
  const form = $('#gameForm');
  form.reset();
  form.elements.id.value = '';
  setStatus('Форма очищена');
};

$('#gameForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    if (data.id) {
      await api(`/api/admin/games/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      setStatus('Игра обновлена');
    } else {
      await api('/api/admin/games', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setStatus('Игра добавлена');
    }
    event.target.reset();
    event.target.elements.id.value = '';
    load();
  } catch (error) {
    setStatus(error.message, true);
  }
});

load();
