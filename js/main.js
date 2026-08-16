/* NEON POOL 8 - boot, main loop, DOM input plumbing */
(function () {
  'use strict';

  var P = window.POOL;
  var C = P.C;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  var game = new P.Game(canvas, ctx);
  window.__POOL_GAME = game;

  /* ---- map DOM coords to canvas coords ---- */
  function toCanvas(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = C.W / rect.width;
    var sy = C.H / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  canvas.addEventListener('mousemove', function (e) {
    var p = toCanvas(e.clientX, e.clientY);
    game.onMouseMove(p.x, p.y);
  });
  canvas.addEventListener('mouseleave', function () { game.mouse.inside = false; });
  canvas.addEventListener('mouseenter', function () { game.mouse.inside = true; });

  canvas.addEventListener('mousedown', function (e) {
    e.preventDefault();
    if (e.button === 0) game.onMouseDown();
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) game.onMouseUp();
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---- touch: drag to aim, release to shoot ---- */
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var p = toCanvas(t.clientX, t.clientY);
    game.onMouseMove(p.x, p.y);
    game.onMouseDown();
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var p = toCanvas(t.clientX, t.clientY);
    game.onMouseMove(p.x, p.y);
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    game.onMouseUp();
  }, { passive: false });

  /* ---- keyboard ---- */
  var BLOCK = {
    Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    KeyW: 1, KeyS: 1, Enter: 1
  };
  window.addEventListener('keydown', function (e) {
    if (BLOCK[e.code]) e.preventDefault();
    if (e.repeat) return;
    game.onKeyDown(e.code, e);
  });
  window.addEventListener('keyup', function (e) {
    if (BLOCK[e.code]) e.preventDefault();
    game.onKeyUp(e.code);
  });

  window.addEventListener('blur', function () { game.keys = {}; game.charging = false; });

  /* ---- first gesture unlocks WebAudio + music ---- */
  function unlock() {
    game.audio.resume();
    game.audio.startMusic();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  /* ---- main loop ---- */
  // The frame is always re-scheduled, even if a frame blows up: one bad draw must
  // never kill the loop and leave a half-painted table on screen.
  var last = performance.now();
  var faults = 0;
  function frame(now) {
    requestAnimationFrame(frame);

    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;

    try {
      if (game.state !== 'paused' && game.state !== 'help') {
        game.update(dt);
      } else {
        game.renderer.update(dt * 0.4);
      }
      game.draw();
    } catch (e) {
      faults++;
      if (faults <= 5 && window.console) {
        console.error('[NEON POOL] frame error #' + faults + ' (state=' + game.state + ')', e);
      }
      // a throw mid-draw leaves save()/translate() unbalanced: reset the context
      for (var k = 0; k < 8; k++) ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  }
  requestAnimationFrame(frame);
})();
