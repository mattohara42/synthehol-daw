# Synthehol

An interactive browser synth and guided learning game. Players unlock analog
synthesis concepts one at a time — each stage ends in a **boss fight** won by
sculpting the target sound. Defeating all four Act I bosses graduates you into
a free-play DAW sandbox.

Built with the Web Audio API — no audio libraries, no backend, no framework.

## Where everything lives / getting the latest

- **Canonical repo:** `mattohara42/synthehol-daw` on GitHub
  (`https://github.com/mattohara42/synthehol-daw`).
- **`master` is the trunk** — the integrated, always-working version. Every
  feature lands here via a pull request. **To get the newest code, use `master`.**
- `claude/build-review-ideas-3vfcyk` is the active build session's branch; it is
  kept fast-forwarded to `master`, so it mirrors trunk. Older `claude/feat-*`
  branches are merged history and can be ignored.

**First time on a new machine** (run from a *writable* folder such as your home
directory — not `/`, which is read-only on macOS):

```bash
cd ~
git clone https://github.com/mattohara42/synthehol-daw.git
cd synthehol-daw
npm install
npm run dev
```

**Already have it — pull the latest:**

```bash
cd ~/synthehol-daw          # wherever you cloned it
git checkout master
git pull origin master
npm install                 # only if dependencies changed
npm run dev
```

`npm run dev` prints a local URL (usually `http://localhost:5173`, or the next
free port like `5174` if that's taken). Open it, then **click a key or the Play
button once** — browsers block audio until a user gesture.

For a deeper map of the architecture (the state store, transport clock, voice
pool, sequencer, and how they fit together), see **`CLAUDE.md`** and the design
docs under **`docs/`** (`docs/backlog.md`, `docs/daw-layout-backlog.md`,
`docs/brainstorms/`, `docs/plans/`).

## How it works

Each stage teaches one synthesis concept and ends in a boss fight:

| Stage | Concept | Boss |
|-------|---------|------|
| 1 | Oscillator (VCO) | Vox Corruptus |
| 2 | Filter (VCF) | The Muffled |
| 3 | Envelope (ADSR) | Dronekeeper |
| 4 | LFO | The Still |

Hit the target sound → deal damage → defeat the boss → unlock the next module.
Restore all four to enter free-play.

## Running it

See [Where everything lives / getting the latest](#where-everything-lives--getting-the-latest)
above for the full setup. The short version:

```
npm install
npm run dev
```

Open the printed local URL, click a key (or press A–K on your keyboard) to start.

## Building

```
npm run build
npm run preview   # serve the production build locally
```

## Testing

```
npm test
```

## Project structure

```
index.html          markup — modules, transport bar, sequencer, keyboard, scope, teaching, boss HUD
src/
  Synth layer
    main.js           entry point: wires synth, engine, progression, animation loop
    state.js          S — the active track's params (a view onto the store; read S, write via store)
    audio.js          Web Audio signal chain: osc → VCA → VCF → master → scope (+ FX, + voice pool)
    notes.js          note name → frequency table
    keyboard.js       on-screen piano + computer-keyboard input (A–K, Z/X octave)
    controls.js       wires sliders/buttons to the store, audio params, canvas redraws
    canvas.js         drawing primitives + per-module mini-canvases
    scope.js          live oscilloscope + spectrum (read the master AnalyserNode)
    teaching.js       per-control explanations + illustrations
    knob.js           vertical-drag knob enhancer over native range inputs
    presets.js        save/load named synth presets (localStorage)
    ui.js             DOM helpers (status pill, slider fill %)
    style.css         all styling + era accent system + battle/transport/sequencer layout
  Engine layer (serializable DAW foundation)
    store.js          the project tree + undo/redo; S is store.params() (E1)
    scheduler.js      pure lookahead step scheduler + musical-position helpers (E2)
    clock.worker.js   Web Worker coarse clock (throttle-proof timing) (E2)
    transport.js      play/stop/tempo/loop over the store; drives the scheduler (E2)
    metronome.js      first scheduler consumer — a click per beat (E2)
    voices.js         polyphonic voice pool + voice stealing (E3)
  DAW surfaces
    transportUI.js    the transport bar UI (Play/BPM/metronome/loop) (L2)
    sequencer.js      step-sequencer engine: grid → scheduled polyphonic notes (L6)
    sequencerUI.js    the step-grid UI + transport-synced playhead (L6)
  Progression layer
    stages.js         Act I stage/boss data and target predicates
    progression.js    progression singleton (stage index, XP, unlocks, localStorage)
    bossEngine.js     pure boss evaluator — runs predicates, fires damage/restore callbacks
    bossArt.js        inline SVG boss characters
    bossAudio.js      combat sound effects
    progressionUI.js  boss HUD, module lock/unlock, battle layout, graduation screen
```

Most files have a matching `*.test.js` beside them (Vitest). `CLAUDE.md` has the
authoritative, detailed description of each module and the conventions.

## Signal flow

```
Oscillator (VCO) → Envelope (VCA) → Filter (VCF) → Master → Oscilloscope → speakers
                                                       ↑
LFO ───────────────────── routes to one of: filter cutoff, pitch, or amp
```

`synthehol.html` is the original single-file prototype this project was split
from — kept for reference, not part of the active build.
