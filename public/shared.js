(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.MG = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var W = 844, H = 390;
  var COURSE = { x: 34, y: 64, w: 776, h: 272, r: 34 };
  var BR = 8, HOLE_R = 11, MAX_SPEED = 700, MAX_STROKES = 8, DT = 1 / 120;
  var WALL_E = 0.8, BUMP_E = 0.2;
  var TEE = [[84, 192], [84, 226]];
  var TEE_MAT = { x: 58, y: 166, w: 56, h: 86 };

  function tower(m) { return { x: m.x - 9, y: m.y + 6, w: 18, h: 50 }; }
  function mill(x, y) { var m = { x: x, y: y, len: 54, omega: 1.0 }; m.tower = tower(m); return m; }
  function gate(x, p0, omega) { return { x: x, y: 181, w: 18, h: 56, axis: 'y', amp: 44, omega: omega || 1.3, p0: p0 || 0 }; }
  function corridor(x) { return [{ x: x, y: 60, w: 18, h: 90 }, { x: x, y: 270, w: 18, h: 70 }]; }
  function lvl(o) {
    o.tee = TEE; o.teeMat = TEE_MAT;
    o.walls = o.walls || []; o.sand = o.sand || []; o.water = o.water || []; o.tele = o.tele || []; o.gates = o.gates || []; o.mill = o.mill || null;
    return o;
  }
  var LEVELS = [
    lvl({ name: 'Aufwärmen', par: 2, hole: { x: 730, y: 200 },
      walls: [{ x: 420, y: 150, w: 18, h: 120 }],
      sand: [{ x: 590, y: 292, rx: 80, ry: 36, seed: 2.1 }] }),
    lvl({ name: 'Schikane', par: 3, hole: { x: 730, y: 272 },
      walls: [{ x: 300, y: 150, w: 18, h: 190 }, { x: 480, y: 60, w: 18, h: 190 }],
      sand: [{ x: 190, y: 292, rx: 70, ry: 34, seed: 1.3 }],
      water: [{ x: 640, y: 112, rx: 60, ry: 34, seed: 4.1 }] }),
    lvl({ name: 'Windmühle', par: 3, hole: { x: 738, y: 262 },
      walls: [{ x: 300, y: 60, w: 18, h: 104 }, { x: 480, y: 226, w: 18, h: 114 }],
      sand: [{ x: 392, y: 292, rx: 74, ry: 40, seed: 1.3 }],
      water: [{ x: 430, y: 118, rx: 64, ry: 34, seed: 4.1 }],
      mill: mill(652, 246) }),
    lvl({ name: 'Röhrenpost', par: 2, hole: { x: 730, y: 209 },
      walls: [{ x: 420, y: 60, w: 18, h: 280 }],
      tele: [{ a: { x: 330, y: 209 }, b: { x: 540, y: 209 } }],
      sand: [{ x: 650, y: 150, rx: 54, ry: 30, seed: 3.3 }],
      water: [{ x: 650, y: 292, rx: 50, ry: 28, seed: 2.2 }] }),
    lvl({ name: 'Schiebetor', par: 3, hole: { x: 735, y: 209 },
      walls: [{ x: 400, y: 60, w: 18, h: 100 }, { x: 400, y: 260, w: 18, h: 80 }],
      gates: [gate(400, 0)],
      sand: [{ x: 600, y: 130, rx: 60, ry: 30, seed: 2.7 }],
      water: [{ x: 600, y: 296, rx: 56, ry: 28, seed: 5.2 }] }),
    lvl({ name: 'Doppeltor', par: 3, hole: { x: 735, y: 209 },
      walls: corridor(300).concat(corridor(520)),
      gates: [gate(300, 0, 1.3), gate(520, Math.PI, 1.3)],
      water: [{ x: 410, y: 112, rx: 50, ry: 28, seed: 4.4 }],
      sand: [{ x: 410, y: 296, rx: 56, ry: 28, seed: 1.9 }] }),
    lvl({ name: 'Röhrenlabyrinth', par: 3, hole: { x: 730, y: 230 },
      walls: [{ x: 420, y: 60, w: 18, h: 280 }],
      tele: [{ a: { x: 250, y: 130 }, b: { x: 560, y: 290 } }, { a: { x: 250, y: 290 }, b: { x: 560, y: 130 } }],
      sand: [{ x: 712, y: 232, rx: 58, ry: 44, seed: 3.8 }],
      water: [{ x: 640, y: 96, rx: 48, ry: 26, seed: 1.1 }] }),
    lvl({ name: 'Tor und Mühle', par: 4, hole: { x: 735, y: 209 },
      walls: corridor(300),
      gates: [gate(300, 0, 1.3)],
      mill: mill(560, 209),
      water: [{ x: 440, y: 108, rx: 56, ry: 28, seed: 3.1 }],
      sand: [{ x: 440, y: 300, rx: 60, ry: 28, seed: 2.4 }] }),
    lvl({ name: 'Finale', par: 4, hole: { x: 738, y: 209 },
      walls: corridor(230).concat([{ x: 420, y: 60, w: 18, h: 280 }]),
      gates: [gate(230, 0, 1.3)],
      tele: [{ a: { x: 340, y: 209 }, b: { x: 500, y: 209 } }],
      mill: mill(620, 209),
      water: [{ x: 700, y: 100, rx: 50, ry: 26, seed: 4.8 }],
      sand: [{ x: 700, y: 312, rx: 50, ry: 22, seed: 2.9 }] })
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function inEllipse(x, y, e, s) {
    var dx = (x - e.x) / (e.rx * s), dy = (y - e.y) / (e.ry * s);
    return dx * dx + dy * dy < 1;
  }
  function reflectOut(b, nx, ny, e) {
    var vn = b.vx * nx + b.vy * ny;
    if (vn > 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; return true; }
    return false;
  }
  function collideCourse(b) {
    var cx = COURSE.x + COURSE.w / 2, cy = COURSE.y + COURSE.h / 2;
    var rad = COURSE.r - BR, hx = COURSE.w / 2 - BR, hy = COURSE.h / 2 - BR;
    var px = b.x - cx, py = b.y - cy;
    var qx = Math.abs(px) - (hx - rad), qy = Math.abs(py) - (hy - rad);
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    var dist = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rad;
    if (dist > 0) {
      var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1, nx, ny;
      if (qx > 0 && qy > 0) { var l = Math.sqrt(qx * qx + qy * qy); nx = qx / l * sx; ny = qy / l * sy; }
      else if (qx > qy) { nx = sx; ny = 0; } else { nx = 0; ny = sy; }
      b.x -= nx * dist; b.y -= ny * dist;
      reflectOut(b, nx, ny, WALL_E);
    }
  }
  function collideRect(b, w) {
    var cx = clamp(b.x, w.x, w.x + w.w), cy = clamp(b.y, w.y, w.y + w.h);
    var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= BR * BR) return;
    var nx, ny, push;
    if (d2 > 0.0001) { var d = Math.sqrt(d2); nx = dx / d; ny = dy / d; push = BR - d; }
    else {
      var l = b.x - w.x, r = w.x + w.w - b.x, t = b.y - w.y, bo = w.y + w.h - b.y;
      var m = Math.min(l, r, t, bo);
      if (m === l) { nx = -1; ny = 0; } else if (m === r) { nx = 1; ny = 0; } else if (m === t) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
      push = BR + m;
    }
    b.x += nx * push; b.y += ny * push;
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= (1 + WALL_E) * vn * nx; b.vy -= (1 + WALL_E) * vn * ny; }
  }
  function collideRectMoving(b, w, vx, vy) {
    var cx = clamp(b.x, w.x, w.x + w.w), cy = clamp(b.y, w.y, w.y + w.h);
    var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= BR * BR) return;
    var nx, ny, push;
    if (d2 > 0.0001) { var d = Math.sqrt(d2); nx = dx / d; ny = dy / d; push = BR - d; }
    else {
      var l = b.x - w.x, r = w.x + w.w - b.x, t = b.y - w.y, bo = w.y + w.h - b.y, m = Math.min(l, r, t, bo);
      if (m === l) { nx = -1; ny = 0; } else if (m === r) { nx = 1; ny = 0; } else if (m === t) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
      push = BR + m;
    }
    b.x += nx * push; b.y += ny * push;
    var vn = (b.vx - vx) * nx + (b.vy - vy) * ny;
    if (vn < 0) { b.vx -= (1 + WALL_E) * vn * nx; b.vy -= (1 + WALL_E) * vn * ny; }
  }
  function gateTheta(g, k, phase, t) { return g.p0 + phase * (1 + 0.7 * k) + g.omega * t; }
  function gateRect(g, th) {
    var off = g.amp * Math.sin(th);
    return { x: g.x + (g.axis === 'x' ? off : 0), y: g.y + (g.axis === 'y' ? off : 0), w: g.w, h: g.h };
  }
  function collideCapsule(b, ax, ay, bx, by, rad, vfun) {
    var abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby;
    var t = l2 > 0 ? clamp(((b.x - ax) * abx + (b.y - ay) * aby) / l2, 0, 1) : 0;
    var cx = ax + abx * t, cy = ay + aby * t;
    var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, R = BR + rad;
    if (d2 >= R * R) return;
    var d = Math.sqrt(d2), nx, ny;
    if (d > 0.0001) { nx = dx / d; ny = dy / d; } else { nx = -aby; ny = abx; var nl = Math.sqrt(nx * nx + ny * ny) || 1; nx /= nl; ny /= nl; d = 0; }
    b.x += nx * (R - d); b.y += ny * (R - d);
    var bv = vfun ? vfun(cx, cy) : [0, 0];
    var rvx = b.vx - bv[0], rvy = b.vy - bv[1], vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx -= (1.6) * vn * nx; b.vy -= (1.6) * vn * ny; }
  }
  function millAngle(level, phase, t) { return phase + (level.mill ? level.mill.omega : 0) * t; }

  function runShot(level, ballsIn, shooter, angleDeg, power, phase) {
    var balls = [], i;
    var ph0 = (phase && typeof phase === 'object') ? phase : null;
    function mA(t) { return ph0 ? ph0.mill + (level.mill ? level.mill.omega : 0) * t : millAngle(level, phase, t); }
    function gT(g, k, t) { return ph0 ? ph0.gates[k] + g.omega * t : gateTheta(g, k, phase, t); }
    for (i = 0; i < 2; i++) {
      var s = ballsIn[i];
      balls.push({ x: s.x, y: s.y, vx: 0, vy: 0, done: !!s.done, lx: s.x, ly: s.y, splash: false, sunk: false });
    }
    var a = angleDeg * Math.PI / 180, sp = clamp(power / 100, 0.03, 1) * MAX_SPEED;
    balls[shooter].vx = Math.cos(a) * sp; balls[shooter].vy = -Math.sin(a) * sp;
    var frames = [], events = [], step = 0, maxSteps = 14 * 120, m = level.mill, pads = [];
    for (i = 0; i < level.tele.length; i++) { pads.push(level.tele[i].a); pads.push(level.tele[i].b); }
    for (i = 0; i < 2; i++) balls[i].tp = -1;
    function r1(v) { return Math.round(v * 10) / 10; }
    function rec(t) {
      var fr = [r1(balls[0].x), r1(balls[0].y), r1(balls[1].x), r1(balls[1].y), Math.round(mA(t) * 1000) / 1000];
      for (var gi = 0; gi < level.gates.length; gi++) fr.push(Math.round(gT(level.gates[gi], gi, t) * 1000) / 1000);
      frames.push(fr);
    }
    rec(0);
    while (step < maxSteps) {
      step++;
      var t = step * DT, ang = mA(t), any = false;
      for (i = 0; i < 2; i++) {
        var b = balls[i];
        if (b.done) continue;
        b.x += b.vx * DT; b.y += b.vy * DT;
        collideCourse(b);
        for (var w = 0; w < level.walls.length; w++) collideRect(b, level.walls[w]);
        for (var gk = 0; gk < level.gates.length; gk++) {
          var gg = level.gates[gk], gth = gT(gg, gk, t), gv = gg.amp * gg.omega * Math.cos(gth);
          collideRectMoving(b, gateRect(gg, gth), gg.axis === 'x' ? gv : 0, gg.axis === 'y' ? gv : 0);
        }
        if (m) {
          collideRect(b, m.tower);
          collideCapsule(b, m.x, m.y, m.x, m.y, 6.5, null);
          for (var k = 0; k < 4; k++) {
            var th = ang + k * Math.PI / 2, dx = Math.sin(th), dy = -Math.cos(th);
            collideCapsule(b, m.x + dx * 8, m.y + dy * 8, m.x + dx * m.len, m.y + dy * m.len, 4.5,
              function (cx, cy) { return [-(cy - m.y) * m.omega, (cx - m.x) * m.omega]; });
          }
        }
      }
      if (!balls[0].done && !balls[1].done) {
        var ddx = balls[1].x - balls[0].x, ddy = balls[1].y - balls[0].y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd < 2 * BR && dd > 0.0001) {
          var nx = ddx / dd, ny = ddy / dd, ov = 2 * BR - dd;
          balls[0].x -= nx * ov / 2; balls[0].y -= ny * ov / 2; balls[1].x += nx * ov / 2; balls[1].y += ny * ov / 2;
          var vn = (balls[0].vx - balls[1].vx) * nx + (balls[0].vy - balls[1].vy) * ny;
          if (vn > 0) {
            var j = (1 + BUMP_E) * vn / 2;
            balls[0].vx -= j * nx; balls[0].vy -= j * ny; balls[1].vx += j * nx; balls[1].vy += j * ny;
            if (vn > 20) events.push({ f: frames.length, t: 'bump' });
          }
        }
      }
      for (i = 0; i < 2; i++) {
        var q = balls[i];
        if (q.done) continue;
        var spd = Math.sqrt(q.vx * q.vx + q.vy * q.vy), inSand = false, e;
        for (e = 0; e < level.sand.length; e++) if (inEllipse(q.x, q.y, level.sand[e], 0.95)) inSand = true;
        if (spd > 0) {
          var dec = inSand ? 700 : 90 + 0.35 * spd, ns = Math.max(0, spd - dec * DT);
          q.vx *= ns / spd; q.vy *= ns / spd; spd = ns;
        }
        var wet = false;
        for (e = 0; e < level.water.length; e++) if (inEllipse(q.x, q.y, level.water[e], 0.93)) wet = true;
        if (wet) {
          q.x = q.lx; q.y = q.ly; q.vx = 0; q.vy = 0; q.splash = true;
          events.push({ f: frames.length, t: 'splash', who: i });
          continue;
        }
        var hx = q.x - level.hole.x, hy = q.y - level.hole.y;
        if (Math.sqrt(hx * hx + hy * hy) < HOLE_R - 3 && spd < 430) {
          q.x = level.hole.x; q.y = level.hole.y; q.vx = 0; q.vy = 0; q.done = true; q.sunk = true;
          events.push({ f: frames.length, t: 'sink', who: i });
          continue;
        }
        for (var pi = 0; pi < pads.length; pi++) {
          var pd = pads[pi], pdx = q.x - pd.x, pdy = q.y - pd.y, pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (q.tp === pi) { if (pdist > 18) q.tp = -1; continue; }
          if (pdist < 10 && spd > 0) {
            var dst = pads[pi ^ 1], ux = q.vx / spd, uy = q.vy / spd;
            q.x = dst.x + ux * 14; q.y = dst.y + uy * 14; q.tp = pi ^ 1;
            events.push({ f: frames.length, t: 'tele', who: i });
            break;
          }
        }
        if (spd < 6) { q.vx = 0; q.vy = 0; } else any = true;
      }
      if (step % 2 === 0) rec(t);
      if (!any) break;
    }
    for (i = 0; i < 2; i++) { balls[i].vx = 0; balls[i].vy = 0; }
    rec(step * DT);
    return { frames: frames, events: events, balls: balls.map(function (b) { return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, done: b.done, sunk: b.sunk, splash: b.splash }; }) };
  }

  return { W: W, H: H, COURSE: COURSE, BR: BR, HOLE_R: HOLE_R, MAX_STROKES: MAX_STROKES, MAX_SPEED: MAX_SPEED, LEVELS: LEVELS, runShot: runShot, millAngle: millAngle };
});
