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

Run with `npm run dev`; build with `npm run build`; run tests with `npm test`.

## Architecture

### Synth layer

- `src/state.js` — `S`, the single mutable object holding every synth
  parameter (waveform, octave, detune, filterType/cutoff/resonance, attack/
  decay/sustain/release, lfoDest/lfoRate/lfoDepth, masterVol). Everything
  else reads/writes this object rather than threading values through function
  args. `S.lfoDest` is one of `'filter'`, `'pitch'`, `'amp'`, or `'none'`.
- `src/audio.js` — owns the `AudioContext` and node graph via the `engine`
  object (`engine.ctx`, `engine.osc`, `engine.ampEnv`, `engine.vcf`,
  `engine.master`, `engine.scope`, `engine.lfoOsc`, `engine.lfoMod`,
  `engine.noteOn`, `engine.currentNote`). Audio is lazily started on the
  first key press (`startAudio()`), not on page load — browsers block
  `AudioContext` creation without a user gesture.
  Signal chain: `osc → ampEnv (VCA) → vcf (VCF) → master → scope → destination`.
  The LFO is a second oscillator (`lfoOsc`) scaled by a gain node (`lfoMod`)
  and patched into one of three destinations depending on `S.lfoDest`
  (`vcf.frequency`, `osc.detune`, or `ampEnv.gain`) via `applyLFORouting()`.
  When `S.lfoDest === 'none'`, `lfoMod` is disconnected entirely.
  Exports: `startAudio`, `playNote`, `releaseNote`, `applyLFORouting`,
  `lfoDepthScaled`.
- `src/notes.js` — `noteFreq(note, octave)` converts note names (`'C'`,
  `'C#'`, …, `'C5'`) and an octave number to a frequency in Hz using equal
  temperament (A4=440 Hz). `'C5'` is a special case that always yields one
  octave above the current base octave.
- `src/keyboard.js` — builds the on-screen piano DOM and maps both
  mouse/touch and a fixed set of computer-keyboard keys (A–K plus black-key
  row W/E/T/Y/U, Z/X for octave shift) to `playNote`/`releaseNote` in
  `audio.js`. Also calls `bossEngine.notify()` on every note-on event so the
  boss engine sees key presses even when no control has changed.
- `src/controls.js` — the only place that wires DOM inputs to `S`, to audio
  params, to a module's mini-canvas redraw, and to the teaching panel. When
  adding a new control, follow the `wire()` / `wireToggleGroup()` pattern
  here rather than adding ad hoc listeners elsewhere. Both helpers call
  `bossEngine.notify()` after every change so the boss engine evaluates on
  every control interaction.
- `src/canvas.js` — shared drawing primitives: `waveformSample`, `drawWaveOnCanvas`,
  `drawFilterCurveOnCanvas`, `drawADSRShape`, plus the four per-module
  mini-canvas renderers (`drawOscCanvas`, `drawFilterCanvas`, `drawADSRCanvas`,
  `drawLFOCanvas`) and `advanceLfoPhase`. These are reused by `teaching.js` so
  the teaching panel can render the same shapes at a different scale.
  The LFO canvas is animated: `advanceLfoPhase()` advances a module-level
  `lfoPhase` counter on every animation frame.
- `src/scope.js` — `drawScope()`, the always-running oscilloscope. Reads
  `engine.scope` (an `AnalyserNode`) every animation frame, finds a
  zero-crossing for a jitter-free display, draws a phosphor-green waveform
  with a subtle glow, and renders a background grid.
- `src/teaching.js` — `teach(key)` looks up `TEACHINGS[key]` (title, body
  copy, draw function) and populates `#teach-title`, `#teach-body`, and
  `#teach-canvas`. Keys come in two flavours: control keys like `'filter-cutoff'`
  (called by `controls.js` after every parameter change) and lore keys like
  `'lore-osc'` (called by `progressionUI.js` when a lore button is clicked).
  Lore buttons (`<button class="lore-btn" data-lore="osc">`) are wired in
  `progressionUI.js`, not `controls.js`.
- `src/ui.js` — small shared UI helpers: `setStatus(text, active)` updates
  the `#status-pill` element; `fillSlider(el)` writes the `--pct` CSS custom
  property on a range input so the CSS gradient fill tracks the thumb.
- `src/bossArt.js` — `BOSS_SVG`, an object keyed by stage id (`'osc'`,
  `'filter'`, `'envelope'`, `'lfo'`) containing inline SVG strings for the
  four Act I boss characters. Each SVG uses rack-unit motifs specific to the
  module (knob-eyes for osc, slider-eyes for filter, ADSR-curve mouth for
  envelope, frozen-sine eyes for LFO). `viewBox="0 0 140 110"`;
  `stroke="currentColor"` so CSS context colors the art.
- `src/main.js` — entry point. Imports `style.css`, calls `initKeyboard()`
  and `initControls()` immediately (synchronously), then on the `load` event
  calls `initProgressionUI()` and starts the animation loop (LFO canvas +
  oscilloscope). Also re-draws the static module canvases on `resize`.

### Progression layer (sits above the synth layer)

- `src/stages.js` — `STAGES`, the Act I data: four corrupted Moog-era
  instruments (Vox Corruptus, The Muffled, Dronekeeper, The Still). Each entry
  carries: `id`, `moduleId` (DOM element id), `era`, `instrument`, `pioneer`,
  `historyYear`, `historyFact`, `intro`, and `boss` (`{ name, corruptedOf,
  taunt, maxHp, damagePerHit }`). Each entry also has a
  `target(S, isPlaying) => boolean` predicate defining what "dealing damage"
  means for that stage. Exports `STAGES` (default + named) and `stageById(id)`.
- `src/progression.js` — `progression`, the singleton holding
  `currentStageIndex`, `unlockedCount`, `xp`, and `defeated[]`. Persists to
  `localStorage` under the key `synthehol_progress`. Completely independent
  of `state.js` — no imports from the synth layer. Also exports `STAGE_IDS`
  (`['osc', 'filter', 'envelope', 'lfo']`). Methods: `load()`, `save()`,
  `reset()`, `unlockNext()`, `addXp(n)`, `markDefeated(id)`.
- `src/bossEngine.js` — `bossEngine`, the pure evaluator. `notify({ S, isPlaying })`
  is called by both `controls.js` (on every control change) and `keyboard.js`
  (on every note-on). It runs the current stage's predicate, drains HP, fires
  `onDamage` / `onRestore` callbacks, advances `progression`, and sets
  `graduated = true` when all four stages are cleared. `activateStage()`
  resets HP to the incoming boss's `maxHp` (or 0 if graduated).
  `_clearListeners()` is provided for test teardown only.
- `src/progressionUI.js` — `initProgressionUI()` is the only place that
  touches DOM for progression concerns. It wires: the boss HUD (`#boss-hud`,
  `#boss-name`, `#boss-taunt`, `#boss-hp-fill`), module lock/unlock CSS
  classes (`locked`, `active-stage`), the boss character panel
  (`#boss-panel`, `.boss-svg-wrap`) using `BOSS_SVG` from `bossArt.js`,
  the stage-intro banner (`#stage-intro`) with pioneer/instrument/historyFact,
  the `battle-active` layout on `<main>`, the CSS glitch intensity variable
  `--gi` (0→1 as HP drains), the graduation screen (`#graduation-banner`),
  lore buttons, and the reset button. The `body[data-layers]` attribute
  (0–4) advances each time a boss is restored and drives CSS era-layering
  effects.

## DOM structure (index.html)

Key element ids that code writes to:

| id | owner |
|---|---|
| `status-pill` | `ui.js` via `setStatus()` |
| `boss-hud` | `progressionUI.js` |
| `boss-name`, `boss-taunt`, `boss-hp-fill` | `progressionUI.js` |
| `boss-panel`, `.boss-svg-wrap`, `boss-panel-name` | `progressionUI.js` + `bossArt.js` |
| `stage-intro`, `stage-intro-pioneer`, `stage-intro-instrument`, `stage-intro-fact` | `progressionUI.js` |
| `graduation-banner` | `progressionUI.js` |
| `reset-btn` | `progressionUI.js` |
| `keyboard` | `keyboard.js` |
| `scope-canvas` | `scope.js` |
| `teach-title`, `teach-body`, `teach-canvas` | `teaching.js` |
| `c-osc`, `c-filter`, `c-adsr`, `c-lfo` | `canvas.js` |
| `mod-osc`, `mod-filter`, `mod-adsr`, `mod-lfo` | `progressionUI.js` (adds/removes CSS classes) |
| `v-oct`, `v-detune`, `v-cutoff`, `v-res`, `v-atk`, `v-dec`, `v-sus`, `v-rel`, `v-lforate`, `v-lfodepth` | `controls.js` |
| `s-oct`, `s-detune`, `s-cutoff`, `s-res`, `s-atk`, `s-dec`, `s-sus`, `s-rel`, `s-lforate`, `s-lfodepth`, `master-vol` | `controls.js` (`wire()`) |
| `wave-btns`, `ftype-btns`, `lfodest-btns` | `controls.js` (`wireToggleGroup()`) |

## Testing

Tests use **Vitest** (`npm test` or `npm run test:watch`). Test environment is
`node` (not `jsdom`) — tests that need browser APIs mock them explicitly.

Test files live alongside source files as `src/*.test.js`. Current coverage:

- `src/progression.test.js` — full unit coverage of `progression` singleton:
  fresh state, persistence round-trip, reset, malformed localStorage, `unlockNext`,
  `markDefeated`. Uses a `makeLocalStorageMock()` helper with `vi.stubGlobal`.
- `src/bossEngine.test.js` — covers `activateStage`, `notify` (no-damage and
  damage cases, XP, callbacks), restore (boss defeat, stage advance, HP reset),
  and full graduation across all four stages. Also uses `makeLocalStorageMock`.
  Calls `bossEngine._clearListeners()` in `beforeEach` to prevent listener
  accumulation across tests.
- `src/stages.test.js` — validates the `STAGES` array schema (required fields,
  boss fields, valid moduleIds), exports, ordering, and every stage's `target`
  predicate with boundary values.
- `src/teaching.test.js` — verifies `teach()` doesn't throw for lore keys,
  writes non-empty title/body, and includes pioneer names. Mocks `state.js`,
  `canvas.js`, and `document.getElementById` to avoid browser dependencies.

When adding a new module or stage, add matching tests in the same pattern.
Always mock `localStorage` in progression/bossEngine tests via `vi.stubGlobal`.

## Conventions

- All synth parameters live in `S` (`state.js`). Progression state lives in
  `progression` (`progression.js`). Keep these two singletons strictly separate —
  the synth layer never imports from the progression layer.
- Continuous audio params (cutoff, resonance, master vol, LFO rate/depth) are
  set with `setTargetAtTime` ramps to avoid clicks. Discrete changes (waveform
  type, filter type, detune) may use direct `.value =` assignment — they are
  instantaneous by nature.
- Canvas redraws are pull-based (call `drawModCanvas('osc')` etc. after a
  state change) except the LFO mini-canvas and the oscilloscope, which animate
  continuously via `requestAnimationFrame`.
- Adding a new slider control: use `wire(id, handler)` in `controls.js`. Adding
  a new toggle group: use `wireToggleGroup(groupId, onSelect)`. Both patterns
  automatically call `fillSlider`, update the teaching panel, and notify the
  boss engine.
- Adding a new teaching entry: add a key to `TEACHINGS` in `teaching.js` with
  `title`, `body`, and a `draw(canvas)` function reusing `canvas.js` primitives.
  Then call `teach('your-key')` from the appropriate `controls.js` handler.
- `synthehol.html` at the repo root is the original single-file prototype this
  project was split out of. It is inert (not part of the Vite build) — treat
  it as historical reference only, never edit it as if it were live.
- Boss art lives in `bossArt.js` as inline SVG strings. The SVG uses
  `stroke="currentColor"` and no hardcoded colors so CSS context controls the
  appearance. All art is code-only — no external image assets.

## Dev environment

- `.claude/launch.json` — configures the Vite dev server for the Claude Code
  web IDE (port 5173, auto-port). This is IDE metadata, not a build artifact.
- `vite.config.js` — Vite build root is `.` (repo root), outDir is `dist`,
  Vitest is configured with `environment: 'node'` and
  `include: ['src/**/*.test.js']`.

## Act II+ roadmap (not yet built)

Act I covers the four existing modules. Future acts follow the same
stage → boss pattern:

- **Act II** — noise generator (white/pink noise source), second oscillator
  (detuned stacking, unison)
- **Act III** — polyphony (currently monophonic; a new note while one is held
  cuts the first rather than sustaining a chord)
- **Act IV** — step sequencer/arpeggiator, MIDI in/out (never hard-gates —
  players without MIDI hardware must never be soft-locked)

Defeating the final Act IV boss opens a full DAW sandbox with all capabilities
visible at once.

See `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md`
for the full phased roadmap and requirements, and
`docs/brainstorms/2026-06-22-boss-visuals-historical-context-requirements.md`
for the boss art and historical lore design decisions.
