(function () {
'use strict';
var MG = window.MG, W = MG.W, H = MG.H, LEVELS = MG.LEVELS, BR = MG.BR;
var $ = function (id) { return document.getElementById(id); };
var cv = $('c'), ctx = cv.getContext('2d');
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var COURSE = MG.COURSE;
var STATIC = null, scale = 1, builtLevel = -1, builtW = 0, R2 = null;

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rrp(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function rr(c, x, y, w, h, r) { c.beginPath(); rrp(c, x, y, w, h, r); }
function blob(c, e, wob, sc) {
  sc = sc || 1; c.beginPath(); var n = 72;
  for (var i = 0; i <= n; i++) {
    var a = i / n * Math.PI * 2, k = 1 + wob * (Math.sin(a * 3 + e.seed) * 0.6 + Math.sin(a * 5 + e.seed * 2.1) * 0.4);
    var x = e.x + Math.cos(a) * e.rx * k * sc, y = e.y + Math.sin(a) * e.ry * k * sc;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
function blades(c, R, x, y, w, h, n, cols, lw, alpha) {
  var per = Math.floor(n / cols.length);
  for (var k = 0; k < cols.length; k++) {
    c.strokeStyle = cols[k]; c.globalAlpha = alpha; c.lineWidth = lw; c.beginPath();
    for (var i = 0; i < per; i++) {
      var px = x + R() * w, py = y + R() * h, len = 1.4 + R() * 2.8, ang = -Math.PI / 2 + (R() - 0.5) * 1.2;
      c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}
function wall(c, x, y, w, h) {
  c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 12; c.shadowOffsetX = 3; c.shadowOffsetY = 6; rr(c, x, y + 4, w, h, 3); c.fillStyle = '#5d3a1b'; c.fill(); c.restore();
  rr(c, x, y + 4, w, h, 3); c.fillStyle = '#6e4523'; c.fill();
  var g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#e6b97e'); g.addColorStop(0.5, '#c28a50'); g.addColorStop(1, '#9f6e3b');
  rr(c, x, y, w, h, 3); c.fillStyle = g; c.fill();
  c.save(); rr(c, x, y, w, h, 3); c.clip();
  for (var i = 0; i < 16; i++) { var gx = x + 1 + R2() * (w - 2); c.strokeStyle = R2() > 0.5 ? 'rgba(90,55,20,.2)' : 'rgba(255,230,190,.18)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + (R2() - 0.5) * 2, y + h); c.stroke(); }
  c.restore();
  rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 3); c.strokeStyle = 'rgba(255,238,205,.8)'; c.lineWidth = 1.2; c.stroke();
}
function drawBall(c, x, y, r, c0, c1, c2, alpha) {
  c.save(); if (alpha != null) c.globalAlpha = alpha;
  c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 6; c.shadowOffsetX = 3; c.shadowOffsetY = 4; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = c1; c.fill(); c.restore();
  var g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(0,0,0,.13)';
  var d = [[0.3, 0.2], [-0.1, 0.45], [0.5, -0.2], [0.05, -0.05], [-0.45, 0.2], [0.25, 0.55], [-0.3, -0.45]];
  for (var i = 0; i < d.length; i++) { c.beginPath(); c.arc(x + d[i][0] * r, y + d[i][1] * r, r * 0.09, 0, Math.PI * 2); c.fill(); }
  c.save(); c.translate(x - r * 0.38, y - r * 0.42); c.rotate(-0.6); c.beginPath(); c.ellipse(0, 0, r * 0.3, r * 0.17, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill(); c.restore();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 0.8; c.stroke();
  c.restore();
}
var COL = [['#d3e7ff', '#3a86ea', '#1a4fa0'], ['#ffd5cf', '#e5483b', '#9c2218']];

function buildStatic(idx) {
  var L = LEVELS[idx], i, k;
  var off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
  var c = off.getContext('2d'); c.scale(scale, scale);
  var R = mulberry(7 + idx); R2 = mulberry(99 + idx);
  var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2f7443'); g.addColorStop(1, '#1b5130'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  blades(c, R, 0, 0, W, H, 30000, ['#3c8c50', '#256a3c', '#2e7c46', '#1a5a31'], 0.55, 0.5);
  c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 20; c.shadowOffsetY = 6; rr(c, COURSE.x, COURSE.y, COURSE.w, COURSE.h, COURSE.r); c.fillStyle = '#4fa44c'; c.fill(); c.restore();
  c.save(); rr(c, COURSE.x, COURSE.y, COURSE.w, COURSE.h, COURSE.r); c.clip();
  for (var x = COURSE.x, s = 0; x < COURSE.x + COURSE.w; x += 28, s++) { c.fillStyle = s % 2 ? '#55ac51' : '#63ba5c'; c.fillRect(x, COURSE.y, 28, COURSE.h); }
  for (i = 0; i < 280; i++) { var mx = COURSE.x + R() * COURSE.w, my = COURSE.y + R() * COURSE.h, mr = 20 + R() * 50; var gg = c.createRadialGradient(mx, my, 0, mx, my, mr); var light = R() > 0.5; gg.addColorStop(0, light ? 'rgba(200,245,160,.11)' : 'rgba(8,60,20,.11)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(mx - mr, my - mr, mr * 2, mr * 2); }
  blades(c, R, COURSE.x, COURSE.y, COURSE.w, COURSE.h, 110000, ['#9ddc85', '#3f9a43', '#7acb69', '#2f8a3a', '#b2e594'], 0.5, 0.42);
  var lg = c.createLinearGradient(COURSE.x, COURSE.y, COURSE.x + COURSE.w, COURSE.y + COURSE.h); lg.addColorStop(0, 'rgba(255,255,210,.12)'); lg.addColorStop(1, 'rgba(0,0,0,.14)'); c.fillStyle = lg; c.fillRect(COURSE.x, COURSE.y, COURSE.w, COURSE.h);
  var vg = c.createRadialGradient(COURSE.x + COURSE.w / 2, COURSE.y + COURSE.h / 2, 120, COURSE.x + COURSE.w / 2, COURSE.y + COURSE.h / 2, 470); vg.addColorStop(0, 'rgba(8,40,18,0)'); vg.addColorStop(1, 'rgba(8,40,18,.38)'); c.fillStyle = vg; c.fillRect(COURSE.x, COURSE.y, COURSE.w, COURSE.h);
  c.save(); c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 18; c.strokeStyle = '#000'; c.lineWidth = 8; rr(c, COURSE.x - 4, COURSE.y - 4, COURSE.w + 8, COURSE.h + 8, COURSE.r + 4); c.stroke(); c.restore();
  var T = L.teeMat;
  c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 8; c.shadowOffsetY = 3; rr(c, T.x, T.y, T.w, T.h, 10); c.fillStyle = '#2f7d3f'; c.fill(); c.restore();
  var tg = c.createLinearGradient(T.x, T.y, T.x, T.y + T.h); tg.addColorStop(0, '#3f9150'); tg.addColorStop(1, '#2a7239'); rr(c, T.x, T.y, T.w, T.h, 10); c.fillStyle = tg; c.fill();
  c.save(); rr(c, T.x, T.y, T.w, T.h, 10); c.clip(); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.6; for (var ty = T.y; ty < T.y + T.h; ty += 3) { c.beginPath(); c.moveTo(T.x, ty); c.lineTo(T.x + T.w, ty); c.stroke(); } c.restore();
  rr(c, T.x + 6, T.y + 6, T.w - 12, T.h - 12, 6); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
  rr(c, T.x, T.y, T.w, T.h, 10); c.strokeStyle = 'rgba(20,60,30,.8)'; c.lineWidth = 1.5; c.stroke();
  for (k = 0; k < L.sand.length; k++) {
    var SA = L.sand[k];
    blob(c, SA, 0.1, 1.12); c.fillStyle = 'rgba(20,70,30,.3)'; c.fill();
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 8; c.shadowOffsetY = 2; blob(c, SA, 0.1); c.fillStyle = '#d9c283'; c.fill(); c.restore();
    var sg = c.createRadialGradient(SA.x - 14, SA.y - 12, 6, SA.x, SA.y, SA.rx); sg.addColorStop(0, '#f8ebc0'); sg.addColorStop(0.7, '#e6d095'); sg.addColorStop(1, '#cdb272');
    blob(c, SA, 0.1); c.fillStyle = sg; c.fill();
    c.save(); blob(c, SA, 0.1); c.clip();
    for (i = 0; i < 5200; i++) { var sx = SA.x + (R() * 2 - 1) * SA.rx * 1.1, sy = SA.y + (R() * 2 - 1) * SA.ry * 1.1; c.fillStyle = R() > 0.5 ? 'rgba(255,248,220,.7)' : 'rgba(150,120,60,.45)'; c.fillRect(sx, sy, 0.8, 0.8); }
    c.save(); c.shadowColor = 'rgba(120,90,30,.7)'; c.shadowBlur = 10; c.strokeStyle = 'rgba(120,90,30,.8)'; c.lineWidth = 6; blob(c, SA, 0.1, 1.02); c.stroke(); c.restore();
    c.restore();
    blob(c, SA, 0.1); c.strokeStyle = 'rgba(185,157,85,.9)'; c.lineWidth = 1.5; c.stroke();
  }
  for (k = 0; k < L.water.length; k++) {
    var WA = L.water[k];
    blob(c, WA, 0.08, 1.16); c.fillStyle = 'rgba(15,55,30,.35)'; c.fill();
    blob(c, WA, 0.08, 1.07); c.fillStyle = '#b9a77a'; c.fill();
  }
  c.restore();
  for (k = 0; k < L.gates.length; k++) {
    var GR = L.gates[k];
    c.save(); c.shadowColor = 'rgba(255,255,255,.25)'; c.shadowBlur = 1; c.shadowOffsetY = 1;
    if (GR.axis === 'y') rr(c, GR.x + GR.w / 2 - 3, GR.y - GR.amp, 6, GR.h + 2 * GR.amp, 3); else rr(c, GR.x - GR.amp, GR.y + GR.h / 2 - 3, GR.w + 2 * GR.amp, 6, 3);
    c.fillStyle = 'rgba(10,25,15,.75)'; c.fill(); c.restore();
  }
  for (k = 0; k < L.walls.length; k++) wall(c, L.walls[k].x, L.walls[k].y - (L.walls[k].y <= 70 ? 4 : 0), L.walls[k].w, L.walls[k].h + (L.walls[k].y <= 70 ? 4 : 0));
  var M = L.mill;
  if (M) {
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 10; c.shadowOffsetX = 6; c.shadowOffsetY = 8;
    c.beginPath(); c.moveTo(M.x - 18, M.y + 56); c.lineTo(M.x + 18, M.y + 56); c.lineTo(M.x + 9, M.y + 6); c.lineTo(M.x - 9, M.y + 6); c.closePath();
    var wg = c.createLinearGradient(M.x - 18, 0, M.x + 18, 0); wg.addColorStop(0, '#f7edd9'); wg.addColorStop(1, '#cfba95'); c.fillStyle = wg; c.fill(); c.restore();
    c.strokeStyle = 'rgba(120,95,60,.35)'; c.lineWidth = 0.8;
    for (var by = 14; by < 54; by += 8) { var t = (by - 6) / 50; c.beginPath(); c.moveTo(M.x - 9 - 9 * t, M.y + by); c.lineTo(M.x + 9 + 9 * t, M.y + by); c.stroke(); }
    rr(c, M.x - 5, M.y + 36, 10, 20, 5); c.fillStyle = '#7a4a24'; c.fill();
    c.beginPath(); c.moveTo(M.x - 15, M.y + 8); c.lineTo(M.x + 15, M.y + 8); c.lineTo(M.x, M.y - 22); c.closePath();
    var rg = c.createLinearGradient(M.x - 15, 0, M.x + 15, 0); rg.addColorStop(0, '#d4553b'); rg.addColorStop(1, '#8f2e1c'); c.fillStyle = rg; c.fill();
  }
  var HO = L.hole;
  c.beginPath(); c.ellipse(HO.x + 1, HO.y + 2, 13, 11, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(10,50,20,.5)'; c.fill();
  var hg = c.createRadialGradient(HO.x, HO.y, 2, HO.x, HO.y, 11); hg.addColorStop(0, '#000'); hg.addColorStop(1, '#222');
  c.beginPath(); c.arc(HO.x, HO.y, 11, 0, Math.PI * 2); c.fillStyle = '#e8efe5'; c.fill();
  c.beginPath(); c.arc(HO.x, HO.y, 9.5, 0, Math.PI * 2); c.fillStyle = hg; c.fill();
  c.beginPath(); c.arc(HO.x, HO.y, 9.5, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2; c.stroke();
  c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 16; c.shadowOffsetY = 5;
  c.beginPath(); rrp(c, 20, 50, 804, 300, 47); rrp(c, 34, 64, 776, 272, 34);
  var fg = c.createLinearGradient(0, 50, 0, 350); fg.addColorStop(0, '#e0b176'); fg.addColorStop(0.5, '#b07a44'); fg.addColorStop(1, '#84552b'); c.fillStyle = fg; c.fill('evenodd'); c.restore();
  c.save(); c.beginPath(); rrp(c, 20, 50, 804, 300, 47); rrp(c, 34, 64, 776, 272, 34); c.clip('evenodd');
  for (i = 0; i < 260; i++) { var ins = R() * 14; c.strokeStyle = R() > 0.5 ? 'rgba(80,48,18,.22)' : 'rgba(255,230,190,.16)'; c.lineWidth = 0.4 + R() * 0.5; rr(c, 20 + ins, 50 + ins, 804 - 2 * ins, 300 - 2 * ins, Math.max(2, 47 - ins)); c.stroke(); }
  c.restore();
  rr(c, 34, 64, 776, 272, 34); c.strokeStyle = 'rgba(255,238,205,.85)'; c.lineWidth = 1.6; c.stroke();
  rr(c, 20, 50, 804, 300, 47); c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.stroke();
  var bolts = [[120, 57], [422, 57], [724, 57], [120, 343], [422, 343], [724, 343], [27, 200], [817, 200]];
  for (i = 0; i < bolts.length; i++) { var bx = bolts[i][0], by2 = bolts[i][1]; var bg = c.createRadialGradient(bx - 0.8, by2 - 0.8, 0.3, bx, by2, 3); bg.addColorStop(0, '#f2f2ee'); bg.addColorStop(1, '#6f6f6a'); c.beginPath(); c.arc(bx, by2, 2.8, 0, Math.PI * 2); c.fillStyle = bg; c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.6; c.stroke(); }
  STATIC = off; builtLevel = idx; builtW = cv.width;
}
function drawWater(c, e, t) {
  c.save(); blob(c, e, 0.08); c.clip();
  var g = c.createRadialGradient(e.x - 18, e.y - 14, 4, e.x, e.y, e.rx * 1.1); g.addColorStop(0, '#9bd9f7'); g.addColorStop(0.55, '#4aa0dc'); g.addColorStop(1, '#256fb8'); c.fillStyle = g; c.fillRect(e.x - e.rx - 8, e.y - e.ry - 8, e.rx * 2 + 16, e.ry * 2 + 16);
  c.lineWidth = 1.4;
  for (var i = 0; i < 5; i++) { var p = (t * 0.18 + i / 5) % 1; c.strokeStyle = 'rgba(255,255,255,' + ((1 - p) * 0.4).toFixed(3) + ')'; c.beginPath(); c.ellipse(e.x - 10 + i * 5, e.y + 2, p * e.rx * 1.1, p * e.ry * 1.1, 0, 0, Math.PI * 2); c.stroke(); }
  c.lineWidth = 1.8; c.lineCap = 'round';
  for (i = 0; i < 7; i++) { var yy = e.y - e.ry * 0.7 + i * e.ry * 0.24, ph = t * 1.2 + i * 1.3; c.strokeStyle = 'rgba(255,255,255,' + (0.22 + 0.1 * Math.sin(ph)).toFixed(3) + ')'; c.beginPath(); for (var k = 0; k <= 24; k++) { var xx = e.x - e.rx + k * (e.rx * 2 / 24), y2 = yy + Math.sin(k * 0.7 + ph) * 1.6; if (k) c.lineTo(xx, y2); else c.moveTo(xx, y2); } c.stroke(); }
  for (i = 0; i < 14; i++) { var sx = e.x + Math.cos(i * 2.4) * e.rx * 0.7 * ((i % 3) / 3 + 0.3), sy = e.y + Math.sin(i * 1.7) * e.ry * 0.6, a = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.9); c.fillStyle = 'rgba(255,255,255,' + (a * 0.8).toFixed(3) + ')'; c.beginPath(); c.arc(sx, sy, 0.9 + a * 0.8, 0, Math.PI * 2); c.fill(); }
  c.save(); c.shadowColor = 'rgba(0,40,90,.6)'; c.shadowBlur = 12; c.strokeStyle = 'rgba(0,40,90,.6)'; c.lineWidth = 6; blob(c, e, 0.08, 1.03); c.stroke(); c.restore();
  c.restore();
  blob(c, e, 0.08); c.strokeStyle = 'rgba(240,250,255,.95)'; c.lineWidth = 2.2; c.stroke();
}
function drawBlade(c) {
  c.fillStyle = '#f6efe0'; c.strokeStyle = '#a48a62'; c.lineWidth = 1;
  rr(c, -4.5, -54, 9, 48, 1.5); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(164,138,98,.8)'; c.lineWidth = 0.7;
  for (var y = -50; y < -8; y += 8) { c.beginPath(); c.moveTo(-4.5, y); c.lineTo(4.5, y); c.stroke(); }
  c.beginPath(); c.moveTo(0, -54); c.lineTo(0, -6); c.stroke();
}
function drawMill(c, M, ang) {
  c.save(); c.translate(M.x, M.y); c.rotate(ang);
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 6; c.shadowOffsetX = 6; c.shadowOffsetY = 8;
  var sc = M.len / 54;
  c.scale(sc, sc);
  for (var i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); drawBlade(c); c.restore(); }
  c.restore();
  var hg = c.createRadialGradient(M.x - 1.5, M.y - 1.5, 0.5, M.x, M.y, 7); hg.addColorStop(0, '#e87a5f'); hg.addColorStop(1, '#7a2615');
  c.beginPath(); c.arc(M.x, M.y, 6.5, 0, Math.PI * 2); c.fillStyle = hg; c.fill(); c.strokeStyle = '#4a1609'; c.lineWidth = 1; c.stroke();
}
function drawFlag(c, H0, t) {
  var w = reduce ? 0 : Math.sin(t * 3.2) * 2.2;
  c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 4; c.shadowOffsetX = 4; c.shadowOffsetY = 5;
  c.strokeStyle = '#f5f5f2'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(H0.x, H0.y); c.lineTo(H0.x, H0.y - 44); c.stroke();
  c.beginPath(); c.moveTo(H0.x, H0.y - 44); c.bezierCurveTo(H0.x + 10, H0.y - 44 + w, H0.x + 18, H0.y - 48 - w, H0.x + 28, H0.y - 44 + w * 0.6); c.lineTo(H0.x + 28, H0.y - 28 + w * 0.6); c.bezierCurveTo(H0.x + 18, H0.y - 32 - w, H0.x + 10, H0.y - 28 + w, H0.x, H0.y - 28); c.closePath();
  var fg = c.createLinearGradient(H0.x, 0, H0.x + 28, 0); fg.addColorStop(0, '#f7d65e'); fg.addColorStop(1, '#e2b52a'); c.fillStyle = fg; c.fill(); c.restore();
  c.beginPath(); c.arc(H0.x, H0.y - 45, 2.3, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
}

function drawGate(c, g, th) {
  var off = g.amp * Math.sin(th), x = g.x + (g.axis === 'x' ? off : 0), y = g.y + (g.axis === 'y' ? off : 0), w = g.w, h = g.h;
  c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 10; c.shadowOffsetX = 3; c.shadowOffsetY = 6; rr(c, x - 2, y + 4, w + 4, h, 3); c.fillStyle = '#39485a'; c.fill(); c.restore();
  var g2 = c.createLinearGradient(x, 0, x + w, 0); g2.addColorStop(0, '#c9d6e3'); g2.addColorStop(0.5, '#8da4bb'); g2.addColorStop(1, '#667f99');
  rr(c, x - 2, y, w + 4, h, 3); c.fillStyle = g2; c.fill();
  c.save(); rr(c, x - 2, y, w + 4, h, 3); c.clip(); c.strokeStyle = '#f2c94c'; c.lineWidth = 4.5;
  for (var i = -w - 10; i < h + w; i += 12) { c.beginPath(); c.moveTo(x - 4, y + i + w + 10); c.lineTo(x + w + 4, y + i); c.stroke(); }
  c.restore();
  rr(c, x - 1.25, y + 0.75, w + 2.5, h - 1.5, 3); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.1; c.stroke();
  rr(c, x - 2, y, w + 4, h, 3); c.strokeStyle = '#2c3a4a'; c.lineWidth = 1.4; c.stroke();
}
var PADCOL = [['180,140,255', '#b48cff'], ['61,224,192', '#3de0c0']];
function drawPad(c, p, t, pair) {
  var col = PADCOL[pair % 2], pulse = reduce ? 0 : Math.sin(t * 3 + pair) * 1.5;
  c.save(); c.translate(p.x, p.y);
  var gl = c.createRadialGradient(0, 0, 4, 0, 0, 26 + pulse); gl.addColorStop(0, 'rgba(' + col[0] + ',.55)'); gl.addColorStop(1, 'rgba(' + col[0] + ',0)');
  c.fillStyle = gl; c.beginPath(); c.arc(0, 0, 26 + pulse, 0, Math.PI * 2); c.fill();
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fillStyle = '#1a1230'; c.fill(); c.restore();
  var ig = c.createRadialGradient(0, 0, 1, 0, 0, 10); ig.addColorStop(0, '#02010a'); ig.addColorStop(1, 'rgba(' + col[0] + ',.55)');
  c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fillStyle = ig; c.fill();
  c.lineWidth = 1.6; c.lineCap = 'round';
  for (var i = 0; i < 4; i++) { var a0 = (reduce ? 0 : t * (2.2 + i * 0.35)) + i * 1.6; c.strokeStyle = 'rgba(255,255,255,' + (0.9 - i * 0.15) + ')'; c.beginPath(); c.arc(0, 0, 2.5 + i * 2.1, a0, a0 + 1.7); c.stroke(); }
  c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.strokeStyle = col[1]; c.lineWidth = 2.6; c.stroke();
  c.restore();
}

/* ---------- App-Zustand ---------- */
var A = { id: null, token: null, seat: -1, game: null, seq: 0, anim: null, aim: null, busy: false, pollT: 0, millOff: 0, gOff: [0, 0, 0, 0], viewLevel: 0 };

function fit() {
  var r = cv.getBoundingClientRect(); if (r.width < 10) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * dpr * H / W); scale = cv.width / W;
  builtLevel = -1;
}
function ensureLevel() { if (builtLevel !== A.viewLevel || builtW !== cv.width) buildStatic(A.viewLevel); }

function ballPositions() {
  if (A.anim) {
    var f = A.anim.frames[A.anim.idx];
    return [{ x: f[0], y: f[1] }, { x: f[2], y: f[3] }];
  }
  return A.game.balls;
}
function drawAim(c, t, B) {
  var my = A.game.balls[A.seat]; if (!my) return;
  var col = COL[A.seat], pul = reduce ? 0 : Math.sin(t * 4) * 1.3;
  if (A.aim) {
    var a = A.aim.angle * Math.PI / 180, ux = Math.cos(a), uy = -Math.sin(a), len = 50 + A.aim.power * 2.2;
    var off = reduce ? 0 : (t * 20) % 12;
    c.save(); c.shadowColor = 'rgba(255,255,255,.7)'; c.shadowBlur = 5;
    for (var d = 20 + off; d < len; d += 12) { var f = d / len; c.beginPath(); c.arc(my.x + ux * d, my.y + uy * d, 2.9 - f * 0.9, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,' + (0.98 - f * 0.3).toFixed(3) + ')'; c.fill(); }
    c.restore();
    var pl = 10 + A.aim.power * 0.4, hx = my.x - ux * pl, hy = my.y - uy * pl;
    c.save(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3.2; c.lineCap = 'round'; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 4; c.beginPath(); c.moveTo(my.x, my.y); c.lineTo(hx, hy); c.stroke();
    c.beginPath(); c.arc(hx, hy, 9 + pul * 0.4, 0, Math.PI * 2); var hg = c.createRadialGradient(hx - 3, hy - 3, 1, hx, hy, 10); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#cfe3ff'); c.fillStyle = hg; c.fill(); c.strokeStyle = col[1]; c.lineWidth = 3; c.stroke(); c.restore();
  }
  c.save(); c.setLineDash([3, 5]); c.lineDashOffset = reduce ? 0 : -t * 8; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(my.x, my.y, 18 + pul * 0.4, 0, Math.PI * 2); c.stroke(); c.restore();
}
function render(ms) {
  requestAnimationFrame(render);
  if (!A.game || $('game').hidden) return;
  ensureLevel(); if (!STATIC) return;
  var t = ms / 1000, L = LEVELS[A.viewLevel];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(STATIC, 0, 0); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (A.anim) {
    var an = A.anim, fi = Math.min(an.frames.length - 1, Math.floor((performance.now() - an.start) / 16.667));
    while (an.idx < fi) { an.idx++; while (an.ev < an.events.length && an.events[an.ev].f <= an.idx) { onEvent(an.events[an.ev]); an.ev++; } }
    if (fi >= an.frames.length - 1 && performance.now() - an.start > (an.frames.length - 1) * 16.667 + 350) { finishAnim(); }
  }
  var k;
  for (k = 0; k < L.water.length; k++) drawWater(ctx, L.water[k], t);
  for (k = 0; k < L.tele.length; k++) { drawPad(ctx, L.tele[k].a, t, k); drawPad(ctx, L.tele[k].b, t, k); }
  var fr = A.anim ? A.anim.frames[A.anim.idx] : null;
  for (k = 0; k < L.gates.length; k++) drawGate(ctx, L.gates[k], fr ? fr[5 + k] : (A.gOff[k] || 0) + t * L.gates[k].omega);
  var ang = fr ? fr[4] : A.millOff + t * (L.mill ? L.mill.omega : 0);
  if (L.mill) drawMill(ctx, L.mill, ang);
  drawFlag(ctx, L.hole, t);
  var P = ballPositions(), order = [0, 1];
  if (A.game.turn === 0) order = [1, 0];
  for (var oi = 0; oi < 2; oi++) {
    var i = order[oi], hidden = A.anim ? A.anim.prevDone[i] : A.game.balls[i].done;
    if (A.game.status === 'waiting' && i === 1) hidden = true;
    if (hidden) continue;
    var dx = P[i].x - L.hole.x, dy = P[i].y - L.hole.y, near = Math.sqrt(dx * dx + dy * dy) < 5;
    drawBall(ctx, P[i].x, P[i].y, near ? BR * 0.6 : BR, COL[i][0], COL[i][1], COL[i][2], near ? 0.7 : null);
  }
  if (canAim()) drawAim(ctx, t, P);
}

var SND = { ctx: null, mute: false };
try { SND.mute = localStorage.getItem('mg_mute') === '1'; } catch (e) {}
function audio() {
  if (!SND.ctx) { try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (SND.ctx.state === 'suspended') SND.ctx.resume();
  return SND.ctx;
}
function tone(f0, f1, dur, type, vol, delay) {
  var c = SND.mute ? null : audio(); if (!c) return;
  var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, delay) {
  var c = SND.mute ? null : audio(); if (!c) return;
  var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + (delay || 0);
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
}
function sound(name) {
  if (SND.mute) return;
  if (name === 'hit') { tone(900, 300, 0.07, 'triangle', 0.35); noise(0.05, 0.25, 2500); }
  else if (name === 'bump') { tone(520, 260, 0.09, 'square', 0.18); }
  else if (name === 'splash') { noise(0.5, 0.5, 700); tone(300, 90, 0.35, 'sine', 0.25); }
  else if (name === 'sink') { tone(180, 90, 0.18, 'sine', 0.4); tone(523, 523, 0.14, 'triangle', 0.25, 0.18); tone(659, 659, 0.14, 'triangle', 0.25, 0.3); tone(784, 784, 0.3, 'triangle', 0.25, 0.42); }
  else if (name === 'tele') { tone(300, 1200, 0.25, 'sine', 0.25); tone(1200, 400, 0.25, 'sine', 0.2, 0.2); }
  else if (name === 'turn') { tone(660, 660, 0.12, 'sine', 0.3); tone(880, 880, 0.2, 'sine', 0.3, 0.13); }
  else if (name === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, 0.25, 'triangle', 0.28, i * 0.14); }); }
}
function onEvent(ev) {
  if (ev.t === 'bump') { toast('Rempel!'); sound('bump'); }
  else if (ev.t === 'splash') { toast('Platsch! +1 Strafschlag'); sound('splash'); }
  else if (ev.t === 'sink') { toast('Eingelocht!'); sound('sink'); }
  else if (ev.t === 'tele') { toast('Teleport!'); sound('tele'); }
}
var toastTimer = 0;
function toast(msg) {
  var el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1600);
}

/* ---------- Netzwerk ---------- */
function api(method, url, body) {
  return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Fehler'); e.status = r.status; e.data = j; throw e; } return j; }); });
}
function store() { try { return JSON.parse(localStorage.getItem('mg_games') || '{}'); } catch (e) { return {}; } }
function saveStore(o) { try { localStorage.setItem('mg_games', JSON.stringify(o)); } catch (e) {} }
function rememberGame(id, token, seat, name) { var s = store(); s[id] = { token: token, seat: seat, name: name, at: Date.now() }; saveStore(s); }
function myName() { try { return localStorage.getItem('mg_name') || ''; } catch (e) { return ''; } }
function setMyName(n) { try { localStorage.setItem('mg_name', n); } catch (e) {} }

function stopPoll() { clearTimeout(A.pollT); }
function schedulePoll() {
  stopPoll();
  var myTurn = A.game && A.game.status === 'playing' && A.game.turn === A.seat;
  var ms = myTurn ? 6000 : 2000;
  A.pollT = setTimeout(poll, ms);
}
function poll() {
  if (!A.id) return;
  if (A.busy) { schedulePoll(); return; }
  api('GET', '/api/games/' + A.id + '?seq=' + A.seq + (A.token ? '&token=' + A.token : ''))
    .then(function (res) {
      if (A.busy) return;
      if (res.game.updatedAt !== A.game.updatedAt) handleUpdate(res);
    }).catch(function () {}).then(schedulePoll);
}
function handleUpdate(res) {
  if (res.shot && res.shot.seq === A.seq + 1 && A.game) playShot(res.shot, res);
  else commit(res);
}
function playShot(shot, res) {
  A.busy = true; A.aim = null; sound('hit');
  A.viewLevel = shot.hole;
  A.anim = { frames: shot.frames, events: shot.events, idx: 0, ev: 0, start: performance.now(), res: res, shot: shot, prevDone: [A.game.balls[0].done, A.game.balls[1].done] };
  if (reduce) { A.anim.start -= 100000; }
  updateHud();
}
function finishAnim() {
  var an = A.anim; if (!an) return;
  var last = an.frames[an.frames.length - 1], L = LEVELS[an.shot.hole];
  A.millOff = last[4] - (performance.now() / 1000) * (L.mill ? L.mill.omega : 0);
  for (var gi = 0; gi < L.gates.length; gi++) A.gOff[gi] = last[5 + gi] - (performance.now() / 1000) * L.gates[gi].omega;
  A.anim = null; A.busy = false;
  var pen = an.shot.penalties;
  commit(an.res);
  if (an.res.game.status === 'finished') sound('win'); else if (A.seat >= 0 && an.res.game.turn === A.seat) sound('turn');
  if (an.res.game.hole !== an.shot.hole || (an.res.game.status === 'finished' && an.shot.hole === LEVELS.length - 1)) {
    if (an.res.game.status !== 'finished') toast('Bahn geschafft!');
  }
}
function commit(res) {
  var prevHole = A.game ? A.game.hole : -1;
  A.game = res.game; A.seat = res.you; A.seq = res.game.seq; A.viewLevel = res.game.hole;
  if (prevHole !== -1 && prevHole !== res.game.hole) A.aim = null;
  var g = A.game;
  if (A.token == null && A.seat >= 0) { /* nichts */ }
  updateHud();
}

/* ---------- Oberfläche ---------- */
function canAim() { return A.game && A.game.status === 'playing' && A.seat >= 0 && A.game.turn === A.seat && !A.busy && !A.anim; }
function totalFor(i) {
  var g = A.game, s = 0, h;
  for (h = 0; h < g.scores[i].length; h++) s += g.scores[i][h] || 0;
  if (g.status !== 'finished') s += g.balls[i].strokes;
  return s;
}
function nameOf(i) { var p = A.game.players[i]; return p ? p.name : 'wartet ...'; }
var TGC = null;
api('GET', '/api/config').then(function (c) { TGC = c; if (A.game) updateHud(); }).catch(function () {});
function updateHud() {
  var g = A.game; if (!g) return;
  $('tgb').hidden = !(TGC && TGC.telegram && TGC.bot && A.seat >= 0 && g.status !== 'finished' && g.tg && !g.tg[A.seat]);
  var L = LEVELS[A.viewLevel];
  $('n1').textContent = nameOf(0) + (A.seat === 0 ? ' (du)' : '');
  $('n2').textContent = nameOf(1) + (A.seat === 1 ? ' (du)' : '');
  $('s1').textContent = g.balls[0].done ? 'im Loch · ges. ' + totalFor(0) : g.balls[0].strokes + ' Schl. · ges. ' + totalFor(0);
  $('s2').textContent = g.players[1] ? (g.balls[1].done ? 'im Loch · ges. ' + totalFor(1) : g.balls[1].strokes + ' Schl. · ges. ' + totalFor(1)) : '';
  var playing = g.status === 'playing' && !A.anim;
  $('p1').classList.toggle('me', playing && g.turn === 0);
  $('p2').classList.toggle('me', playing && g.turn === 1);
  $('midT').textContent = 'Bahn ' + (A.viewLevel + 1) + '/' + g.levels + ' · Par ' + L.par;
  var sub = '';
  if (g.status === 'waiting') sub = 'Warte auf Mitspieler';
  else if (g.status === 'finished') sub = 'Spiel beendet';
  else if (A.anim) sub = 'Ball rollt ...';
  else if (A.seat === g.turn) sub = 'Du bist dran';
  else sub = nameOf(g.turn) + ' ist dran';
  $('midS').textContent = sub;
  var banner = $('banner');
  var intro = g.hole === 0 && g.seq < 2;
  if (intro && g.status === 'playing' && !A.anim && A.seat >= 0 && g.turn !== A.seat) { banner.hidden = false; banner.textContent = 'Warten auf ' + nameOf(g.turn) + '. Du kannst die App schließen, das Spiel ist gespeichert.'; }
  else if (intro && g.status === 'playing' && !A.anim && A.seat === g.turn && !A.aim) { banner.hidden = false; banner.textContent = 'Tippe aufs Feld und ziehe nach hinten, dann Schlag drücken.'; }
  else if (A.seat < 0 && g.status === 'playing') { banner.hidden = false; banner.textContent = 'Du schaust zu.'; }
  else banner.hidden = true;
  var pw = A.aim ? Math.round(A.aim.power) : 0;
  $('pw').style.width = pw + '%'; $('pwT').textContent = pw + ' %';
  $('angT').textContent = 'Winkel ' + (A.aim ? Math.round(((A.aim.angle % 360) + 360) % 360) + '°' : '-');
  $('go').classList.toggle('off', !(canAim() && A.aim));
  $('invite').hidden = !(g.status === 'waiting' && A.seat === 0);
  if (!$('invite').hidden) $('link').value = location.origin + location.pathname + '#/game/' + g.id;
  var fin = g.status === 'finished' && !A.anim;
  $('end').hidden = !fin;
  if (fin) buildEnd();
  var other = g.rematch && A.seat >= 0;
  $('rematch').hidden = A.seat < 0;
  $('rematch').textContent = other ? 'Revanche annehmen' : 'Revanche';
  if (other && !A.rmToast) { A.rmToast = true; toast('Revanche wartet!'); }
  $('mTg').hidden = !(TGC && TGC.telegram && TGC.bot && A.seat >= 0 && g.tg && !g.tg[A.seat]);
  $('mLink').hidden = A.seat < 0;
  $('mSnd').textContent = SND.mute ? 'Ton: aus' : 'Ton: an';
  $('sndBtn').textContent = SND.mute ? '🔇' : '🔊';
}
function buildEnd() {
  var g = A.game, t0 = totalFor(0), t1 = totalFor(1), h;
  var title = t0 === t1 ? 'Unentschieden' : (nameOf(t0 < t1 ? 0 : 1) + ' gewinnt');
  if (A.seat >= 0 && t0 !== t1) title = ((t0 < t1 ? 0 : 1) === A.seat) ? 'Du gewinnst!' : nameOf(t0 < t1 ? 0 : 1) + ' gewinnt';
  $('endT').textContent = title;
  var html = '<tr><th></th>';
  for (h = 0; h < g.levels; h++) html += '<th>' + (h + 1) + '</th>';
  html += '<th>Σ</th></tr>';
  for (var pi = 0; pi < 2; pi++) {
    html += '<tr><td>' + esc(nameOf(pi)) + '</td>';
    for (h = 0; h < g.levels; h++) html += '<td>' + (g.scores[pi][h] != null ? g.scores[pi][h] : '-') + '</td>';
    html += '<td><b>' + (pi ? t1 : t0) + '</b></td></tr>';
  }
  var pars = 0; for (h = 0; h < g.levels; h++) pars += LEVELS[h].par;
  html += '<tr><td>Par</td>'; for (h = 0; h < g.levels; h++) html += '<td>' + LEVELS[h].par + '</td>'; html += '<td>' + pars + '</td></tr>';
  $('endTab').innerHTML = html;
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function sendShot() {
  if (A.busy) return;
  if (!A.game || A.game.status !== 'playing') return;
  if (A.seat < 0 || A.game.turn !== A.seat) { toast('Du bist nicht dran'); return; }
  if (!A.aim) { toast('Zieh erst nach hinten zum Zielen'); return; }
  var aim = A.aim; A.busy = true;
  var nowS = performance.now() / 1000, SL = LEVELS[A.game.hole], gs = [];
  for (var qi = 0; qi < SL.gates.length; qi++) gs.push((A.gOff[qi] || 0) + nowS * SL.gates[qi].omega);
  api('POST', '/api/games/' + A.id + '/shot', { token: A.token, angle: Math.round(aim.angle * 10) / 10, power: Math.round(aim.power), mill: A.millOff + nowS * (SL.mill ? SL.mill.omega : 0), gates: gs })
    .then(function (res) { A.busy = false; if (res.shot && res.shot.seq === A.seq + 1) playShot(res.shot, res); else commit(res); })
    .catch(function (e) { A.busy = false; toast(e.message || 'Fehler'); if (e.data && e.data.game) commit(e.data); });
}
var drag = null;
function toLogical(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointerdown', function (e) { if (!canAim()) return; var p = toLogical(e); drag = { sx: p.x, sy: p.y }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
cv.addEventListener('pointermove', function (e) {
  if (!drag) return; var p = toLogical(e), dx = drag.sx - p.x, dy = drag.sy - p.y, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;
  A.aim = { angle: Math.atan2(-dy, dx) * 180 / Math.PI, power: Math.min(100, len / 1.1) }; updateHud();
});
cv.addEventListener('pointerup', function () { drag = null; });
cv.addEventListener('pointercancel', function () { drag = null; });
$('go').addEventListener('click', sendShot);
$('tgb').addEventListener('click', function () { if (TGC && TGC.bot) window.open('https://t.me/' + TGC.bot + '?start=' + A.token, '_blank'); });

/* ---------- Seiten ---------- */
function show(which) { $('home').hidden = which !== 'home'; $('join').hidden = which !== 'join'; $('game').hidden = which !== 'game'; $('rot').hidden = which !== 'game'; }
function showHome() {
  stopPoll(); A.id = null; A.game = null; show('home');
  $('nameHome').value = myName();
  var s = store(), ids = Object.keys(s).sort(function (a, b) { return s[b].at - s[a].at; }).slice(0, 8), html = '';
  if (ids.length) html += '<p>Deine Spiele</p>';
  ids.forEach(function (id) { html += '<a href="#/game/' + id + '"><span>' + esc(s[id].name || 'Spiel') + '</span><span>öffnen</span></a>'; });
  $('mine').innerHTML = html;
}
function openGame(id) {
  A.id = id; var st = store()[id]; A.token = st ? st.token : null; A.game = null; A.anim = null; A.busy = false; A.aim = null;
  api('GET', '/api/games/' + id + (A.token ? '?token=' + A.token : '')).then(function (res) {
    if (res.you < 0 && res.game.status === 'waiting') {
      show('join'); $('nameJoin').value = myName(); $('joinInfo').textContent = res.game.players[0].name + ' hat dich zu einem Minigolf-Duell eingeladen.'; $('joinErr').textContent = '';
      return;
    }
    show('game'); fit(); commit(res); schedulePoll();
  }).catch(function (e) {
    show('home'); $('homeErr').textContent = e.status === 404 ? 'Dieses Spiel gibt es nicht (mehr).' : 'Keine Verbindung zum Server.';
    $('mine').innerHTML = '';
  });
}
function route() {
  stopPoll(); $('menu').hidden = true;
  var pv = /[?&]preview=(\d+)/.exec(location.search);
  if (pv) {
    var n = Math.max(1, Math.min(LEVELS.length, parseInt(pv[1], 10))) - 1, tb = [0, 1].map(function (i) { return { x: LEVELS[n].tee[i][0], y: LEVELS[n].tee[i][1], strokes: 0, done: false }; });
    show('game'); fit();
    commit({ game: { id: 'preview', status: 'playing', players: [{ name: 'Alex' }, { name: 'Viktor' }], hole: n, turn: 0, balls: tb, scores: [[], []], seq: 5, levels: LEVELS.length, updatedAt: 0 }, you: 0 });
    return;
  }
  var m = /^#\/game\/([0-9a-f-]{36})(?:\/k\/([0-9a-f]{32}))?/i.exec(location.hash);
  if (!m) { showHome(); return; }
  if (m[2]) { rememberGame(m[1], m[2], -1, myName()); history.replaceState(null, '', location.pathname + location.search + '#/game/' + m[1]); }
  openGame(m[1]);
}
$('create').addEventListener('click', function () {
  var n = $('nameHome').value.trim(); if (!n) { $('homeErr').textContent = 'Bitte gib deinen Namen ein.'; return; }
  setMyName(n); $('homeErr').textContent = '';
  api('POST', '/api/games', { name: n }).then(function (r) { rememberGame(r.id, r.token, r.seat, n); location.hash = '#/game/' + r.id; })
    .catch(function () { $('homeErr').textContent = 'Keine Verbindung zum Server.'; });
});
$('joinBtn').addEventListener('click', function () {
  var n = $('nameJoin').value.trim(); if (!n) { $('joinErr').textContent = 'Bitte gib deinen Namen ein.'; return; }
  setMyName(n);
  api('POST', '/api/games/' + A.id + '/join', { name: n }).then(function (r) { rememberGame(r.id, r.token, r.seat, n); route(); })
    .catch(function (e) { $('joinErr').textContent = e.message || 'Fehler'; });
});
$('copy').addEventListener('click', function () {
  var el = $('link'); el.select();
  try { navigator.clipboard.writeText(el.value).then(function () { toast('Link kopiert'); }, function () { document.execCommand('copy'); toast('Link kopiert'); }); } catch (e) { try { document.execCommand('copy'); toast('Link kopiert'); } catch (x) {} }
});
$('share').addEventListener('click', function () {
  var url = $('link').value;
  if (navigator.share) navigator.share({ title: 'Minigolf Duell', text: 'Spielst du mit mir Minigolf?', url: url }).catch(function () {});
  else { $('link').select(); toast('Link markieren und kopieren'); }
});
document.addEventListener('pointerdown', function () { audio(); }, { once: true });
function toggleSnd() { SND.mute = !SND.mute; try { localStorage.setItem('mg_mute', SND.mute ? '1' : '0'); } catch (e) {} updateHud(); if (!SND.mute) sound('turn'); }
$('mSnd').addEventListener('click', toggleSnd);
$('sndBtn').addEventListener('click', toggleSnd);
$('again').addEventListener('click', function () { location.hash = ''; });
$('rematch').addEventListener('click', function () {
  api('POST', '/api/games/' + A.id + '/rematch', { token: A.token }).then(function (r) {
    rememberGame(r.id, r.token, r.seat, myName()); A.rmToast = false; location.hash = '#/game/' + r.id;
  }).catch(function (e) { toast(e.message || 'Fehler'); });
});
$('menuBtn').addEventListener('click', function () { updateHud(); $('menu').hidden = false; });
$('mClose').addEventListener('click', function () { $('menu').hidden = true; });
$('mHome').addEventListener('click', function () { $('menu').hidden = true; location.hash = ''; });
$('mTg').addEventListener('click', function () { $('tgb').click(); });
$('mLink').addEventListener('click', function () {
  var url = location.origin + location.pathname + '#/game/' + A.id + '/k/' + A.token;
  try { navigator.clipboard.writeText(url).then(function () { toast('Dein Link ist kopiert'); }, function () { prompt('Dein Link:', url); }); } catch (e) { prompt('Dein Link:', url); }
});
window.addEventListener('hashchange', route);
window.addEventListener('resize', function () { if (!$('game').hidden) fit(); });
if (window.ResizeObserver) new ResizeObserver(function () { if (!$('game').hidden) fit(); }).observe($('game'));
var fl = []; try { fl = [document.fonts.load('800 14px Nunito'), document.fonts.load('700 12px Nunito')]; } catch (e) {}
Promise.all(fl).catch(function () {}).then(function () { route(); requestAnimationFrame(render); });
})();
