# Anime Game Packs

Новая версия сайта с нуля под Vercel.

Стек:

- Next.js App Router;
- Vercel hosting/serverless API routes;
- Supabase Postgres для базы;
- Discord OAuth;
- обычная регистрация по нику и паролю;
- HTTP-only JWT cookie для сессии;
- anime/glass UI.

## Что умеет сайт

- Вход через Discord.
- Обычная регистрация: ник + пароль.
- Скример при обычной регистрации.
- У каждого пользователя есть постоянный `Site ID`.
- Справа сверху показывается ник и аватар.
- 5 паков игр.
- Карточки игр: видео, название, вес, мультиплеер, жанр, описание.
- Лайки/дизлайки, которые сохраняются в базе.
- Голосование `играем` / `не играем` со списком ников.
- Чат в правом нижнем углу.
- Админка `/admin` для добавления, редактирования и удаления игр.

## 1. Локальный запуск

Нужен Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Открой:

```txt
http://localhost:3000
```

Без Supabase env сайт откроется, но API авторизации/игр работать не будут. Сначала настрой базу.

## 2. Настрой Supabase

1. Создай проект на [supabase.com](https://supabase.com).
2. Открой **SQL Editor**.
3. Скопируй весь файл `supabase/schema.sql`.
4. Вставь в SQL Editor и нажми **Run**.
5. Открой **Project Settings -> API**.
6. Скопируй:
   - Project URL;
   - `service_role` key.

`SUPABASE_URL` должен выглядеть именно так:

```txt
https://xxxxx.supabase.co
```

Не вставляй в `SUPABASE_URL` такие варианты:

```txt
https://xxxxx.supabase.co/rest/v1
https://xxxxx.supabase.co/auth/v1
```

Иначе сайт может показать ошибку `Invalid path specified in request URL`.

Заполни `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=придумай_длинный_секрет
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=твой_service_role_key
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
ADMIN_IDS=
```

Важно: `SUPABASE_SERVICE_ROLE_KEY` нельзя показывать пользователям и нельзя вставлять в frontend. В этом проекте он используется только в serverless API routes.

Если Supabase пишет ошибку около `created_at`, чаще всего SQL был вставлен не целиком или без запятой на предыдущей строке. Очисти SQL Editor полностью и вставь весь `supabase/schema.sql` заново, начиная со строки:

```sql
create extension if not exists pgcrypto;
```

Не вставляй номера строк вида `L1:` / `L2:`.

Если регистрация уже работает, но чат, лайки или голосование не сохраняются, заново выполни свежий `supabase/schema.sql` целиком. Он пересоздает таблицы `chat_messages`, `votes` и `reactions` с правильной связью на `app_users`.

## 3. Настрой Discord OAuth

1. Открой [Discord Developer Portal](https://discord.com/developers/applications).
2. Нажми **New Application**.
3. Открой **OAuth2**.
4. Скопируй **Client ID** и **Client Secret** в `.env.local`:

```env
DISCORD_CLIENT_ID=твой_client_id
DISCORD_CLIENT_SECRET=твой_client_secret
```

5. В **OAuth2 -> Redirects** добавь локальный redirect:

```txt
http://localhost:3000/api/auth/discord/callback
```

Для Vercel потом добавь:

```txt
https://ТВОЙ-САЙТ.vercel.app/api/auth/discord/callback
```

Используется только scope `identify`: сайт получает Discord ID, ник и аватарку.

## 4. Как включить админку

1. Зарегистрируйся или войди через Discord.
2. Справа сверху появится `Твой Site ID`.
3. Скопируй его.
4. Впиши в `.env.local`:

```env
ADMIN_IDS=u_твой_id
```

5. Перезапусти `npm run dev`.
6. Открой:

```txt
http://localhost:3000/admin
```

Несколько админов:

```env
ADMIN_IDS=u_abc123,u_def456
```

На Vercel после изменения `ADMIN_IDS` нужно обновить Environment Variables и сделать redeploy.

## 5. Деплой на Vercel

1. Залей репозиторий на GitHub.
2. На [vercel.com](https://vercel.com) нажми **Add New Project**.
3. Выбери репозиторий.
4. В **Environment Variables** добавь:

```env
NEXT_PUBLIC_SITE_URL=https://ТВОЙ-САЙТ.vercel.app
BACKGROUND_VIDEO_URL=
NEXT_PUBLIC_BACKGROUND_VIDEO_URL=
AUTH_SECRET=длинный_секрет
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=твой_service_role_key
DISCORD_CLIENT_ID=твой_client_id
DISCORD_CLIENT_SECRET=твой_client_secret
ADMIN_IDS=
```

5. Нажми **Deploy**.
6. После первого входа скопируй свой `Site ID`, добавь его в `ADMIN_IDS` на Vercel и сделай redeploy.

## 6. Фоновое видео

Есть 2 варианта.

### Вариант A: файл в репозитории

Положи mp4-файл сюда:

```txt
public/assets/anime-bg.mp4
```

Если файл называется именно `anime-bg.mp4`, сайт сам поставит его на фон. Видео автоматически запускается без звука и повторяется по кругу.

Для Vercel и GitHub лучше, чтобы файл был не слишком тяжелым. Если твое видео 3 минуты и много весит, лучше использовать вариант B.

Если Supabase Storage открывается только через VPN, используй именно этот вариант A. Тогда видео отдается с домена Vercel вместе с сайтом. В этом случае удали переменные `BACKGROUND_VIDEO_URL` и `NEXT_PUBLIC_BACKGROUND_VIDEO_URL` в Vercel, чтобы сайт сразу брал локальный файл:

```txt
/assets/anime-bg.mp4
```

### Вариант B: ссылка на mp4

Загрузи видео в публичное хранилище, например Supabase Storage, и получи прямую публичную ссылку на `.mp4`.

Потом в Vercel добавь Environment Variable:

```env
BACKGROUND_VIDEO_URL=https://xxxxx.supabase.co/storage/v1/object/public/anime/animevideo.mp4
```

После изменения переменной сделай redeploy.

Можно использовать и signed-ссылку Supabase вида `/storage/v1/object/sign/...`, но лучше сделать bucket/file публичным и использовать `/storage/v1/object/public/...`, потому что signed-ссылка со временем истечет.

Важно:

- ссылка должна открывать именно видеофайл `.mp4`, а не страницу просмотра;
- не добавляй пробелы в начало/конец ссылки;
- не добавляй точку в конце ссылки;
- после изменения переменной на Vercel обязательно сделай redeploy.

Если фонового видео нет или ссылка неправильная, сайт показывает встроенный anime-style градиент.

Если внешний URL не загрузился, сайт автоматически попробует локальный fallback `/assets/anime-bg.mp4`.

### Звук фонового видео

Браузеры запрещают автоматический запуск видео со звуком без действия пользователя. Поэтому фон стартует без звука, а на сайте есть кнопка:

```txt
включить звук фона
```

После клика видео продолжит играть уже со звуком. Повторный клик выключит звук.

Если хочешь скинуть видео агенту/разработчику, загрузи файл в чат и попроси положить его как:

```txt
public/assets/anime-bg.mp4
```

## 7. Скример

Файлы:

```txt
public/assets/scream.mp3
public/assets/screamer.gif
```

Если `screamer.gif` нет, сайт все равно покажет полноэкранный оверлей с текстом `БУ!`. Звук запускается после клика по регистрации, потому что браузеры блокируют автоматический звук без действия пользователя.

## 8. Видео игр

В админке можно вставлять:

```txt
https://www.youtube.com/watch?v=VIDEO_ID
```

или:

```txt
https://www.youtube.com/embed/VIDEO_ID
```

## 9. Про чат и обновления у всех

Эта Vercel-версия не использует Socket.IO. Данные сохраняются в Supabase, а главная страница автоматически обновляет игры и чат каждые несколько секунд. Для маленького сайта друзей это проще и надежнее на бесплатном Vercel.

Если позже захочешь прям мгновенный realtime без задержки, можно добавить Supabase Realtime поверх этих же таблиц.
