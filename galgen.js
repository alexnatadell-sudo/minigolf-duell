'use strict';
// Galgenmännchen für zwei Spieler: einer gibt ein Wort vor, der andere rät, Rollenwechsel jede Runde.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROUNDS = 6;
const MAXERR = 8;
const MAXLEN = 16;
const MAX_AGE_MS = 90 * 24 * 3600 * 1000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
const THEMES = ['Tier', 'Essen', 'Ort', 'Haushalt', 'Natur', 'Beruf', 'Früher', 'Sonstiges'];

const WORDS = {
  'Tier': ['ELEFANT', 'SCHMETTERLING', 'EICHHÖRNCHEN', 'KROKODIL', 'PINGUIN', 'IGEL', 'FLEDERMAUS', 'NASHORN', 'KANINCHEN', 'STORCH', 'GIRAFFE', 'EICHELHÄHER'],
  'Essen': ['KARTOFFEL', 'SCHOKOLADE', 'PFANNKUCHEN', 'ERDBEERE', 'SAUERKRAUT', 'BRATWURST', 'APFELSTRUDEL', 'MARMELADE', 'ZWIEBEL', 'SPAGHETTI', 'KIRSCHKUCHEN'],
  'Ort': ['HAMBURG', 'BODENSEE', 'SCHWARZWALD', 'OSTSEE', 'MÜNCHEN', 'DRESDEN', 'ZUGSPITZE', 'LEIPZIG', 'HEIDELBERG', 'NORDSEE'],
  'Haushalt': ['STAUBSAUGER', 'REGENSCHIRM', 'KÜHLSCHRANK', 'TASCHENLAMPE', 'BÜGELEISEN', 'KAFFEEMASCHINE', 'SCHLÜSSEL', 'NÄHMASCHINE', 'BADEWANNE', 'TEPPICH'],
  'Natur': ['SONNENBLUME', 'REGENBOGEN', 'GEWITTER', 'SCHNEEFLOCKE', 'WASSERFALL', 'MORGENTAU', 'GÄNSEBLÜMCHEN', 'NEBEL'],
  'Beruf': ['BÄCKER', 'SCHORNSTEINFEGER', 'TISCHLER', 'FRISEUR', 'LOKFÜHRER', 'GÄRTNER', 'SCHNEIDER', 'BRIEFTRÄGER'],
  'Früher': ['SCHALLPLATTE', 'SCHREIBMASCHINE', 'KOFFERRADIO', 'DIAPROJEKTOR', 'WÄHLSCHEIBE', 'KAUFMANNSLADEN', 'DAMPFLOK', 'PETTICOAT']
};

let DATA_FILE = '';
let games = {};
let notifyFn = () => {};

function init(dataFile, notify) {
  DATA_FILE = dataFile;
  notifyFn = notify || notifyFn;
  try {
    games = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const now = Date.now();
    for (const id of Object.keys(games)) if (now - games[id].updatedAt > MAX_AGE_MS) delete games[id];
  } catch (e) { games = {}; }
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
  } catch (e) { console.error('galgen save failed', e.message); }
}

function token() { return crypto.randomBytes(16).toString('hex'); }
function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return n || 'Spieler';
}
// Großbuchstaben, ß wird SS. Gibt null zurück, wenn etwas anderes als Buchstaben drin ist.
function normWord(w) {
  w = String(w || '').trim().replace(/ß/g, 'SS').replace(/ẞ/g, 'SS').toUpperCase();
  return w;
}
function checkWord(w) {
  if (!w) return 'Bitte ein Wort eingeben.';
  if (/\s/.test(w)) return 'Bitte nur ein Wort, ohne Leerzeichen.';
  for (const ch of w) if (LETTERS.indexOf(ch) < 0) return 'Bitte nur Buchstaben verwenden (keine Zahlen oder Zeichen).';
  if (w.length < 2) return 'Das Wort ist zu kurz.';
  if (w.length > MAXLEN) return 'Das Wort ist zu lang (höchstens ' + MAXLEN + ' Buchstaben).';
  return '';
}

function setterOf(g, r) { return r % 2; } // Runde 1: Spieler 1 (Ersteller) gibt das Wort vor
function freshRound(g) { return { setter: setterOf(g, g.rounds.length), word: '', cat: '', auto: false, guessed: [], errs: 0, hint: false, done: false, win: null }; }

function newGame(name) {
  const id = crypto.randomUUID();
  const g = { id, status: 'waiting', players: [{ name: cleanName(name), token: token() }], rounds: [], seq: 0, createdAt: Date.now(), updatedAt: Date.now() };
  g.rounds.push(freshRound(g));
  games[id] = g; save();
  return g;
}
function seatOf(g, tok) {
  if (!tok) return -1;
  for (let i = 0; i < g.players.length; i++) if (g.players[i].token === tok) return i;
  return -1;
}
function cur(g) { return g.rounds[g.rounds.length - 1]; }
// Wer ist gerade dran? -1 = niemand (warten auf Beitritt oder Ende)
function turnOf(g) {
  if (g.status === 'finished') return -1;
  const r = cur(g);
  if (!r.word) return r.setter;
  if (g.status !== 'playing') return -1;
  return 1 - r.setter;
}
function scores(g) {
  const s = [{ solved: 0, errs: 0, played: 0 }, { solved: 0, errs: 0, played: 0 }];
  for (const r of g.rounds) {
    if (!r.done) continue;
    const gu = 1 - r.setter;
    s[gu].played++; s[gu].errs += r.errs; if (r.win) s[gu].solved++;
  }
  return s;
}
function pubRound(r, seat, full) {
  const showWord = full || r.done || seat === r.setter;
  return {
    setter: r.setter, cat: r.cat, auto: r.auto, len: r.word.length, hasWord: !!r.word,
    word: showWord ? r.word : '',
    mask: r.word ? r.word.split('').map(ch => (r.guessed.indexOf(ch) >= 0 ? ch : '')) : [],
    guessed: r.guessed, errs: r.errs, hint: r.hint, done: r.done, win: r.win
  };
}
function view(g, seat) {
  return {
    game: {
      id: g.id, status: g.status, players: g.players.map(p => ({ name: p.name })),
      rounds: g.rounds.map(r => pubRound(r, seat, g.status === 'finished')),
      round: g.rounds.length, total: ROUNDS, maxErr: MAXERR, turn: turnOf(g), scores: scores(g),
      seq: g.seq, updatedAt: g.updatedAt, rematch: g.rematch || null,
      tg: [0, 1].map(i => !!(g.players[i] && g.players[i].chat))
    },
    you: seat, themes: THEMES
  };
}
function touch(g) { g.seq++; g.updatedAt = Date.now(); save(); }

function pickWord(g) {
  const used = new Set(g.rounds.map(r => r.word));
  const pool = [];
  for (const c of Object.keys(WORDS)) for (const w of WORDS[c]) if (!used.has(w)) pool.push({ w, c });
  return pool[Math.floor(Math.random() * pool.length)];
}

function allFound(r) { for (const ch of r.word) if (r.guessed.indexOf(ch) < 0) return false; return true; }
function afterGuess(g) {
  const r = cur(g);
  if (allFound(r)) { r.done = true; r.win = true; }
  else if (r.errs >= MAXERR) { r.done = true; r.win = false; }
  if (!r.done) return;
  const gu = 1 - r.setter;
  const res = r.win ? g.players[gu].name + ' hat ' + r.word + ' erraten.' : g.players[gu].name + ' hat ' + r.word + ' nicht erraten.';
  if (g.rounds.length >= ROUNDS) {
    g.status = 'finished';
    const s = scores(g);
    const txt = 'Galgenmännchen: ' + res + ' Die Partie ist zu Ende (' + g.players[0].name + ' ' + s[0].solved + ', ' + g.players[1].name + ' ' + s[1].solved + ').';
    notifyFn(g, 0, txt); notifyFn(g, 1, txt);
  } else {
    g.rounds.push(freshRound(g));
    const ns = cur(g).setter;
    notifyFn(g, ns, 'Galgenmännchen: ' + res + ' Du bist dran und denkst dir ein Wort aus.');
    notifyFn(g, 1 - ns, 'Galgenmännchen: ' + res + ' Jetzt denkt sich ' + g.players[ns].name + ' ein Wort aus.');
  }
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

// parts: ['api','galgen', id?, action?]
async function handle(req, res, url, parts, h) {
  const { sendJson, readBody } = h;
  if (parts.length === 2 && req.method === 'POST') {
    const body = await readBody(req);
    const g = newGame(body.name);
    return sendJson(res, 200, { id: g.id, token: g.players[0].token, seat: 0 });
  }
  const g = games[parts[2]];
  if (!g) return sendJson(res, 404, { error: 'Spiel nicht gefunden' });
  const action = parts[3];
  if (!action && req.method === 'GET') return sendJson(res, 200, view(g, seatOf(g, url.searchParams.get('token'))));
  if (req.method !== 'POST') return sendJson(res, 404, { error: 'not found' });
  const body = await readBody(req);

  if (action === 'join') {
    if (g.players.length >= 2) return sendJson(res, 409, { error: 'Das Spiel ist schon voll' });
    g.players.push({ name: cleanName(body.name), token: token() });
    g.status = 'playing'; touch(g);
    const r = cur(g);
    notifyFn(g, 0, 'Galgenmännchen: ' + g.players[1].name + ' ist beigetreten.' + (r.word ? ' Das Raten beginnt.' : ' Du bist dran und denkst dir ein Wort aus.'));
    return sendJson(res, 200, { id: g.id, token: g.players[1].token, seat: 1 });
  }

  const seat = seatOf(g, body.token);
  if (seat < 0) return sendJson(res, 403, { error: 'Kein Zugriff' });

  if (action === 'rematch') {
    if (g.status !== 'finished') return sendJson(res, 409, { error: 'Die Partie läuft noch' });
    let ng = g.rematch && games[g.rematch];
    if (!ng) {
      const id = crypto.randomUUID();
      // Rollen tauschen: wer in der alten Partie geraten hat, gibt jetzt zuerst ein Wort vor
      ng = { id, status: 'playing', players: [g.players[1], g.players[0]].map(p => ({ name: p.name, token: token(), chat: p.chat })), rounds: [], seq: 0, createdAt: Date.now(), updatedAt: Date.now() };
      ng.rounds.push(freshRound(ng));
      games[id] = ng; g.rematch = id; touch(g);
      // Sitze sind getauscht: der Gegner (alter Sitz 1-seat) sitzt jetzt auf Sitz seat
      notifyFn(ng, seat, 'Galgenmännchen: ' + g.players[seat].name + ' möchte noch eine Partie.');
    }
    const newSeat = 1 - seat;
    return sendJson(res, 200, { id: ng.id, token: ng.players[newSeat].token, seat: newSeat });
  }

  if (g.status === 'finished') return sendJson(res, 409, Object.assign({ error: 'Die Partie ist zu Ende' }, view(g, seat)));
  const r = cur(g);

  if (action === 'word') {
    if (r.setter !== seat || r.word) return sendJson(res, 409, Object.assign({ error: 'Du bist gerade nicht mit dem Wort dran' }, view(g, seat)));
    if (body.auto) {
      const p = pickWord(g);
      r.word = p.w; r.cat = p.c; r.auto = true;
    } else {
      const w = normWord(body.word);
      const err = checkWord(w);
      if (err) return sendJson(res, 400, { error: err });
      const cat = THEMES.indexOf(body.cat) >= 0 ? body.cat : '';
      if (!cat) return sendJson(res, 400, { error: 'Bitte ein Thema antippen.' });
      r.word = w; r.cat = cat; r.auto = false;
    }
    touch(g);
    if (g.status === 'playing') notifyFn(g, 1 - seat, 'Galgenmännchen: ' + g.players[seat].name + ' hat ein Wort ausgesucht (Thema ' + r.cat + '). Du bist dran!');
    return sendJson(res, 200, view(g, seat));
  }

  if (action === 'guess' || action === 'hint') {
    if (g.status !== 'playing' || !r.word || seat === r.setter) return sendJson(res, 409, Object.assign({ error: 'Du bist gerade nicht dran' }, view(g, seat)));
    if (action === 'guess') {
      const l = String(body.letter || '').toUpperCase();
      if (l.length !== 1 || LETTERS.indexOf(l) < 0) return sendJson(res, 400, { error: 'Ungültiger Buchstabe' });
      if (r.guessed.indexOf(l) < 0) {
        r.guessed.push(l);
        if (r.word.indexOf(l) < 0) r.errs++;
      }
    } else {
      if (r.hint) return sendJson(res, 409, Object.assign({ error: 'Der Hinweis ist schon benutzt' }, view(g, seat)));
      const left = [];
      for (const ch of r.word) if (r.guessed.indexOf(ch) < 0 && left.indexOf(ch) < 0) left.push(ch);
      if (left.length) {
        r.hint = true;
        r.guessed.push(left[Math.floor(Math.random() * left.length)]);
        r.errs++;
      }
    }
    afterGuess(g);
    touch(g);
    return sendJson(res, 200, view(g, seat));
  }
  return sendJson(res, 404, { error: 'not found' });
}

module.exports = { init, handle, linkChat, flush, normWord, checkWord, ROUNDS, MAXERR };
