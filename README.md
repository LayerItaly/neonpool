# NEON POOL 8

A retro-arcade, top-down 8-ball pool game for the browser. Pure HTML5 canvas + vanilla
JavaScript — no build step, no dependencies, no assets. All graphics are drawn at runtime
(including the bitmap font) and every sound is synthesised with the Web Audio API.

You are Player 1. The machine is not friendly.

## Play

Just open `index.html` in a browser (works straight off the filesystem), or serve the
folder:

```sh
python3 -m http.server 8765
# then open http://localhost:8765/
```

## Rules

- 16 balls: the cue ball plus 1–15.
- The table is **open** after the break. The first legal pot decides your group:
  **solids 1–7** or **stripes 9–15**.
- Clear your whole group, then sink the **8** to win the stage.
- Potting the 8 too early — or scratching on it — loses the stage.
- Fouls hand **ball in hand** to the opponent: scratch, no contact, or hitting the
  wrong group first.
- Potting one of your own keeps you at the table and builds the combo multiplier.

## Controls

| Input | Action |
|---|---|
| Mouse move | Aim |
| Hold left button | Charge power |
| Release | Shoot |
| ← / → | Fine aim (hold Shift for very fine) |
| ↑ / ↓ | Adjust power directly |
| Space | Hold to charge, release to shoot |
| W / S | Top spin / back spin (follow & draw) |
| Click / Enter | Place the cue ball when you have ball in hand |
| P | Pause |
| H | Help & rules |
| M | Music on / off |
| N | Sound effects on / off |
| R | Retry the stage (costs a life) |

Touch works too: drag to aim, lift to shoot.

## Audio

Music and sound effects are two independent channels, each with its own switch:
**M** toggles the chiptune loop, **N** toggles the sound effects. The two indicators in
the bottom bar show the current state, and the choice is remembered across sessions in
`localStorage`. Turning a channel off silences it without touching the other.

## Stages

Six successive tables, each with its own rack pattern, hazards and CPU skill level:

1. **ROOKIE ROOM** — standard rack, clean table
2. **THE PILLARS** — two bumpers in the open
3. **DIAMOND CUT** — diamond rack, centre block
4. **THE GAUNTLET** — column rack, narrow lanes
5. **NEON VOID** — ring rack, hostile field
6. **GRANDMASTER** — scattered rack, no mercy

Bumpers kick the ball back harder than a cushion. Blocks are solid walls.

## Power-ups

Pickups drift onto the felt between shots. Roll the **cue ball** over one to grab it.

| | Name | Effect |
|---|---|---|
| LSR | Laser Sight | Full bank-shot prediction (3 shots) |
| PWR | Overdrive | +55% maximum shot speed (2 shots) |
| MAG | Pocket Magnet | Your group gets pulled into pockets (2 shots) |
| WID | Wide Pockets | Pocket capture radius +45% (2 shots) |
| XTR | Extra Turn | The opponent skips their next turn |
| SHD | Foul Shield | Your next foul is forgiven |

The CPU can collect them too.

## Scoring

| Event | Points |
|---|---|
| Pot one of yours | +100 × combo |
| Power-up collected | +250 |
| Sink the 8 legally | +1500 |
| Stage bonus | +1000 × stage number |
| CPU balls left on the table | +150 each |
| Time bonus | up to +1500 |
| Foul | −75 |
| Potting an opponent's ball | −40 |

High score is stored in `localStorage`.

## Layout

```
index.html          markup + arcade cabinet shell
css/style.css       CRT scanlines, glow, cabinet frame
js/util.js          table geometry, palette, math helpers
js/font.js          5x7 bitmap font renderer
js/audio.js         Web Audio SFX + chiptune loop
js/physics.js       balls, cushions, obstacles, pockets, raycasting
js/levels.js        rack patterns + stage definitions
js/powerups.js      pickups and effect bookkeeping
js/ai.js            CPU: ghost-ball shot search with skill-scaled noise
js/render.js        table, balls, cue, HUD, FX
js/game.js          state machine, 8-ball rules, scoring, input
js/screens.js       frame composition + overlay screens
js/main.js          boot, main loop, DOM event plumbing
```
