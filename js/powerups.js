/* NEON POOL 8 - power-up pickups: spawning, collection, effect bookkeeping */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M;

  var TYPES = {
    LASER: {
      key: 'LASER', label: 'LASER SIGHT', short: 'LSR',
      color: '#3ef2d0', shots: 3,
      desc: 'FULL BANK PREDICTION'
    },
    POWER: {
      key: 'POWER', label: 'OVERDRIVE', short: 'PWR',
      color: '#ff9a3d', shots: 2,
      desc: 'CANNON SHOT +55%'
    },
    MAGNET: {
      key: 'MAGNET', label: 'POCKET MAGNET', short: 'MAG',
      color: '#ff4fd8', shots: 2,
      desc: 'YOUR BALLS GET SUCKED IN'
    },
    WIDE: {
      key: 'WIDE', label: 'WIDE POCKETS', short: 'WID',
      color: '#ffd83d', shots: 2,
      desc: 'POCKETS GROW +45%'
    },
    EXTRA: {
      key: 'EXTRA', label: 'EXTRA TURN', short: 'XTR',
      color: '#4dff88', shots: 1,
      desc: 'OPPONENT SKIPS A TURN'
    },
    SHIELD: {
      key: 'SHIELD', label: 'FOUL SHIELD', short: 'SHD',
      color: '#4d8cff', shots: 1,
      desc: 'NEXT FOUL IS FORGIVEN'
    }
  };
  var TYPE_LIST = Object.keys(TYPES);

  function PowerUps() {
    this.items = [];
    this.timer = 6;
    this.rate = 8;
    this.enabled = true;
  }

  PowerUps.prototype.reset = function (rate) {
    this.items = [];
    this.rate = rate || 8;
    this.timer = Math.min(4, this.rate * 0.5);
  };

  PowerUps.prototype.spawn = function (world) {
    if (this.items.length >= 3) return null;
    for (var attempt = 0; attempt < 220; attempt++) {
      var x = M.rand(C.PX + 46, C.PR - 46);
      var y = M.rand(C.PY + 40, C.PB - 40);
      if (!world.isFree(x, y, null, 16)) continue;
      var tooClose = false;
      for (var i = 0; i < this.items.length; i++) {
        if (M.dist2(x, y, this.items[i].x, this.items[i].y) < 90 * 90) { tooClose = true; break; }
      }
      if (tooClose) continue;
      var t = TYPES[TYPE_LIST[Math.floor(Math.random() * TYPE_LIST.length)]];
      var item = { type: t, x: x, y: y, r: 13, born: 0, life: 26, phase: Math.random() * 6.28 };
      this.items.push(item);
      return item;
    }
    return null;
  };

  /** ticks the pickups. `idle` = balls are at rest (spawn only then). */
  PowerUps.prototype.update = function (dt, world, idle) {
    for (var i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      it.born += dt;
      it.phase += dt * 3;
      if (it.born > it.life) this.items.splice(i, 1);
    }
    if (!this.enabled) return null;
    if (idle) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.rate * M.rand(0.75, 1.35);
        return this.spawn(world);
      }
    }
    return null;
  };

  /** returns the pickup collected by the cue ball this frame, or null */
  PowerUps.prototype.checkCollect = function (cue) {
    if (!cue || !cue.active || cue.pocketAnim > 0) return null;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (M.dist2(cue.x, cue.y, it.x, it.y) < Math.pow(it.r + cue.r, 2)) {
        this.items.splice(i, 1);
        return it;
      }
    }
    return null;
  };

  /* ---------- effect container held by each player ---------- */
  function Effects() { this.map = {}; }

  Effects.prototype.add = function (typeKey) {
    var t = TYPES[typeKey];
    if (!t) return;
    this.map[typeKey] = (this.map[typeKey] || 0) + t.shots;
  };
  Effects.prototype.has = function (k) { return (this.map[k] || 0) > 0; };
  Effects.prototype.count = function (k) { return this.map[k] || 0; };
  Effects.prototype.consume = function (k) {
    if (!this.map[k]) return false;
    this.map[k]--;
    if (this.map[k] <= 0) delete this.map[k];
    return true;
  };
  Effects.prototype.clear = function () { this.map = {}; };
  Effects.prototype.list = function () {
    var out = [];
    for (var k in this.map) if (this.map[k] > 0) out.push({ type: TYPES[k], n: this.map[k] });
    return out;
  };

  P.POWER_TYPES = TYPES;
  P.PowerUps = PowerUps;
  P.Effects = Effects;
})();
