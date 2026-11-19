'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MG = require('./public/shared.js');
const GALGEN = require('./galgen.js');
const WOERTER = require('./woerter.js');

const PORT = parseInt(process.env.PORT || '3020', 10);
const DATA_FILE = process.env.DATA_FILE || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'games.json') : path.join(__dirname, 'data', 'games.json'));
const PUBLIC = path.join(__dirname, 'public');
const MAX_AGE_MS = 90 * 24 * 3600 * 1000;

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let TG_USER = process.env.TELEGRAM_BOT_USERNAME || '';
let baseUrl = process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '');

let games = {};
try {
  games = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const now = Date.now();
  for (const id of Object.keys(games)) if (now - games[id].updatedAt > MAX_AGE_MS) delete games[id];
} catch (e) { games = {}; }

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(games));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error('save failed', e.message); }
  }, 150);
}

async function tg(method, body) {
  const r = await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}
function notify(g, seat, text, gid, prefix) {
  const p = g.players[seat];
  if (!TG_TOKEN || !p || !p.chat) return;
  tg('sendMessage', { chat_id: p.chat, text: text + (baseUrl ? '\n' + baseUrl + (prefix || '/') + '#/game/' + (gid || g.id) : '') }).catch(e => console.error('telegram', e.message));
}
GALGEN.init(path.join(path.dirname(DATA_FILE), 'galgen.json'), (g, seat, text) => notify(g, seat, text, null, '/galgen/'));
WOERTER.init(path.join(path.dirname(DATA_FILE), 'woerter.json'), (g, seat, text) => notify(g, seat, text, null, '/woerter/'));
async function tgLoop() {
  let offset = 0;
  try { const me = await tg('getMe'); if (me.ok && !TG_USER) TG_USER = me.result.username; await tg('deleteWebhook'); } catch (e) { console.error('telegram init', e.message); }
  for (;;) {
    try {
      const r = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      if (!r.ok) { await new Promise(res => setTimeout(res, 10000)); continue; }
      for (const u of r.result) {
        offset = u.update_id + 1;
        const m = u.message;
        if (!m || !m.text) continue;
        const mt = /^\/start\s+([a-f0-9]{32})$/.exec(m.text.trim());
        if (!mt) { tg('sendMessage', { chat_id: m.chat.id, text: 'Hallo! Über den Telegram-Knopf im Spiel verbindest du dich mit deinem Spiel.' }).catch(() => {}); continue; }
        if (GALGEN.linkChat(mt[1], m.chat.id)) { tg('sendMessage', { chat_id: m.chat.id, text: 'Verbunden! Ich melde mich, sobald du beim Galgenmännchen dran bist.' }).catch(() => {}); continue; }
        if (WOERTER.linkChat(mt[1], m.chat.id)) { tg('sendMessage', { chat_id: m.chat.id, text: 'Verbunden! Ich melde mich, sobald du beim Wörter-Duell dran bist.' }).catch(() => {}); continue; }
        for (const g of Object.values(games)) {
          const seat = seatOf(g, mt[1]);
          if (seat < 0) continue;
          g.players[seat].chat = m.chat.id; g.updatedAt = Date.now(); save();
          tg('sendMessage', { chat_id: m.chat.id, text: 'Verbunden! Ich melde mich, sobald du beim Minigolf dran bist.' }).catch(() => {});
          break;
        }
      }
    } catch (e) { await new Promise(res => setTimeout(res, 10000)); }
  }
}

function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return n || 'Spieler';
}
function token() { return crypto.randomBytes(16).toString('hex'); }
function teeBalls(level) {
  return [0, 1].map(i => ({ x: level.tee[i][0], y: level.tee[i][1], strokes: 0, done: false }));
}
function newGame(name) {
  const id = crypto.randomUUID();
  const g = {
    id, status: 'waiting',
    players: [{ name: cleanName(name), token: token() }],
    hole: 0, turn: 0, balls: teeBalls(MG.LEVELS[0]),
    scores: [[], []], seq: 0, lastShot: null,
    createdAt: Date.now(), updatedAt: Date.now()
  };
  games[id] = g; save();
  return g;
}
function pub(g) {
  return {
    id: g.id, status: g.status, players: g.players.map(p => ({ name: p.name })),
    hole: g.hole, turn: g.turn, balls: g.balls, scores: g.scores, seq: g.seq,
    levels: MG.LEVELS.length, updatedAt: g.updatedAt, rematch: g.rematch || null, tg: [0, 1].map(i => !!(g.players[i] && g.players[i].chat))
  };
}
function seatOf(g, tok) {
  if (!tok) return -1;
  for (let i = 0; i < g.players.length; i++) if (g.players[i].token === tok) return i;
  return -1;
}
function view(g, seat, seqParam) {
  const out = { game: pub(g), you: seat };
  if (g.lastShot && seqParam < g.seq) out.shot = g.lastShot;
  return out;
}

function applyShot(g, seat, angle, power, sync) {
  const hole = g.hole, level = MG.LEVELS[hole];
  let phase = Math.random() * Math.PI * 2;
  if (sync && isFinite(sync.mill) && Array.isArray(sync.gates) && sync.gates.length >= level.gates.length && sync.gates.every(isFinite)) {
    phase = { mill: sync.mill, gates: sync.gates.map(Number) };
  }
  const res = MG.runShot(level, g.balls, seat, angle, power, phase);
  const penalties = [0, 0];
  g.balls[seat].strokes += 1;
  for (let i = 0; i < 2; i++) {
    const b = g.balls[i], r = res.balls[i];
    if (g.balls[i].done) continue;
    b.x = r.x; b.y = r.y;
    if (r.splash) { b.strokes += 1; penalties[i] = 1; }
    if (r.sunk) b.done = true;
    if (!b.done && b.strokes >= MG.MAX_STROKES) {
      b.strokes = MG.MAX_STROKES; b.done = true; b.x = level.hole.x; b.y = level.hole.y;
    }
  }
  g.seq += 1;
  g.lastShot = { seq: g.seq, shooter: seat, hole, angle, power, frames: res.frames, events: res.events, penalties };
  const other = 1 - seat;
  if (g.balls[0].done && g.balls[1].done) {
    g.scores[0][hole] = g.balls[0].strokes; g.scores[1][hole] = g.balls[1].strokes;
    g.hole += 1;
    if (g.hole >= MG.LEVELS.length) { g.status = 'finished'; g.hole = MG.LEVELS.length - 1; }
    else { g.balls = teeBalls(MG.LEVELS[g.hole]); g.turn = g.hole % 2; }
  } else {
    g.turn = g.balls[other].done ? seat : other;
  }
  g.updatedAt = Date.now();
  save();
  if (g.status === 'finished') { notify(g, 0, 'Minigolf: Das Spiel ist zu Ende!'); notify(g, 1, 'Minigolf: Das Spiel ist zu Ende!'); }
  else if (g.turn !== seat) notify(g, g.turn, 'Minigolf: ' + g.players[seat].name + ' hat geschlagen. Du bist dran!');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // api games :id action
  if (parts[1] === 'config') return sendJson(res, 200, { telegram: !!TG_TOKEN, bot: TG_USER });
  if (!process.env.PUBLIC_URL && !process.env.RAILWAY_PUBLIC_DOMAIN && req.headers.host) baseUrl = (req.headers['x-forwarded-proto'] || 'http') + '://' + (req.headers['x-forwarded-host'] || req.headers.host);
  if (parts[1] === 'galgen') return GALGEN.handle(req, res, url, parts, { sendJson, readBody });
  if (parts[1] === 'woerter') return WOERTER.handle(req, res, url, parts, { sendJson, readBody });
  if (parts[1] !== 'games') return sendJson(res, 404, { error: 'not found' });
  if (parts.length === 2 && req.method === 'POST') {
    const body = await readBody(req);
    const g = newGame(body.name);
    return sendJson(res, 200, { id: g.id, token: g.players[0].token, seat: 0 });
  }
  const g = games[parts[2]];
  if (!g) return sendJson(res, 404, { error: 'Spiel nicht gefunden' });
  const action = parts[3];
  if (!action && req.method === 'GET') {
    const seat = seatOf(g, url.searchParams.get('token'));
    const seq = parseInt(url.searchParams.get('seq') || '0', 10);
    return sendJson(res, 200, view(g, seat, isNaN(seq) ? 0 : seq));
  }
  if (action === 'join' && req.method === 'POST') {
    const body = await readBody(req);
    if (g.players.length >= 2) return sendJson(res, 409, { error: 'Das Spiel ist schon voll' });
    g.players.push({ name: cleanName(body.name), token: token() });
    g.status = 'playing'; g.updatedAt = Date.now(); save();
    notify(g, 0, 'Minigolf: ' + g.players[1].name + ' ist beigetreten. Du bist dran!');
    return sendJson(res, 200, { id: g.id, token: g.players[1].token, seat: 1 });
  }
  if (action === 'shot' && req.method === 'POST') {
    const body = await readBody(req);
    const seat = seatOf(g, body.token);
    if (seat < 0) return sendJson(res, 403, { error: 'Kein Zugriff' });
    const angle = Number(body.angle), power = Number(body.power);
    if (!isFinite(angle) || !isFinite(power)) return sendJson(res, 400, { error: 'Ungültiger Schlag' });
    if (g.status !== 'playing' || g.turn !== seat) {
      return sendJson(res, 409, Object.assign({ error: 'Du bist nicht dran' }, view(g, seat, g.seq)));
    }
    applyShot(g, seat, angle, Math.max(3, Math.min(100, power)), { mill: Number(body.mill), gates: Array.isArray(body.gates) ? body.gates.map(Number) : null });
    return sendJson(res, 200, view(g, seat, g.seq - 1));
  }
  if (action === 'rematch' && req.method === 'POST') {
    const body = await readBody(req);
    const seat = seatOf(g, body.token);
    if (seat < 0) return sendJson(res, 403, { error: 'Kein Zugriff' });
    if (g.status !== 'finished') return sendJson(res, 409, { error: 'Das Spiel läuft noch' });
    let ng = g.rematch && games[g.rematch];
    if (!ng) {
      const id = crypto.randomUUID();
      ng = {
        id, status: 'playing',
        players: g.players.map(p => ({ name: p.name, token: token(), chat: p.chat })),
        hole: 0, turn: 0, balls: teeBalls(MG.LEVELS[0]),
        scores: [[], []], seq: 0, lastShot: null,
        createdAt: Date.now(), updatedAt: Date.now()
      };
      games[id] = ng; g.rematch = id; g.updatedAt = Date.now(); save();
      notify(ng, 1 - seat, 'Minigolf: ' + g.players[seat].name + ' will Revanche!' + (ng.turn === 1 - seat ? ' Du bist dran.' : ''), g.id);
    }
    return sendJson(res, 200, { id: ng.id, token: ng.players[seat].token, seat });
  }
  return sendJson(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/galgen') { res.writeHead(301, { Location: '/galgen/' }); return res.end(); }
  if (p === '/woerter') { res.writeHead(301, { Location: '/woerter/' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true, games: Object.keys(games).length });
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 400, { error: 'Fehlerhafte Anfrage' }); else res.end();
  }
});
server.listen(PORT, '0.0.0.0', () => console.log('Minigolf Duell läuft auf Port ' + PORT));
if (TG_TOKEN) tgLoop();
process.on('SIGTERM', () => { GALGEN.flush(); WOERTER.flush(); try { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(games)); } catch (e) {} process.exit(0); });
