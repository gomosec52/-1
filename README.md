# Game Packs Anime Site

Функции: Discord OAuth, обычная регистрация, SQLite база, лайки/дизлайки, голосование с никами, realtime-чат, админ-панель для игр, 5 паков игр.

## Запуск локально
```bash
npm install
cp .env.example .env
npm run dev
```
Открой: http://localhost:3000

## Discord OAuth
1. Открой Discord Developer Portal → New Application.
2. OAuth2 → добавь Redirect URI:
   - локально: `http://localhost:3000/auth/discord/callback`
   - на хостинге: `https://ТВОЙ-ДОМЕН/auth/discord/callback`
3. Скопируй Client ID и Client Secret в `.env`.
4. В `BASE_URL` укажи адрес сайта без `/` в конце.

Используются scopes: `identify`.

## Админка
1. Зарегистрируйся/войди.
2. В правом верхнем углу увидишь свой `Site ID`.
3. Вставь его в `.env` в `ADMIN_IDS=...`.
4. Перезапусти сервер.
5. Открой `/admin`.

Можно вписать несколько админов через запятую.

## Скример
Файл звука положи сюда: `public/assets/scream.mp3`.
Картинку/гифку для скримера положи сюда: `public/assets/screamer.gif`.
Если файлов нет, сайт покажет встроенный CSS-оверлей без внешних ссылок.

## Фон и галерея
Чтобы не зависеть от чужих ссылок и авторских прав, положи свои файлы:
- фон: `public/assets/anime-bg.gif` или `anime-bg.mp4`
- галерея: `public/assets/gallery-1.jpg` ... `gallery-10.jpg`

Без файлов сайт покажет встроенные anime-style SVG-заглушки.

## Деплой
На бесплатном хостинге с SQLite важно иметь persistent disk, иначе база будет сбрасываться при перезапусках. Лучший вариант для 24/7 — VPS, но для MVP можно Render/Koyeb/Railway с ограничениями.
