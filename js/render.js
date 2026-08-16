/* NEON POOL 8 - all drawing: table, balls, cue, HUD, overlays, FX */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M, PAL = P.PAL, F = P.Font;

  /* ---------------- particles / floating text ---------------- */
  function FX() { this.parts = []; this.texts = []; this.shake = 0; }

  FX.prototype.burst = function (x, y, color, n, spd) {
    n = n || 8; spd = spd || 160;
    for (var i = 0; i < n; i++) {
      var a = M.rand(0, Math.PI * 2), s = M.rand(spd * 0.3, spd);
      this.parts.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: M.rand(0.25, 0.7), t: 0, color: color, size: M.randInt(2, 4)
      });
    }
  };

  FX.prototype.ring = function (x, y, color, r) {
    this.parts.push({ ring: true, x: x, y: y, r0: 4, r1: r || 46, life: 0.45, t: 0, color: color });
  };

  FX.prototype.text = function (x, y, str, color, scale) {
    this.texts.push({ x: x, y: y, str: str, color: color, scale: scale || 2, life: 1.1, t: 0 });
  };

  FX.prototype.update = function (dt) {
    var i, p;
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      if (!p.ring) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.94; p.vy *= 0.94;
      }
    }
    for (i = this.texts.length - 1; i >= 0; i--) {
      p = this.texts[i];
      p.t += dt;
      p.y -= dt * 26;
      if (p.t >= p.life) this.texts.splice(i, 1);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.4);
  };

  FX.prototype.draw = function (ctx) {
    var i, p, a;
    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i];
      a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, M.lerp(p.r0, p.r1, p.t / p.life), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < this.texts.length; i++) {
      p = this.texts[i];
      a = 1 - Math.pow(p.t / p.life, 2.2);
      ctx.globalAlpha = a;
      F.draw(ctx, p.str, p.x, p.y, { scale: p.scale, color: p.color, align: 'center', shadow: 'rgba(0,0,0,0.7)' });
    }
    ctx.globalAlpha = 1;
  };

  /* ---------------- Renderer ---------------- */
  function Renderer(ctx) {
    this.ctx = ctx;
    this.fx = new FX();
    this.t = 0;
    this.feltPattern = null;
  }

  Renderer.prototype.update = function (dt) {
    this.t += dt;
    this.fx.update(dt);
  };

  /* ---- background ---- */
  Renderer.prototype.drawBackground = function () {
    var ctx = this.ctx;
    ctx.fillStyle = PAL.bgDeep;
    ctx.fillRect(0, 0, C.W, C.H);

    // subtle animated grid
    ctx.strokeStyle = 'rgba(60,90,180,0.10)';
    ctx.lineWidth = 1;
    var off = (this.t * 9) % 32;
    ctx.beginPath();
    for (var x = -32 + off; x < C.W; x += 32) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, C.H); }
    for (var y = -32 + off; y < C.H; y += 32) { ctx.moveTo(0, y + 0.5); ctx.lineTo(C.W, y + 0.5); }
    ctx.stroke();

    // horizon glow
    var g = ctx.createRadialGradient(C.W / 2, C.H / 2, 40, C.W / 2, C.H / 2, 520);
    g.addColorStop(0, 'rgba(40,70,140,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);
  };

  /* ---- table ---- */
  Renderer.prototype.drawTable = function (world, state) {
    var ctx = this.ctx;
    var rail = C.RAIL;
    var ox = C.PX - rail, oy = C.PY - rail;
    var ow = C.PW + rail * 2, oh = C.PH + rail * 2;

    // outer frame shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(ox - 6, oy - 4, ow + 12, oh + 16);

    // wooden rail
    ctx.fillStyle = PAL.rail;
    ctx.fillRect(ox - 6, oy - 6, ow + 12, oh + 12);
    ctx.fillStyle = PAL.railHi;
    ctx.fillRect(ox - 6, oy - 6, ow + 12, 4);
    ctx.fillStyle = PAL.railLo;
    ctx.fillRect(ox - 6, oy + oh + 2, ow + 12, 4);

    // neon trim
    ctx.strokeStyle = 'rgba(62,242,208,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 5.5, oy - 5.5, ow + 11, oh + 11);

    // felt
    ctx.fillStyle = PAL.felt;
    ctx.fillRect(C.PX, C.PY, C.PW, C.PH);

    // felt shading (soft vignette on the cloth)
    var g = ctx.createRadialGradient(C.PX + C.PW / 2, C.CY, 60, C.PX + C.PW / 2, C.CY, C.PW * 0.62);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(C.PX, C.PY, C.PW, C.PH);

    // pixel weave
    ctx.fillStyle = 'rgba(255,255,255,0.022)';
    for (var yy = C.PY; yy < C.PB; yy += 4) ctx.fillRect(C.PX, yy, C.PW, 1);

    // head string + foot spot
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(C.HEAD_STRING) + 0.5, C.PY);
    ctx.lineTo(Math.round(C.HEAD_STRING) + 0.5, C.PB);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(Math.round(C.FOOT_X) - 2, Math.round(C.CY) - 2, 4, 4);

    // rail sight diamonds
    ctx.fillStyle = 'rgba(240,235,210,0.75)';
    var i, dx;
    for (i = 1; i <= 7; i++) {
      if (i === 4) continue;
      dx = C.PX + (C.PW / 8) * i;
      diamond(ctx, dx, C.PY - rail / 2, 3);
      diamond(ctx, dx, C.PB + rail / 2, 3);
    }
    for (i = 1; i <= 3; i++) {
      var dy = C.PY + (C.PH / 4) * i;
      diamond(ctx, C.PX - rail / 2, dy, 3);
      diamond(ctx, C.PR + rail / 2, dy, 3);
    }

    // pockets
    for (i = 0; i < world.pockets.length; i++) {
      var pk = world.pockets[i];
      var pr = C.POCKET_R * world.pocketScale;
      ctx.fillStyle = '#1a0e06';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, pr + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAL.pocket;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, pr, 0, Math.PI * 2); ctx.fill();
      if (world.pocketScale > 1) {
        ctx.strokeStyle = 'rgba(255,216,61,' + (0.5 + 0.3 * Math.sin(this.t * 8)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pk.x, pk.y, pr + 2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // obstacles
    for (i = 0; i < world.obstacles.length; i++) {
      var ob = world.obstacles[i];
      var flash = ob.flash || 0;
      if (ob.flash) ob.flash = Math.max(0, ob.flash - 0.06);
      if (ob.type === 'rect') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(ob.x + 3, ob.y + 4, ob.w, ob.h);
        ctx.fillStyle = flash > 0.1 ? '#ffffff' : '#2a3566';
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.fillStyle = flash > 0.1 ? '#ffffff' : '#4a5fa8';
        ctx.fillRect(ob.x, ob.y, ob.w, 3);
        ctx.strokeStyle = 'rgba(62,242,208,' + (0.55 + flash * 0.45) + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(ob.x + 1, ob.y + 1, ob.w - 2, ob.h - 2);
        // hazard stripes
        ctx.save();
        ctx.beginPath(); ctx.rect(ob.x, ob.y, ob.w, ob.h); ctx.clip();
        ctx.strokeStyle = 'rgba(255,216,61,0.16)';
        ctx.lineWidth = 4;
        for (var s = -ob.h; s < ob.w + ob.h; s += 12) {
          ctx.beginPath();
          ctx.moveTo(ob.x + s, ob.y + ob.h);
          ctx.lineTo(ob.x + s + ob.h, ob.y);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath(); ctx.arc(ob.x + 3, ob.y + 4, ob.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash > 0.1 ? '#ffffff' : '#ff4fd8';
        ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(ob.x - ob.r * 0.3, ob.y - ob.r * 0.35, ob.r * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.5 * Math.abs(Math.sin(this.t * 3 + ob.x))) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
  };

  function diamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
  }

  /* ---- power-up pickups ---- */
  Renderer.prototype.drawPickups = function (pu) {
    var ctx = this.ctx;
    for (var i = 0; i < pu.items.length; i++) {
      var it = pu.items[i];
      var bob = Math.sin(it.phase) * 3;
      var fade = it.born > it.life - 4 ? (0.35 + 0.65 * Math.abs(Math.sin(it.born * 9))) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(it.x, it.y + bob);

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(2, 12 - bob, it.r * 0.8, 4, 0, 0, Math.PI * 2); ctx.fill();

      ctx.rotate(Math.sin(it.phase * 0.5) * 0.25);
      // hexagon capsule
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = (k / 6) * Math.PI * 2 - Math.PI / 2;
        var px = Math.cos(a) * it.r, py = Math.sin(a) * it.r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#0c1226';
      ctx.fill();
      ctx.strokeStyle = it.type.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(-Math.sin(it.phase * 0.5) * 0.25);

      F.draw(ctx, it.type.short, 0, -4, { scale: 1, color: it.type.color, align: 'center', tracking: 1 });
      ctx.restore();

      // pulse ring
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(it.phase * 2);
      ctx.strokeStyle = it.type.color;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(it.x, it.y + bob, it.r + 5 + Math.sin(it.phase * 2) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  /* ---- balls ---- */
  Renderer.prototype.drawBalls = function (world, hideCue) {
    var ctx = this.ctx;
    var i, b;
    // shadows first
    for (i = 0; i < world.balls.length; i++) {
      b = world.balls[i];
      if (!b.active || (hideCue && b.n === 0)) continue;
      var sc = b.pocketAnim > 0 ? (1 - b.pocketAnim) : 1;
      if (sc <= 0.02) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(b.x + 2.5, b.y + 3.5, b.r * sc, b.r * 0.82 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (i = 0; i < world.balls.length; i++) {
      b = world.balls[i];
      if (!b.active || (hideCue && b.n === 0)) continue;
      this.drawBall(b);
    }
  };

  Renderer.prototype.drawBall = function (b) {
    var ctx = this.ctx;
    var sc = b.pocketAnim > 0 ? Math.max(0, 1 - b.pocketAnim) : 1;
    if (sc <= 0.02) return;
    var r = b.r * sc;

    ctx.save();
    ctx.translate(b.x, b.y);

    // body
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    if (b.stripe) {
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
      ctx.rotate(b.rollDir + Math.PI / 2);
      var band = Math.sin(b.rollAngle) * r * 0.55;
      ctx.fillStyle = '#f4f2e8';
      ctx.fillRect(-r, -r, r * 2, r + band - r * 0.42);
      ctx.fillRect(-r, band + r * 0.42, r * 2, r * 2);
      ctx.restore();
    }

    // rim shade
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, r - 0.7, 0, Math.PI * 2); ctx.stroke();

    // number badge (hidden while spinning fast so it reads as motion)
    if (b.n > 0 && sc > 0.55) {
      var nx = Math.cos(b.rollAngle * 0.6) * r * 0.18;
      var ny = Math.sin(b.rollAngle * 0.45) * r * 0.18;
      ctx.fillStyle = '#f7f5ec';
      ctx.beginPath(); ctx.arc(nx, ny, r * 0.5, 0, Math.PI * 2); ctx.fill();
      F.draw(ctx, String(b.n), nx, ny - 2.5, {
        scale: b.n > 9 ? 0.62 : 0.72, color: '#14161f', align: 'center', tracking: 1
      });
    }

    // specular
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(-r * 0.34, -r * 0.38, r * 0.24, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  };

  /* ---- aiming line + ghost ball ---- */
  Renderer.prototype.drawAim = function (world, cue, angle, laser) {
    var ctx = this.ctx;
    var dx = Math.cos(angle), dy = Math.sin(angle);

    var hit = world.raycast(cue.x, cue.y, dx, dy, cue, 2200);
    var end = { x: cue.x + dx * hit.dist, y: cue.y + dy * hit.dist };

    ctx.save();
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -(this.t * 34) % 13;
    ctx.strokeStyle = laser ? 'rgba(62,242,208,0.95)' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = laser ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (hit.type === 'ball') {
      // ghost cue ball at contact
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(end.x, end.y, C.BALL_R, 0, Math.PI * 2); ctx.stroke();

      // object ball departure line
      var ox = hit.nx, oy = hit.ny;
      ctx.strokeStyle = 'rgba(255,216,61,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hit.ball.x, hit.ball.y);
      ctx.lineTo(hit.ball.x + ox * 70, hit.ball.y + oy * 70);
      ctx.stroke();

      // cue ball tangent (deflection) line
      var tanx = -oy, tany = ox;
      var side = (dx * tanx + dy * tany) >= 0 ? 1 : -1;
      ctx.strokeStyle = 'rgba(120,200,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x + tanx * side * 52, end.y + tany * side * 52);
      ctx.stroke();
      ctx.setLineDash([]);

      if (laser) this.drawBounce(world, hit.ball.x, hit.ball.y, ox, oy, hit.ball, 2, 'rgba(255,216,61,0.5)');
    } else if (hit.type === 'rail' && laser) {
      var rd = reflect(dx, dy, hit.nx, hit.ny);
      this.drawBounce(world, end.x, end.y, rd.x, rd.y, cue, 2, 'rgba(62,242,208,0.55)');
    } else if (hit.type === 'pocket') {
      ctx.strokeStyle = 'rgba(255,216,61,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(end.x, end.y, 10 + Math.sin(this.t * 10) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype.drawBounce = function (world, x, y, dx, dy, ignore, depth, color) {
    var ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    for (var i = 0; i < depth; i++) {
      var hit = world.raycast(x, y, dx, dy, ignore, 1400);
      var ex = x + dx * hit.dist, ey = y + dy * hit.dist;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      if (hit.type !== 'rail') break;
      var r = reflect(dx, dy, hit.nx, hit.ny);
      dx = r.x; dy = r.y;
      x = ex + dx * 0.6; y = ey + dy * 0.6;
      ignore = null;
    }
    ctx.restore();
  };

  function reflect(dx, dy, nx, ny) {
    var d = dx * nx + dy * ny;
    return { x: dx - 2 * d * nx, y: dy - 2 * d * ny };
  }

  /* ---- the cue stick ---- */
  Renderer.prototype.drawCue = function (cue, angle, power, thrust, spin) {
    var ctx = this.ctx;
    var dx = Math.cos(angle), dy = Math.sin(angle);
    var gap = 15 + power * 46 - thrust * 46;
    var len = 210;

    var tipX = cue.x - dx * gap;
    var tipY = cue.y - dy * gap;
    var buttX = tipX - dx * len;
    var buttY = tipY - dy * len;

    ctx.save();
    // shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tipX + 3, tipY + 5); ctx.lineTo(buttX + 3, buttY + 5); ctx.stroke();

    // shaft (light wood -> dark butt)
    var g = ctx.createLinearGradient(tipX, tipY, buttX, buttY);
    g.addColorStop(0, '#e8cf9a');
    g.addColorStop(0.45, '#c9a06a');
    g.addColorStop(0.62, '#4a2a16');
    g.addColorStop(1, '#2c1809');
    ctx.strokeStyle = g;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(buttX, buttY); ctx.stroke();

    // highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tipX - dy * 1.6, tipY + dx * 1.6);
    ctx.lineTo(buttX - dy * 1.6, buttY + dx * 1.6);
    ctx.stroke();

    // wrap + rings
    ctx.strokeStyle = '#101018';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(tipX - dx * len * 0.70, tipY - dy * len * 0.70);
    ctx.lineTo(tipX - dx * len * 0.90, tipY - dy * len * 0.90);
    ctx.stroke();
    ctx.strokeStyle = '#d8d2c0';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(tipX - dx * len * 0.655, tipY - dy * len * 0.655);
    ctx.lineTo(tipX - dx * len * 0.685, tipY - dy * len * 0.685);
    ctx.stroke();

    // ferrule + tip
    ctx.strokeStyle = '#f4f0e2';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(tipX + dx * 1, tipY + dy * 1);
    ctx.lineTo(tipX - dx * 9, tipY - dy * 9);
    ctx.stroke();
    ctx.strokeStyle = spin > 0.05 ? '#5bd6ff' : (spin < -0.05 ? '#ff7ad0' : '#2f5fbe');
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(tipX + dx * 2.5, tipY + dy * 2.5);
    ctx.lineTo(tipX - dx * 1.5, tipY - dy * 1.5);
    ctx.stroke();
    ctx.restore();
  };

  /* ---- HUD ---- */
  Renderer.prototype.drawHUD = function (g) {
    var ctx = this.ctx;
    var i;

    // top bar
    ctx.fillStyle = 'rgba(8,10,24,0.85)';
    ctx.fillRect(0, 0, C.W, 118);
    ctx.strokeStyle = 'rgba(62,242,208,0.30)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 118.5); ctx.lineTo(C.W, 118.5); ctx.stroke();

    var p1Active = g.turn === 'p1';

    // --- player 1 panel ---
    this.playerPanel(18, 12, 'PLAYER 1', g.score, g.groups.p1, world_remaining(g.world, g.groups.p1), p1Active, PAL.cyan, g.effects.p1);
    // --- cpu panel ---
    this.playerPanel(C.W - 18 - 300, 12, 'CPU ' + (g.levelIndex + 1), g.cpuScore, g.groups.cpu, world_remaining(g.world, g.groups.cpu), !p1Active, PAL.magenta, g.effects.cpu);

    // --- centre: level + lives ---
    var lv = P.LEVELS[Math.min(g.levelIndex, P.LEVELS.length - 1)];
    F.draw(ctx, 'STAGE ' + (g.levelIndex + 1) + '/' + P.LEVELS.length, C.W / 2, 14, { scale: 2, color: PAL.yellow, align: 'center', glow: 8 });
    F.draw(ctx, lv.name, C.W / 2, 36, { scale: 1.6, color: PAL.text, align: 'center' });
    F.draw(ctx, lv.sub, C.W / 2, 54, { scale: 1, color: PAL.dim, align: 'center' });

    // lives
    var lx = C.W / 2 - (g.lives * 16) / 2;
    for (i = 0; i < 4; i++) {
      var on = i < g.lives;
      ctx.fillStyle = on ? PAL.red : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(C.W / 2 - 26 + i * 17, 80, 5, 0, Math.PI * 2); ctx.fill();
      if (on) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(C.W / 2 - 28 + i * 17, 78, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    F.draw(ctx, 'LIVES', C.W / 2, 94, { scale: 1, color: PAL.dim, align: 'center' });

    // --- bottom bar ---
    var by = 528;
    ctx.fillStyle = 'rgba(8,10,24,0.85)';
    ctx.fillRect(0, by, C.W, C.H - by);
    ctx.strokeStyle = 'rgba(62,242,208,0.30)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, by + 0.5); ctx.lineTo(C.W, by + 0.5); ctx.stroke();

    // power meter
    this.powerMeter(24, by + 20, 300, 22, g.power, g.effects.p1.has('POWER'));

    // spin control
    this.spinDial(378, by + 42, g.spin);

    // status message
    var msg = g.status || '';
    F.draw(ctx, msg, 470, by + 16, { scale: 1.7, color: g.statusColor || PAL.text, align: 'left', glow: 6 });
    F.draw(ctx, g.hint || '', 470, by + 40, { scale: 1, color: PAL.dim, align: 'left' });

    // audio switches, bottom right
    var wSfx = this.audioChipWidth('SOUND FX', 'N');
    var wMus = this.audioChipWidth('MUSIC', 'M');
    var chipY = by + 88;
    this.audioChip(C.W - 24 - wSfx, chipY, 'SOUND FX', g.audio.sfxOn, 'N');
    this.audioChip(C.W - 24 - wSfx - 10 - wMus, chipY, 'MUSIC', g.audio.musicOn, 'M');

    // active effects (player) - full labels down here, short chips up in the panels
    var eff = g.effects.p1.list();
    if (eff.length) {
      F.draw(ctx, 'YOUR POWER-UPS', C.W - 24, by + 30, { scale: 1, color: PAL.dim, align: 'right' });
      for (i = 0; i < eff.length && i < 3; i++) {
        var e = eff[i];
        F.draw(ctx, e.type.label + ' X' + e.n, C.W - 24, by + 44 + i * 14,
          { scale: 1.2, color: e.type.color, align: 'right' });
      }
    } else {
      F.draw(ctx, 'H = HELP    P = PAUSE    R = RETRY',
        C.W - 24, by + 54, { scale: 1.2, color: PAL.dim, align: 'right' });
    }

    // combo
    if (g.combo > 1) {
      F.draw(ctx, 'COMBO X' + g.combo, 24, by + 74, { scale: 2, color: PAL.magenta, align: 'left', glow: 10 });
    }

    // high score
    F.draw(ctx, 'HI ' + M.formatScore(g.hiScore), C.W - 24, by + 16, { scale: 1.4, color: PAL.yellow, align: 'right' });
  };

  /** width of an audio switch, measured on the longest state so it never jitters */
  Renderer.prototype.audioChipWidth = function (label, key) {
    return F.width('[' + key + '] ' + label + ' OFF', 1.2, 1) + 22;
  };

  /** small on/off switch for an audio channel; returns the width it used */
  Renderer.prototype.audioChip = function (x, y, label, on, key) {
    var ctx = this.ctx;
    var color = on ? PAL.green : PAL.dim;
    var text = '[' + key + '] ' + label + ' ' + (on ? 'ON' : 'OFF');
    var w = this.audioChipWidth(label, key);

    ctx.fillStyle = on ? 'rgba(77,255,136,0.10)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, y, w, 18);
    ctx.strokeStyle = on ? 'rgba(77,255,136,0.55)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 17);

    // led
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 9, y + 9, 3.5, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(x + 8, y + 8, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    F.draw(ctx, text, x + 17, y + 5, { scale: 1.2, color: color });
    return w;
  };

  function world_remaining(world, group) {
    if (!group) return null;
    var n = 0;
    for (var i = 0; i < world.balls.length; i++) {
      var b = world.balls[i];
      if (b.active && b.pocketAnim === 0 && b.type === group) n++;
    }
    return n;
  }

  Renderer.prototype.playerPanel = function (x, y, name, score, group, remaining, active, color, effects) {
    var ctx = this.ctx;
    var w = 300, h = 92;

    ctx.fillStyle = active ? 'rgba(62,242,208,0.10)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active ? color : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (active) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.t * 6);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
      ctx.restore();
    }

    F.draw(ctx, name, x + 12, y + 10, { scale: 1.8, color: active ? color : PAL.dim, glow: active ? 8 : 0 });
    F.draw(ctx, M.formatScore(score), x + 12, y + 32, { scale: 2.4, color: PAL.text });

    // active power-up chips
    if (effects) {
      var list = effects.list();
      var cx = x + w - 8;
      for (var e = list.length - 1; e >= 0; e--) {
        var it = list[e];
        var lab = it.type.short + (it.n > 1 ? 'X' + it.n : '');
        var cw = F.width(lab, 1.2, 1) + 10;
        cx -= cw + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(cx, y + 8, cw, 16);
        ctx.strokeStyle = it.type.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, y + 8.5, cw - 1, 15);
        F.draw(ctx, lab, cx + cw / 2, y + 12, { scale: 1.2, color: it.type.color, align: 'center' });
      }
    }

    // group badge
    var gy = y + 62;
    if (group) {
      var label = group === 'solid' ? 'SOLIDS 1-7' : 'STRIPES 9-15';
      F.draw(ctx, label, x + 12, gy, { scale: 1.2, color: PAL.white });
      F.draw(ctx, remaining + ' LEFT', x + 12, gy + 14, { scale: 1.2, color: remaining === 0 ? PAL.yellow : PAL.dim });
      // mini ball icons
      var sample = group === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      for (var i = 0; i < sample.length; i++) {
        var bx = x + 150 + i * 20, byy = gy + 8;
        var done = i >= remaining;
        ctx.globalAlpha = done ? 0.18 : 1;
        ctx.fillStyle = P.BALL_COLORS[sample[i]];
        ctx.beginPath(); ctx.arc(bx, byy, 7, 0, Math.PI * 2); ctx.fill();
        if (group === 'stripe') {
          ctx.fillStyle = '#f4f2e8';
          ctx.fillRect(bx - 7, byy - 2.5, 14, 5);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx, byy, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      F.draw(ctx, 'TABLE OPEN', x + 12, gy, { scale: 1.2, color: PAL.yellow });
      F.draw(ctx, 'FIRST POT DECIDES', x + 12, gy + 14, { scale: 1.2, color: PAL.dim });
    }
  };

  Renderer.prototype.powerMeter = function (x, y, w, h, power, boosted) {
    var ctx = this.ctx;
    F.draw(ctx, 'POWER', x, y - 14, { scale: 1.2, color: PAL.dim });

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    var seg = 20, gap = 2;
    var segW = (w - 6) / seg;
    var filled = Math.round(power * seg);
    for (var i = 0; i < seg; i++) {
      var t = i / (seg - 1);
      var col = t < 0.45 ? '#4dff88' : (t < 0.78 ? '#ffd83d' : '#ff4d5e');
      ctx.fillStyle = i < filled ? col : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 3 + i * segW, y + 3, segW - gap, h - 6);
    }
    if (boosted) {
      ctx.strokeStyle = '#ff9a3d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
      F.draw(ctx, 'OVERDRIVE', x + w, y - 14, { scale: 1.2, color: '#ff9a3d', align: 'right' });
    }
    F.draw(ctx, Math.round(power * 100) + '%', x + w, y + h + 6, { scale: 1.2, color: PAL.text, align: 'right' });
  };

  Renderer.prototype.spinDial = function (cx, cy, spin) {
    var ctx = this.ctx;
    F.draw(ctx, 'SPIN', cx, cy - 40, { scale: 1.2, color: PAL.dim, align: 'center' });
    ctx.fillStyle = '#f4f7ff';
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    // contact point marker
    var my = cy - spin * 13;
    ctx.fillStyle = spin > 0.05 ? '#2b56d8' : (spin < -0.05 ? '#e03131' : '#14161f');
    ctx.beginPath(); ctx.arc(cx, my, 4.5, 0, Math.PI * 2); ctx.fill();
    var label = spin > 0.05 ? 'TOP' : (spin < -0.05 ? 'BACK' : 'CENTRE');
    F.draw(ctx, label, cx, cy + 26, { scale: 1, color: PAL.text, align: 'center' });
    F.draw(ctx, 'W/S', cx, cy + 38, { scale: 1, color: PAL.dim, align: 'center' });
  };

  /* ---- legal placement zone while holding the cue ball ---- */
  Renderer.prototype.drawPlacementZone = function (headStringOnly) {
    var ctx = this.ctx;
    var x = C.PX, w = headStringOnly ? (C.HEAD_STRING - C.PX) : C.PW;
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(this.t * 5);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(x, C.PY, w, C.PH);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = PAL.cyan;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -(this.t * 26) % 11;
    ctx.strokeRect(x + 1, C.PY + 1, w - 2, C.PH - 2);
    ctx.setLineDash([]);
    ctx.restore();
    if (headStringOnly) {
      F.draw(ctx, 'BREAK ZONE', x + w / 2, C.PY + 8, { scale: 1.2, color: PAL.cyan, align: 'center' });
    }
  };

  /* ---- ball-in-hand cursor ---- */
  Renderer.prototype.drawGhostCue = function (x, y, legal) {
    var ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = legal ? '#f4f7ff' : '#ff4d5e';
    ctx.beginPath(); ctx.arc(x, y, C.BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = legal ? PAL.cyan : PAL.red;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -(this.t * 30) % 8;
    ctx.beginPath(); ctx.arc(x, y, C.BALL_R + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---- crosshair cursor ---- */
  Renderer.prototype.drawCursor = function (x, y) {
    var ctx = this.ctx;
    ctx.strokeStyle = 'rgba(62,242,208,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 0.5); ctx.lineTo(x - 3, y + 0.5);
    ctx.moveTo(x + 3, y + 0.5); ctx.lineTo(x + 9, y + 0.5);
    ctx.moveTo(x + 0.5, y - 9); ctx.lineTo(x + 0.5, y - 3);
    ctx.moveTo(x + 0.5, y + 3); ctx.lineTo(x + 0.5, y + 9);
    ctx.stroke();
  };

  /* ---- overlays ---- */
  Renderer.prototype.dim = function (a) {
    var ctx = this.ctx;
    ctx.fillStyle = 'rgba(3,4,12,' + a + ')';
    ctx.fillRect(0, 0, C.W, C.H);
  };

  Renderer.prototype.panel = function (x, y, w, h, color) {
    var ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,10,26,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color || PAL.cyan;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  };

  P.Renderer = Renderer;
  P.FX = FX;
})();
