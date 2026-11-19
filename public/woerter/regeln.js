// Wörter-Duell: Regeln, die Server und Browser gemeinsam nutzen (Brett, Steine, Wertung).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WR = factory();
})(this, function () {
  'use strict';
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
  var VALUES = {};
  [['ENSIRATU', 1], ['DHLGOM', 2], ['BCWK', 3], ['FZP', 4], ['VÜÄÖJ', 6], ['XY', 8], ['Q', 10]].forEach(function (p) {
    for (var i = 0; i < p[0].length; i++) VALUES[p[0][i]] = p[1];
  });
  var RACK = 7;
  var BINGO = 50;
  // Eigene Verteilung, an der Buchstabenhäufigkeit im Deutschen orientiert. ? = Joker.
  var BAGS = {
    11: 'E8 N5 S4 I4 R4 A4 T4 U3 D2 H2 L2 G2 O2 C2 M2 B1 F1 K1 W1 Z1 P1 V1 Ü1 Ä1 Ö1 ?2',
    15: 'E14 N9 S7 I6 R6 A6 T6 U4 D4 H4 L4 M4 G3 O3 C3 B2 F2 K2 W2 Z1 P1 V1 Ü1 Ä1 Ö1 J1 X1 Q1 ?2'
  };
  // Bonusfelder, je ein Achtel des Bretts (Zeile <= Spalte <= Mitte), wird achtfach gespiegelt.
  // 1 = Buchstabe x2, 2 = Buchstabe x3, 3 = Wort x2, 4 = Wort x3
  var OCT = {
    11: { 4: [[0, 0]], 3: [[2, 2], [5, 5]], 2: [[3, 3], [1, 1], [1, 5]], 1: [[0, 3], [4, 5]] },
    15: { 4: [[0, 3]], 3: [[1, 5], [4, 4], [7, 7]], 2: [[0, 0], [2, 6], [5, 7]], 1: [[1, 2], [3, 3], [0, 7], [5, 5], [3, 5]] }
  };
  var cache = {};
  function premiums(N) {
    if (cache[N]) return cache[N];
    var p = new Array(N * N).fill(0), oct = OCT[N];
    Object.keys(oct).forEach(function (k) {
      oct[k].forEach(function (rc) {
        var r = rc[0], c = rc[1], m = N - 1;
        [[r, c], [c, r], [m - r, c], [m - c, r], [r, m - c], [c, m - r], [m - r, m - c], [m - c, m - r]].forEach(function (q) { p[q[0] * N + q[1]] = +k; });
      });
    });
    cache[N] = p;
    return p;
  }
  function bagFor(N) {
    var out = [];
    BAGS[N].split(' ').forEach(function (t) { var ch = t[0], n = parseInt(t.slice(1), 10); for (var i = 0; i < n; i++) out.push(ch); });
    return out;
  }
  function center(N) { var h = (N - 1) / 2; return h * N + h; }
  // Brettzelle: '' leer, Großbuchstabe = normaler Stein, Kleinbuchstabe = Joker mit diesem Buchstaben
  function cellLetter(s) { return s ? s.toUpperCase() : ''; }
  function cellValue(s) { return s && s === s.toUpperCase() ? VALUES[s] || 0 : 0; }
  function rackValue(rack) { var t = 0; for (var i = 0; i < rack.length; i++) t += rack[i] === '?' ? 0 : VALUES[rack[i]] || 0; return t; }

  // tiles: [{i: Feldnummer, l: Buchstabe, j: true wenn Joker}]
  // Ergebnis: {error} oder {words: [{w, pts, cells}], score, bingo, cells}
  function evaluate(board, N, tiles) {
    if (!tiles || !tiles.length) return { error: 'Lege zuerst Steine aufs Brett.' };
    if (tiles.length > RACK) return { error: 'Zu viele Steine.' };
    var prem = premiums(N), neu = {}, empty = true, i;
    for (i = 0; i < board.length; i++) if (board[i]) { empty = false; break; }
    for (i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (!(t.i >= 0 && t.i < N * N) || t.i !== Math.floor(t.i)) return { error: 'Ungültiges Feld.' };
      if (board[t.i] || neu[t.i]) return { error: 'Das Feld ist schon belegt.' };
      if (typeof t.l !== 'string' || t.l.length !== 1 || LETTERS.indexOf(t.l) < 0) return { error: 'Ungültiger Buchstabe.' };
      neu[t.i] = t.j ? t.l.toLowerCase() : t.l;
    }
    var rows = {}, cols = {};
    tiles.forEach(function (t) { rows[Math.floor(t.i / N)] = 1; cols[t.i % N] = 1; });
    var nr = Object.keys(rows).length, nc = Object.keys(cols).length;
    if (nr > 1 && nc > 1) return { error: 'Alle Steine müssen in einer Reihe liegen, waagerecht oder senkrecht.' };
    function at(r, c) { if (r < 0 || c < 0 || r >= N || c >= N) return ''; var k = r * N + c; return board[k] || neu[k] || ''; }
    function wordAt(r, c, dr, dc) {
      while (at(r - dr, c - dc)) { r -= dr; c -= dc; }
      var cells = [];
      while (at(r, c)) { cells.push(r * N + c); r += dr; c += dc; }
      return cells;
    }
    function score(cells) {
      var sum = 0, wm = 1, w = '';
      cells.forEach(function (k) {
        var s = board[k] || neu[k], v = cellValue(s);
        w += cellLetter(s);
        if (!board[k]) {
          var p = prem[k];
          if (p === 1) v *= 2; else if (p === 2) v *= 3; else if (p === 3) wm *= 2; else if (p === 4) wm *= 3;
        }
        sum += v;
      });
      return { w: w, pts: sum * wm, cells: cells };
    }
    var t0 = tiles[0], r0 = Math.floor(t0.i / N), c0 = t0.i % N;
    // Richtung: bei einem Stein die Richtung, in der ein Wort entsteht
    var horiz = nr === 1 && (nc > 1 || at(r0, c0 - 1) || at(r0, c0 + 1));
    var dr = horiz ? 0 : 1, dc = horiz ? 1 : 0;
    var main = wordAt(r0, c0, dr, dc);
    for (i = 0; i < tiles.length; i++) if (main.indexOf(tiles[i].i) < 0) return { error: 'Die Steine müssen lückenlos zusammenhängen.' };
    var words = [];
    if (main.length >= 2) words.push(score(main));
    tiles.forEach(function (t) {
      var cr = wordAt(Math.floor(t.i / N), t.i % N, dc, dr);
      if (cr.length >= 2) words.push(score(cr));
    });
    if (!words.length) return { error: 'Ein Wort braucht mindestens zwei Buchstaben.' };
    if (empty) {
      if (!neu[center(N)]) return { error: 'Das erste Wort muss über den Stern in der Mitte gehen.' };
    } else {
      var touches = words.some(function (w) { return w.cells.some(function (k) { return !!board[k]; }); });
      if (!touches) return { error: 'Das Wort muss an liegende Steine anschließen.' };
    }
    var total = 0;
    words.forEach(function (w) { total += w.pts; });
    var bingo = tiles.length === RACK;
    if (bingo) total += BINGO;
    return { words: words, score: total, bingo: bingo, cells: tiles.map(function (t) { return t.i; }) };
  }

  return { LETTERS: LETTERS, VALUES: VALUES, RACK: RACK, BINGO: BINGO, SIZES: [11, 15], premiums: premiums, bagFor: bagFor, center: center, evaluate: evaluate, rackValue: rackValue, cellLetter: cellLetter };
});
