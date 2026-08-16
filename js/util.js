/* NEON POOL 8 - shared constants + math helpers */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});

  /* ---------- geometry / tuning constants ---------- */
  var C = {
    W: 960,
    H: 640,

    // playfield (inner felt) rectangle
    PX: 128,
    PY: 148,
    PW: 704,
    PH: 352,

    RAIL: 22,          // rail thickness drawn around the felt
    BALL_R: 9,
    POCKET_R: 20,      // capture radius
    POCKET_MOUTH: 26,  // gap in the cushion around each pocket

    MAX_SPEED: 1750,   // px/s at full power
    MIN_SPEED: 140,    // px/s at minimum power
    FRICTION: 0.62,    // rolling damping coefficient (per second, exponential)
    CUSHION_RESTITUTION: 0.76,
    BALL_RESTITUTION: 0.95,
    STOP_SPEED: 7.5,   // below this a ball is parked

    SUBSTEP: 1 / 240,
    MAX_FRAME: 1 / 20
  };
  C.PR = C.PX + C.PW;  // right edge
  C.PB = C.PY + C.PH;  // bottom edge
  C.HEAD_STRING = C.PX + C.PW * 0.28;
  C.FOOT_X = C.PX + C.PW * 0.72;
  C.CY = C.PY + C.PH / 2;
  P.C = C;

  /* ---------- palette ---------- */
  P.PAL = {
    bg: '#070915',
    bgDeep: '#04050d',
    felt: '#12633f',
    feltDark: '#0d4a2f',
    feltLine: '#17754a',
    rail: '#6a3a1c',
    railHi: '#96552a',
    railLo: '#40200e',
    pocket: '#05060a',
    chrome: '#c9d4ff',
    text: '#c8ffe8',
    dim: '#4d5c8a',
    cyan: '#3ef2d0',
    magenta: '#ff4fd8',
    yellow: '#ffd83d',
    red: '#ff4d5e',
    green: '#4dff88',
    orange: '#ff9a3d',
    blue: '#4d8cff',
    white: '#f2f6ff',
    shadow: 'rgba(0,0,0,0.42)'
  };

  /* ---------- ball colours (standard pool set) ---------- */
  P.BALL_COLORS = {
    1: '#f5c518', 2: '#2b56d8', 3: '#e03131', 4: '#8b3fd1',
    5: '#f07818', 6: '#128f45', 7: '#8f2f2f', 8: '#141414',
    9: '#f5c518', 10: '#2b56d8', 11: '#e03131', 12: '#8b3fd1',
    13: '#f07818', 14: '#128f45', 15: '#8f2f2f'
  };

  /* ---------- math ---------- */
  var M = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist: function (ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },
    dist2: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    // shortest signed difference between two angles
    angDiff: function (a, b) {
      var d = (a - b) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    // closest point on segment ab to point p -> writes into out {x,y,t}
    closestOnSegment: function (px, py, ax, ay, bx, by, out) {
      var abx = bx - ax, aby = by - ay;
      var len2 = abx * abx + aby * aby;
      var t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      out.x = ax + abx * t;
      out.y = ay + aby * t;
      out.t = t;
      return out;
    },
    // does segment a->b pass within `r` of circle centre c ?
    segmentHitsCircle: function (ax, ay, bx, by, cx, cy, r) {
      var tmp = { x: 0, y: 0, t: 0 };
      M.closestOnSegment(cx, cy, ax, ay, bx, by, tmp);
      return M.dist2(tmp.x, tmp.y, cx, cy) <= r * r;
    },
    formatScore: function (n) {
      var s = String(Math.max(0, Math.floor(n)));
      while (s.length < 7) s = '0' + s;
      return s;
    }
  };
  P.M = M;

  /* ---------- tiny event/log-free helpers ---------- */
  P.now = function () { return performance.now() / 1000; };
})();
