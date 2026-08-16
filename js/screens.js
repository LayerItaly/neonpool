/* NEON POOL 8 - frame composition + full-screen overlays */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M, PAL = P.PAL, F = P.Font;
  var Game = P.Game;

  Game.prototype.draw = function () {
    var ctx = this.ctx;
    var r = this.renderer;

    // start every frame from a known-clean context
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    ctx.save();
    if (r.fx.shake > 0.01) {
      ctx.translate(M.rand(-1, 1) * r.fx.shake * 5, M.rand(-1, 1) * r.fx.shake * 5);
    }

    if (this.state === 'title') {
      this.drawTitle();
      if (this.mouse.inside) r.drawCursor(Math.round(this.mouse.x), Math.round(this.mouse.y));
      ctx.restore();
      return;
    }

    r.drawBackground();
    r.drawTable(this.world, this.state);
    if (this.state === 'inhand') r.drawPlacementZone(this.headStringOnly);
    r.drawPickups(this.powerups);
    r.drawBalls(this.world, this.state === 'inhand');

    var cue = this.world.cue();
    var showAim = (this.state === 'aim');
    var showCue = (this.state === 'aim' || this.state === 'cpuAim' || (this.state === 'shooting' && this.cueThrust > 0.05));

    if (showAim && cue && cue.active) {
      r.drawAim(this.world, cue, this.angle, this.effects.p1.has('LASER'));
    }
    if (this.state === 'cpuAim' && cue && cue.active) {
      r.drawAim(this.world, cue, this.angle, false);
    }
    if (showCue && cue && cue.active) {
      r.drawCue(cue, this.angle, this.power, this.cueThrust, this.spin);
    }
    if (this.state === 'inhand') {
      r.drawGhostCue(this.ghost.x, this.ghost.y, this.ghostLegal());
    }

    r.fx.draw(ctx);
    r.drawHUD(this);

    // state overlays
    if (this.state === 'intro') this.drawIntro();
    else if (this.state === 'levelclear') this.drawLevelClear();
    else if (this.state === 'levelfail') this.drawLevelFail();
    else if (this.state === 'gameover') this.drawGameOver();
    else if (this.state === 'victory') this.drawVictory();
    else if (this.state === 'paused') this.drawPaused();
    else if (this.state === 'help') this.drawHelp();

    // hit flash
    if (this.flashT > 0) {
      ctx.globalAlpha = M.clamp(this.flashT / 0.28, 0, 1) * 0.25;
      ctx.fillStyle = this.flashTint || '#ffffff';
      ctx.fillRect(0, 0, C.W, C.H);
      ctx.globalAlpha = 1;
    }

    if (this.mouse.inside) r.drawCursor(Math.round(this.mouse.x), Math.round(this.mouse.y));

    ctx.restore();
  };

  /* ---------------- title ---------------- */
  Game.prototype.drawTitle = function () {
    var ctx = this.ctx;
    var r = this.renderer;
    r.drawBackground();

    // drifting demo balls
    for (var i = 0; i < this.titleBalls.length; i++) {
      var b = this.titleBalls[i];
      ctx.globalAlpha = 0.30;
      r.drawBall(b);
      ctx.globalAlpha = 1;
    }

    var t = r.t;
    var bob = Math.sin(t * 2) * 4;

    // logo
    F.draw(ctx, 'NEON', C.W / 2 - 158, 96 + bob, { scale: 7, color: PAL.magenta, align: 'center', glow: 26, shadow: 'rgba(0,0,0,0.8)' });
    F.draw(ctx, 'POOL', C.W / 2 + 46, 96 + bob, { scale: 7, color: PAL.cyan, align: 'center', glow: 26, shadow: 'rgba(0,0,0,0.8)' });

    // the 8 ball as the "8"
    var ex = C.W / 2 + 212, ey = 118 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(ex + 4, ey + 6, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(ex, ey, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7f5ec';
    ctx.beginPath(); ctx.arc(ex, ey, 17, 0, Math.PI * 2); ctx.fill();
    F.draw(ctx, '8', ex, ey - 9, { scale: 2.6, color: '#14161f', align: 'center' });
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(ex - 12, ey - 14, 8, 0, Math.PI * 2); ctx.fill();

    F.draw(ctx, 'RETRO ARCADE BILLIARDS', C.W / 2, 176, { scale: 2, color: PAL.yellow, align: 'center', glow: 10 });
    F.draw(ctx, 'PLAYER 1  VS  THE MACHINE', C.W / 2, 202, { scale: 1.6, color: PAL.dim, align: 'center' });

    // panels
    this.renderer.panel(120, 240, 340, 236, PAL.cyan);
    F.draw(ctx, 'CONTROLS', 290, 254, { scale: 2, color: PAL.cyan, align: 'center' });
    var ctrl = [
      ['MOUSE      AIM', PAL.text],
      ['HOLD LMB   CHARGE POWER', PAL.text],
      ['RELEASE    SHOOT', PAL.text],
      ['ARROWS     AIM / POWER', PAL.text],
      ['SPACE      HOLD TO CHARGE', PAL.text],
      ['W / S      TOP / BACK SPIN', PAL.text],
      ['M          MUSIC ' + (this.audio.musicOn ? 'ON' : 'OFF'), this.audio.musicOn ? PAL.green : PAL.dim],
      ['N          SOUND FX ' + (this.audio.sfxOn ? 'ON' : 'OFF'), this.audio.sfxOn ? PAL.green : PAL.dim],
      ['H HELP   P PAUSE   R RETRY', PAL.text]
    ];
    for (var k = 0; k < ctrl.length; k++) {
      F.draw(ctx, ctrl[k][0], 140, 288 + k * 20, { scale: 1.4, color: ctrl[k][1] });
    }

    this.renderer.panel(500, 240, 340, 236, PAL.magenta);
    F.draw(ctx, 'POWER-UPS', 670, 254, { scale: 2, color: PAL.magenta, align: 'center' });
    var keys = Object.keys(P.POWER_TYPES);
    for (k = 0; k < keys.length; k++) {
      var ty = P.POWER_TYPES[keys[k]];
      var yy = 288 + k * 28;
      ctx.strokeStyle = ty.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(518.5, yy - 3.5, 34, 18);
      F.draw(ctx, ty.short, 535, yy + 1, { scale: 1.2, color: ty.color, align: 'center' });
      F.draw(ctx, ty.label, 562, yy - 3, { scale: 1.2, color: PAL.white });
      F.draw(ctx, ty.desc, 562, yy + 8, { scale: 1, color: PAL.dim });
    }

    // prompt
    if (Math.floor(t * 2) % 2 === 0) {
      F.draw(ctx, 'PRESS SPACE OR CLICK TO START', C.W / 2, 494, { scale: 2.4, color: PAL.white, align: 'center', glow: 14 });
    }
    F.draw(ctx, 'HI-SCORE ' + M.formatScore(this.hiScore), C.W / 2, 540, { scale: 2, color: PAL.yellow, align: 'center' });
    F.draw(ctx, '6 STAGES - 3 LIVES - POT YOUR GROUP THEN SINK THE 8', C.W / 2, 576, { scale: 1.2, color: PAL.dim, align: 'center' });
    F.draw(ctx, '(C) 1987 LAYER ARCADE SYSTEMS', C.W / 2, 604, { scale: 1, color: '#3a4470', align: 'center' });
  };

  /* ---------------- stage intro ---------------- */
  Game.prototype.drawIntro = function () {
    var ctx = this.ctx;
    var lv = P.LEVELS[Math.min(this.levelIndex, P.LEVELS.length - 1)];
    var t = this.stateTime;
    var a = t < 1.6 ? 1 : M.clamp(1 - (t - 1.6) / 0.4, 0, 1);
    ctx.globalAlpha = a;
    this.renderer.dim(0.62);
    var w = 520, h = 150;
    this.renderer.panel(C.W / 2 - w / 2, C.H / 2 - h / 2, w, h, PAL.yellow);
    F.draw(ctx, 'STAGE ' + (this.levelIndex + 1), C.W / 2, C.H / 2 - 52, { scale: 2, color: PAL.dim, align: 'center' });
    F.draw(ctx, lv.name, C.W / 2, C.H / 2 - 24, { scale: 4, color: PAL.yellow, align: 'center', glow: 16 });
    F.draw(ctx, lv.sub, C.W / 2, C.H / 2 + 16, { scale: 1.6, color: PAL.text, align: 'center' });
    F.draw(ctx, 'CPU SKILL ' + Math.round(lv.cpu * 100) + '%', C.W / 2, C.H / 2 + 40, { scale: 1.4, color: PAL.magenta, align: 'center' });
    ctx.globalAlpha = 1;
  };

  /* ---------------- stage clear ---------------- */
  Game.prototype.drawLevelClear = function () {
    var ctx = this.ctx;
    this.renderer.dim(0.72);
    var w = 560, h = 300;
    var x = C.W / 2 - w / 2, y = C.H / 2 - h / 2;
    this.renderer.panel(x, y, w, h, PAL.green);
    F.draw(ctx, 'STAGE CLEAR!', C.W / 2, y + 26, { scale: 4, color: PAL.green, align: 'center', glow: 18 });

    var b = this.lastBonus || { eight: 0, level: 0, leftover: 0, time: 0, total: 0 };
    var rows = [
      ['BLACK BALL SUNK', b.eight],
      ['STAGE BONUS', b.level],
      ['CPU BALLS LEFT', b.leftover],
      ['TIME BONUS', b.time]
    ];
    for (var i = 0; i < rows.length; i++) {
      var yy = y + 86 + i * 26;
      F.draw(ctx, rows[i][0], x + 40, yy, { scale: 1.6, color: PAL.text });
      F.draw(ctx, '+' + rows[i][1], x + w - 40, yy, { scale: 1.6, color: PAL.yellow, align: 'right' });
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(x + 40, y + 196.5); ctx.lineTo(x + w - 40, y + 196.5); ctx.stroke();
    F.draw(ctx, 'TOTAL SCORE', x + 40, y + 210, { scale: 2, color: PAL.white });
    F.draw(ctx, M.formatScore(this.score), x + w - 40, y + 210, { scale: 2, color: PAL.cyan, align: 'right' });

    if (Math.floor(this.renderer.t * 2) % 2 === 0) {
      var last = this.levelIndex >= P.LEVELS.length - 1;
      F.draw(ctx, last ? 'PRESS SPACE FOR THE FINAL RESULT' : 'PRESS SPACE FOR NEXT STAGE',
        C.W / 2, y + h - 40, { scale: 1.6, color: PAL.white, align: 'center' });
    }
  };

  /* ---------------- stage failed ---------------- */
  Game.prototype.drawLevelFail = function () {
    var ctx = this.ctx;
    this.renderer.dim(0.72);
    var w = 520, h = 170;
    this.renderer.panel(C.W / 2 - w / 2, C.H / 2 - h / 2, w, h, PAL.red);
    F.draw(ctx, 'STAGE FAILED', C.W / 2, C.H / 2 - 56, { scale: 3.4, color: PAL.red, align: 'center', glow: 16 });
    F.draw(ctx, this.loseReason || '', C.W / 2, C.H / 2 - 12, { scale: 1.6, color: PAL.text, align: 'center' });
    F.draw(ctx, this.lives + ' LIVES LEFT', C.W / 2, C.H / 2 + 16, { scale: 2, color: PAL.yellow, align: 'center' });
    F.draw(ctx, 'RETRYING...', C.W / 2, C.H / 2 + 46, { scale: 1.4, color: PAL.dim, align: 'center' });
  };

  /* ---------------- game over ---------------- */
  Game.prototype.drawGameOver = function () {
    var ctx = this.ctx;
    this.renderer.dim(0.82);
    var w = 520, h = 230;
    this.renderer.panel(C.W / 2 - w / 2, C.H / 2 - h / 2, w, h, PAL.red);
    F.draw(ctx, 'GAME OVER', C.W / 2, C.H / 2 - 84, { scale: 4.6, color: PAL.red, align: 'center', glow: 20 });
    F.draw(ctx, 'FINAL SCORE', C.W / 2, C.H / 2 - 22, { scale: 1.6, color: PAL.dim, align: 'center' });
    F.draw(ctx, M.formatScore(this.score), C.W / 2, C.H / 2 - 2, { scale: 3, color: PAL.cyan, align: 'center' });
    F.draw(ctx, 'BEST COMBO X' + this.bestCombo + '   STAGE ' + (this.levelIndex + 1),
      C.W / 2, C.H / 2 + 38, { scale: 1.4, color: PAL.text, align: 'center' });
    if (this.score >= this.hiScore && this.score > 0) {
      F.draw(ctx, 'NEW HI-SCORE!', C.W / 2, C.H / 2 + 60, { scale: 1.8, color: PAL.yellow, align: 'center', glow: 12 });
    }
    if (Math.floor(this.renderer.t * 2) % 2 === 0) {
      F.draw(ctx, 'PRESS SPACE TO CONTINUE', C.W / 2, C.H / 2 + 88, { scale: 1.6, color: PAL.white, align: 'center' });
    }
  };

  /* ---------------- victory ---------------- */
  Game.prototype.drawVictory = function () {
    var ctx = this.ctx;
    this.renderer.dim(0.8);
    var w = 600, h = 260;
    this.renderer.panel(C.W / 2 - w / 2, C.H / 2 - h / 2, w, h, PAL.yellow);
    var pulse = 1 + Math.sin(this.renderer.t * 5) * 0.03;
    ctx.save();
    ctx.translate(C.W / 2, C.H / 2 - 76);
    ctx.scale(pulse, pulse);
    F.draw(ctx, 'ALL STAGES CLEAR', 0, -14, { scale: 3.6, color: PAL.yellow, align: 'center', glow: 22 });
    ctx.restore();
    F.draw(ctx, 'YOU BEAT THE MACHINE', C.W / 2, C.H / 2 - 34, { scale: 2, color: PAL.green, align: 'center' });
    F.draw(ctx, 'FINAL SCORE', C.W / 2, C.H / 2 + 4, { scale: 1.6, color: PAL.dim, align: 'center' });
    F.draw(ctx, M.formatScore(this.score), C.W / 2, C.H / 2 + 24, { scale: 3.2, color: PAL.cyan, align: 'center', glow: 14 });
    F.draw(ctx, 'BEST COMBO X' + this.bestCombo + '   LIVES LEFT ' + this.lives,
      C.W / 2, C.H / 2 + 68, { scale: 1.4, color: PAL.text, align: 'center' });
    if (Math.floor(this.renderer.t * 2) % 2 === 0) {
      F.draw(ctx, 'PRESS SPACE FOR THE TITLE SCREEN', C.W / 2, C.H / 2 + 96, { scale: 1.6, color: PAL.white, align: 'center' });
    }
  };

  /* ---------------- pause ---------------- */
  Game.prototype.drawPaused = function () {
    var ctx = this.ctx;
    this.renderer.dim(0.7);
    F.draw(ctx, 'PAUSED', C.W / 2, C.H / 2 - 30, { scale: 5, color: PAL.cyan, align: 'center', glow: 18 });
    F.draw(ctx, 'PRESS P TO RESUME   -   H FOR HELP', C.W / 2, C.H / 2 + 26, { scale: 1.6, color: PAL.text, align: 'center' });
  };

  /* ---------------- help ---------------- */
  Game.prototype.drawHelp = function () {
    var ctx = this.ctx;
    this.renderer.dim(0.85);
    var w = 700, h = 524;
    var x = C.W / 2 - w / 2, y = C.H / 2 - h / 2;
    this.renderer.panel(x, y, w, h, PAL.cyan);
    F.draw(ctx, 'HOW TO PLAY', C.W / 2, y + 22, { scale: 3, color: PAL.cyan, align: 'center', glow: 12 });

    var lines = [
      ['RULES', PAL.yellow],
      ['THE TABLE IS OPEN AFTER THE BREAK.', PAL.text],
      ['THE FIRST LEGAL POT DECIDES YOUR GROUP:', PAL.text],
      ['SOLIDS 1-7 OR STRIPES 9-15.', PAL.text],
      ['CLEAR YOUR GROUP, THEN SINK THE 8 TO WIN.', PAL.text],
      ['POT THE 8 EARLY AND YOU LOSE THE STAGE.', PAL.red],
      ['', PAL.text],
      ['FOULS (OPPONENT GETS BALL IN HAND)', PAL.yellow],
      ['SCRATCH - CUE BALL IN A POCKET', PAL.text],
      ['NO CONTACT - YOU HIT NOTHING', PAL.text],
      ['WRONG BALL FIRST - HIT YOUR GROUP FIRST', PAL.text],
      ['', PAL.text],
      ['SCORING', PAL.yellow],
      ['POT +100 X COMBO   POWER-UP +250', PAL.text],
      ['THE 8 +1500   STAGE BONUS +1000 X STAGE', PAL.text],
      ['FOUL -75   WRONG BALL -40', PAL.text],
      ['', PAL.text],
      ['AUDIO', PAL.yellow],
      ['M TOGGLES THE MUSIC - NOW ' + (this.audio.musicOn ? 'ON' : 'OFF'),
        this.audio.musicOn ? PAL.green : PAL.dim],
      ['N TOGGLES THE SOUND FX - NOW ' + (this.audio.sfxOn ? 'ON' : 'OFF'),
        this.audio.sfxOn ? PAL.green : PAL.dim]
    ];
    for (var i = 0; i < lines.length; i++) {
      F.draw(ctx, lines[i][0], x + 30, y + 64 + i * 21, { scale: 1.4, color: lines[i][1] });
    }
    F.draw(ctx, 'PRESS H OR SPACE TO GO BACK', C.W / 2, y + h - 28, { scale: 1.6, color: PAL.white, align: 'center' });
  };
})();
