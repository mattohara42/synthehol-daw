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
  decay/sustain/release, lfoDest/lfoRate/lfoDepth, FX delay/reverb, masterVol).
  Everything reads `S` as before, **but `S` is no longer the source of truth**:
  it is now just `store.params()` (the active track's `instrument.params` object)
  re-exported. Reads still use `S.cutoff` etc.; **writes must go through the
  store** (`store.set('cutoff', v)`) so they record undo history and notify
  subscribers — see the Engine layer below. `S.lfoDest` is one of `'filter'`,
  `'pitch'`, `'amp'`, or `'none'`.
- `src/audio.js` — owns the `AudioContext` and node graph via the `engine`
  object (`engine.ctx`, `engine.osc`, `engine.ampEnv`, `engine.vcf`,
  `engine.master`, `engine.scope`, `engine.lfoOsc`, `engine.lfoMod`, the FX
  nodes `delay`/`delayFb`/`delayWet`/`reverb`/`reverbWet`, `engine.voices`
  (the polyphonic pool, E3), `engine.noteOn`, `engine.currentNote`). Audio is
  lazily started on the first key press (`startAudio()`), not on page load —
  browsers block `AudioContext` creation without a user gesture.
  Signal chain: `osc → ampEnv (VCA) → vcf (VCF) → master → scope → destination`,
  with `master` also fanning out to delay + reverb sends summed back at `scope`.
  The LFO is a second oscillator (`lfoOsc`) scaled by a gain node (`lfoMod`)
  and patched into one of three destinations depending on `S.lfoDest`
  (`vcf.frequency`, `osc.detune`, or `ampEnv.gain`) via `applyLFORouting()`.
  When `S.lfoDest === 'none'`, `lfoMod` is disconnected entirely.
  **Two note paths:** (1) the **mono live path** —
  `noteOnAt(note,octave,time,velocity)`/`noteOffAt(time)`, with
  `playNote`/`releaseNote` delegating at `ctx.currentTime` — reuses the single
  persistent `osc`/`ampEnv` and is what the keyboard and Act I use (a new note
  cuts the held one). (2) the **polyphonic path** (E3) —
  `voiceNoteOn(note,octave,time,velocity) → id`, `voiceNoteOff(id,time)`,
  `releaseAllVoices(time)` — allocates independent voices from `engine.voices`,
  summed into the same `vcf`. The sequencer drives this path; the live keyboard
  stays mono until Act III. Exports: `startAudio`, `playNote`, `releaseNote`,
  `noteOnAt`, `noteOffAt`, `voiceNoteOn`, `voiceNoteOff`, `releaseAllVoices`,
  `applyLFORouting`, `lfoDepthScaled`, `makeImpulse`.
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
- `src/main.js` — entry point. Imports `style.css`; inits keyboard, controls,
  knobs, the transport clock + its consumers (metronome + sequencer), the
  transport bar UI, the sequencer UI, boss audio, and presets; then on the
  `load` event calls `initProgressionUI()` and starts the animation loop
  (LFO canvas + oscilloscope + transport position + sequencer playhead). Exposes
  debug hooks `window.synthStore` (E1), `window.synthTransport` (E2), and
  `window.synthAudio` (E3: `{ engine, voiceNoteOn, voiceNoteOff, releaseAllVoices }`)
  for console/headless verification. Re-draws the static module canvases on `resize`.

### Engine layer (E1–E3 — the serializable DAW foundation)

This layer was added to turn the single-synth toy into a DAW core. It imports
nothing from the progression layer.

- `src/store.js` — **`store`, the serializable project tree and source of truth
  behind `S` (E1).** Owns `project = { version, transport, tracks[], activeTrackId }`.
  Each track has `{ id, name, instrument:{ type, params }, fx, clips, pattern,
  mixer }`; the active track's `instrument.params` **is** the object exported as
  `S`. `transport` holds `{ bpm, timeSig, playing, metronome, loop, position }`.
  API: `get()`, `params()`, `pattern()`, `activeTrackIndex()`,
  `set(key,value)` (active-param write, **undoable**), `setPath(path,value)`
  (any tree path, undoable — array indices work, e.g.
  `tracks.0.pattern.cells.3.5`), `setTransient(path,value)` (writes **without**
  history, for playback state like `transport.playing`), `subscribe(fn)`,
  `serialize()`/`load(json)`, `undo()`/`redo()`, `reset()`, `_resetForTest()`.
  Writes coalesce same-key runs (a slider drag) into one undo step
  (`COALESCE_MS`). `applyState` mutates leaves **in place** (`Object.assign`) so
  the `S` reference every module holds stays valid across load/undo.
- `src/scheduler.js` — pure lookahead scheduler core (the "A Tale of Two Clocks"
  pattern). `createScheduler({ now, schedule, getBpm, lookahead })` returns
  `{ start, stop, tick, … }`; `tick()` schedules every step whose time falls in
  `[now, now+lookahead)`. Plus musical-position helpers `stepsPerBar`,
  `stepToPosition`, `positionFor` (loop-aware), `STEPS_PER_BEAT` (= 4, i.e.
  16th-note steps). No worker or audio context — fully unit-testable.
- `src/clock.worker.js` — a Web Worker posting `'tick'` on a `setInterval`
  (default 25 ms), immune to background-tab/mobile main-thread throttling.
  Responds to `{cmd:'start'|'stop'|'interval'}`.
- `src/transport.js` — **`transport`, the play/stop/tempo/loop controller (E2).**
  Wires the worker clock to a `scheduler` whose `schedule` callback writes the
  musical position into `store` (transiently) and fans out to registered
  consumers. API: `init()`, `play()`, `stop()` (releases all voices + resets
  position), `toggle()`, `setBpm(n)` (clamped 20–300, **undoable**),
  `toggleMetronome()`, `setLoop()`, `registerConsumer(fn)` where
  `fn(step, time, position)`. Falls back to a main-thread interval if `Worker`
  is unavailable.
- `src/metronome.js` — `metronomeConsumer(step,time,pos)`, the first scheduler
  consumer: a click each beat (accented on the downbeat), gated by
  `transport.metronome`, on its own gain bus.
- `src/voices.js` — **the polyphonic voice manager (E3).**
  `createVoiceManager({ ctx, output, getParams, maxVoices })` returns
  `{ noteOn(freq,time,vel)→id, noteOff(id,time), releaseAll(time), activeCount(),
  heldCount() }`. Each voice is its own `osc → amp(ADSR)` summed into `output`
  (the engine's `vcf`); voices self-destruct on `osc.onended` after their
  release tail; oldest-voice stealing past `maxVoices` (16). Decoupled from the
  engine (takes ctx/output/getParams) so it's testable and reusable per-track
  in the future. Release uses `cancelAndHoldAtTime` so note-offs scheduled
  ahead of time ramp from the value **at** the release instant.

### DAW surfaces (L2, L6 — the visible DAW UI)

- `src/transportUI.js` — the transport bar (L2): Play/Stop, live
  `bar . beat . sixteenth` readout (pulled each frame in `main.js` — position is
  mutated in place, off the subscribe path), editable BPM, time signature, and
  metronome/loop LED toggles. Reflects committed state via `store.subscribe`;
  exports `initTransportUI`, `refreshTransportPosition`, and the pure
  `formatPosition` helper.
- `src/sequencer.js` — the step-sequencer engine (L6), pure + testable. A
  diatonic `SCALE` (C-major, 8 degrees) with `rowToPitch`, `stepToColumn`,
  `activeNotesAt` (the chord in a column), `stepDuration`, `swingOffset`, and
  `createSequencerConsumer({ getPattern, getBpm, noteOn, noteOff, … })` — a
  scheduler consumer that fires a **gated** polyphonic voice for each active cell
  per step.
- `src/sequencerUI.js` — renders the pattern grid (8 pitch rows × up to 16
  steps) entirely from `store.pattern()`: click a cell → `store.setPath` toggle
  (undoable); Steps (8/16), Swing, Clear controls; a transport-synced playhead
  pulled each frame (`refreshSequencerPlayhead`). Lives in a "Sequencer" tab
  that takes over the lower-left area and hides the keyboard while active
  (`body[data-stage="seq"]`). **Interim home** — a real work-area is L5/L3.

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
| `scope-canvas`, `spectrum-canvas` | `scope.js` |
| `teach-title`, `teach-body`, `teach-canvas` | `teaching.js` |
| `c-osc`, `c-filter`, `c-adsr`, `c-lfo`, `c-fx` | `canvas.js` |
| `mod-osc`, `mod-filter`, `mod-adsr`, `mod-lfo`, `mod-fx` | `progressionUI.js` (adds/removes CSS classes) |
| `v-oct`, `v-detune`, `v-cutoff`, `v-res`, `v-fenv`, `v-atk`, `v-dec`, `v-sus`, `v-rel`, `v-lforate`, `v-lfodepth`, `v-delaytime`, `v-delayfb`, `v-delaymix`, `v-reverbmix` | `controls.js` |
| `s-oct`, `s-detune`, `s-cutoff`, `s-res`, `s-fenv`, `s-atk`, `s-dec`, `s-sus`, `s-rel`, `s-lforate`, `s-lfodepth`, `s-delaytime`, `s-delayfb`, `s-delaymix`, `s-reverbmix`, `master-vol` | `controls.js` (`wire()`) |
| `wave-btns`, `ftype-btns`, `lfodest-btns` | `controls.js` (`wireToggleGroup()`) |
| `tr-play`, `tr-pos`, `tr-bpm`, `tr-sig`, `tr-metro`, `tr-loop` | `transportUI.js` (L2) |
| `tab-scope`, `tab-seq`, `view-scope`, `view-seq` | `sequencerUI.js` (lower-area tabs) |
| `seq-grid`, `seq-length`, `seq-swing`, `seq-clear` | `sequencerUI.js` (L6) |
| `preset-select`, `preset-load-btn`, `preset-name-input`, `preset-save-btn`, `preset-delete-btn` | `presets.js` |

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
- `src/store.test.js` — the project store (E1): set/setPath/setTransient,
  history coalescing, undo/redo, serialize/load round-trip, in-place apply.
- `src/scheduler.test.js` — the lookahead core (E2) with an injected clock:
  windowing, step spacing at tempo, mid-run tempo change, stop, and the musical
  position/loop-wrap helpers.
- `src/audio.test.js` — `makeImpulse` (reverb IR) shape/decay/bounds.
- `src/voices.test.js` — the voice manager (E3) with a fake `AudioContext`:
  allocation, velocity-scaled ADSR, release + `osc.stop`, self-clean, simultaneous
  voices, oldest-voice stealing, `releaseAll`.
- `src/sequencer.test.js` — the sequencer engine (L6): diatonic pitch mapping,
  column wrap, chord read-out, step duration, swing, gated note firing.
- `src/transportUI.test.js` — the pure `formatPosition` helper.

When adding a new module or stage, add matching tests in the same pattern.
Always mock `localStorage` in progression/bossEngine tests via `vi.stubGlobal`.
Engine pieces (`scheduler`, `voices`, `sequencer`) take their dependencies as
injected functions/objects specifically so they can be tested without a browser
— keep that seam when extending them. Full suite is currently **115 tests**.

## Conventions

- All synth parameters live in `S` (`state.js`). Progression state lives in
  `progression` (`progression.js`). Keep these two singletons strictly separate —
  the synth layer never imports from the progression layer. The engine layer
  (`store`/`transport`/`scheduler`/`voices`) also never imports from progression.
- **Reads use `S`; writes go through `store`.** `S` is just `store.params()`,
  so `S.cutoff` reads are fine, but never assign `S.cutoff = v` directly — call
  `store.set('cutoff', v)` (or `store.setPath(...)` for non-param tree paths) so
  the change is undoable and notifies subscribers. `controls.js` and
  `keyboard.js` already route their writes this way; follow suit. Use
  `setTransient` only for playback state that must not pollute undo history
  (`transport.playing`, `transport.position`).
- New time-driven feature? Register a **transport consumer**
  (`transport.registerConsumer(fn)`, `fn(step, time, position)`) and schedule
  audio at the provided `time` against `engine.ctx.currentTime` — don't spin your
  own timer. Polyphonic notes go through `voiceNoteOn/voiceNoteOff`; the mono
  live path is for the keyboard only.
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

## DAW-foundation progress (built toward the full sandbox)

The engine + first DAW surfaces now exist, ahead of the Act-by-Act game framing.
**Shipped:** `E1` project-state store, `E2` transport clock + lookahead scheduler,
`E3` polyphonic voice manager, `L2` transport bar UI, `L6` step sequencer (v1).
These are wired and tested but mostly **not yet gated into the game** — e.g. the
transport bar and sequencer are visible now rather than unlocked at Act IV, and
the live keyboard is still mono (Act III turns on live polyphony, which the voice
manager already supports). The sequencer's lower-left tab is an **interim home**
until the work-area layout exists.

**Next foundations (not yet built):** `L1/L3/L5` region shell + view modes +
time-ruler work-area (gives the sequencer a real home), `E4` multi-track graph +
mixer, `E7` surfaced undo/redo, `L16a` MIDI file I/O. Live Web MIDI (`E9`) is an
enhancement that must never hard-gate — it's unavailable on all iOS and desktop
Safari (see the architecture doc). Per-step velocity and the Act IV boss
"target pattern" overlay are deferred sequencer follow-ups.

## Act II+ game roadmap

Act I covers the four existing modules. Future acts follow the same
stage → boss pattern (the engine for several of these is already built; the work
remaining is the boss framing + gating):

- **Act II** — noise generator (white/pink noise source), second oscillator
  (detuned stacking, unison)
- **Act III** — live-keyboard polyphony (`E3` voice manager is built; this act
  routes the keyboard through it so held notes sustain as chords)
- **Act IV** — step sequencer/arpeggiator (`L6` v1 built), MIDI in/out (never
  hard-gates — players without MIDI hardware must never be soft-locked)

Defeating the final Act IV boss opens a full DAW sandbox with all capabilities
visible at once.

### Reference docs

- `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md` —
  full phased roadmap and requirements.
- `docs/brainstorms/2026-06-22-boss-visuals-historical-context-requirements.md` —
  boss art and historical lore design decisions.
- `docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md` — the
  layered state-driven architecture, verified MIDI/mobile constraints, and the
  `E1–E10` engine backlog.
- `docs/daw-layout-backlog.md` — the `L1–L17` layout backlog (region taxonomy,
  view modes, sequencer surfaces).
- `docs/backlog.md` — the `B1–B16` synth/gameplay polish backlog.
- `docs/plans/` — per-feature implementation plans (E1, E2, E3, L1 region shell).
