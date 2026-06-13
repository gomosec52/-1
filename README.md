# Anime Game Packs

Сайт-предложка игр для друзей в anime/glass стиле.

Что уже есть:

- вход через Discord OAuth;
- обычная регистрация по нику и паролю;
- личный `Site ID` для каждого пользователя;
- 5 паков игр;
- карточки игр с видео, весом, мультиплеером, жанром и описанием;
- лайки/дизлайки, которые видны всем;
- голосование `играем` / `не играем` со списком ников;
- realtime-чат в правом нижнем углу;
- админ-панель для добавления, редактирования и удаления игр;
- скример при обычной регистрации.

## Запуск локально

Нужен Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev
```

Открой: <http://localhost:3000>

## Настройка Discord OAuth

1. Открой [Discord Developer Portal](https://discord.com/developers/applications).
2. Нажми **New Application**.
3. Открой **OAuth2**.
4. Скопируй **Client ID** и **Client Secret** в `.env`:

```env
DISCORD_CLIENT_ID=твой_client_id
DISCORD_CLIENT_SECRET=твой_client_secret
```

5. В **OAuth2 -> Redirects** добавь:

```txt
http://localhost:3000/auth/discord/callback
```

Для хостинга добавь второй redirect:

```txt
https://ТВОЙ-ДОМЕН/auth/discord/callback
```

6. В `.env` укажи адрес сайта без `/` в конце:

```env
BASE_URL=http://localhost:3000
```

На хостинге это будет примерно:

```env
BASE_URL=https://my-game-packs.example.com
```

Используется только scope `identify`, то есть сайт получает ник, Discord ID и аватарку.

## Обычная регистрация

Пользователь вводит ник и пароль. Данные сохраняются в SQLite:

- `data.sqlite` - пользователи, игры, реакции, голосования, чат;
- `sessions.sqlite` - сессии входа.

Пароли хранятся не как обычный текст, а как bcrypt-хэш.

## Как включить админку

1. Зарегистрируйся или войди через Discord.
2. Справа сверху появится `Твой Site ID`.
3. Скопируй его.
4. Впиши в `.env`:

```env
ADMIN_IDS=u_твой_id
```

5. Перезапусти сервер.
6. Открой `/admin`.

Несколько админов можно указать через запятую:

```env
ADMIN_IDS=u_abc123,u_def456
```

## Как добавить фоновое видео

Положи файл в проект:

```txt
public/assets/anime-bg.mp4
```

После этого сайт сам поставит его на фон. Видео лучше сделать коротким и зацикленным, например 5-15 секунд. Если файла нет, сайт показывает встроенный anime-style градиент.

Если хочешь отправить видео другому человеку или агенту, просто загрузи файл в чат/таску и скажи: "поставь это видео как `public/assets/anime-bg.mp4`".

## Скример

Файлы:

```txt
public/assets/scream.mp3
public/assets/screamer.gif
```

Если `screamer.gif` отсутствует, сайт все равно покажет полноэкранный CSS-оверлей с текстом `БУ!`. Звук начнет играть только после клика по регистрации, потому что браузеры блокируют автоматический звук без действия пользователя.

## Видео игр

В админке можно вставить обычную YouTube-ссылку:

```txt
https://www.youtube.com/watch?v=VIDEO_ID
```

Или embed-ссылку:

```txt
https://www.youtube.com/embed/VIDEO_ID
```

## Деплой и Vercel

Для этого проекта важны две вещи:

1. база должна сохраняться после перезапуска;
2. realtime-чат работает через WebSocket/Socket.IO.

Из-за этого обычный бесплатный Vercel не является лучшим вариантом для текущей Express + SQLite версии: serverless-функции не подходят для постоянного Socket.IO-сервера, а локальный SQLite-файл может не сохраняться как постоянная база.

Хорошие варианты для MVP:

- Render с persistent disk;
- Railway;
- Koyeb;
- Fly.io;
- недорогой VPS.

Если принципиально нужен Vercel, лучше переделать backend под внешние сервисы:

- база: Supabase Postgres, Neon или Vercel Postgres;
- realtime: Supabase Realtime, Ably или Pusher;
- авторизация: Discord OAuth через серверные API routes или через Supabase Auth.

Текущая версия специально сделана простой для обучения: один Node/Express сервер, SQLite и обычные HTML/CSS/JS файлы.

## Переменные окружения

Смотри `.env.example`.

В продакшене обязательно замени:

```env
SESSION_SECRET=change_me_to_a_long_random_string
```

Если сайт работает строго по HTTPS за proxy, можно включить:

```env
COOKIE_SECURE=true
TRUST_PROXY=true
```
