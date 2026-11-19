'use strict';
// Wörter-Duell: Wortlegespiel für zwei (per Link) oder gegen den Computer.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const WR = require('./public/woerter/regeln.js');

const MAX_AGE_MS = 90 * 24 * 3600 * 1000;
const MAX_PASSES = 4; // so viele Züge ohne Punkte hintereinander beenden die Partie
const TIPS = 3;
const LEVELS = { leicht: 'leicht', mittel: 'mittel', schwer: 'schwer' };
const LEVEL_NAME = { leicht: 'Computer (leicht)', mittel: 'Computer (mittel)', schwer: 'Computer (schwer)' };
const L = WR.LETTERS;
const LIDX = {};
for (let i = 0; i < L.length; i++) LIDX[L[i]] = i;
const ALL = (1 << L.length) - 1;

/* ---------- Wortliste als kompakter Baum (Trie) ---------- */
let T = null; // { child, next, ch, term }
function loadWords(file) {
  const t0 = Date.now();
  const words = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean);
  words.sort();
  let n = 1, prev = '';
  for (const w of words) { let i = 0; while (i < w.length && i < prev.length && w[i] === prev[i]) i++; n += w.length - i; prev = w; }
  const child = new Int32Array(n), next = new Int32Array(n), ch = new Uint8Array(n), term = new Uint8Array(n);
  let used = 1;
  for (const w of words) {
    let node = 0, ok = true;
    for (const c of w) { if (LIDX[c] === undefined) { ok = false; break; } }
    if (!ok) continue;
    for (const c of w) {
      const li = LIDX[c];
      let x = child[node];
      while (x && ch[x] !== li) x = next[x];
      if (!x) { x = used++; ch[x] = li; next[x] = child[node]; child[node] = x; }
      node = x;
    }
    term[node] = 1;
  }
  T = { child, next, ch, term, count: words.length };
  console.log('Wortliste geladen: ' + words.length + ' Wörter, ' + used + ' Knoten, ' + (Date.now() - t0) + ' ms');
}
function childOf(node, li) { let x = T.child[node]; while (x && T.ch[x] !== li) x = T.next[x]; return x; }
function isWord(w) {
  if (!T) return true;
  let node = 0;
  for (const c of w) { const li = LIDX[c]; if (li === undefined) return false; node = childOf(node, li); if (!node) return false; }
  return T.term[node] === 1;
}

/* ---------- Computer: alle möglichen Züge finden (Appel-Jacobson) ---------- */
function genMoves(board, N, rack) {
  const prem = WR.premiums(N);
  const counts = new Array(L.length).fill(0);
  let blanks = 0;
  for (const t of rack) { if (t === '?') blanks++; else counts[LIDX[t]]++; }
  const rackSize = rack.length;
  const moves = [];
  const empty = board.every(s => !s);
  const letterIdx = board.map(s => (s ? LIDX[s.toUpperCase()] : -1));
  const cellVal = board.map(s => (s && s === s.toUpperCase() ? WR.VALUES[s] : 0));

  for (const across of [true, false]) {
    const id = (r, c) => (across ? r * N + c : c * N + r);
    // Querprüfung je leerem Feld: erlaubte Buchstaben und Punkte der Querwörter
    const cross = new Int32Array(N * N).fill(ALL), crossSum = new Int32Array(N * N), hasCross = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = id(r, c);
      if (letterIdx[k] >= 0) continue;
      const up = [], down = [];
      let rr = r - 1; while (rr >= 0 && letterIdx[id(rr, c)] >= 0) { up.unshift(id(rr, c)); rr--; }
      rr = r + 1; while (rr < N && letterIdx[id(rr, c)] >= 0) { down.push(id(rr, c)); rr++; }
      if (!up.length && !down.length) continue;
      hasCross[k] = 1;
      let sum = 0; for (const q of up) sum += cellVal[q]; for (const q of down) sum += cellVal[q];
      crossSum[k] = sum;
      let node = 0;
      for (const q of up) { node = childOf(node, letterIdx[q]); if (!node) break; }
      let mask = 0;
      if (node || !up.length) {
        for (let x = T.child[node]; x; x = T.next[x]) {
          let n2 = x, okw = true;
          for (const q of down) { n2 = childOf(n2, letterIdx[q]); if (!n2) { okw = false; break; } }
          if (okw && T.term[n2]) mask |= 1 << T.ch[x];
        }
      }
      cross[k] = mask;
    }
    const isAnchor = (r, c) => {
      const k = id(r, c);
      if (letterIdx[k] >= 0) return false;
      if (empty) return k === WR.center(N);
      return (r > 0 && letterIdx[id(r - 1, c)] >= 0) || (r < N - 1 && letterIdx[id(r + 1, c)] >= 0) ||
        (c > 0 && letterIdx[id(r, c - 1)] >= 0) || (c < N - 1 && letterIdx[id(r, c + 1)] >= 0);
    };
    for (let r = 0; r < N; r++) {
      const anchors = [];
      for (let c = 0; c < N; c++) anchors.push(isAnchor(r, c));
      const placed = []; // {c, li, j}
      const record = (endC) => {
        // Wort reicht vom ersten Stein bis endC-1
        let start = endC - 1;
        while (start > 0 && (letterIdx[id(r, start - 1)] >= 0 || placed.some(p => p.c === start - 1))) start--;
        const len = endC - start;
        if (len < 2) return;
        let main = 0, wm = 1, extra = 0;
        const pmap = {};
        for (const p of placed) pmap[p.c] = p;
        for (let c = start; c < endC; c++) {
          const k = id(r, c);
          const p = pmap[c];
          if (!p) { main += cellVal[k]; continue; }
          let v = p.j ? 0 : WR.VALUES[L[p.li]], lm = 1, w = 1;
          const pr = prem[k];
          if (pr === 1) lm = 2; else if (pr === 2) lm = 3; else if (pr === 3) w = 2; else if (pr === 4) w = 3;
          main += v * lm; wm *= w;
          if (hasCross[k]) extra += (crossSum[k] + v * lm) * w;
        }
        let score = main * wm + extra;
        if (placed.length === WR.RACK) score += WR.BINGO;
        moves.push({ score, len, jokers: placed.reduce((a, p) => a + (p.j ? 1 : 0), 0), tiles: placed.map(p => ({ i: id(r, p.c), l: L[p.li], j: !!p.j })) });
      };
      const extendRight = (node, c, anchorC) => {
        if (c < N && letterIdx[id(r, c)] >= 0) {
          const nx = childOf(node, letterIdx[id(r, c)]);
          if (nx) extendRight(nx, c + 1, anchorC);
          return;
        }
        if (c > anchorC && T.term[node] && placed.length) record(c);
        if (c >= N || placed.length >= rackSize) return;
        const k = id(r, c);
        const mask = cross[k];
        for (let x = T.child[node]; x; x = T.next[x]) {
          const li = T.ch[x];
          if (!(mask & (1 << li))) continue;
          if (counts[li] > 0) {
            counts[li]--; placed.push({ c, li, j: false });
            extendRight(x, c + 1, anchorC);
            placed.pop(); counts[li]++;
          } else if (blanks > 0) {
            blanks--; placed.push({ c, li, j: true });
            extendRight(x, c + 1, anchorC);
            placed.pop(); blanks++;
          }
        }
      };
      const leftPart = (node, anchorC, limit, depth) => {
        // linke Steine liegen auf anchorC-depth .. anchorC-1
        extendRight(node, anchorC, anchorC);
        if (limit <= 0) return;
        for (let x = T.child[node]; x; x = T.next[x]) {
          const li = T.ch[x];
          const use = counts[li] > 0 ? 'n' : blanks > 0 ? 'j' : '';
          if (!use) continue;
          if (use === 'n') counts[li]--; else blanks--;
          // alle bisherigen linken Steine eins nach links schieben, neuer Stein direkt vor den Anker
          for (const p of placed) p.c--;
          placed.push({ c: anchorC - 1, li, j: use === 'j' });
          leftPart(x, anchorC, limit - 1, depth + 1);
          placed.pop();
          for (const p of placed) p.c++;
          if (use === 'n') counts[li]++; else blanks++;
        }
      };
      for (let c = 0; c < N; c++) {
        if (!anchors[c]) continue;
        if (c > 0 && letterIdx[id(r, c - 1)] >= 0) {
          let s = c - 1; while (s > 0 && letterIdx[id(r, s - 1)] >= 0) s--;
          let node = 0;
          for (let q = s; q < c && (q === s || node); q++) node = childOf(node, letterIdx[id(r, q)]);
          if (node) extendRight(node, c, c);
        } else {
          let limit = 0, q = c - 1;
          while (q >= 0 && !anchors[q] && letterIdx[id(r, q)] < 0) { limit++; q--; }
          leftPart(0, c, Math.min(limit, rackSize - 1), 0);
        }
      }
    }
  }
  return moves;
}

// Zug für den Computer oder als Tipp auswählen
function chooseMove(board, N, rack, level) {
  const all = genMoves(board, N, rack);
  if (!all.length) return null;
  const valid = [];
  for (const m of all) {
    const ev = WR.evaluate(board, N, m.tiles);
    if (ev.error) continue;
    if (!ev.words.every(w => isWord(w.w))) continue;
    m.score = ev.score; m.words = ev.words.map(w => w.w);
    valid.push(m);
  }
  if (!valid.length) return null;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  if (level === 'schwer') {
    valid.sort((a, b) => (b.score - b.jokers * 8) - (a.score - a.jokers * 8));
    return valid[0];
  }
  if (level === 'tipp') {
    let pool = valid.filter(m => m.words.every(w => w.length <= 6) && !m.jokers);
    if (!pool.length) pool = valid;
    pool.sort((a, b) => b.score - a.score);
    return rnd(pool.slice(0, 3));
  }
  if (level === 'mittel') {
    const max = Math.max(...valid.map(m => m.score));
    let pool = valid.filter(m => m.score >= max * 0.45 && m.score <= max * 0.8 && m.jokers === 0);
    if (!pool.length) pool = valid.filter(m => m.score >= max * 0.3);
    return rnd(pool);
  }
  // leicht: kurze Wörter, keine Joker, eher wenige Punkte
  let pool = valid.filter(m => m.len >= 3 && m.words.every(w => w.length <= 5) && !m.jokers);
  if (!pool.length) pool = valid.filter(m => !m.jokers);
  if (!pool.length) pool = valid;
  pool.sort((a, b) => a.score - b.score);
  const lo = Math.floor(pool.length * 0.3), hi = Math.max(lo + 1, Math.ceil(pool.length * 0.7));
  return rnd(pool.slice(lo, hi));
}

/* ---------- Partien ---------- */
let DATA_FILE = '';
let games = {};
let notifyFn = () => {};

function init(dataFile, notify, wordFile) {
  DATA_FILE = dataFile;
  notifyFn = notify || notifyFn;
  try {
    games = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const now = Date.now();
    for (const id of Object.keys(games)) if (now - games[id].updatedAt > MAX_AGE_MS) delete games[id];
  } catch (e) { games = {}; }
  try { loadWords(wordFile || path.join(__dirname, 'woerter', 'wortliste.txt.gz')); } catch (e) { console.error('Wortliste fehlt', e.message); }
  for (const g of Object.values(games)) scheduleCpu(g);
}
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, 150);
}
function flush() {
  if (!DATA_FILE) return;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(games));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) { console.error('woerter save failed', e.message); }
}
function token() { return crypto.randomBytes(16).toString('hex'); }
function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return n || 'Spieler';
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function draw(g, p) { while (p.rack.length < WR.RACK && g.bag.length) p.rack.push(g.bag.pop()); }
function seatOf(g, tok) {
  if (!tok) return -1;
  for (let i = 0; i < g.players.length; i++) if (g.players[i].token === tok) return i;
  return -1;
}
function touch(g) { g.seq++; g.updatedAt = Date.now(); save(); }
function label() { return 'Wörter-Duell: '; }

function makeGame(opts, players) {
  const N = opts.size === 15 ? 15 : 11;
  const g = {
    id: crypto.randomUUID(), status: opts.mode === 'cpu' ? 'playing' : 'waiting',
    mode: opts.mode === 'cpu' ? 'cpu' : 'duel', level: LEVELS[opts.level] || 'leicht',
    size: N, check: opts.check !== false, tips: opts.tips ? TIPS : 0,
    players, board: new Array(N * N).fill(''), bag: shuffle(WR.bagFor(N)),
    turn: opts.first || 0, passes: 0, moves: [], seq: 0, createdAt: Date.now(), updatedAt: Date.now()
  };
  for (const p of g.players) { p.rack = []; p.score = 0; p.tipsUsed = 0; draw(g, p); }
  if (g.mode === 'cpu') g.check = opts.check !== false;
  games[g.id] = g; save();
  return g;
}
function newGame(body) {
  const opts = { mode: body.mode, level: body.level, size: Number(body.size), check: body.check !== false, tips: !!body.tips };
  const players = [{ name: cleanName(body.name), token: token() }];
  if (opts.mode === 'cpu') players.push({ name: LEVEL_NAME[LEVELS[opts.level] || 'leicht'], token: token(), cpu: true });
  else players.push({ name: '', token: '' }); // Platz für den Gast, Steine liegen schon bereit
  const g = makeGame(opts, players);
  return g;
}

function view(g, seat) {
  const fin = g.status === 'finished';
  const last = [...g.moves].reverse().find(m => m.type === 'play');
  return {
    game: {
      id: g.id, status: g.status, mode: g.mode, level: g.level, size: g.size, check: g.check, tips: g.tips,
      players: g.players.map((p, i) => ({ name: p.name || '', score: p.score, tiles: p.rack.length, cpu: !!p.cpu, tipsLeft: g.tips - (p.tipsUsed || 0), rack: fin || i === seat ? p.rack : null })),
      joined: !!g.players[1].token && (g.mode === 'cpu' || !!g.players[1].name),
      board: g.board, bag: g.bag.length, turn: fin ? -1 : g.turn, moves: g.moves.slice(-40), total: g.moves.length,
      last: last ? last.cells : [], seq: g.seq, updatedAt: g.updatedAt, rematch: g.rematch || null,
      tg: [0, 1].map(i => !!(g.players[i] && g.players[i].chat))
    },
    you: seat
  };
}

function takeFromRack(rack, need) {
  const r = rack.slice();
  for (const t of need) { const k = r.indexOf(t); if (k < 0) return null; r.splice(k, 1); }
  return r;
}
function otherSeat(s) { return 1 - s; }

function finish(g, outSeat) {
  g.status = 'finished';
  const pen = g.players.map(p => WR.rackValue(p.rack));
  if (outSeat >= 0) {
    const o = otherSeat(outSeat);
    g.players[outSeat].score += pen[o];
    g.players[o].score -= pen[o];
    g.moves.push({ p: outSeat, type: 'end', score: pen[o], minus: pen[o] });
  } else {
    g.players.forEach((p, i) => { p.score -= pen[i]; });
    g.moves.push({ p: -1, type: 'end', minus0: pen[0], minus1: pen[1] });
  }
  const s = g.players.map(p => p.name + ' ' + p.score).join(', ');
  notifyFn(g, 0, label(g) + 'Die Partie ist zu Ende (' + s + ').');
  notifyFn(g, 1, label(g) + 'Die Partie ist zu Ende (' + s + ').');
}
function nextTurn(g, seat, txt) {
  g.turn = otherSeat(seat);
  notifyFn(g, g.turn, label(g) + g.players[seat].name + ' ' + txt + ' Du bist dran!');
}

// Gemeinsame Zuglogik für Mensch und Computer. Gibt Fehlertext oder '' zurück.
function doPlay(g, seat, tiles, force) {
  const p = g.players[seat];
  if (!Array.isArray(tiles) || !tiles.length || tiles.length > WR.RACK) return { error: 'Lege zuerst Steine aufs Brett.' };
  tiles = tiles.map(t => ({ i: Number(t.i), l: String(t.l || '').toUpperCase(), j: !!t.j }));
  const rest = takeFromRack(p.rack, tiles.map(t => (t.j ? '?' : t.l)));
  if (!rest) return { error: 'Diese Steine hast du nicht.' };
  const ev = WR.evaluate(g.board, g.size, tiles);
  if (ev.error) return { error: ev.error };
  if (g.check && !force) {
    const bad = ev.words.map(w => w.w).filter(w => !isWord(w));
    if (bad.length) return { error: (bad.length > 1 ? 'Diese Wörter kenne ich nicht: ' : 'Dieses Wort kenne ich nicht: ') + bad.join(', '), bad };
  }
  for (const t of tiles) g.board[t.i] = t.j ? t.l.toLowerCase() : t.l;
  p.rack = rest;
  p.score += ev.score;
  draw(g, p);
  g.passes = 0;
  g.moves.push({ p: seat, type: 'play', words: ev.words.map(w => ({ w: w.w, pts: w.pts })), score: ev.score, bingo: ev.bingo, cells: ev.cells });
  if (!p.rack.length && !g.bag.length) finish(g, seat);
  else nextTurn(g, seat, 'hat ' + ev.words[0].w + ' gelegt (' + ev.score + ' Punkte).');
  return { ok: true };
}
function doPass(g, seat, swap) {
  const p = g.players[seat];
  if (swap && swap.length) {
    if (g.bag.length < WR.RACK) return { error: 'Tauschen geht nur, solange noch mindestens ' + WR.RACK + ' Steine im Beutel sind.' };
    const rest = takeFromRack(p.rack, swap);
    if (!rest) return { error: 'Diese Steine hast du nicht.' };
    p.rack = rest;
    draw(g, p);
    g.bag.push(...swap); shuffle(g.bag);
    g.moves.push({ p: seat, type: 'swap', n: swap.length });
  } else {
    g.moves.push({ p: seat, type: 'pass' });
  }
  g.passes++;
  if (g.passes >= MAX_PASSES) finish(g, -1);
  else nextTurn(g, seat, swap && swap.length ? 'hat Steine getauscht.' : 'hat gepasst.');
  return { ok: true };
}

const cpuTimers = {};
function scheduleCpu(g) {
  if (g.mode !== 'cpu' || g.status !== 'playing' || !g.players[g.turn].cpu || cpuTimers[g.id]) return;
  cpuTimers[g.id] = setTimeout(() => {
    delete cpuTimers[g.id];
    if (g.status !== 'playing' || !g.players[g.turn].cpu) return;
    const seat = g.turn, p = g.players[seat];
    let m = null;
    try { m = chooseMove(g.board, g.size, p.rack, g.level); } catch (e) { console.error('cpu', e); }
    if (m) doPlay(g, seat, m.tiles, true);
    else if (g.bag.length >= WR.RACK) doPass(g, seat, p.rack.filter(t => t !== '?' && t !== 'E'));
    else doPass(g, seat, null);
    touch(g);
  }, 900);
}

function linkChat(tok, chatId) {
  for (const g of Object.values(games)) {
    const seat = seatOf(g, tok);
    if (seat < 0) continue;
    g.players[seat].chat = chatId; g.updatedAt = Date.now(); save();
    return true;
  }
  return false;
}

// parts: ['api','woerter', id?, action?]
async function handle(req, res, url, parts, h) {
  const { sendJson, readBody } = h;
  if (parts.length === 2 && req.method === 'POST') {
    const body = await readBody(req);
    const g = newGame(body);
    return sendJson(res, 200, { id: g.id, token: g.players[0].token, seat: 0 });
  }
  const g = games[parts[2]];
  if (!g) return sendJson(res, 404, { error: 'Partie nicht gefunden' });
  const action = parts[3];
  if (!action && req.method === 'GET') { scheduleCpu(g); return sendJson(res, 200, view(g, seatOf(g, url.searchParams.get('token')))); }
  if (req.method !== 'POST') return sendJson(res, 404, { error: 'not found' });
  const body = await readBody(req);

  if (action === 'join') {
    if (g.mode === 'cpu' || g.players[1].name) return sendJson(res, 409, { error: 'Die Partie ist schon voll' });
    g.players[1].name = cleanName(body.name); g.players[1].token = token();
    g.status = 'playing'; touch(g);
    notifyFn(g, 0, label(g) + g.players[1].name + ' ist beigetreten.' + (g.turn === 0 ? ' Du bist dran!' : ''));
    return sendJson(res, 200, { id: g.id, token: g.players[1].token, seat: 1 });
  }
  const seat = seatOf(g, body.token);
  if (seat < 0) return sendJson(res, 403, { error: 'Kein Zugriff' });

  if (action === 'rematch') {
    if (g.status !== 'finished') return sendJson(res, 409, { error: 'Die Partie läuft noch' });
    let ng = g.rematch && games[g.rematch];
    if (!ng) {
      const players = g.players.map(p => ({ name: p.name, token: token(), chat: p.chat, cpu: p.cpu }));
      // gegen den Computer fängt immer der Mensch an, sonst wechselt der Anfang
      const first = g.mode === 'cpu' ? 0 : 1 - (g.first || 0);
      ng = makeGame({ mode: g.mode, level: g.level, size: g.size, check: g.check, tips: !!g.tips, first }, players);
      ng.first = first; ng.status = 'playing';
      g.rematch = ng.id; touch(g); touch(ng);
      notifyFn(ng, 1 - seat, label(ng) + g.players[seat].name + ' möchte noch eine Partie.' + (ng.turn === 1 - seat ? ' Du bist dran!' : ''));
    }
    return sendJson(res, 200, { id: ng.id, token: ng.players[seat].token, seat });
  }

  if (g.status === 'finished') return sendJson(res, 409, Object.assign({ error: 'Die Partie ist zu Ende' }, view(g, seat)));
  if (g.turn !== seat) return sendJson(res, 409, Object.assign({ error: 'Du bist gerade nicht dran' }, view(g, seat)));

  if (action === 'tip') {
    const p = g.players[seat];
    if ((p.tipsUsed || 0) >= g.tips) return sendJson(res, 409, { error: 'Keine Tipps mehr übrig' });
    const m = chooseMove(g.board, g.size, p.rack, 'tipp');
    if (!m) return sendJson(res, 200, { tiles: [], msg: 'Ich finde kein Wort. Tausche Steine oder passe.' });
    p.tipsUsed = (p.tipsUsed || 0) + 1; touch(g);
    return sendJson(res, 200, { tiles: m.tiles, score: m.score, left: g.tips - p.tipsUsed });
  }
  let r;
  if (action === 'play') r = doPlay(g, seat, body.tiles, false);
  else if (action === 'swap') r = doPass(g, seat, Array.isArray(body.tiles) && body.tiles.length ? body.tiles.map(String) : null);
  else if (action === 'pass') r = doPass(g, seat, null);
  else return sendJson(res, 404, { error: 'not found' });
  if (r.error) return sendJson(res, 400, r);
  touch(g);
  scheduleCpu(g);
  return sendJson(res, 200, view(g, seat));
}

module.exports = { init, handle, linkChat, flush, isWord, genMoves, chooseMove, loadWords, _games: () => games };
