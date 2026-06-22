# Synthehol

An interactive browser synth and guided learning game. Players unlock analog
synthesis concepts one at a time — each stage ends in a **boss fight** won by
sculpting the target sound. Defeating all four Act I bosses graduates you into
a free-play DAW sandbox.

Built with the Web Audio API — no audio libraries, no backend, no framework.

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
index.html          markup — modules, keyboard, scope, teaching panel, boss HUD
src/
  main.js           entry point: wires synth, progression, and animation loop
  state.js          S — single source of truth for all synth parameters
  audio.js          Web Audio signal chain: osc → VCA → VCF → master → scope
  notes.js          note name → frequency table
  keyboard.js       on-screen piano + computer-keyboard input (A–K, Z/X octave)
  controls.js       wires sliders/buttons to S, audio params, canvas redraws
  canvas.js         drawing primitives + four per-module mini-canvases
  scope.js          live oscilloscope (reads the master AnalyserNode)
  teaching.js       per-control explanations + illustrations
  ui.js             DOM helpers (status pill, slider fill %)
  style.css         all styling + era accent system + battle layout
  stages.js         Act I stage/boss data and target predicates
  progression.js    progression singleton (stage index, XP, unlocks, localStorage)
  bossEngine.js     pure boss evaluator — runs predicates, fires damage/restore callbacks
  progressionUI.js  boss HUD, module lock/unlock, battle layout, graduation screen
```

## Signal flow

```
Oscillator (VCO) → Envelope (VCA) → Filter (VCF) → Master → Oscilloscope → speakers
                                                       ↑
LFO ───────────────────── routes to one of: filter cutoff, pitch, or amp
```

`synthehol.html` is the original single-file prototype this project was split
from — kept for reference, not part of the active build.
