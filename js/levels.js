/* NEON POOL 8 - level layouts ("schemi") : racks, obstacles, CPU skill */
(function () {
  'use strict';

  var P = (window.POOL = window.POOL || {});
  var C = P.C, M = P.M;

  var SP = C.BALL_R * 2 + 0.7;          // rack spacing
  var DX = SP * Math.cos(Math.PI / 6);  // triangle row offset

  /* --- assign numbers to N slots respecting 8-ball rack conventions --- */
  function assignNumbers(slots, eightIndex, apexIndex, cornerA, cornerB) {
    var solids = [1, 2, 3, 4, 5, 6, 7];
    var stripes = [9, 10, 11, 12, 13, 14, 15];
    shuffle(solids); shuffle(stripes);

    var out = new Array(slots.length);
    out[eightIndex] = 8;

    if (apexIndex !== undefined && apexIndex !== null && out[apexIndex] === undefined) {
      out[apexIndex] = solids.shift();
    }
    if (cornerA !== undefined && cornerA !== null && out[cornerA] === undefined) {
      out[cornerA] = solids.shift();
    }
    if (cornerB !== undefined && cornerB !== null && out[cornerB] === undefined) {
      out[cornerB] = stripes.shift();
    }

    var rest = solids.concat(stripes);
    shuffle(rest);
    for (var i = 0; i < slots.length; i++) {
      if (out[i] === undefined) out[i] = rest.shift();
    }
    return out;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function toBalls(slots, nums) {
    var arr = [];
    for (var i = 0; i < slots.length; i++) arr.push({ n: nums[i], x: slots[i].x, y: slots[i].y });
    return arr;
  }

  /* ---------------- rack shapes ---------------- */

  // classic 5-row triangle, apex pointing at the head of the table
  function rackTriangle(cx, cy) {
    var slots = [];
    for (var row = 0; row < 5; row++) {
      for (var j = 0; j <= row; j++) {
        slots.push({ x: cx + row * DX, y: cy + (j - row / 2) * SP });
      }
    }
    // apex = 0 ; centre of row 2 = index 4 ; back corners = 10 and 14
    return toBalls(slots, assignNumbers(slots, 4, 0, 10, 14));
  }

  // diamond: two triangles back to back
  function rackDiamond(cx, cy) {
    var slots = [];
    var rows = [1, 2, 3, 4, 3, 2];   // 15 balls
    var col = 0;
    for (var r = 0; r < rows.length; r++) {
      for (var j = 0; j < rows[r]; j++) {
        slots.push({ x: cx + col * DX, y: cy + (j - (rows[r] - 1) / 2) * SP });
      }
      col++;
    }
    return toBalls(slots, assignNumbers(slots, 7, 0, slots.length - 1, 3));
  }

  // three vertical columns
  function rackColumns(cx, cy) {
    var slots = [];
    for (var c = 0; c < 3; c++) {
      var count = c === 1 ? 5 : 5;
      for (var j = 0; j < count; j++) {
        slots.push({ x: cx + c * (DX * 1.9), y: cy + (j - (count - 1) / 2) * SP * 1.05 + (c === 1 ? SP / 2 : 0) });
      }
    }
    return toBalls(slots.slice(0, 15), assignNumbers(slots.slice(0, 15), 7, 0, 4, 14));
  }

  // ring of balls around a hollow centre
  function rackRing(cx, cy) {
    var slots = [];
    var i;
    for (i = 0; i < 10; i++) {
      var a = (i / 10) * Math.PI * 2;
      slots.push({ x: cx + Math.cos(a) * 52, y: cy + Math.sin(a) * 52 });
    }
    for (i = 0; i < 5; i++) {
      var a2 = (i / 5) * Math.PI * 2 + 0.6;
      slots.push({ x: cx + Math.cos(a2) * 26, y: cy + Math.sin(a2) * 26 });
    }
    return toBalls(slots, assignNumbers(slots, 12, 0, 3, 7));
  }

  // scattered chaos rack
  function rackScatter(cx, cy) {
    var slots = [];
    var cols = 5, rowsN = 3;
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rowsN; r++) {
        slots.push({
          x: cx + c * DX * 1.75 + (r % 2 ? DX * 0.6 : 0),
          y: cy + (r - 1) * SP * 2.15 + (c % 2 ? SP * 0.5 : -SP * 0.3)
        });
      }
    }
    return toBalls(slots, assignNumbers(slots, 7, 0, 2, 12));
  }

  /* ---------------- levels ---------------- */

  var LEVELS = [
    {
      name: 'ROOKIE ROOM',
      sub: 'STANDARD RACK - NO HAZARDS',
      cpu: 0.42,
      powerRate: 9.0,
      rack: function () { return rackTriangle(C.FOOT_X, C.CY); },
      obstacles: function () { return []; }
    },
    {
      name: 'THE PILLARS',
      sub: 'MIND THE BUMPERS',
      cpu: 0.54,
      powerRate: 8.0,
      rack: function () { return rackTriangle(C.FOOT_X + 12, C.CY); },
      obstacles: function () {
        return [
          { type: 'circle', x: C.PX + C.PW * 0.42, y: C.CY - 88, r: 16 },
          { type: 'circle', x: C.PX + C.PW * 0.42, y: C.CY + 88, r: 16 }
        ];
      }
    },
    {
      name: 'DIAMOND CUT',
      sub: 'CENTRE BLOCK ONLINE',
      cpu: 0.64,
      powerRate: 7.5,
      rack: function () { return rackDiamond(C.PX + C.PW * 0.60, C.CY); },
      obstacles: function () {
        return [
          { type: 'rect', x: C.PX + C.PW * 0.30 - 12, y: C.CY - 62, w: 24, h: 124 }
        ];
      }
    },
    {
      name: 'THE GAUNTLET',
      sub: 'NARROW LANES',
      cpu: 0.73,
      powerRate: 7.0,
      rack: function () { return rackColumns(C.PX + C.PW * 0.62, C.CY); },
      obstacles: function () {
        return [
          { type: 'rect', x: C.PX + C.PW * 0.42, y: C.PY + 6, w: 20, h: 96 },
          { type: 'rect', x: C.PX + C.PW * 0.42, y: C.PB - 102, w: 20, h: 96 },
          { type: 'circle', x: C.PX + C.PW * 0.33, y: C.CY, r: 18 }
        ];
      }
    },
    {
      name: 'NEON VOID',
      sub: 'RING RACK - HOSTILE FIELD',
      cpu: 0.82,
      powerRate: 6.5,
      rack: function () { return rackRing(C.PX + C.PW * 0.66, C.CY); },
      obstacles: function () {
        return [
          { type: 'rect', x: C.PX + C.PW * 0.38 - 46, y: C.CY - 9, w: 92, h: 18 },
          { type: 'circle', x: C.PX + C.PW * 0.38, y: C.CY - 78, r: 14 },
          { type: 'circle', x: C.PX + C.PW * 0.38, y: C.CY + 78, r: 14 }
        ];
      }
    },
    {
      name: 'GRANDMASTER',
      sub: 'FINAL TABLE - NO MERCY',
      cpu: 0.92,
      powerRate: 6.0,
      rack: function () { return rackScatter(C.PX + C.PW * 0.52, C.CY); },
      obstacles: function () {
        return [
          { type: 'circle', x: C.PX + C.PW * 0.34, y: C.CY - 92, r: 15 },
          { type: 'circle', x: C.PX + C.PW * 0.34, y: C.CY + 92, r: 15 },
          { type: 'circle', x: C.PX + C.PW * 0.86, y: C.CY, r: 15 },
          { type: 'rect', x: C.PX + C.PW * 0.34 - 10, y: C.CY - 26, w: 20, h: 52 }
        ];
      }
    }
  ];

  P.LEVELS = LEVELS;

  P.buildLevel = function (world, index) {
    var lv = LEVELS[Math.min(index, LEVELS.length - 1)];
    world.balls = [];
    world.clearObstacles();

    var obs = lv.obstacles();
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (o.type === 'rect') world.addRectObstacle(o.x, o.y, o.w, o.h);
      else world.addCircleObstacle(o.x, o.y, o.r);
    }

    var cue = new P.Ball(0, C.PX + C.PW * 0.20, C.CY);
    world.addBall(cue);

    var rack = lv.rack();
    for (var k = 0; k < rack.length; k++) {
      world.addBall(new P.Ball(rack[k].n, rack[k].x, rack[k].y));
    }

    world.relaxOverlaps(80);

    // make sure the cue ball ends up legally behind the head string
    var spot = world.findSpot(C.PX + C.PW * 0.20, C.CY, cue);
    cue.x = spot.x; cue.y = spot.y;

    return lv;
  };
})();
