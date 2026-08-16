/* NEON POOL 8 - procedural chiptune SFX + music (WebAudio, zero assets) */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});

  var PREF_KEY = 'neonpool8.audio';
  var SFX_LEVEL = 0.9;
  var MUSIC_LEVEL = 0.30;

  function Audio() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.sfxOn = true;
    this.musicOn = true;
    this._noiseBuf = null;
    this._musicTimer = null;
    this._step = 0;
    this._lastPlay = {};
    this.loadPrefs();
  }

  /* ---------------- persisted preferences ---------------- */
  Audio.prototype.loadPrefs = function () {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      this.sfxOn = o.sfx !== false;
      this.musicOn = o.music !== false;
    } catch (e) { /* no storage: keep defaults */ }
  };

  Audio.prototype.savePrefs = function () {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ sfx: this.sfxOn, music: this.musicOn }));
    } catch (e) { /* private mode: ignore */ }
  };

  Audio.prototype.init = function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? SFX_LEVEL : 0;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? MUSIC_LEVEL : 0;
    this.musicBus.connect(this.master);

    // pre-baked white noise for impacts
    var len = Math.floor(this.ctx.sampleRate * 0.5);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
  };

  Audio.prototype.resume = function () {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  /* ---------------- independent channel switches ---------------- */
  Audio.prototype.setSfx = function (on) {
    this.init();
    this.sfxOn = !!on;
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxOn ? SFX_LEVEL : 0;
    this.savePrefs();
    if (this.sfxOn) this.ui();   // audible confirmation when switching back on
    return this.sfxOn;
  };

  Audio.prototype.setMusic = function (on) {
    this.init();
    this.musicOn = !!on;
    if (this.musicBus) this.musicBus.gain.value = this.musicOn ? MUSIC_LEVEL : 0;
    if (this.musicOn) this.startMusic(); else this.stopMusic();
    this.savePrefs();
    return this.musicOn;
  };

  Audio.prototype.toggleSfx = function () { return this.setSfx(!this.sfxOn); };
  Audio.prototype.toggleMusic = function () { return this.setMusic(!this.musicOn); };

  /** true when both channels are silent */
  Audio.prototype.isSilent = function () { return !this.sfxOn && !this.musicOn; };

  Audio.prototype._t = function () { return this.ctx.currentTime; };

  /* --- primitive: pitched blip --- */
  Audio.prototype.tone = function (o) {
    if (!this.ctx) return;
    var bus = o.bus || this.sfxBus;
    if (bus === this.musicBus ? !this.musicOn : !this.sfxOn) return;
    var t0 = this._t() + (o.delay || 0);
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    var vol = (o.vol === undefined ? 0.3 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, o.dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  };

  /* --- primitive: filtered noise burst --- */
  Audio.prototype.noise = function (o) {
    if (!this.ctx || !this.sfxOn) return;
    var t0 = this._t() + (o.delay || 0);
    var src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    var f = this.ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.to), t0 + o.dur);
    f.Q.value = o.q === undefined ? 1.2 : o.q;
    var g = this.ctx.createGain();
    var vol = (o.vol === undefined ? 0.25 : o.vol);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  };

  /* throttle helper so 12 simultaneous clicks don't blow the mix */
  Audio.prototype._gate = function (key, ms) {
    var n = performance.now();
    if (this._lastPlay[key] && n - this._lastPlay[key] < ms) return false;
    this._lastPlay[key] = n;
    return true;
  };

  /* ---------------- game sounds ---------------- */

  Audio.prototype.cueStrike = function (power) {
    if (!this.ctx) return;
    var p = Math.max(0.12, Math.min(1, power));
    this.noise({ freq: 2600 - 900 * p, to: 700, dur: 0.07, vol: 0.30 * (0.5 + p), q: 0.7 });
    this.tone({ type: 'triangle', freq: 220 + 260 * p, to: 90, dur: 0.10, vol: 0.16 * p });
  };

  Audio.prototype.ballClick = function (speed) {
    if (!this.ctx) return;
    if (!this._gate('click', 22)) return;
    var s = Math.min(1, speed / 900);
    this.noise({ freq: 1500 + 2600 * s, to: 900, dur: 0.035 + 0.02 * s, vol: 0.10 + 0.22 * s, q: 2.4 });
    this.tone({ type: 'square', freq: 620 + 700 * s, to: 300, dur: 0.03, vol: 0.05 + 0.08 * s });
  };

  Audio.prototype.cushion = function (speed) {
    if (!this.ctx) return;
    if (!this._gate('rail', 30)) return;
    var s = Math.min(1, speed / 900);
    this.noise({ filter: 'lowpass', freq: 420 + 700 * s, to: 160, dur: 0.09, vol: 0.09 + 0.16 * s, q: 0.6 });
  };

  Audio.prototype.wall = function (speed) {
    if (!this.ctx) return;
    if (!this._gate('wall', 30)) return;
    var s = Math.min(1, speed / 900);
    this.tone({ type: 'square', freq: 180 + 260 * s, to: 70, dur: 0.08, vol: 0.06 + 0.10 * s });
  };

  Audio.prototype.pocket = function () {
    if (!this.ctx) return;
    this.noise({ filter: 'lowpass', freq: 900, to: 120, dur: 0.22, vol: 0.20 });
    this.tone({ type: 'square', freq: 500, to: 110, dur: 0.20, vol: 0.16 });
    this.tone({ type: 'square', freq: 760, to: 180, dur: 0.16, vol: 0.09, delay: 0.03 });
  };

  Audio.prototype.scratch = function () {
    if (!this.ctx) return;
    this.tone({ type: 'sawtooth', freq: 300, to: 70, dur: 0.34, vol: 0.20 });
    this.tone({ type: 'square', freq: 150, to: 55, dur: 0.40, vol: 0.14, delay: 0.05 });
  };

  Audio.prototype.foul = function () {
    if (!this.ctx) return;
    this.tone({ type: 'sawtooth', freq: 170, dur: 0.13, vol: 0.20 });
    this.tone({ type: 'sawtooth', freq: 130, dur: 0.20, vol: 0.20, delay: 0.14 });
  };

  Audio.prototype.powerup = function () {
    if (!this.ctx) return;
    var seq = [523, 659, 784, 1047, 1319];
    for (var i = 0; i < seq.length; i++) {
      this.tone({ type: 'square', freq: seq[i], dur: 0.09, vol: 0.16, delay: i * 0.05 });
    }
  };

  Audio.prototype.spawn = function () {
    if (!this.ctx) return;
    this.tone({ type: 'triangle', freq: 880, to: 1400, dur: 0.14, vol: 0.10 });
  };

  Audio.prototype.ui = function () {
    if (!this.ctx) return;
    this.tone({ type: 'square', freq: 720, dur: 0.05, vol: 0.12 });
  };

  Audio.prototype.charge = function (level) {
    if (!this.ctx) return;
    if (!this._gate('charge', 55)) return;
    this.tone({ type: 'square', freq: 240 + 620 * level, dur: 0.045, vol: 0.055 });
  };

  Audio.prototype.combo = function (n) {
    if (!this.ctx) return;
    var base = 660 * Math.pow(1.12, Math.min(8, n));
    this.tone({ type: 'square', freq: base, dur: 0.08, vol: 0.14 });
    this.tone({ type: 'square', freq: base * 1.5, dur: 0.08, vol: 0.09, delay: 0.06 });
  };

  Audio.prototype.win = function () {
    if (!this.ctx) return;
    var seq = [523, 659, 784, 1047, 784, 1047, 1319];
    for (var i = 0; i < seq.length; i++) {
      this.tone({ type: 'square', freq: seq[i], dur: 0.16, vol: 0.20, delay: i * 0.11 });
      this.tone({ type: 'triangle', freq: seq[i] / 2, dur: 0.18, vol: 0.10, delay: i * 0.11 });
    }
  };

  Audio.prototype.lose = function () {
    if (!this.ctx) return;
    var seq = [392, 349, 311, 233];
    for (var i = 0; i < seq.length; i++) {
      this.tone({ type: 'sawtooth', freq: seq[i], dur: 0.26, vol: 0.18, delay: i * 0.17 });
    }
  };

  Audio.prototype.levelUp = function () {
    if (!this.ctx) return;
    var seq = [440, 554, 659, 880];
    for (var i = 0; i < seq.length; i++) {
      this.tone({ type: 'square', freq: seq[i], dur: 0.12, vol: 0.18, delay: i * 0.08 });
    }
  };

  /* ---------------- background music ---------------- */
  // 16-step minor groove: bass + arpeggio. Simple, loops forever, cheap.
  var BASS = [55, 55, 0, 82.4, 0, 55, 0, 73.4, 65.4, 0, 65.4, 0, 49, 0, 49, 61.7];
  var ARP = [440, 523, 659, 523, 587, 698, 587, 523, 494, 587, 740, 587, 392, 494, 587, 494];

  Audio.prototype.startMusic = function () {
    var self = this;
    this.init();
    if (!this.ctx || this._musicTimer || !this.musicOn) return;
    var stepMs = 132;
    this._musicTimer = setInterval(function () {
      if (!self.musicOn || !self.ctx) return;
      var s = self._step % 16;
      var b = BASS[s];
      if (b) {
        self.tone({ type: 'triangle', freq: b, dur: 0.20, vol: 0.30, bus: self.musicBus });
        self.tone({ type: 'square', freq: b * 2, dur: 0.10, vol: 0.07, bus: self.musicBus });
      }
      if (s % 2 === 0) {
        self.tone({ type: 'square', freq: ARP[s], dur: 0.11, vol: 0.09, bus: self.musicBus });
      }
      if (s % 4 === 2) {
        // soft hat
        var t0 = self._t();
        var src = self.ctx.createBufferSource();
        src.buffer = self._noiseBuf;
        var f = self.ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 7000;
        var g = self.ctx.createGain();
        g.gain.setValueAtTime(0.05, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        src.connect(f); f.connect(g); g.connect(self.musicBus);
        src.start(t0); src.stop(t0 + 0.06);
      }
      self._step++;
    }, stepMs);
  };

  Audio.prototype.stopMusic = function () {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  };

  P.Audio = Audio;
})();
