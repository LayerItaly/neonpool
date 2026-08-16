/* NEON POOL 8 - ball physics: friction, elastic collisions, cushions, pockets */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M;

  /* ---------------- Ball ---------------- */
  function Ball(n, x, y) {
    this.n = n;                 // 0 = cue
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = C.BALL_R;
    this.active = true;         // false once pocketed
    this.spin = 0;              // stored english applied on first contact
    this.rollAngle = 0;         // for the rolling stripe animation
    this.rollDir = 0;
    this.color = n === 0 ? '#f4f7ff' : P.BALL_COLORS[n];
    this.stripe = n > 8;
    this.type = n === 0 ? 'cue' : (n === 8 ? 'eight' : (n < 8 ? 'solid' : 'stripe'));
    this.pocketAnim = 0;        // 0..1 shrink animation while dropping
    this.pocketAt = null;
  }
  Ball.prototype.speed = function () { return Math.hypot(this.vx, this.vy); };
  Ball.prototype.moving = function () { return this.active && (this.vx * this.vx + this.vy * this.vy) > 0.5; };

  /* ---------------- World ---------------- */
  function World() {
    this.balls = [];
    this.cushions = [];   // {ax,ay,bx,by,nx,ny}
    this.walls = [];      // obstacle segments (same shape, different sfx/paint)
    this.obstacles = [];  // {type:'rect'|'circle', ...} for rendering
    this.pockets = [];
    this.pocketScale = 1; // WIDE POCKETS power-up multiplier
    this.events = [];
    this.magnetOwner = null;   // 'p1' | 'cpu' | null  (MAGNET power-up)
    this.magnetGroup = null;   // 'solid' | 'stripe' | null
    this._tmp = { x: 0, y: 0, t: 0 };
    this.buildTable();
  }

  World.prototype.buildTable = function () {
    var px = C.PX, py = C.PY, pr = C.PR, pb = C.PB, m = C.POCKET_MOUTH;
    var mx = px + C.PW / 2;

    this.pockets = [
      { x: px, y: py, corner: true },
      { x: mx, y: py - 2, corner: false },
      { x: pr, y: py, corner: true },
      { x: px, y: pb, corner: true },
      { x: mx, y: pb + 2, corner: false },
      { x: pr, y: pb, corner: true }
    ];

    this.cushions = [];
    // top rail (two runs), bottom rail (two runs), left rail, right rail
    this.addCushion(px + m, py, mx - m, py, 0, 1);
    this.addCushion(mx + m, py, pr - m, py, 0, 1);
    this.addCushion(px + m, pb, mx - m, pb, 0, -1);
    this.addCushion(mx + m, pb, pr - m, pb, 0, -1);
    this.addCushion(px, py + m, px, pb - m, 1, 0);
    this.addCushion(pr, py + m, pr, pb - m, -1, 0);
  };

  World.prototype.addCushion = function (ax, ay, bx, by, nx, ny) {
    this.cushions.push({ ax: ax, ay: ay, bx: bx, by: by, nx: nx, ny: ny });
  };

  World.prototype.clearObstacles = function () {
    this.walls = [];
    this.obstacles = [];
  };

  World.prototype.addRectObstacle = function (x, y, w, h, style) {
    this.obstacles.push({ type: 'rect', x: x, y: y, w: w, h: h, style: style || 'block' });
    this.walls.push({ ax: x, ay: y, bx: x + w, by: y, nx: 0, ny: -1 });
    this.walls.push({ ax: x + w, ay: y, bx: x + w, by: y + h, nx: 1, ny: 0 });
    this.walls.push({ ax: x + w, ay: y + h, bx: x, by: y + h, nx: 0, ny: 1 });
    this.walls.push({ ax: x, ay: y + h, bx: x, by: y, nx: -1, ny: 0 });
  };

  World.prototype.addCircleObstacle = function (x, y, r, style) {
    this.obstacles.push({ type: 'circle', x: x, y: y, r: r, style: style || 'bumper' });
  };

  World.prototype.addBall = function (b) { this.balls.push(b); return b; };

  World.prototype.cue = function () {
    for (var i = 0; i < this.balls.length; i++) if (this.balls[i].n === 0) return this.balls[i];
    return null;
  };

  World.prototype.anyMoving = function () {
    for (var i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      if (b.moving()) return true;
      if (b.pocketAnim > 0 && b.pocketAnim < 1) return true;
    }
    return false;
  };

  World.prototype.stopAll = function () {
    for (var i = 0; i < this.balls.length; i++) { this.balls[i].vx = 0; this.balls[i].vy = 0; }
  };

  /* ---------------- integration ---------------- */

  World.prototype.step = function (dt) {
    var steps = Math.max(1, Math.min(24, Math.ceil(dt / C.SUBSTEP)));
    var h = dt / steps;
    for (var s = 0; s < steps; s++) this.substep(h);
  };

  World.prototype.substep = function (h) {
    var balls = this.balls, i, b;
    var damp = Math.exp(-C.FRICTION * h);

    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.pocketAnim > 0 && b.pocketAnim < 1) {
        b.pocketAnim = Math.min(1, b.pocketAnim + h * 5.5);
        if (b.pocketAt) {
          b.x += (b.pocketAt.x - b.x) * Math.min(1, h * 14);
          b.y += (b.pocketAt.y - b.y) * Math.min(1, h * 14);
        }
        continue;
      }
      if (!b.active) continue;

      // magnet: gentle pull towards nearest pocket for the owner's group
      if (this.magnetGroup && b.type === this.magnetGroup && b.speed() > 40) {
        var pk = this.nearestPocket(b.x, b.y);
        var d = M.dist(b.x, b.y, pk.x, pk.y);
        if (d > 1 && d < 210) {
          var pull = 380 * (1 - d / 210);
          b.vx += ((pk.x - b.x) / d) * pull * h;
          b.vy += ((pk.y - b.y) / d) * pull * h;
        }
      }

      b.x += b.vx * h;
      b.y += b.vy * h;
      b.vx *= damp;
      b.vy *= damp;

      var sp = b.speed();
      if (sp > 0.001) {
        b.rollAngle += sp * h / b.r;
        b.rollDir = Math.atan2(b.vy, b.vx);
      }
      if (sp < C.STOP_SPEED) { b.vx = 0; b.vy = 0; }
    }

    this.collideBalls();
    this.collideSegments(this.cushions, 'cushion');
    this.collideSegments(this.walls, 'wall');
    this.collideCircleObstacles();
    this.checkPockets();
  };

  World.prototype.nearestPocket = function (x, y) {
    var best = this.pockets[0], bd = Infinity;
    for (var i = 0; i < this.pockets.length; i++) {
      var d = M.dist2(x, y, this.pockets[i].x, this.pockets[i].y);
      if (d < bd) { bd = d; best = this.pockets[i]; }
    }
    return best;
  };

  World.prototype.collideBalls = function () {
    var balls = this.balls;
    for (var i = 0; i < balls.length; i++) {
      var a = balls[i];
      if (!a.active || a.pocketAnim > 0) continue;
      for (var j = i + 1; j < balls.length; j++) {
        var b = balls[j];
        if (!b.active || b.pocketAnim > 0) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var rr = a.r + b.r;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;

        var d = Math.sqrt(d2);
        var nx = dx / d, ny = dy / d;

        // positional correction
        var overlap = rr - d;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        var rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        var vn = rvx * nx + rvy * ny;
        if (vn > 0) continue; // separating

        var jimp = -(1 + C.BALL_RESTITUTION) * vn / 2; // equal masses
        a.vx -= jimp * nx; a.vy -= jimp * ny;
        b.vx += jimp * nx; b.vy += jimp * ny;

        // english transfer: cue ball follow / draw on its first contact
        var cueBall = a.n === 0 ? a : (b.n === 0 ? b : null);
        if (cueBall && cueBall.spin !== 0) {
          var s = cueBall.spin;
          var dirx = cueBall === a ? nx : -nx;
          var diry = cueBall === a ? ny : -ny;
          var mag = Math.min(420, Math.abs(vn) * 0.55) * s;
          cueBall.vx += dirx * mag;
          cueBall.vy += diry * mag;
          cueBall.spin = 0;
        }

        this.events.push({ type: 'ball', a: a, b: b, speed: Math.abs(vn) });
      }
    }
  };

  World.prototype.collideSegments = function (segs, kind) {
    var tmp = this._tmp;
    for (var i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      if (!b.active || b.pocketAnim > 0) continue;
      for (var s = 0; s < segs.length; s++) {
        var g = segs[s];
        M.closestOnSegment(b.x, b.y, g.ax, g.ay, g.bx, g.by, tmp);
        var dx = b.x - tmp.x, dy = b.y - tmp.y;
        var d2 = dx * dx + dy * dy;
        if (d2 >= b.r * b.r) continue;

        var d = Math.sqrt(d2);
        var nx, ny;
        if (d > 0.0001) { nx = dx / d; ny = dy / d; }
        else { nx = g.nx; ny = g.ny; }

        b.x += nx * (b.r - d + 0.05);
        b.y += ny * (b.r - d + 0.05);

        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          var sp = b.speed();
          b.vx -= (1 + C.CUSHION_RESTITUTION) * vn * nx;
          b.vy -= (1 + C.CUSHION_RESTITUTION) * vn * ny;
          if (sp > 25) this.events.push({ type: kind, ball: b, speed: sp });
        }
      }
    }
  };

  World.prototype.collideCircleObstacles = function () {
    for (var o = 0; o < this.obstacles.length; o++) {
      var ob = this.obstacles[o];
      if (ob.type !== 'circle') continue;
      for (var i = 0; i < this.balls.length; i++) {
        var b = this.balls[i];
        if (!b.active || b.pocketAnim > 0) continue;
        var dx = b.x - ob.x, dy = b.y - ob.y;
        var rr = b.r + ob.r;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        var d = Math.sqrt(d2);
        var nx = dx / d, ny = dy / d;
        b.x = ob.x + nx * (rr + 0.05);
        b.y = ob.y + ny * (rr + 0.05);
        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          var sp = b.speed();
          // bumpers kick the ball back a bit harder — arcade feel
          b.vx -= 1.9 * vn * nx;
          b.vy -= 1.9 * vn * ny;
          ob.flash = 1;
          this.events.push({ type: 'bumper', ball: b, speed: sp, obstacle: ob });
        }
      }
    }
  };

  World.prototype.checkPockets = function () {
    var R = C.POCKET_R * this.pocketScale;
    for (var i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      if (!b.active || b.pocketAnim > 0) continue;
      for (var p = 0; p < this.pockets.length; p++) {
        var pk = this.pockets[p];
        if (M.dist2(b.x, b.y, pk.x, pk.y) < R * R) {
          b.pocketAnim = 0.001;
          b.pocketAt = pk;
          b.vx *= 0.25; b.vy *= 0.25;
          this.events.push({ type: 'pocket', ball: b, pocket: pk });
          break;
        }
      }
    }
  };

  World.prototype.finalisePocketed = function () {
    for (var i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      if (b.pocketAnim >= 1 && b.active) {
        b.active = false;
        b.vx = 0; b.vy = 0;
      }
    }
  };

  /* ---------------- placement helpers ---------------- */

  World.prototype.isFree = function (x, y, ignoreBall, pad) {
    pad = pad || 0;
    var r = C.BALL_R;
    if (x < C.PX + r + 1 || x > C.PR - r - 1 || y < C.PY + r + 1 || y > C.PB - r - 1) return false;
    var i, o;
    for (i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      if (!b.active || b === ignoreBall || b.pocketAnim > 0) continue;
      if (M.dist2(x, y, b.x, b.y) < Math.pow(r * 2 + pad, 2)) return false;
    }
    for (i = 0; i < this.pockets.length; i++) {
      if (M.dist2(x, y, this.pockets[i].x, this.pockets[i].y) < Math.pow(C.POCKET_R + r, 2)) return false;
    }
    for (o = 0; o < this.obstacles.length; o++) {
      var ob = this.obstacles[o];
      if (ob.type === 'rect') {
        if (x > ob.x - r - pad && x < ob.x + ob.w + r + pad &&
            y > ob.y - r - pad && y < ob.y + ob.h + r + pad) return false;
      } else if (ob.type === 'circle') {
        if (M.dist2(x, y, ob.x, ob.y) < Math.pow(ob.r + r + pad, 2)) return false;
      }
    }
    return true;
  };

  // nudge a ball out of any illegal overlap after racking
  World.prototype.relaxOverlaps = function (iterations) {
    iterations = iterations || 60;
    for (var it = 0; it < iterations; it++) {
      var moved = false;
      for (var i = 0; i < this.balls.length; i++) {
        var b = this.balls[i];
        if (!b.active) continue;
        if (!this.isFree(b.x, b.y, b, 0.4)) {
          // spiral search for a legal spot nearby
          for (var k = 1; k < 90; k++) {
            var ang = k * 2.399963;
            var rad = 2.2 * Math.sqrt(k);
            var nx = b.x + Math.cos(ang) * rad;
            var ny = b.y + Math.sin(ang) * rad;
            if (this.isFree(nx, ny, b, 0.4)) { b.x = nx; b.y = ny; moved = true; break; }
          }
        }
      }
      if (!moved) break;
    }
  };

  // find a legal respot for the cue ball (used when it's pocketed and re-spotted)
  World.prototype.findSpot = function (px, py, ignoreBall) {
    if (this.isFree(px, py, ignoreBall, 2)) return { x: px, y: py };
    for (var k = 1; k < 900; k++) {
      var ang = k * 2.399963;
      var rad = 3.4 * Math.sqrt(k);
      var x = px + Math.cos(ang) * rad;
      var y = py + Math.sin(ang) * rad;
      if (this.isFree(x, y, ignoreBall, 2)) return { x: x, y: y };
    }
    return { x: C.PX + C.PW * 0.25, y: C.CY };
  };

  /* ---------------- prediction (aiming line) ---------------- */

  /**
   * Cast a ray from (x,y) along dir, returning the first hit.
   * Considers balls, cushions, obstacle walls, circle obstacles and pockets.
   */
  World.prototype.raycast = function (x, y, dx, dy, ignore, maxDist) {
    maxDist = maxDist || 3000;
    var best = { dist: maxDist, type: 'none', nx: 0, ny: 0, ball: null };
    var r = C.BALL_R;
    var i, t;

    // balls: expanded-circle intersection (radius 2r)
    for (i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      if (!b.active || b === ignore || b.pocketAnim > 0) continue;
      var ex = b.x - x, ey = b.y - y;
      var proj = ex * dx + ey * dy;
      if (proj <= 0) continue;
      var perp2 = (ex * ex + ey * ey) - proj * proj;
      var rr = (r * 2) * (r * 2);
      if (perp2 > rr) continue;
      t = proj - Math.sqrt(rr - perp2);
      if (t > 0 && t < best.dist) {
        var hx = x + dx * t, hy = y + dy * t;
        var nlen = M.dist(hx, hy, b.x, b.y) || 1;
        best = { dist: t, type: 'ball', ball: b, nx: (b.x - hx) / nlen, ny: (b.y - hy) / nlen };
      }
    }

    // segments (offset by ball radius along the normal)
    var segs = this.cushions.concat(this.walls);
    for (i = 0; i < segs.length; i++) {
      var g = segs[i];
      var sx = g.ax + g.nx * r, sy = g.ay + g.ny * r;
      var tx = g.bx + g.nx * r, ty = g.by + g.ny * r;
      var hit = raySegment(x, y, dx, dy, sx, sy, tx, ty);
      if (hit !== null && hit > 0.01 && hit < best.dist) {
        best = { dist: hit, type: 'rail', ball: null, nx: g.nx, ny: g.ny };
      }
    }

    // circle obstacles
    for (i = 0; i < this.obstacles.length; i++) {
      var ob = this.obstacles[i];
      if (ob.type !== 'circle') continue;
      var cx = ob.x - x, cy = ob.y - y;
      var pj = cx * dx + cy * dy;
      if (pj <= 0) continue;
      var pp = (cx * cx + cy * cy) - pj * pj;
      var R2 = (ob.r + r) * (ob.r + r);
      if (pp > R2) continue;
      t = pj - Math.sqrt(R2 - pp);
      if (t > 0 && t < best.dist) {
        var qx = x + dx * t, qy = y + dy * t;
        var ln = M.dist(qx, qy, ob.x, ob.y) || 1;
        best = { dist: t, type: 'rail', ball: null, nx: (qx - ob.x) / ln, ny: (qy - ob.y) / ln };
      }
    }

    // pockets swallow the prediction line
    for (i = 0; i < this.pockets.length; i++) {
      var pk = this.pockets[i];
      var ax = pk.x - x, ay = pk.y - y;
      var pr2 = ax * dx + ay * dy;
      if (pr2 <= 0) continue;
      var pd = (ax * ax + ay * ay) - pr2 * pr2;
      var PR = C.POCKET_R * this.pocketScale * 0.8;
      if (pd > PR * PR) continue;
      t = pr2 - Math.sqrt(PR * PR - pd);
      if (t > 0 && t < best.dist) {
        best = { dist: t, type: 'pocket', ball: null, nx: 0, ny: 0, pocket: pk };
      }
    }

    return best;
  };

  function raySegment(ox, oy, dx, dy, ax, ay, bx, by) {
    var sx = bx - ax, sy = by - ay;
    var denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-9) return null;
    var qx = ax - ox, qy = ay - oy;
    var t = (qx * sy - qy * sx) / denom;   // along ray
    var u = (qx * dy - qy * dx) / denom;   // along segment
    if (t > 0 && u >= 0 && u <= 1) return t;
    return null;
  }

  P.Ball = Ball;
  P.World = World;
})();
