# Synthehol — project context for Claude Code

Synthehol is a browser synth and guided learning game. Players unlock synthesis
concepts one at a time — oscillator (VCO), filter (VCF), envelope (VCA/ADSR),
LFO — each gated by a **boss fight** they win by sculpting the target sound.
Defeating all four Act I bosses graduates them into a free-play DAW sandbox.
The goal is "fun first, accurate second" — every control should sound good to
play with, and touching it should teach the user what just happened to the sound.

## Stack

Plain JS (ES modules) + Web Audio API + Canvas 2D, bundled with Vite. No
framework, no audio library — the signal chain is hand-built from
`AudioNode`s so the code itself stays readable as a synthesis reference.

Run with `npm run dev`; build with `npm run build`.

## Architecture

- `src/state.js` — `S`, the single mutable object holding every synth
  parameter (waveform, octave, detune, filter type/cutoff/resonance, ADSR
  times, LFO dest/rate/depth, master volume). Everything else reads/writes
  this object rather than threading values through function args.
- `src/audio.js` — owns the actual `AudioContext` and node graph, exposed via
  the `engine` object (`engine.ctx`, `engine.osc`, `engine.vcf`, etc.).
  Audio is lazily started on the first key press (`startAudio()`), not on
  page load — browsers block audio context creation without a user gesture.
  Signal chain: `osc → ampEnv (VCA) → vcf (VCF) → master → scope → destination`.
  The LFO is a second oscillator (`lfoOsc`) scaled by a gain node (`lfoMod`)
  and patched into one of three destinations depending on `S.lfoDest`
  (`vcf.frequency`, `osc.detune`, or `ampEnv.gain`) — see `applyLFORouting()`.
- `src/keyboard.js` — builds the on-screen piano DOM and maps both mouse/touch
  and a fixed set of computer-keyboard keys (A–K plus black-key row, Z/X for
  octave shift) to `playNote`/`releaseNote` in `audio.js`.
- `src/controls.js` — the only place that wires DOM inputs to `S`, to audio
  params, to a module's mini-canvas redraw, and to the teaching panel. When
  adding a new control, follow the existing `wire()` / `wireToggleGroup()`
  pattern here rather than adding ad hoc listeners elsewhere.
- `src/canvas.js` — shared drawing primitives (waveform sampling, filter
  curve via `BiquadFilterNode.getFrequencyResponse`, ADSR shape) plus the
  four small per-module canvases. These are intentionally reusable so the
  teaching panel can render the same shapes at a different scale.
- `src/teaching.js` — a lookup table (`TEACHINGS`) keyed by a short id like
  `'filter-cutoff'`, each with a title, body copy, and a draw function reusing
  `canvas.js` primitives. `controls.js` calls `teach(key)` after every
  parameter change.
- `src/scope.js` — the always-running oscilloscope, reading
  `engine.scope` (an `AnalyserNode`) every animation frame and finding a
  zero-crossing so the waveform display doesn't jitter.
- `src/main.js` — entry point. Imports `style.css`, calls `initKeyboard()`,
  `initControls()`, and `initProgressionUI()`, then starts the redraw/animation
  loop on `load`.

### Progression layer (sits above the synth layer)

- `src/stages.js` — `STAGES`, the Act I data: four corrupted Moog-era
  instruments (Vox Corruptus, The Muffled, Dronekeeper, The Still). Each entry
  carries a `target(S, isPlaying) => boolean` predicate that defines what "dealing
  damage" means for that stage. Export `stageById(id)` for point lookups.
- `src/progression.js` — `progression`, the singleton holding `currentStageIndex`,
  `unlockedCount`, `xp`, and `defeated[]`. Persists to `localStorage` under the
  key `synthehol_progress`. Completely independent of `S` — no imports from
  `state.js`. Methods: `load()`, `save()`, `reset()`, `unlockNext()`, `addXp(n)`,
  `markDefeated(id)`.
- `src/bossEngine.js` — `bossEngine`, the pure evaluator. `notify({ S, isPlaying })`
  is called by instrumentation on every control change or note-on; it runs the
  current stage's predicate, drains HP, fires `onDamage` / `onRestore` callbacks,
  advances `progression`, and sets `graduated = true` when all four stages are
  cleared. `activateStage()` resets HP to the incoming boss's `maxHp`.
- `src/progressionUI.js` — `initProgressionUI()` wires the boss HUD, module
  lock/unlock CSS classes, the stage-intro banner, the `battle-active` layout
  on `<main>`, and the graduation screen to `bossEngine` callbacks. This is the
  only place that touches DOM for progression concerns — keep it that way.

## Conventions

- All synth parameters live in `S` (`state.js`). Progression state lives in
  `progression` (`progression.js`). Keep these two singletons strictly separate —
  the synth layer never imports from the progression layer.
- Audio params are set with `setTargetAtTime`/`setValueAtTime` ramps, not
  direct `.value =` assignment, to avoid audible clicks — match this when
  adding new continuous controls.
- Canvas redraws are pull-based (call `drawModCanvas('osc')` etc. after a
  state change) except the LFO mini-canvas and the oscilloscope, which
  animate continuously via `requestAnimationFrame`.
- `synthehol.html` at the repo root is the original single-file prototype
  this project was split out of. It's inert (not part of the Vite build) —
  treat it as historical reference only, don't edit it as if it were live.

## Act II+ roadmap (not yet built)

Act I covers the four existing modules. Future acts follow the same
stage → boss pattern, each introducing one new synthesis concept:

- **Act II** — noise generator (white/pink noise source)
- **Act III** — second oscillator (detuned stacking, unison)
- **Act IV** — polyphony (currently monophonic; a new note while one is held
  cuts the first rather than sustaining a chord) + sequencer/arpeggiator

See `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md`
for the full phased roadmap.
