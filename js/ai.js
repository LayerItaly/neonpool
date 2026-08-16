/* NEON POOL 8 - CPU opponent: ghost-ball shot search with skill-scaled noise */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M;

  var R = C.BALL_R;

  function legalTargets(world, group) {
    var out = [], i, b;
    var mine = [];
    for (i = 0; i < world.balls.length; i++) {
      b = world.balls[i];
      if (!b.active || b.pocketAnim > 0 || b.n === 0) continue;
      if (group === null) { if (b.n !== 8) mine.push(b); }
      else if (b.type === group) mine.push(b);
    }
    if (mine.length) return mine;
    // group cleared -> the 8 is the target
    for (i = 0; i < world.balls.length; i++) {
      b = world.balls[i];
      if (b.active && b.pocketAnim === 0 && b.n === 8) out.push(b);
    }
    return out;
  }

  /**
   * Evaluate every (target, pocket) pair from a given cue position.
   * Returns the best {angle, power, quality, target, pocket} or null.
   */
  function findBestShot(world, cueX, cueY, group, skill) {
    var targets = legalTargets(world, group);
    var cue = world.cue();
    var best = null;

    for (var t = 0; t < targets.length; t++) {
      var ball = targets[t];
      for (var p = 0; p < world.pockets.length; p++) {
        var pk = world.pockets[p];

        var tpx = pk.x - ball.x, tpy = pk.y - ball.y;
        var tpd = Math.hypot(tpx, tpy);
        if (tpd < 1) continue;
        var tux = tpx / tpd, tuy = tpy / tpd;

        // ghost ball position: where the cue ball must be at contact
        var gx = ball.x - tux * (R * 2);
        var gy = ball.y - tuy * (R * 2);

        var cgx = gx - cueX, cgy = gy - cueY;
        var cgd = Math.hypot(cgx, cgy);
        if (cgd < R * 1.2) continue;
        var cux = cgx / cgd, cuy = cgy / cgd;

        // cut angle: cos between cue travel and ball travel
        var cosCut = cux * tux + cuy * tuy;
        if (cosCut < 0.22) continue;               // too thin to be sane

        // is the cue ball's path to the ghost clear?
        var hit = world.raycast(cueX, cueY, cux, cuy, cue, cgd + R * 2.4);
        if (hit.type !== 'ball' || hit.ball !== ball) continue;
        if (hit.dist < cgd - R * 1.6) continue;    // something in the way earlier

        // is the object ball's path to the pocket clear?
        var hit2 = world.raycast(ball.x, ball.y, tux, tuy, ball, tpd + 40);
        if (hit2.type !== 'pocket' || hit2.pocket !== pk) continue;

        // ---- scoring ----
        var q = 1;
        q *= Math.pow(cosCut, 1.25);                       // straighter is better
        q *= 1 / (1 + cgd / 620);                          // shorter cue travel
        q *= 1 / (1 + tpd / 480);                          // shorter object travel
        if (ball.n === 8) q *= 1.35;                       // finish the game
        if (!pk.corner) q *= 1.06;                         // side pockets are handy

        // scratch risk: cue ball deflects along the tangent after contact
        var tanx = -tuy, tany = tux;
        var side = (cux * tanx + cuy * tany) >= 0 ? 1 : -1;
        var defx = tanx * side, defy = tany * side;
        var srisk = world.raycast(gx, gy, defx, defy, cue, 340);
        if (srisk.type === 'pocket') q *= 0.30;

        if (best === null || q > best.quality) {
          var dist = cgd + tpd;
          var v0 = M.clamp(C.FRICTION * (cgd + tpd * 2.05) * 2.0 + 260, 320, C.MAX_SPEED);
          best = {
            angle: Math.atan2(cuy, cux),
            power: M.clamp((v0 - C.MIN_SPEED) / (C.MAX_SPEED - C.MIN_SPEED), 0.16, 1),
            quality: q,
            target: ball,
            pocket: pk,
            dist: dist
          };
        }
      }
    }
    return best;
  }

  /** last-resort: nudge the nearest legal ball, keep it safe-ish */
  function safetyShot(world, cueX, cueY, group) {
    var targets = legalTargets(world, group);
    var cue = world.cue();
    var best = null;
    for (var i = 0; i < targets.length; i++) {
      var b = targets[i];
      var dx = b.x - cueX, dy = b.y - cueY;
      var d = Math.hypot(dx, dy) || 1;
      var hit = world.raycast(cueX, cueY, dx / d, dy / d, cue, d + 30);
      var clear = (hit.type === 'ball' && hit.ball === b);
      var q = (clear ? 2 : 0.4) / (1 + d / 400);
      if (!best || q > best.quality) {
        best = {
          angle: Math.atan2(dy, dx),
          power: M.clamp(0.30 + d / 1600, 0.22, 0.6),
          quality: q, target: b, pocket: null, dist: d, safety: true
        };
      }
    }
    if (!best) {
      best = { angle: M.rand(0, Math.PI * 2), power: 0.4, quality: 0, target: null, pocket: null, safety: true };
    }
    return best;
  }

  var AI = {
    /**
     * Decide a shot. Returns {angle, power, spin, ballInHand:{x,y}|null, info}
     */
    think: function (world, group, skill, ballInHand, isBreak) {
      var cue = world.cue();
      var placement = null;
      var shot;

      if (isBreak) {
        var bx = C.PX + C.PW * 0.20, by = C.CY + M.rand(-26, 26);
        var spot = world.findSpot(bx, by, cue);
        placement = spot;
        // aim at the rack apex-ish
        var apex = null, bestX = Infinity;
        for (var i = 0; i < world.balls.length; i++) {
          var b = world.balls[i];
          if (b.n !== 0 && b.active && b.x < bestX) { bestX = b.x; apex = b; }
        }
        var ang = apex ? Math.atan2(apex.y - spot.y, apex.x - spot.x) : 0;
        return {
          angle: ang + M.rand(-0.02, 0.02),
          power: M.rand(0.88, 1),
          spin: 0,
          ballInHand: placement,
          info: 'BREAK'
        };
      }

      if (ballInHand) {
        // sample candidate cue positions, keep the one with the best shot
        var bestPlace = null, bestShot = null;
        var candidates = [];
        var k;
        for (k = 0; k < 46; k++) {
          candidates.push({
            x: M.rand(C.PX + 24, C.PR - 24),
            y: M.rand(C.PY + 24, C.PB - 24)
          });
        }
        // plus a few sensible anchors
        candidates.push({ x: C.PX + C.PW * 0.2, y: C.CY });
        candidates.push({ x: C.PX + C.PW * 0.5, y: C.PY + 44 });
        candidates.push({ x: C.PX + C.PW * 0.5, y: C.PB - 44 });

        for (k = 0; k < candidates.length; k++) {
          var c = candidates[k];
          if (!world.isFree(c.x, c.y, cue, 3)) continue;
          var s = findBestShot(world, c.x, c.y, group, skill);
          if (s && (!bestShot || s.quality > bestShot.quality)) { bestShot = s; bestPlace = c; }
        }
        if (bestShot) {
          placement = bestPlace;
          shot = bestShot;
        } else {
          placement = world.findSpot(C.PX + C.PW * 0.35, C.CY, cue);
          shot = safetyShot(world, placement.x, placement.y, group);
        }
      } else {
        shot = findBestShot(world, cue.x, cue.y, group, skill);
        if (!shot) shot = safetyShot(world, cue.x, cue.y, group);
      }

      // skill-scaled aiming error; harder cuts wobble more
      var err = (1 - skill) * 0.075;
      err *= (0.6 + 0.9 * Math.min(1, (shot.dist || 300) / 500));
      var noise = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~gaussian
      var angle = shot.angle + noise * err;

      var powerNoise = 1 + (1 - skill) * M.rand(-0.14, 0.14);
      var power = M.clamp(shot.power * powerNoise, 0.14, 1);

      // a confident CPU uses draw to avoid following the object ball in
      var spin = 0;
      if (!shot.safety && Math.random() < skill * 0.7) spin = -M.rand(0.3, 0.85);

      return {
        angle: angle,
        power: power,
        spin: spin,
        ballInHand: placement,
        info: shot.safety ? 'SAFETY' : (shot.target && shot.target.n === 8 ? 'GOING FOR THE 8' : 'POTTING ' + (shot.target ? shot.target.n : '?'))
      };
    },

    findBestShot: findBestShot
  };

  P.AI = AI;
})();
