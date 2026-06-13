require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = process.env.DATA_DIR || process.cwd();
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'data.sqlite'));

if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

class BetterSqliteSessionStore extends session.Store {
  constructor(filename) {
    super();
    this.db = new Database(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    `);
    const cleanup = setInterval(() => {
      this.db.prepare('DELETE FROM sessions WHERE expire <= ?').run(Date.now());
    }, 1000 * 60 * 30);
    cleanup.unref();
  }

  get(sid, callback) {
    try {
      const row = this.db.prepare('SELECT sess FROM sessions WHERE sid=? AND expire > ?').get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      const maxAge = sess.cookie?.originalMaxAge || sess.cookie?.maxAge || (1000 * 60 * 60 * 24);
      const expire = Date.now() + maxAge;
      this.db.prepare('INSERT INTO sessions (sid, sess, expire) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expire=excluded.expire').run(sid, JSON.stringify(sess), expire);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sess, callback) {
    try {
      const maxAge = sess.cookie?.originalMaxAge || sess.cookie?.maxAge || (1000 * 60 * 60 * 24);
      this.db.prepare('UPDATE sessions SET expire=? WHERE sid=?').run(Date.now() + maxAge, sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}

const sessionMiddleware = session({
  store: new BetterSqliteSessionStore(path.join(DATA_DIR, 'sessions.sqlite')),
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true'
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(express.static('public'));
io.engine.use(sessionMiddleware);

function initDb(){
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL,
      discord_id TEXT UNIQUE,
      username TEXT NOT NULL,
      password_hash TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack INTEGER NOT NULL DEFAULT 1,
      video_url TEXT,
      title TEXT NOT NULL,
      size TEXT DEFAULT '',
      multiplayer TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reactions (
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY(user_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS votes (
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      choice TEXT NOT NULL,
      PRIMARY KEY(user_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const count = db.prepare('SELECT COUNT(*) c FROM games').get().c;
  if(!count){
    const stmt = db.prepare('INSERT INTO games (pack, video_url, title, size, multiplayer, genre, description) VALUES (?,?,?,?,?,?,?)');
    stmt.run(1, 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Пример игры: Neon Raid', '12 GB', '1–4 игрока', 'Action / Co-op', 'Шаблон карточки. Замени через админку на свою игру, трейлер или gameplay-видео.');
    stmt.run(1, 'https://www.youtube.com/embed/aqz-KE-bpKQ', 'Пример игры: Moon Cafe', '3 GB', '1–2 игрока', 'Casual', 'Лёгкая игра для вечернего созвона и мемов.');
    stmt.run(2, 'https://www.youtube.com/embed/ysz5S6PUM-U', 'Пример игры: Shadow Arena', '25 GB', '2–8 игроков', 'PvP', 'Пак 2 уже готов принимать игры.');
  }
}
initDb();

function cleanText(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function packNumber(value) {
  const pack = Math.trunc(Number(value) || 1);
  return Math.min(5, Math.max(1, pack));
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[char]);
}

function gamePayload(body) {
  return {
    pack: packNumber(body.pack),
    video_url: cleanText(body.video_url, 500),
    title: cleanText(body.title, 80),
    size: cleanText(body.size, 40),
    multiplayer: cleanText(body.multiplayer, 80),
    genre: cleanText(body.genre, 80),
    description: cleanText(body.description, 1200)
  };
}

function currentUser(req){ return req.session.userId ? db.prepare('SELECT id, public_id, provider, username, avatar_url FROM users WHERE id=?').get(req.session.userId) : null; }
function isAdmin(user){ return !!user && (process.env.ADMIN_IDS || '').split(',').map(s=>s.trim()).includes(user.public_id); }
function requireAuth(req,res,next){ const u=currentUser(req); if(!u) return res.status(401).json({error:'Нужно войти'}); req.user=u; next(); }
function requireAdmin(req,res,next){ const u=currentUser(req); if(!isAdmin(u)) return res.status(403).json({error:'Нет доступа'}); req.user=u; next(); }
function defaultAvatar(name){ return `/api/avatar/${encodeURIComponent(cleanText(name, 32) || 'user')}`; }

app.get('/api/avatar/:name', (req,res)=>{
  const name = escapeXml(cleanText(req.params.name || 'U', 2).toUpperCase());
  res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#ff77d9"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><rect width="100%" height="100%" rx="36" fill="url(#g)"/><text x="50%" y="55%" text-anchor="middle" font-size="56" font-family="Arial" fill="white" font-weight="700">${name}</text></svg>`);
});

app.get('/api/me', (req,res)=> res.json({ user: currentUser(req), isAdmin: isAdmin(currentUser(req)) }));
app.post('/api/auth/register', async (req,res)=>{
  const username = cleanText(req.body.username, 32);
  const password = String(req.body.password || '');
  if(!username || !password || username.length < 2 || password.length < 4) return res.status(400).json({error:'Ник от 2 символов, пароль от 4'});
  if(password.length > 200) return res.status(400).json({error:'Слишком длинный пароль'});
  const exists = db.prepare('SELECT id FROM users WHERE provider=? AND lower(username)=lower(?)').get('local', username);
  if(exists) return res.status(409).json({error:'Такой ник уже занят'});
  const hash = await bcrypt.hash(password, 10);
  const publicId = 'u_' + nanoid(10);
  const info = db.prepare('INSERT INTO users (public_id, provider, username, password_hash, avatar_url) VALUES (?,?,?,?,?)').run(publicId, 'local', username, hash, defaultAvatar(username));
  req.session.userId = info.lastInsertRowid;
  res.json({ok:true});
});
app.post('/api/auth/login', async (req,res)=>{
  const username = cleanText(req.body.username, 32);
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE provider=? AND lower(username)=lower(?)').get('local', username);
  if(!user || !(await bcrypt.compare(password || '', user.password_hash || ''))) return res.status(401).json({error:'Неверный ник или пароль'});
  req.session.userId = user.id; res.json({ok:true});
});
app.post('/api/auth/logout', (req,res)=> req.session.destroy(()=>res.json({ok:true})) );

app.get('/auth/discord', (req,res)=>{
  const id = process.env.DISCORD_CLIENT_ID;
  if(!id) return res.status(500).send('DISCORD_CLIENT_ID не указан в .env');
  const redirect = encodeURIComponent(`${BASE_URL}/auth/discord/callback`);
  res.redirect(`https://discord.com/oauth2/authorize?client_id=${id}&response_type=code&redirect_uri=${redirect}&scope=identify`);
});
app.get('/auth/discord/callback', async (req,res)=>{
  try{
    const code = req.query.code;
    if(!code) throw new Error('Нет code');
    const tokenResp = await fetch('https://discord.com/api/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID, client_secret:process.env.DISCORD_CLIENT_SECRET, grant_type:'authorization_code', code, redirect_uri:`${BASE_URL}/auth/discord/callback`})});
    const token = await tokenResp.json();
    if(!token.access_token) throw new Error(JSON.stringify(token));
    const userResp = await fetch('https://discord.com/api/users/@me', {headers:{Authorization:`Bearer ${token.access_token}`}});
    const du = await userResp.json();
    const discordName = cleanText(du.global_name || du.username || 'Discord user', 32);
    const avatar = du.avatar ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png?size=160` : defaultAvatar(discordName);
    let user = db.prepare('SELECT * FROM users WHERE discord_id=?').get(du.id);
    if(!user){
      const info = db.prepare('INSERT INTO users (public_id, provider, discord_id, username, avatar_url) VALUES (?,?,?,?,?)').run('u_'+nanoid(10), 'discord', du.id, discordName, avatar);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    } else {
      db.prepare('UPDATE users SET username=?, avatar_url=? WHERE id=?').run(discordName, avatar, user.id);
    }
    req.session.userId = user.id; res.redirect('/');
  }catch(e){ res.status(500).send('Discord auth error: '+e.message); }
});

app.get('/api/games/:pack', (req,res)=>{
  const pack = packNumber(req.params.pack);
  const games = db.prepare('SELECT * FROM games WHERE pack=? ORDER BY id DESC').all(pack).map(g=>{
    const likes = db.prepare('SELECT COUNT(*) c FROM reactions WHERE game_id=? AND value=1').get(g.id).c;
    const dislikes = db.prepare('SELECT COUNT(*) c FROM reactions WHERE game_id=? AND value=-1').get(g.id).c;
    const votes = db.prepare('SELECT votes.choice, users.username FROM votes JOIN users ON users.id=votes.user_id WHERE game_id=? ORDER BY users.username').all(g.id);
    return {...g, likes, dislikes, votes};
  });
  res.json({games});
});
app.post('/api/games/:id/reaction', requireAuth, (req,res)=>{
  const value = Number(req.body.value) === -1 ? -1 : 1;
  const game = db.prepare('SELECT id FROM games WHERE id=?').get(req.params.id);
  if(!game) return res.status(404).json({error:'Игра не найдена'});
  db.prepare('INSERT INTO reactions (user_id, game_id, value) VALUES (?,?,?) ON CONFLICT(user_id, game_id) DO UPDATE SET value=excluded.value').run(req.user.id, game.id, value);
  io.emit('dataChanged'); res.json({ok:true});
});
app.post('/api/games/:id/vote', requireAuth, (req,res)=>{
  const choice = req.body.choice === 'no' ? 'no' : 'yes';
  const game = db.prepare('SELECT id FROM games WHERE id=?').get(req.params.id);
  if(!game) return res.status(404).json({error:'Игра не найдена'});
  db.prepare('INSERT INTO votes (user_id, game_id, choice) VALUES (?,?,?) ON CONFLICT(user_id, game_id) DO UPDATE SET choice=excluded.choice').run(req.user.id, game.id, choice);
  io.emit('dataChanged'); res.json({ok:true});
});

app.get('/api/chat', (req,res)=>{
  const rows = db.prepare('SELECT chat_messages.message, chat_messages.created_at, users.username FROM chat_messages JOIN users ON users.id=chat_messages.user_id ORDER BY chat_messages.id DESC LIMIT 50').all().reverse();
  res.json({messages: rows});
});
io.on('connection', socket=>{
  socket.on('chat', msg=>{
    const userId = socket.request.session.userId;
    const user = userId && db.prepare('SELECT id, username FROM users WHERE id=?').get(userId);
    const text = cleanText(msg, 300);
    if(!user || !text) return;
    db.prepare('INSERT INTO chat_messages (user_id, message) VALUES (?,?)').run(user.id, text);
    io.emit('chat', {username:user.username, message:text, created_at:new Date().toISOString()});
  });
});

app.get('/api/admin/games', requireAdmin, (req,res)=> res.json({games: db.prepare('SELECT * FROM games ORDER BY pack, id DESC').all()}));
app.post('/api/admin/games', requireAdmin, (req,res)=>{
  const game = gamePayload(req.body);
  if(!game.title) return res.status(400).json({error:'Нужно название'});
  db.prepare('INSERT INTO games (pack, video_url, title, size, multiplayer, genre, description) VALUES (?,?,?,?,?,?,?)').run(game.pack, game.video_url, game.title, game.size, game.multiplayer, game.genre, game.description);
  io.emit('dataChanged'); res.json({ok:true});
});
app.put('/api/admin/games/:id', requireAdmin, (req,res)=>{
  const game = gamePayload(req.body);
  if(!game.title) return res.status(400).json({error:'Нужно название'});
  const info = db.prepare('UPDATE games SET pack=?, video_url=?, title=?, size=?, multiplayer=?, genre=?, description=? WHERE id=?').run(game.pack, game.video_url, game.title, game.size, game.multiplayer, game.genre, game.description, req.params.id);
  if(!info.changes) return res.status(404).json({error:'Игра не найдена'});
  io.emit('dataChanged'); res.json({ok:true});
});
app.delete('/api/admin/games/:id', requireAdmin, (req,res)=>{
  const tx = db.transaction((id) => {
    db.prepare('DELETE FROM reactions WHERE game_id=?').run(id);
    db.prepare('DELETE FROM votes WHERE game_id=?').run(id);
    return db.prepare('DELETE FROM games WHERE id=?').run(id);
  });
  const info = tx(req.params.id);
  if(!info.changes) return res.status(404).json({error:'Игра не найдена'});
  io.emit('dataChanged'); res.json({ok:true});
});

app.get('/admin', (req,res)=> res.sendFile(__dirname + '/public/admin.html'));
app.get('/secret', (req,res)=> res.sendFile(__dirname + '/public/secret.html'));
app.get('*', (req,res)=> res.sendFile(__dirname + '/public/index.html'));
server.listen(PORT, ()=> console.log(`Running on ${BASE_URL}`));
