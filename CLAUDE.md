# Synthehol — project context for Claude Code

Synthehol is a browser synth that doubles as a teaching tool for analog
synthesis fundamentals: oscillator (VCO), filter (VCF), envelope (VCA/ADSR),
and LFO. The goal of the project is "fun first, accurate second" — every
control should sound good to play with, and clicking/dragging it should
teach the user what just happened to the sound.

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
- `src/main.js` — entry point. Imports `style.css`, calls `initKeyboard()`
  and `initControls()`, then starts the redraw/animation loop on `load`.

## Conventions

- All synth parameters live in `S` (`state.js`) — don't introduce parallel
  state elsewhere.
- Audio params are set with `setTargetAtTime`/`setValueAtTime` ramps, not
  direct `.value =` assignment, to avoid audible clicks — match this when
  adding new continuous controls.
- Canvas redraws are pull-based (call `drawModCanvas('osc')` etc. after a
  state change) except the LFO mini-canvas and the oscilloscope, which
  animate continuously via `requestAnimationFrame`.
- `synthehol.html` at the repo root is the original single-file prototype
  this project was split out of. It's inert (not part of the Vite build) —
  treat it as historical reference only, don't edit it as if it were live.

## Ideas for next modules (not yet built)

If extending this, the natural next building blocks to teach are: a second
oscillator for detuned stacking, a noise generator, a sequencer/arpeggiator,
and polyphony (currently monophonic — playing a new note while one is held
cuts the first short rather than sustaining a chord).
