# Synthehol — project context for Claude Code

Synthehol is a browser synth and guided learning game. Players unlock synthesis
concepts one at a time — oscillator (VCO), filter (VCF), envelope (VCA/ADSR),
LFO, noise (VNO), a second oscillator (VCO2), and a "match the sound" capstone
— each gated by a **boss fight** they win by sculpting (or reproducing) the
target sound. Defeating all seven bosses graduates the player into a free-play
DAW sandbox — which already has a transport, step sequencer, piano-roll, live
MIDI input, undo/redo, project auto-save, and audio export sitting underneath
it, ungated, the whole time. The goal is "fun first, accurate second" — every
control should sound good to play with, and touching it should teach the user
what just happened to the sound.

## Stack

Plain JS (ES modules) + Web Audio API + Canvas 2D, bundled with Vite. No
framework, no audio library — the signal chain is hand-built from
`AudioNode`s so the code itself stays readable as a synthesis reference.

Run with `npm run dev`; build with `npm run build`; run tests with `npm test`.

## Architecture

### Synth layer

- `src/state.js` — `S`, the single mutable object holding every synth
  parameter: waveform/octave/detune, noise (`noiseType`/`noiseMix`), a second
  oscillator (`osc2Waveform`/`osc2Octave`/`osc2Detune`/`osc2Mix`),
  filterType/cutoff/resonance/`filterEnvAmount`, attack/decay/sustain/release,
  lfoDest/lfoRate/lfoDepth/`lfoWaveform`/`lfoRetrigger`, a 3-band EQ
  (`eqLow`/`eqMid`/`eqHigh`), FX (`drive`, delay, reverb), and `masterVol`.
  `S` is not the source of truth: it's `store.params()` (the active track's
  `instrument.params` object) re-exported. Reads still use `S.cutoff` etc.;
  **writes must go through the store** (`store.set('cutoff', v)`) so they
  record undo history and notify subscribers — see the Engine layer below.
  `S.lfoDest` is one of `'filter'`, `'pitch'`, `'amp'`, or `'none'`.
- `src/audio.js` — owns the `AudioContext` and node graph via the `engine`
  object (`engine.ctx`, `engine.vcf`, `engine.drive`, `engine.eqLow/eqMid/
  eqHigh`, `engine.master`, `engine.scope`, `engine.lfoOsc`, `engine.lfoMod`,
  `engine.lfoShSource` (a `ConstantSourceNode`, the Sample & Hold LFO shape's
  source — D1), the FX nodes `delay`/`delayFb`/`delayWet`/`reverb`/
  `reverbWet`, `engine.voices` (the polyphonic pool, E3), `engine.streamDest`
  (a `MediaStreamAudioDestinationNode` tap for `exporter.js`), the signal-flow
  analyser taps `tapSource`/`tapFilter`/`tapEq` (D3), `engine.noteOn`,
  `engine.currentNote`). Audio is lazily started on the first key press
  (`startAudio()`), not on page load — browsers block `AudioContext` creation
  without a user gesture.
  **Signal chain (fully polyphonic — there is no mono note path anymore):**
  `voices (E3, per-note osc+osc2+noise+ampEnv) → vcf (VCF) → drive
  (WaveShaper saturation) → eqLow → eqMid → eqHigh → master → scope →
  destination`, with `master` also fanning out to delay + reverb sends summed
  back at `scope`, and `scope` branching once more into `streamDest` for
  export. Every note — the live keyboard, MIDI, the sequencer, the piano
  roll — allocates its own voice via `voiceNoteOn(note,octave,time,velocity)
  → id` / `voiceNoteOff(id,time)` / `releaseAllVoices(time)`; simultaneous
  notes (chords, overlapping sequencer steps) coexist. `applyLFORouting()`
  patches the shared `lfoMod` gain into `vcf.frequency` when
  `S.lfoDest === 'filter'`; LFO→Pitch/Amp instead fan into each voice's own
  `osc.detune`/`amp.gain` at voice-build time (see `voices.js`) since there's
  no single mono node to route to. `applyFilterEnv(time)` /
  `releaseFilterEnv(time)` sweep the shared filter cutoff per chord onset/
  release (the filter envelope, and the LFO key-sync retrigger via
  `restartLfoOsc(time)`, are chord-level effects — see `chordState.js`
  below, not per-voice). `applyLFOWaveform()` swaps which source feeds
  `lfoMod` — the continuous `lfoOsc` for the four native waveforms, or
  `lfoShSource` for Sample & Hold (D1's gated 5th shape; there's no native
  `OscillatorType` for stepped random values) — mutually exclusive, called
  whenever `S.lfoWaveform` changes and at startup. `tickSampleHold()`,
  called once per frame from `main.js`'s rAF loop, steps `lfoShSource`
  to a fresh random value once per LFO cycle via scheduled
  `setValueAtTime` calls; a no-op unless S&H is the active shape.
  `previewPatch(patch, note, octave, duration)` plays
  a one-off note through a separate, throwaway voice pool built from an
  arbitrary `patch` object instead of live `S` — used by the boss "Hear the
  target" button (B15) and hover-preview (D2) so auditioning a sound never
  touches the player's own held note. `makeImpulse` builds the reverb IR;
  `makeDriveCurve` builds the WaveShaper curve. Exports: `startAudio`,
  `voiceNoteOn`, `voiceNoteOff`, `releaseAllVoices`, `previewPatch`,
  `applyLFORouting`, `applyLFOWaveform`, `tickSampleHold`, `lfoDepthScaled`,
  `applyFilterEnv`, `releaseFilterEnv`, `restartLfoOsc`, `makeImpulse`,
  `makeDriveCurve`.
- `src/notes.js` — `noteFreq(note, octave)` converts note names (`'C'`,
  `'C#'`, …, `'C5'`) and an octave number to a frequency in Hz using equal
  temperament (A4=440 Hz); `NOTE_NAMES`, the 12-note chromatic array used by
  `midi.js` and `pianoroll.js`. `'C5'` is a special case that always yields
  one octave above the current base octave.
- `src/chordState.js` — shared chord-level bookkeeping across every note
  input source (keyboard, MIDI). All voices share one filter and one LFO
  oscillator, so the filter envelope and LFO key-sync retrigger must fire
  once when the FIRST held note from ANY source starts, and release once
  when the LAST one from ANY source lets go — a single module-level counter,
  not something each input tracks independently, otherwise releasing a MIDI
  note while a keyboard note is still held would incorrectly end the chord.
  `noteOnsetIfFirst(time)` / `noteReleaseIfLast(time)`; also flips
  `engine.noteOn` (the boss engine's `isPlaying` signal).
- `src/keyboard.js` — builds the on-screen piano DOM and maps both
  mouse/touch and a fixed set of computer-keyboard keys (A–K plus black-key
  row W/E/T/Y/U, Z/X for octave shift) to `voiceNoteOn`/`voiceNoteOff` in
  `audio.js`, routed through `chordState.js` so live-keyboard chords behave
  like the polyphonic sequencer/MIDI paths. Pointer Y-position on a key maps
  to velocity (press low on the key = louder).
- `src/midi.js` — live MIDI input (E9), feature-detected via
  `navigator.requestMIDIAccess`; silently no-ops where Web MIDI is
  unavailable (Safari, iOS, Firefox without a flag) or permission is denied.
  `midiNoteToPitch`/`parseMidiMessage` are pure and tested standalone. MIDI
  notes share the same polyphonic voice pool and `chordState.js` bookkeeping
  as the keyboard, so a MIDI chord and a keyboard chord interleave correctly.
  MIDI output is not implemented.
- `src/controls.js` — the only place that wires DOM inputs to `S`, to audio
  params, to a module's mini-canvas redraw, and to the teaching panel. When
  adding a new control, follow the `wire()` / `wireToggleGroup()` pattern
  here rather than adding ad hoc listeners elsewhere. **Boss damage is no
  longer fired from here** — `main.js` ticks the boss engine once per
  animation frame off the live `S` and `engine.noteOn` instead (see
  Progression layer below); `wire()`/`wireToggleGroup()` still call
  `fillSlider` and `teach()`. Also exports `applyPreset(patch)`, which
  resyncs every slider/toggle (and, transitively, the engine + canvases)
  from a plain params object — used by preset load, shared-patch links,
  project persistence restore, and undo/redo.
- `src/knob.js` — `initKnobs()` / `enhanceKnob(input)`: a hardware-style
  rotary SVG skin drawn over every `input[type="range"][data-knob]`. The
  range input stays the single source of truth (focusable, keyboard- and
  screen-reader-operable); the knob only translates pointer gestures into
  value changes and dispatches `input` events, so `wire()`, the teaching
  panel, the boss engine, and `applyPreset()` all keep working unmodified.
  Vertical drag = adjust (Shift = fine, Ctrl/Cmd = coarse); wheel = step;
  double-click = reset to `input.defaultValue`.
- `src/canvas.js` — shared drawing primitives: `waveformSample`,
  `drawWaveOnCanvas`, `drawFilterCurveOnCanvas`, `drawADSRShape`, plus the
  per-module mini-canvas renderers (`drawOscCanvas`, `drawOsc2Canvas`,
  `drawNoiseCanvas`, `drawFilterCanvas`, `drawEqCanvas`, `drawADSRCanvas`,
  `drawLFOCanvas`, `drawFXCanvas`) and `advanceLfoPhase`. `drawModCanvas(id)`
  dispatches to the right renderer by module name. These are reused by
  `teaching.js` so the teaching panel can render the same shapes at a
  different scale. The LFO canvas is animated: `advanceLfoPhase()` advances
  a module-level `lfoPhase` counter every frame (driven by `main.js`'s single
  rAF dispatcher, not its own loop).
- `src/scope.js` — `drawScope()` and `drawSpectrum()`, the always-visible
  oscilloscope and FFT view. Both read `engine.scope` (an `AnalyserNode`)
  once per frame from `main.js`'s rAF dispatcher (not their own loops — see
  E8); the scope finds a zero-crossing for a jitter-free display and draws a
  phosphor-green waveform with a subtle glow; the spectrum draws bars over
  frequency-domain bins. `diagnostics.js` reuses this same analyser.
- `src/teaching.js` — `teach(key)` looks up `TEACHINGS[key]` (title, body
  copy, draw function) and populates `#teach-title`, `#teach-body`, and
  `#teach-canvas`. Keys come in two flavours: control keys like
  `'filter-cutoff'` (called by `controls.js` after every parameter change)
  and lore keys like `'lore-osc'` (called by `progressionUI.js` when a lore
  button is clicked, one per module including `'lore-noise'`/`'lore-osc2'`/
  `'lore-eq'`). The Learn panel now has two tabs — Learn (`teach()` output)
  and History (the stage-intro pioneer/instrument/fact) — switched by
  `progressionUI.js`'s `switchTeachView`, not `teach()` itself.
- `src/ui.js` — small shared UI helpers: `setStatus(text, active)` updates
  the `#status-pill` element; `fillSlider(el)` writes the `--pct` CSS custom
  property on a range input so the CSS gradient fill (and the knob skin)
  tracks the value.
- `src/drums.js` — three synthesized one-shot drum voices (F5 lean step),
  no samples: `playKick`/`playSnare`/`playHat(ctx, dest, time)`. Fed straight
  into the master bus so they're heard, exported, and scaled by the volume
  slider like everything else. Triggered from the sequencer's drum lanes
  (`main.js`'s `createSequencerConsumer` wiring) and reused verbatim by
  `wavRender.js`'s offline render.
- `src/bossArt.js` — `BOSS_SVG`, an object keyed by stage/challenge id
  (`'osc'`, `'filter'`, `'envelope'`, `'lfo'`, `'noise'`, `'osc2'`, `'mimic'`,
  and `'lfo-sh'` for the D1 bonus challenge boss) containing inline SVG
  strings for each boss character. `stroke="currentColor"` so CSS context
  colors the art.
- `src/bossAudio.js` — combat sound effects (B6): a throttled damage blip
  (pitch rises as the boss's HP falls — `damageBlipFreq(hpFrac)`, pure and
  tested) while draining a boss, a resolving major arpeggio (`RESTORE_ARP`)
  on defeat, and a longer fanfare (`GRADUATION_ARP`) on graduation. Routed
  through its own gain straight to `ctx.destination`, bypassing the player's
  master volume/filter — SFX is feedback, not instrument. `initBossAudio()`
  subscribes to `bossEngine.onDamage`/`onRestore`.
- `src/main.js` — entry point. Imports `style.css`; inits the keyboard, MIDI,
  signal-flow LEDs, diagnostics, controls, hover-preview, knobs, export,
  offline-.wav render, undo/redo (header buttons + Ctrl+Z/⇧+Ctrl+Z/Ctrl+Y),
  the transport clock + its consumers (metronome, sequencer, piano-roll),
  the transport bar UI, the sequencer UI, the piano-roll UI, the clips UI,
  boss audio, presets, and project persistence; then on the `load` event
  calls `initProgressionUI()` and starts the single rAF `animate()` loop
  (E8 — LFO canvas, scope, spectrum, signal-flow LEDs, diagnostics, transport
  position, sequencer/piano-roll playheads, and the boss-engine tick, all off
  one `requestAnimationFrame`). Exposes debug hooks `window.synthStore` (E1),
  `window.synthTransport` (E2), and `window.synthAudio` (E3:
  `{ engine, voiceNoteOn, voiceNoteOff, releaseAllVoices }`) for
  console/headless verification. Re-draws the static module canvases on
  `resize`.

### Engine layer (E1–E3, E6, E8, E9 — the serializable DAW foundation)

This layer was added to turn the single-synth toy into a DAW core. It imports
nothing from the progression layer.

- `src/store.js` — **`store`, the serializable project tree and source of truth
  behind `S` (E1).** Owns `project = { version, transport, tracks[], activeTrackId }`.
  Each track has `{ id, name, instrument:{ type, params }, fx, clips, pattern,
  mixer }`; the active track's `instrument.params` **is** the object exported as
  `S`. `transport` holds `{ bpm, timeSig, playing, metronome, countIn, loop,
  position }`. API: `get()`, `params()`, `pattern()`, `activeTrackIndex()`,
  `set(key,value)` (active-param write, **undoable**), `setPath(path,value)`
  (any tree path, undoable — array indices work, e.g.
  `tracks.0.pattern.cells.3.5`), `setTransient(path,value)` (writes **without**
  history, for playback state like `transport.playing`), `subscribe(fn)`,
  `canUndo()`/`canRedo()`, `serialize()`/`load(json)`, `undo()`/`redo()`,
  `reset()`, `_resetForTest()`. **Pattern clips (L8)** live here too:
  `clips()`, `saveClip(name)`, `loadClip(id)`, `duplicateClip(id, newName)`,
  `deleteClip(id)` — a per-track library of saved patterns (step grid + drums
  + automation + piano roll), undo-tracked and serialized with the project
  (unlike synth presets, which are a separate global `localStorage` key).
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
  `toggleMetronome()`, `toggleCountIn()`, `setLoop()`, `registerConsumer(fn)`
  where `fn(step, time, position)`. Falls back to a main-thread interval if
  `Worker` is unavailable. Count-in (a bar of clicks before playback starts)
  and tap-tempo (`tr-tap` averages recent tap gaps into BPM) are transport-bar
  features (F7) built on this.
- `src/metronome.js` — `metronomeConsumer(step,time,pos)`, the first scheduler
  consumer: a click each beat (accented on the downbeat), gated by
  `transport.metronome`, on its own gain bus.
- `src/voices.js` — **the polyphonic voice manager (E3), the only note path.**
  `createVoiceManager({ ctx, output, getParams, maxVoices, lfoMod })` returns
  `{ noteOn(freq,time,vel)→id, noteOff(id,time), releaseAll(time), activeCount(),
  heldCount() }`. Each voice is `osc` (main waveform) + `osc2` (second
  oscillator, octave/detune/mix from `S.osc2*`) + a looped noise source
  (white, or shelved toward pink) + one `amp` (ADSR) gain, all summed and
  connected to `output` (the engine's `vcf`); voices self-destruct on
  `osc.onended` after their release tail; oldest-voice stealing past
  `maxVoices` (16 live, 32 for the offline `.wav` render). Release uses
  `cancelAndHoldAtTime` so note-offs scheduled ahead of time ramp from the
  value **at** the release instant. If `lfoMod` is passed, `LFO→Pitch`/
  `LFO→Amp` connect to *this voice's own* `osc.detune`/`osc2.detune`/
  `amp.gain` at build time (LFO→Filter needs no per-voice wiring — every
  voice already shares one downstream filter). Decoupled from the engine
  (takes ctx/output/getParams) so it's testable and reusable per-track once
  E4 (multi-track) lands; `wavRender.js` builds a second instance of this
  same manager against an `OfflineAudioContext`.
- `src/persistence.js` — **project auto-persistence (E6 lean step).** The
  whole project (synth params, pattern, clips, transport settings) debounce-
  saves to `localStorage` (`synthehol_project`, 500ms after the last change)
  and restores on load via `initPersistence(store, applyPreset)` — work
  survives a refresh. `.json` file import/export and `.mid` import/export are
  still open (see the E-tier doc).
- `src/exporter.js` — **real-time audio export (F2 v1).** `MediaRecorder`
  capture of `engine.streamDest` (the exact post-FX signal the speakers get)
  → downloadable `.webm`/`.opus` (codec is whatever the browser supports).
  `initExport()` wires the `#export-btn` toggle.
- `src/wavRender.js` — **offline `.wav` render (E6 continuation).** Rebuilds
  the whole signal chain fresh inside an `OfflineAudioContext`, walks the
  active pattern directly (step grid + drums + piano-roll + automation) once
  computing exact step times — no real-time scheduler involved — and encodes
  the result to 16-bit PCM (`audioBufferToWav`, pure/tested). Deliberately
  duplicates `audio.js`'s graph-building rather than sharing a factory: this
  module never touches the live engine, so a mistake here can't destabilize
  real-time playback, and an `OfflineAudioContext` needs no user-gesture
  unlock. `initWavRender()` wires the `#render-wav-btn`.

### DAW surfaces (L2, L5–L8 — the visible DAW UI)

- `src/transportUI.js` — the transport bar (L2): Play/Stop, live
  `bar . beat . sixteenth` readout (pulled each frame in `main.js` — position is
  mutated in place, off the subscribe path), editable BPM, time signature,
  metronome/loop/count-in LED toggles, and a tap-tempo button. Reflects
  committed state via `store.subscribe`; exports `initTransportUI`,
  `refreshTransportPosition`, and the pure `formatPosition` helper.
- `src/sequencer.js` — the step-sequencer engine (L6), pure + testable. A
  diatonic `SCALE` (C-major, 8 degrees) with `rowToPitch`, `stepToColumn`,
  `activeNotesAt` (the chord in a column), `stepDuration`, `swingOffset`, and
  `createSequencerConsumer({ getPattern, getBpm, noteOn, noteOff, setCutoff,
  setResonance, setVolume, playKick, playSnare, playHat, … })` — a scheduler
  consumer that fires a **gated** polyphonic voice for each active pitch
  cell, triggers whichever drum lanes are hit, and applies per-step
  automation (F1 v2 — cutoff/resonance/volume, whichever lanes have points,
  even across rests) per step.
- `src/sequencerUI.js` — renders the pattern grid (8 pitch rows × up to 16
  steps, plus drum lanes and a selectable automation lane) entirely from
  `store.pattern()`: click a cell → `store.setPath` toggle (undoable); a
  bar/beat ruler (`#seq-ruler`, L5 lean step) with a transport-synced
  playhead; Steps (8/16), Swing, Clear, and Duplicate (F6 — copies the
  pattern's first half into its second half) controls. Lives in a
  "Sequencer" tab (of a `#lower-tabs` strip that also holds Scope and Piano
  Roll) that takes over the lower-left area and hides the keyboard while
  active (`body[data-stage="seq"]`).
- `src/pianoroll.js` — the piano-roll engine (L7 lean step), pure + testable.
  A chromatic `ROLL_ROWS = 24` (2 octaves) grid sharing the step sequencer's
  timing helpers (`stepToColumn`/`stepDuration`/`swingOffset`) but storing a
  note as a **run** of consecutive true cells in one row
  (`pattern.roll[row][col]`), not a one-step blip. `rollRowToPitch(row,
  baseOctave)`, `noteRunsStartingAt(pattern, col)` (pure, shared by the UI and
  the consumer), and `createPianoRollConsumer({ getPattern, getBpm, noteOn,
  noteOff, … })` — fires one gated voice per run at its leading edge, held
  for the run's full length.
- `src/pianoRollUI.js` — renders the chromatic grid in a "Piano Roll" tab,
  reusing the exact `.seq-cell`/`.seq-ruler`/`.seq-rowlabel` styling as the
  step sequencer. Click-to-add a note, drag right to lengthen it (capped so
  it can't swallow a neighboring note), click an existing note to erase the
  whole run. `refreshPianoRollPlayhead()` mirrors the sequencer's playhead
  derivation.
- `src/clipsUI.js` — **pattern/clip management (L8).** A "Pattern" bar
  (`#clips-bar`, shared by the Sequencer and Piano Roll tabs since both edit
  `store.pattern()`) to save/load/duplicate/delete named pattern snapshots —
  the same mental model as `presets.js`, scoped to `track.clips` instead of
  a global sound library. Resyncs its `<select>` on every `store.subscribe`
  tick since undo/redo can change the clip list out from under it.

### Differentiation layer (D2–D4 — legibility/feedback bets)

Not a new architectural layer so much as small, focused modules implementing
the "beat Ableton on legibility, not features" bets in
`docs/brainstorms/2026-07-01-daw-differentiation-north-star.md`.

- `src/hoverPreview.js` — **hover A/B preview (D2 v1).** Hovering an inactive
  option in a toggle group (waveform, filter type, noise type, osc2
  waveform, LFO dest/shape) plays a short before/after — the current patch,
  then the same patch with that one option swapped — via `previewPatch()`,
  so it never touches the live sound or a held note. `buildHoverPreview`
  is pure/tested; a 250ms hover-dwell timer avoids firing on a passing mouse.
  Scoped to toggle groups only — sliders have no natural "hover value".
- `src/signalFlow.js` — **visible signal flow (D3 v1).** A small LED per
  audio-path rack module (source modules — both oscillators, noise, the amp
  envelope — all light from `engine.tapSource`, since their individual
  contributions aren't separable without per-source buses; filter from
  `tapFilter`; EQ from `tapEq`; FX from the existing `engine.scope`). The LFO
  module has no LED — it's modulation, not audio. `peakLevel(data)` is pure/
  tested; `refreshSignalFlow()` runs off `main.js`'s single rAF dispatcher.
- `src/diagnostics.js` — **sound diagnostics (D4 v1), "a grammar checker for
  sound."** Reuses the existing scope analyser (no new audio nodes).
  `analyzeSpectrum(data, sampleRate)` buckets frequency-domain bytes into 6
  bands (sub/low/lowMid/mid/highMid/high); `detectClipping(timeData)` flags
  sustained rail-pinning from time-domain bytes; `diagnose(bands, clipping)`
  turns those into at most one short, actionable line ("Energy piling up
  250–500 Hz — sounds muddy…"), or `null` near silence or when nothing
  dominates. All three are pure/tested. Clipping always takes priority (a
  technical problem, not a taste call). `refreshDiagnostics(engine, now)` is
  throttled to twice a second off the shared rAF loop.

### Progression layer (sits above the synth layer)

- `src/stages.js` — `STAGES`, the seven-stage progression: four Moog-era
  modules (osc/filter/envelope/lfo), an ARP 2600 noise stage, an Oberheim
  Two-Voice second-oscillator stage, and a Sequential Circuits Prophet-5
  capstone ("The Mimic"). Each entry carries `id`, `moduleId` (DOM element
  id, `null` for the capstone — it spans every module learned so far), `era`,
  `instrument`, `pioneer`, `historyYear`, `historyFact`, `intro`, and `boss`
  (`{ name, corruptedOf, taunt, maxHp, dps }`). Each entry's
  `target(S, isPlaying) => boolean | number` predicate defines "dealing
  damage": a boolean for a threshold stage, or a 0..1 "how close" intensity
  for a distance-based stage. The capstone's `matchIntensity(S, spec)` scores
  a 7-dimension reference patch (`MIMIC_PATCH`) — waveform, cutoff, attack,
  sustain, LFO dest+depth, osc2 mix — averaged into one closeness score, and
  exposes `matchTarget` so `progressionUI.js`'s "Hear the target" button can
  audition it via `previewPatch()` without touching the player's own sound.
  Exports `STAGES` (default + named) and `stageById(id)`. Also exports
  **`CHALLENGES`** (D1) — a second, independent unlock track: post-
  graduation bonus bosses, shape-compatible with `STAGES` (same fields) plus
  an `unlocks` key naming the `progression.unlockedFeatures` entry they
  grant. The pilot entry, `'lfo-sh'` ("The Predictable", corrupted Buchla
  266 Source of Uncertainty), gates the LFO's Sample & Hold shape; its
  `target()` requires extreme-but-already-unlocked LFO settings (Pitch dest,
  Square shape, Rate > 15 Hz, Depth > 70%) — a challenge can't require the
  gated feature itself as its own unlock condition.
- `src/progression.js` — `progression`, the singleton holding
  `currentStageIndex`, `xp`, `defeated[]`, and `unlockedFeatures[]` (D1;
  `unlockedCount` is a derived getter, `currentStageIndex + 1`, not stored —
  B13). Persists to `localStorage` under the key `synthehol_progress`.
  Completely independent of `state.js` — no imports from the synth layer.
  Also exports `STAGE_IDS` (`['osc', 'filter', 'envelope', 'lfo', 'noise',
  'osc2', 'mimic']`). Methods: `load()`, `save()`, `reset()`, `unlockNext()`,
  `addXp(n)`, `markDefeated(id)`, `hasFeature(id)`, `unlockFeature(id)`.
  `unlockedFeatures` is an optional field on the persisted shape (older
  saves predate it) — a missing value defaults to `[]` rather than failing
  validation, unlike a malformed one.
- `src/bossEngine.js` — `bossEngine`, the pure evaluator.
  **`activeEncounter()`** returns whichever boss is currently being fought:
  a `STAGES` entry while the main progression is running, or — once
  `graduated` — the first not-yet-unlocked `CHALLENGES` entry (D1), or
  `null` once both tracks are fully cleared. **`tick({ S, isPlaying, dt })`**
  is called once per animation frame by `main.js` (not per control-change
  anymore — B1): while `activeEncounter().target()` is true, it drains the
  boss's HP at `boss.dps * dt * intensity` (intensity = the predicate's 0..1
  return, or `1` for a boolean `true`); while it's false, the boss heals at
  a flat `HEAL_RATE`. Fires `onDamage`/`onRestore` (`onRestore`'s payload
  includes `challenge: true` when the defeated encounter was a bonus
  challenge, not a stage) callbacks, flushes accumulated XP to `progression`
  at most every 0.5s, and runs the defeat → unlock → restore sequence when
  HP hits zero. `_defeat(stage)` branches on `stage.unlocks`: a `CHALLENGES`
  entry calls `progression.unlockFeature()`, a `STAGES` entry calls
  `markDefeated()`/`unlockNext()` and sets `graduated = true` once all seven
  stages are cleared — challenge outcomes never touch `currentStageIndex` or
  `graduated`. `activateStage()` sets `currentHp` to `activeEncounter()`'s
  `maxHp` (0 if nothing is left to fight). `_clearListeners()` is provided
  for test teardown only.
- `src/progressionUI.js` — `initProgressionUI()` is the only place that
  touches DOM for progression concerns. `updateHUD()`, `showStageIntro()`,
  and `enterBattle()` all read `bossEngine.activeEncounter()` rather than
  `STAGES[currentStageIndex]` directly, so the same code drives the boss
  panel for either unlock track (main stage, or a D1 bonus challenge) —
  `enterBattle()` no-ops once `activeEncounter()` is `null` (nothing left to
  fight). It wires: the boss panel (`#boss-panel`, `#boss-panel-name`,
  `#boss-taunt`, `#boss-hp-fill`, `.boss-svg-wrap` using `BOSS_SVG` from
  `bossArt.js`, and `#boss-preview-btn` for match-the-sound stages), module
  lock/unlock CSS classes (`locked`, `active-stage`), the Learn-panel
  History tab (`#stage-intro-pioneer`, `#stage-intro-instrument`,
  `#stage-intro-fact` — no longer a transient banner, a permanent tab
  alongside Learn), the `battle-active` layout on `<main>`, the CSS glitch
  intensity variable `--gi` (0→1 as HP drains), the graduation screen
  (`#graduation-banner` — shown once, the instant the main 7-stage
  progression clears; idempotent, so a later bonus-challenge defeat
  re-running that check is harmless), `revealUnlockedFeatures()` (shows/
  hides `#lfowave-sh-btn` per `progression.hasFeature('lfoSampleHold')`,
  called on init and after every restore), lore buttons, and the reset
  button. The `body[data-layers]` attribute (0–4, capped — it does not track
  all 7 stages 1:1) advances each time a boss is restored and drives CSS
  era-layering effects. Note: the graduation banner text still reads "The
  Rack Is Restored" for the main progression only — bonus challenges (D1)
  intentionally don't get their own banner, just the boss panel re-engaging.

## DOM structure (index.html)

Key element ids that code writes to:

| id | owner |
|---|---|
| `status-pill` | `ui.js` via `setStatus()` |
| `boss-panel`, `boss-panel-name`, `.boss-svg-wrap`, `boss-taunt`, `boss-hp-fill`, `boss-preview-btn` | `progressionUI.js` + `bossArt.js` |
| `stage-intro-pioneer`, `stage-intro-instrument`, `stage-intro-fact` | `progressionUI.js` |
| `graduation-banner` | `progressionUI.js` |
| `reset-btn` | `progressionUI.js` |
| `keyboard`, `play-hint` | `keyboard.js` |
| `scope-canvas`, `spectrum-canvas` | `scope.js` |
| `diagnosis` | `diagnostics.js` |
| `teach-title`, `teach-body`, `teach-canvas`, `teach-view-learn`, `teach-view-history`, `.teach-tab` | `teaching.js` + `progressionUI.js` |
| `c-osc`, `c-osc2`, `c-noise`, `c-filter`, `c-eq`, `c-adsr`, `c-lfo`, `c-fx` | `canvas.js` |
| `mod-osc`, `mod-osc2`, `mod-noise`, `mod-filter`, `mod-eq`, `mod-adsr`, `mod-lfo`, `mod-fx` | `progressionUI.js` (lock classes) + `signalFlow.js` (LEDs) |
| `s-oct`, `s-detune`, `s-noisemix`, `s-osc2oct`, `s-osc2detune`, `s-osc2mix`, `s-cutoff`, `s-res`, `s-fenv`, `s-atk`, `s-dec`, `s-sus`, `s-rel`, `s-lforate`, `s-lfodepth`, `s-drive`, `s-eqlow`, `s-eqmid`, `s-eqhigh`, `s-delaytime`, `s-delayfb`, `s-delaymix`, `s-reverbmix` | `controls.js` (`wire()`) |
| `v-oct`, `v-detune`, `v-noisemix`, `v-osc2oct`, `v-osc2detune`, `v-osc2mix`, `v-cutoff`, `v-res`, `v-fenv`, `v-atk`, `v-dec`, `v-sus`, `v-rel`, `v-lforate`, `v-lfodepth`, `v-drive`, `v-eqlow`, `v-eqmid`, `v-eqhigh`, `v-delaytime`, `v-delayfb`, `v-delaymix`, `v-reverbmix`, `master-vol` | `controls.js` |
| `wave-btns`, `noise-btns`, `osc2wave-btns`, `ftype-btns`, `lfodest-btns`, `lfowave-btns`, `lfowave-sh-btn` (D1-gated), `lfo-keysync` | `controls.js` (`wireToggleGroup()`) + `progressionUI.js` (reveals `lfowave-sh-btn`) |
| `undo-btn`, `redo-btn` | `main.js` |
| `export-btn` | `exporter.js` |
| `render-wav-btn` | `wavRender.js` |
| `share-btn` | `presets.js` |
| `preset-select`, `preset-load-btn`, `preset-name-input`, `preset-save-btn`, `preset-delete-btn` | `presets.js` |
| `tr-play`, `tr-pos`, `tr-bpm`, `tr-sig`, `tr-metro`, `tr-loop`, `tr-countin`, `tr-tap`, `transport-bar` | `transportUI.js` (L2) |
| `lower-tabs`, `tab-scope`, `tab-seq`, `tab-roll`, `view-scope`, `view-seq`, `view-roll` | `sequencerUI.js` / `pianoRollUI.js` (lower-area tabs) |
| `seq-grid`, `seq-ruler`, `seq-length`, `seq-swing`, `seq-clear`, `seq-duplicate`, `seq-auto`, `seq-auto-param` | `sequencerUI.js` (L6) |
| `roll-grid`, `roll-ruler`, `roll-clear` | `pianoRollUI.js` (L7) |
| `clips-bar`, `clip-select`, `clip-load-btn`, `clip-save-btn`, `clip-duplicate-btn`, `clip-delete-btn`, `clip-name-input` | `clipsUI.js` (L8) |

## Testing

Tests use **Vitest** (`npm test` or `npm run test:watch`). Test environment is
`node` (not `jsdom`) — tests that need browser APIs mock them explicitly.
Full suite is currently **19 test files, 209 tests**.

Test files live alongside source files as `src/*.test.js`. Current coverage:

- `src/progression.test.js` — full unit coverage of `progression` singleton:
  fresh state, persistence round-trip, reset, malformed localStorage, `unlockNext`,
  `markDefeated`, `unlockFeature`/`hasFeature` (D1), and that `unlockedFeatures`
  defaults to `[]` on a legacy store that predates the field.
- `src/bossEngine.test.js` — covers `activateStage`, `tick` (no-damage,
  boolean and intensity-scaled damage, healing, XP flush, callbacks), the
  defeat/restore/next-stage sequence, full graduation across all seven
  stages, and `activeEncounter()`/the post-graduation bonus challenge (D1):
  the challenge boss activates automatically on graduation, `tick` is *not*
  a no-op until the challenge is also cleared, defeat unlocks the feature
  without touching `currentStageIndex`, and `onRestore` fires with
  `challenge: true`. Uses a `makeLocalStorageMock()` helper with
  `vi.stubGlobal`; calls `bossEngine._clearListeners()` in `beforeEach`.
- `src/stages.test.js` — validates the `STAGES` array schema (required fields,
  boss fields, valid moduleIds), exports, ordering, `matchIntensity` scoring,
  every stage's `target` predicate with boundary values, and the `CHALLENGES`
  array schema (required fields, no id collisions with `STAGES`, the lfo-sh
  challenge's target predicate).
- `src/teaching.test.js` — verifies `teach()` doesn't throw for lore keys,
  writes non-empty title/body, and includes pioneer names. Mocks `state.js`,
  `canvas.js`, and `document.getElementById` to avoid browser dependencies.
- `src/store.test.js` — the project store (E1): set/setPath/setTransient,
  history coalescing, undo/redo, clip save/load/duplicate/delete, serialize/
  load round-trip, in-place apply.
- `src/scheduler.test.js` — the lookahead core (E2) with an injected clock:
  windowing, step spacing at tempo, mid-run tempo change, stop, and the musical
  position/loop-wrap helpers.
- `src/audio.test.js` — `makeImpulse` (reverb IR) shape/decay/bounds.
- `src/voices.test.js` — the voice manager (E3) with a fake `AudioContext`:
  allocation, velocity-scaled ADSR, osc2/noise summing, release + `osc.stop`,
  self-clean, simultaneous voices, oldest-voice stealing, `releaseAll`.
- `src/sequencer.test.js` — the sequencer engine (L6): diatonic pitch mapping,
  column wrap, chord read-out, step duration, swing, gated note firing.
- `src/transportUI.test.js` — the pure `formatPosition` helper.
- `src/pianoroll.test.js` — the piano-roll engine (L7): row-to-pitch mapping,
  note-run detection, consumer gating/length.
- `src/persistence.test.js` — auto-save/restore round-trip, debounce.
- `src/wavRender.test.js` — `audioBufferToWav` header/PCM correctness.
- `src/midi.test.js` — `midiNoteToPitch`, `parseMidiMessage` (note-on/off,
  running-status note-on-with-zero-velocity).
- `src/chordState.test.js` — onset/release only fire on the first/last held
  note across simulated multi-source chords.
- `src/hoverPreview.test.js` — `buildHoverPreview` pure logic.
- `src/bossAudio.test.js` — `damageBlipFreq` pure pitch curve.
- `src/signalFlow.test.js` — `peakLevel` pure level extraction.
- `src/diagnostics.test.js` — `analyzeSpectrum`, `detectClipping`, `diagnose`
  band/threshold logic.

When adding a new module or stage, add matching tests in the same pattern.
Always mock `localStorage` in progression/bossEngine tests via `vi.stubGlobal`.
Engine pieces (`scheduler`, `voices`, `sequencer`, `pianoroll`) take their
dependencies as injected functions/objects specifically so they can be tested
without a browser — keep that seam when extending them.

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
  own timer. All notes (keyboard, MIDI, sequencer, piano-roll) go through
  `voiceNoteOn`/`voiceNoteOff` — there is no separate mono path.
- **Boss damage is time-based, not event-based.** The boss engine is ticked
  once per animation frame (`bossEngine.tick({ S, isPlaying, dt })` in
  `main.js`), not from `controls.js`/`keyboard.js` event handlers. Don't
  reintroduce a `notify()`-per-input pattern.
- Continuous audio params (cutoff, resonance, master vol, LFO rate/depth, EQ
  gains, drive, delay/reverb mix) are set with `setTargetAtTime` ramps to
  avoid clicks. Discrete changes (waveform type, filter type, detune) may use
  direct `.value =`/`setValueAtTime` — they are instantaneous by nature.
- Canvas redraws are pull-based (call `drawModCanvas('osc')` etc. after a
  state change) except the LFO mini-canvas, oscilloscope, and spectrum, which
  animate continuously via `main.js`'s single rAF dispatcher (E8) — don't add
  a module-owned `requestAnimationFrame` loop; register into `animate()` instead.
- Adding a new slider control: use `wire(id, handler)` in `controls.js`. Adding
  a new toggle group: use `wireToggleGroup(groupId, onSelect)`. Both patterns
  automatically call `fillSlider` and update the teaching panel. If the
  control should be a knob, also give the `<input>` a `data-knob` attribute
  and it's picked up by `initKnobs()` automatically.
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

## Where things stand

**Backlogs are kept current per-feature** (each shipped item gets a `docs:
mark X shipped` commit right after its `feat:` commit) — treat the status
markers in `docs/backlog.md`, `docs/daw-layout-backlog.md`,
`docs/daw-feature-gap-backlog.md`, and
`docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md`'s E-tier
section as accurate. This file (`CLAUDE.md`) and `README.md` are the
architecture/orientation docs and need periodic manual passes like this one
— they don't get a doc-commit per feature.

**Shipped, at a glance:**
- **Progression:** 7 stages (osc/filter/envelope/lfo/noise/osc2 + the Mimic
  capstone), all boss-gated, time-based damage (B1), XP, defeat/restore
  animation, graduation. `docs/backlog.md`'s B1–B16 are all done.
- **Synth:** 2-osc + noise subtractive engine, filter + filter envelope,
  ADSR, LFO (4 waveforms + key-sync retrigger), 3-band EQ, drive/saturation,
  delay + reverb, 16-voice polyphony (live keyboard *and* MIDI *and*
  sequencer all share it — no mono path left), velocity, hardware knobs.
- **Engine (E-tier):** E1 project store + undo/redo (E7, surfaced in the UI),
  E2 transport/scheduler, E3 polyphony, E6 partial (localStorage auto-save +
  `.wav` offline render; `.json`/`.mid` import-export still open), E8 partial
  (single rAF dispatcher; no dirty-region tracking yet), E9 partial (MIDI
  input; no MIDI output).
- **DAW surfaces (L-tier):** L2 transport bar, L5 lean-step ruler, L6 step
  sequencer (drums + multi-param automation + Duplicate), L7 piano-roll lean
  step, L8 pattern/clip management. **Not yet built:** L1 region-shell
  refactor (deliberately deferred — see the doc, nothing has needed it yet),
  L3 view-mode switch, L4 mobile mode, L9–L17 (tracks/mixer/browser/
  arrangement — all depend on E4 multi-track, which doesn't exist yet).
- **Feature-gap (F-tier):** F1–F7 all shipped (automation, audio export,
  drive, EQ, drums, duplicate, count-in/tap-tempo).
- **Differentiation (D-tier):** D2 v1 (hover preview), D3 v1 (signal-flow
  LEDs), D4 v1 (sound diagnostics), D1 v1 (mastery-gated UI as permanent
  post-graduation identity — a `CHALLENGES` unlock track alongside `STAGES`,
  piloted by a Sample & Hold LFO shape gated behind a bonus boss) shipped.
  D5 (era workspaces) and D6 (practice gym) are un-started design bets, not
  implementation gaps — D6 now has `activeEncounter()`/`CHALLENGES` to build
  on if picked up.

**Biggest remaining structural gap:** everything is still **one track**. E4
(multi-track graph + mixer) is the prerequisite for the whole D2 layout tier
(track lanes, mixer view, per-track device chain) and for a real sampler
(F5's drums are synthesized, not sample-based). Nothing currently blocks
starting it, but it's an XL item — no lean-step slice has been tried yet.

Live Web MIDI (E9) intentionally never hard-gates anything — it's
unavailable on all iOS and desktop Safari (see the architecture doc's
platform matrix). `.mid` file import/export (L16a) is still the "works
everywhere" universal MIDI deliverable and hasn't been started.

### Reference docs

- `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md` —
  original phased roadmap and requirements (predates the noise/osc2/capstone
  stages folding into a single progression — read historically).
- `docs/brainstorms/2026-06-22-boss-visuals-historical-context-requirements.md` —
  boss art and historical lore design decisions.
- `docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md` — the
  layered state-driven architecture, verified MIDI/mobile constraints, and the
  living `E1–E10` engine backlog (status markers kept current).
- `docs/brainstorms/2026-07-01-daw-differentiation-north-star.md` — the
  living `D1–D6` differentiation-bet backlog (status markers kept current).
- `docs/daw-layout-backlog.md` — the living `L1–L17` layout backlog (region
  taxonomy, view modes, sequencer surfaces; status markers kept current).
- `docs/daw-feature-gap-backlog.md` — the living `F1–F7` feature-parity
  backlog (status markers kept current).
- `docs/backlog.md` — the `B1–B16` synth/gameplay polish backlog — **closed**,
  all done.
- `docs/plans/` — per-feature implementation plans (E1, E2, E3, L1 region shell).
