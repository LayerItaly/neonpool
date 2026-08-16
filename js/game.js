/* NEON POOL 8 - game state machine, 8-ball rules, scoring, input */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M, PAL = P.PAL, F = P.Font;

  var HI_KEY = 'neonpool8.hiscore';

  var SCORE = {
    POT: 100,
    OPPONENT_POT: -40,
    EIGHT: 1500,
    FOUL: -75,
    POWERUP: 250,
    LEVEL: 1000,
    LEFTOVER: 150
  };

  function Game(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.audio = new P.Audio();
    this.renderer = new P.Renderer(ctx);
    this.world = new P.World();
    this.powerups = new P.PowerUps();

    this.state = 'title';
    this.stateTime = 0;
    this.prevState = null;

    this.levelIndex = 0;
    this.lives = 3;
    this.score = 0;
    this.cpuScore = 0;
    this.hiScore = this.loadHi();

    this.turn = 'p1';
    this.groups = { p1: null, cpu: null };
    this.open = true;
    this.combo = 0;
    this.bestCombo = 0;

    this.angle = 0;
    this.power = 0.55;
    this.spin = 0;
    this.charging = false;
    this.cueThrust = 0;

    this.ballInHand = false;
    this.headStringOnly = false;
    this.isBreak = true;

    this.skipNext = { p1: false, cpu: false };
    this.effects = { p1: new P.Effects(), cpu: new P.Effects() };
    this.shotEffects = [];

    this.status = '';
    this.hint = '';
    this.statusColor = PAL.text;

    this.mouse = { x: C.W / 2, y: C.H / 2, inside: false };
    this.keys = {};
    this.ghost = { x: C.PX + C.PW * 0.2, y: C.CY };

    this.shot = null;
    this.cpuPlan = null;
    this.levelStart = 0;
    this.titleBalls = [];
    this.pendingResult = null;
    this.flashTint = null;
    this.flashT = 0;

    this.buildTitleBalls();
  }

  /* ---------------- persistence ---------------- */
  Game.prototype.loadHi = function () {
    try { return parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0; }
    catch (e) { return 0; }
  };
  Game.prototype.saveHi = function () {
    try {
      if (this.score > this.hiScore) {
        this.hiScore = this.score;
        localStorage.setItem(HI_KEY, String(this.hiScore));
      }
    } catch (e) { /* private mode: ignore */ }
  };

  /* ---------------- flow ---------------- */
  Game.prototype.buildTitleBalls = function () {
    this.titleBalls = [];
    for (var i = 1; i <= 15; i++) {
      this.titleBalls.push({
        n: i,
        x: M.rand(60, C.W - 60), y: M.rand(60, C.H - 60),
        vx: M.rand(-70, 70), vy: M.rand(-50, 50),
        r: 9, rollAngle: M.rand(0, 6), rollDir: 0,
        color: P.BALL_COLORS[i], stripe: i > 8, active: true, pocketAnim: 0
      });
    }
  };

  Game.prototype.setState = function (s) {
    this.prevState = this.state;
    this.state = s;
    this.stateTime = 0;
  };

  Game.prototype.startGame = function () {
    this.levelIndex = 0;
    this.lives = 3;
    this.score = 0;
    this.cpuScore = 0;
    this.bestCombo = 0;
    this.startLevel();
  };

  Game.prototype.startLevel = function () {
    var lv = P.buildLevel(this.world, this.levelIndex);
    this.world.pocketScale = 1;
    this.world.magnetGroup = null;
    this.world.events = [];
    this.powerups.reset(lv.powerRate);
    this.groups = { p1: null, cpu: null };
    this.open = true;
    this.turn = 'p1';
    this.combo = 0;
    this.isBreak = true;
    this.ballInHand = true;
    this.headStringOnly = true;
    this.skipNext = { p1: false, cpu: false };
    this.effects.p1.clear();
    this.effects.cpu.clear();
    this.power = 0.85;
    this.spin = 0;
    this.angle = 0;
    this.ghost.x = C.PX + C.PW * 0.18;
    this.ghost.y = C.CY;
    this.levelStart = P.now();
    this.setState('intro');
  };

  Game.prototype.beginTurn = function () {
    var who = this.turn;
    if (this.skipNext[who]) {
      this.skipNext[who] = false;
      this.say(who === 'p1' ? 'TURN SKIPPED!' : 'CPU LOSES A TURN!', PAL.green,
               who === 'p1' ? 'THE CPU STOLE YOUR SHOT' : 'EXTRA TURN POWER-UP');
      this.renderer.fx.text(C.PX + C.PW / 2, C.CY - 70,
        who === 'p1' ? 'YOUR TURN IS SKIPPED' : 'CPU SKIPS A TURN', PAL.green, 2.4);
      this.audio.powerup();
      this.turn = who === 'p1' ? 'cpu' : 'p1';
      this.beginTurn();
      return;
    }
    this.combo = 0;
    if (this.turn === 'p1') {
      if (this.ballInHand) {
        this.say('BALL IN HAND', PAL.yellow, 'MOVE THE MOUSE, CLICK TO PLACE');
        this.setState('inhand');
      } else {
        this.say(this.isBreak ? 'BREAK!' : 'YOUR SHOT', PAL.cyan, 'HOLD MOUSE OR SPACE TO CHARGE, RELEASE TO FIRE');
        this.setState('aim');
      }
    } else {
      this.say('CPU IS THINKING', PAL.magenta, 'STAND BY...');
      this.setState('cpuThink');
    }
  };

  Game.prototype.say = function (msg, color, hint) {
    this.status = msg;
    this.statusColor = color || PAL.text;
    this.hint = hint || '';
  };

  /* ---------------- shooting ---------------- */
  Game.prototype.currentEffects = function () { return this.effects[this.turn]; };

  Game.prototype.applyShot = function (angle, power, spin) {
    var cue = this.world.cue();
    if (!cue || !cue.active) return;

    var eff = this.currentEffects();
    this.shotEffects = [];
    var maxSpeed = C.MAX_SPEED;

    if (eff.has('POWER')) { maxSpeed *= 1.55; this.shotEffects.push('POWER'); }
    if (eff.has('WIDE')) { this.world.pocketScale = 1.45; this.shotEffects.push('WIDE'); }
    else this.world.pocketScale = 1;
    if (eff.has('MAGNET')) {
      this.world.magnetGroup = this.groups[this.turn];
      this.shotEffects.push('MAGNET');
    } else this.world.magnetGroup = null;
    if (eff.has('LASER')) this.shotEffects.push('LASER');

    var v = M.lerp(C.MIN_SPEED, maxSpeed, M.clamp(power, 0, 1));
    cue.vx = Math.cos(angle) * v;
    cue.vy = Math.sin(angle) * v;
    cue.spin = spin;

    this.shot = {
      shooter: this.turn,
      firstContact: null,
      potted: [],
      cueScratch: false,
      railAfter: false,
      wasBreak: this.isBreak,
      wasOpen: this.open
    };

    this.cueThrust = 1;
    this.audio.cueStrike(power);
    this.renderer.fx.burst(cue.x - Math.cos(angle) * 12, cue.y - Math.sin(angle) * 12, '#ffffff', 6, 90);
    this.renderer.fx.shake = Math.min(1, power) * 0.5;
    this.world.events = [];
    this.say(this.turn === 'p1' ? 'IN PLAY...' : 'CPU SHOOTS...', PAL.text, '');
    this.setState('shooting');
  };

  Game.prototype.processEvents = function () {
    var evs = this.world.events;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.type === 'ball') {
        this.audio.ballClick(e.speed);
        if (e.speed > 120) {
          var mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
          this.renderer.fx.burst(mx, my, '#ffffff', 3, 70);
        }
        if (this.shot && !this.shot.firstContact) {
          var other = e.a.n === 0 ? e.b : (e.b.n === 0 ? e.a : null);
          if (other) this.shot.firstContact = other;
        }
      } else if (e.type === 'cushion') {
        this.audio.cushion(e.speed);
        if (this.shot && this.shot.firstContact) this.shot.railAfter = true;
      } else if (e.type === 'wall') {
        this.audio.wall(e.speed);
      } else if (e.type === 'bumper') {
        this.audio.wall(e.speed * 1.2);
        this.renderer.fx.burst(e.ball.x, e.ball.y, '#ff4fd8', 6, 130);
      } else if (e.type === 'pocket') {
        this.onPocket(e.ball, e.pocket);
      }
    }
    this.world.events = [];
  };

  Game.prototype.onPocket = function (ball, pocket) {
    this.audio.pocket();
    this.renderer.fx.ring(pocket.x, pocket.y, '#ffd83d', 40);
    this.renderer.fx.burst(pocket.x, pocket.y, ball.color, 10, 150);
    this.renderer.fx.shake = 0.6;

    if (!this.shot) return;
    if (ball.n === 0) {
      this.shot.cueScratch = true;
      this.audio.scratch();
      this.renderer.fx.text(pocket.x, pocket.y - 26, 'SCRATCH!', PAL.red, 2);
      return;
    }
    this.shot.potted.push(ball);

    var shooter = this.shot.shooter;
    var myGroup = this.groups[shooter];
    var mine = (myGroup === null) ? (ball.n !== 8) : (ball.type === myGroup);

    if (ball.n === 8) {
      this.renderer.fx.text(pocket.x, pocket.y - 26, 'THE 8!', PAL.yellow, 2.4);
      return;
    }

    if (mine) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      var pts = SCORE.POT * this.combo;
      if (shooter === 'p1') { this.score += pts; this.renderer.fx.text(pocket.x, pocket.y - 26, '+' + pts, PAL.cyan, 2); }
      else { this.cpuScore += pts; this.renderer.fx.text(pocket.x, pocket.y - 26, '+' + pts, PAL.magenta, 2); }
      if (this.combo > 1) this.audio.combo(this.combo);
    } else {
      if (shooter === 'p1') {
        this.score = Math.max(0, this.score + SCORE.OPPONENT_POT);
        this.renderer.fx.text(pocket.x, pocket.y - 26, 'WRONG BALL', PAL.red, 1.6);
      } else {
        this.cpuScore = Math.max(0, this.cpuScore + SCORE.OPPONENT_POT);
      }
    }
  };

  Game.prototype.groupCleared = function (who) {
    var g = this.groups[who];
    if (!g) return false;
    for (var i = 0; i < this.world.balls.length; i++) {
      var b = this.world.balls[i];
      if (b.active && b.pocketAnim === 0 && b.type === g) return false;
    }
    return true;
  };

  Game.prototype.countGroup = function (group) {
    var n = 0;
    for (var i = 0; i < this.world.balls.length; i++) {
      var b = this.world.balls[i];
      if (b.active && b.pocketAnim === 0 && b.type === group) n++;
    }
    return n;
  };

  /* ---------------- turn resolution (8-ball rules) ---------------- */
  Game.prototype.resolveShot = function () {
    var s = this.shot;
    if (!s) { this.beginTurn(); return; }
    var shooter = s.shooter;
    var opponent = shooter === 'p1' ? 'cpu' : 'p1';
    var world = this.world;
    var eff = this.effects[shooter];
    var i;

    // burn one charge of every per-shot effect that was live at shot time
    for (i = 0; i < this.shotEffects.length; i++) {
      var k = this.shotEffects[i];
      if (k !== 'LASER' && k !== 'POWER' && k !== 'MAGNET' && k !== 'WIDE') continue;
      eff.consume(k);
    }
    this.shotEffects = [];
    world.pocketScale = 1;
    world.magnetGroup = null;

    var eightPotted = false, potted8Ball = null;
    var legalPots = [];
    for (i = 0; i < s.potted.length; i++) {
      if (s.potted[i].n === 8) { eightPotted = true; potted8Ball = s.potted[i]; }
      else legalPots.push(s.potted[i]);
    }

    /* --- 8 on the break: just respot it, play on --- */
    if (eightPotted && s.wasBreak) {
      var spot = world.findSpot(C.FOOT_X, C.CY, potted8Ball);
      potted8Ball.active = true;
      potted8Ball.pocketAnim = 0;
      potted8Ball.pocketAt = null;
      potted8Ball.x = spot.x; potted8Ball.y = spot.y;
      potted8Ball.vx = 0; potted8Ball.vy = 0;
      eightPotted = false;
      this.renderer.fx.text(spot.x, spot.y - 24, 'RESPOT', PAL.yellow, 1.6);
    }

    /* --- group assignment on the first legal pot after the break --- */
    var assignedNow = false;
    if (this.open && !s.wasBreak && legalPots.length && !s.cueScratch) {
      var firstType = legalPots[0].type;
      this.groups[shooter] = firstType;
      this.groups[opponent] = firstType === 'solid' ? 'stripe' : 'solid';
      this.open = false;
      assignedNow = true;
      this.renderer.fx.text(C.PX + C.PW / 2, C.CY - 60,
        (shooter === 'p1' ? 'YOU TAKE ' : 'CPU TAKES ') + (firstType === 'solid' ? 'SOLIDS' : 'STRIPES'),
        shooter === 'p1' ? PAL.cyan : PAL.magenta, 2);
    }

    /* --- foul detection --- */
    var foul = false, reason = '';
    var myGroup = this.groups[shooter];
    var shootingEight = myGroup !== null && this.countGroup(myGroup) === 0;

    if (s.cueScratch) { foul = true; reason = 'SCRATCH'; }
    else if (!s.firstContact) { foul = true; reason = 'NO CONTACT'; }
    else if (!s.wasBreak) {
      var fc = s.firstContact;
      if (shootingEight) {
        if (fc.n !== 8) { foul = true; reason = 'MUST HIT THE 8'; }
      } else if (myGroup) {
        if (fc.type !== myGroup) { foul = true; reason = 'WRONG BALL FIRST'; }
      } else {
        if (fc.n === 8) { foul = true; reason = 'CANNOT HIT THE 8 YET'; }
      }
    }

    /* --- shield forgives one foul --- */
    if (foul && eff.has('SHIELD')) {
      eff.consume('SHIELD');
      foul = false;
      reason = '';
      this.renderer.fx.text(C.PX + C.PW / 2, C.CY, 'FOUL SHIELD USED!', '#4d8cff', 2.2);
      this.audio.powerup();
    }

    /* --- the 8 decides the game --- */
    if (eightPotted) {
      var won = !foul && shootingEight && !s.cueScratch;
      if (won) this.endLevel(shooter === 'p1');
      else this.endLevel(shooter !== 'p1', true);
      return;
    }

    /* --- cue ball respot after a scratch --- */
    if (s.cueScratch) {
      var cue = world.cue();
      cue.active = true;
      cue.pocketAnim = 0;
      cue.pocketAt = null;
      cue.vx = 0; cue.vy = 0;
    }

    if (foul) {
      this.audio.foul();
      this.flash('#ff4d5e');
      if (shooter === 'p1') this.score = Math.max(0, this.score + SCORE.FOUL);
      else this.cpuScore = Math.max(0, this.cpuScore + SCORE.FOUL);
      this.renderer.fx.text(C.PX + C.PW / 2, C.CY - 40, 'FOUL - ' + reason, PAL.red, 2.4);
      this.turn = opponent;
      this.ballInHand = true;
      this.headStringOnly = false;
      this.isBreak = false;
      this.beginTurn();
      return;
    }

    this.isBreak = false;

    /* --- did the shooter earn another shot? --- */
    var pottedOwn = false;
    for (i = 0; i < legalPots.length; i++) {
      var b = legalPots[i];
      var mineNow = this.groups[shooter] === null ? true : (b.type === this.groups[shooter]);
      if (mineNow) pottedOwn = true;
    }
    if (s.wasBreak && legalPots.length) pottedOwn = true;

    if (pottedOwn) {
      this.ballInHand = false;
      this.headStringOnly = false;
      if (this.turn === 'p1') this.say('NICE! SHOOT AGAIN', PAL.green, 'COMBO KEEPS BUILDING');
      this.beginTurn();
    } else {
      this.combo = 0;
      this.turn = opponent;
      this.ballInHand = false;
      this.headStringOnly = false;
      this.beginTurn();
    }
  };

  Game.prototype.flash = function (color) {
    this.flashTint = color;
    this.flashT = 0.28;
  };

  /* ---------------- level end ---------------- */
  Game.prototype.endLevel = function (playerWon, blunder) {
    this.world.stopAll();
    if (playerWon) {
      var elapsed = P.now() - this.levelStart;
      var timeBonus = Math.max(0, Math.round((300 - elapsed)) * 5);
      var leftover = this.countGroup(this.groups.cpu) * SCORE.LEFTOVER;
      var levelBonus = SCORE.LEVEL * (this.levelIndex + 1);
      this.lastBonus = {
        eight: SCORE.EIGHT,
        level: levelBonus,
        leftover: leftover,
        time: timeBonus,
        total: SCORE.EIGHT + levelBonus + leftover + timeBonus
      };
      this.score += this.lastBonus.total;
      this.saveHi();
      this.audio.win();
      this.renderer.fx.shake = 1;
      this.setState('levelclear');
    } else {
      this.lives--;
      this.audio.lose();
      this.loseReason = blunder ? 'YOU POTTED THE 8 TOO EARLY' : 'THE CPU CLEARED THE TABLE';
      this.saveHi();
      if (this.lives <= 0) this.setState('gameover');
      else this.setState('levelfail');
    }
  };

  Game.prototype.nextLevel = function () {
    this.levelIndex++;
    if (this.levelIndex >= P.LEVELS.length) {
      this.saveHi();
      this.setState('victory');
    } else {
      this.startLevel();
    }
  };

  /* ---------------- update ---------------- */
  Game.prototype.update = function (dt) {
    this.stateTime += dt;
    this.renderer.update(dt);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.cueThrust > 0) this.cueThrust = Math.max(0, this.cueThrust - dt * 7);

    switch (this.state) {
      case 'title': this.updateTitle(dt); break;
      case 'intro':
        if (this.stateTime > 2.0) { this.beginTurn(); }
        break;
      case 'inhand': this.updateInHand(dt); break;
      case 'aim': this.updateAim(dt); break;
      case 'shooting': this.updateShooting(dt); break;
      case 'resolve':
        if (this.stateTime > 0.55) this.resolveShot();
        break;
      case 'cpuThink': this.updateCpuThink(dt); break;
      case 'cpuAim': this.updateCpuAim(dt); break;
      case 'levelfail':
        if (this.stateTime > 2.6) { this.startLevel(); }
        break;
      default: break;
    }

    if (this.state === 'aim' || this.state === 'inhand' || this.state === 'cpuThink' || this.state === 'cpuAim') {
      var item = this.powerups.update(dt, this.world, true);
      if (item) { this.audio.spawn(); this.renderer.fx.ring(item.x, item.y, item.type.color, 34); }
    } else {
      this.powerups.update(dt, this.world, false);
    }
  };

  Game.prototype.updateTitle = function (dt) {
    for (var i = 0; i < this.titleBalls.length; i++) {
      var b = this.titleBalls[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rollAngle += dt * 3;
      b.rollDir = Math.atan2(b.vy, b.vx);
      if (b.x < 20 || b.x > C.W - 20) { b.vx *= -1; b.x = M.clamp(b.x, 20, C.W - 20); }
      if (b.y < 20 || b.y > C.H - 20) { b.vy *= -1; b.y = M.clamp(b.y, 20, C.H - 20); }
    }
  };

  Game.prototype.updateInHand = function (dt) {
    // keyboard nudging
    var sp = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 40 : 160;
    if (this.keys['ArrowLeft']) this.ghost.x -= sp * dt;
    if (this.keys['ArrowRight']) this.ghost.x += sp * dt;
    if (this.keys['ArrowUp']) this.ghost.y -= sp * dt;
    if (this.keys['ArrowDown']) this.ghost.y += sp * dt;
    this.ghost.x = M.clamp(this.ghost.x, C.PX + C.BALL_R, C.PR - C.BALL_R);
    this.ghost.y = M.clamp(this.ghost.y, C.PY + C.BALL_R, C.PB - C.BALL_R);
  };

  Game.prototype.ghostLegal = function () {
    var cue = this.world.cue();
    if (!this.world.isFree(this.ghost.x, this.ghost.y, cue, 2)) return false;
    if (this.headStringOnly && this.ghost.x > C.HEAD_STRING) return false;
    return true;
  };

  Game.prototype.placeCue = function () {
    if (!this.ghostLegal()) { this.audio.foul(); return; }
    var cue = this.world.cue();
    cue.x = this.ghost.x; cue.y = this.ghost.y;
    cue.vx = 0; cue.vy = 0;
    cue.active = true; cue.pocketAnim = 0; cue.pocketAt = null;
    this.ballInHand = false;
    this.audio.ui();
    this.renderer.fx.ring(cue.x, cue.y, PAL.cyan, 30);
    this.say(this.isBreak ? 'BREAK!' : 'YOUR SHOT', PAL.cyan, 'HOLD MOUSE OR SPACE TO CHARGE, RELEASE TO FIRE');
    this.setState('aim');
  };

  Game.prototype.updateAim = function (dt) {
    var cue = this.world.cue();
    if (!cue) return;

    // keyboard aiming
    var fine = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 0.22 : 1;
    if (this.keys['ArrowLeft']) this.angle -= 1.5 * fine * dt;
    if (this.keys['ArrowRight']) this.angle += 1.5 * fine * dt;
    if (this.keys['ArrowUp']) this.power = M.clamp(this.power + 0.8 * dt, 0.05, 1);
    if (this.keys['ArrowDown']) this.power = M.clamp(this.power - 0.8 * dt, 0.05, 1);
    if (this.keys['KeyW']) this.spin = M.clamp(this.spin + 1.6 * dt, -1, 1);
    if (this.keys['KeyS']) this.spin = M.clamp(this.spin - 1.6 * dt, -1, 1);

    if (this.charging) {
      this.power = M.clamp(this.power + 0.95 * dt, 0.05, 1);
      this.audio.charge(this.power);
    }
  };

  Game.prototype.updateShooting = function (dt) {
    this.world.step(Math.min(dt, C.MAX_FRAME));
    this.processEvents();

    var got = this.powerups.checkCollect(this.world.cue());
    if (got) this.collect(got);

    this.world.finalisePocketed();

    if (!this.world.anyMoving()) {
      this.world.stopAll();
      this.setState('resolve');
    }
  };

  Game.prototype.collect = function (item) {
    var who = this.shot ? this.shot.shooter : this.turn;
    this.effects[who].add(item.type.key);
    this.audio.powerup();
    this.renderer.fx.ring(item.x, item.y, item.type.color, 60);
    this.renderer.fx.burst(item.x, item.y, item.type.color, 16, 220);
    this.renderer.fx.text(item.x, item.y - 24, item.type.label, item.type.color, 2);
    this.flash(item.type.color);

    if (item.type.key === 'EXTRA') {
      var other = who === 'p1' ? 'cpu' : 'p1';
      this.skipNext[other] = true;
      this.effects[who].consume('EXTRA');
    }
    if (who === 'p1') {
      this.score += SCORE.POWERUP;
      this.renderer.fx.text(item.x, item.y - 44, '+' + SCORE.POWERUP, PAL.yellow, 1.6);
    } else {
      this.cpuScore += SCORE.POWERUP;
    }
  };

  Game.prototype.updateCpuThink = function (dt) {
    if (this.stateTime < 0.75) return;
    var lv = P.LEVELS[Math.min(this.levelIndex, P.LEVELS.length - 1)];
    var skill = lv.cpu;
    if (this.effects.cpu.has('LASER')) skill = Math.min(0.98, skill + 0.12);

    var plan = P.AI.think(this.world, this.groups.cpu, skill, this.ballInHand, this.isBreak);
    if (plan.ballInHand) {
      var cue = this.world.cue();
      cue.x = plan.ballInHand.x;
      cue.y = plan.ballInHand.y;
      cue.vx = 0; cue.vy = 0;
      cue.active = true; cue.pocketAnim = 0; cue.pocketAt = null;
      this.ballInHand = false;
      this.renderer.fx.ring(cue.x, cue.y, PAL.magenta, 30);
      this.audio.ui();
    }
    this.cpuPlan = plan;
    this.angle = plan.angle;
    this.power = 0;
    this.spin = plan.spin;
    this.say('CPU: ' + plan.info, PAL.magenta, 'LINING UP THE CUE...');
    this.setState('cpuAim');
  };

  Game.prototype.updateCpuAim = function (dt) {
    var plan = this.cpuPlan;
    if (!plan) { this.setState('cpuThink'); return; }
    var t = Math.min(1, this.stateTime / 0.85);
    this.power = plan.power * t;
    if (t >= 1) {
      this.applyShot(plan.angle, plan.power, plan.spin);
      this.cpuPlan = null;
    }
  };

  /* ---------------- input ---------------- */
  Game.prototype.onMouseMove = function (x, y) {
    this.mouse.x = x; this.mouse.y = y; this.mouse.inside = true;
    if (this.state === 'aim') {
      var cue = this.world.cue();
      if (cue) this.angle = Math.atan2(y - cue.y, x - cue.x);
    } else if (this.state === 'inhand') {
      this.ghost.x = M.clamp(x, C.PX + C.BALL_R, C.PR - C.BALL_R);
      this.ghost.y = M.clamp(y, C.PY + C.BALL_R, C.PB - C.BALL_R);
    }
  };

  Game.prototype.onMouseDown = function () {
    this.audio.resume();
    switch (this.state) {
      case 'title': this.startGame(); this.audio.ui(); break;
      case 'aim':
        this.charging = true;
        this.power = 0.05;
        break;
      case 'inhand': this.placeCue(); break;
      case 'levelclear': this.nextLevel(); this.audio.ui(); break;
      case 'gameover': this.setState('title'); this.audio.ui(); break;
      case 'victory': this.setState('title'); this.audio.ui(); break;
      case 'help': this.setState(this.prevState || 'title'); break;
      default: break;
    }
  };

  Game.prototype.onMouseUp = function () {
    if (this.state === 'aim' && this.charging) {
      this.charging = false;
      this.applyShot(this.angle, this.power, this.spin);
    }
  };

  Game.prototype.onKeyDown = function (code, e) {
    this.audio.resume();
    this.keys[code] = true;

    if (code === 'KeyM') {
      var mOn = this.audio.toggleMusic();
      this.say('MUSIC ' + (mOn ? 'ON' : 'OFF'), mOn ? PAL.green : PAL.dim, this.hint);
      this.renderer.fx.text(C.PX + C.PW / 2, C.CY, 'MUSIC ' + (mOn ? 'ON' : 'OFF'),
        mOn ? PAL.green : PAL.dim, 2);
      return;
    }
    if (code === 'KeyN') {
      var sOn = this.audio.toggleSfx();
      this.say('SOUND FX ' + (sOn ? 'ON' : 'OFF'), sOn ? PAL.green : PAL.dim, this.hint);
      this.renderer.fx.text(C.PX + C.PW / 2, C.CY, 'SOUND FX ' + (sOn ? 'ON' : 'OFF'),
        sOn ? PAL.green : PAL.dim, 2);
      return;
    }
    if (code === 'KeyH') {
      if (this.state === 'help') this.setState(this.prevState || 'title');
      else this.setState('help');
      return;
    }
    if (code === 'KeyP') {
      if (this.state === 'paused') { this.setState(this.prevState || 'aim'); }
      else if (this.state !== 'title' && this.state !== 'gameover' && this.state !== 'victory') { this.setState('paused'); }
      return;
    }
    if (this.state === 'paused') return;

    if (code === 'KeyR' && (this.state === 'aim' || this.state === 'inhand')) {
      this.lives--;
      if (this.lives <= 0) { this.setState('gameover'); }
      else { this.startLevel(); }
      return;
    }

    switch (this.state) {
      case 'title':
        if (code === 'Enter' || code === 'Space') { this.startGame(); this.audio.ui(); }
        break;
      case 'aim':
        if (code === 'Space' && !this.charging) { this.charging = true; this.power = 0.05; }
        break;
      case 'inhand':
        if (code === 'Space' || code === 'Enter') this.placeCue();
        break;
      case 'levelclear':
        if (code === 'Enter' || code === 'Space') { this.nextLevel(); this.audio.ui(); }
        break;
      case 'gameover':
      case 'victory':
        if (code === 'Enter' || code === 'Space') { this.setState('title'); this.audio.ui(); }
        break;
      case 'help':
        if (code === 'Enter' || code === 'Space' || code === 'Escape') this.setState(this.prevState || 'title');
        break;
      default: break;
    }
  };

  Game.prototype.onKeyUp = function (code) {
    this.keys[code] = false;
    if (code === 'Space' && this.state === 'aim' && this.charging) {
      this.charging = false;
      this.applyShot(this.angle, this.power, this.spin);
    }
  };

  P.Game = Game;
  P.SCORE = SCORE;
})();
