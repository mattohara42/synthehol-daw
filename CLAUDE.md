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
  (`eqLow`/`eqMid`/`eqHigh`), FX (`drive`, delay, reverb, and `chorusMix` —
  D1-gated, see the Progression layer below), and `masterVol`.
  `S` is not the source of truth: it's `store.params()` (the active track's
  `instrument.params` object) re-exported. Reads still use `S.cutoff` etc.;
  **writes must go through the store** (`store.set('cutoff', v)`) so they
  record undo history and notify subscribers — see the Engine layer below.
  `S.lfoDest` is one of `'filter'`, `'pitch'`, `'amp'`, or `'none'`.
- `src/audio.js` — owns the `AudioContext` and node graph via the `engine`
  object (`engine.ctx`, `engine.drive`, `engine.eqLow/eqMid/eqHigh`,
  `engine.master`, `engine.scope`, the FX nodes `delay`/`delayFb`/
  `delayWet`/`reverb`/`reverbWet`/`chorusDelay`/`chorusWet` (chorus is
  D1-gated — a fixed-rate LFO sweeping `chorusDelay`'s time, not exposed as
  its own control), `engine.streamDest` (a `MediaStreamAudioDestinationNode`
  tap for `exporter.js`), the post-EQ signal-flow tap `tapEq` (D3),
  `engine.mixBus` (E4 — every track's output sums here before the shared
  drive/EQ/FX chain), `engine.noteOn`, `engine.currentNote`). Audio is
  lazily started on the first key press (`startAudio()`), not on page load
  — browsers block `AudioContext` creation without a user gesture.
  **Signal chain (fully polyphonic, multi-track since E4 steps 3–5):**
  each track gets its own instrument chain — `voices (E3, per-note
  osc+osc2+noise+ampEnv) → vcf (VCF) → trackGain (mixer.gain × mute/solo) →
  pan (mixer.pan, L10)` — and those sum at the shared `mixBus → drive
  (WaveShaper saturation) → eqLow → eqMid → eqHigh → master → scope →
  destination`, with `master` also fanning out to delay + reverb + chorus
  sends summed back at `scope`, and `scope` branching once more into
  `streamDest` for export.
  **`engine.tracks`** is a `Map` of trackId → `{ vcf, voiceBus, tapSource,
  tapFilter, voices, lfoOsc, lfoMod, lfoShSource, lfoShNextStep, trackGain,
  pan, tapOut }` — one entry per `store.tracks()` entry, kept in sync by
  `reconcileTrackEngines()` (subscribed once, in `startAudio()`), which
  builds a new track's chain the moment it appears in the store and tears
  down (disconnects, stops oscillators, releases voices) one that's gone —
  covers `addTrack`/`removeTrack`/undo/redo/load alike, so nothing else
  needs to remember to react to a track-count change. `tapOut` sits after
  `trackGain`/`pan` (post-fader) so `mixerUI.js`'s meters correctly read
  silent on a muted or soloed-out track rather than the pre-mute signal.
  `trackMixGain(trackId)` (private) computes each track's live gain: mute
  always wins; otherwise if any track has `mixer.solo` set, only soloed
  tracks are audible — recomputed on every store change alongside pan.
  **`engine.active()`** resolves whichever
  track is currently active (`store.get().activeTrackId`) — every control
  that used to read `engine.vcf`/`.voices`/`.lfoOsc`/`.lfoMod`/`.tapSource`/
  `.tapFilter` directly now reads `engine.active()?.vcf` etc. instead, so
  turning a knob always affects whichever track the rack is showing. It's a
  live lookup, not a cached alias — nothing needs "re-homing" here the way
  `state.js`'s `S` does when the active track changes (see `store.js`'s
  `rehomeSParamsRef`), since a fresh function call always resolves correctly
  the instant `activeTrackId` changes.
  Every note — the live keyboard, MIDI, the sequencer, the piano roll —
  allocates its own voice via `voiceNoteOn(note,octave,time,velocity,
  trackId?)` → id` / `voiceNoteOff(id,time,trackId?)` /
  `releaseAllVoices(time,trackId?)`; `trackId` defaults to the active track
  (what the live keyboard/MIDI always mean), but the scheduler consumers
  pass an explicit id per track so every track's pattern can play at once,
  each through its own engine — simultaneous notes (chords, overlapping
  sequencer steps, *and now overlapping tracks*) all coexist.
  `applyLFORouting()` patches the active track's own `lfoMod` gain into its
  own `vcf.frequency` when that track's `lfoDest === 'filter'`; LFO→Pitch/
  Amp instead fan into each voice's own `osc.detune`/`amp.gain` at
  voice-build time (see `voices.js`) since there's no single mono node to
  route to. `applyFilterEnv(time)` / `releaseFilterEnv(time)` sweep the
  *active* track's filter cutoff per chord onset/release (the filter
  envelope, and the LFO key-sync retrigger via `restartLfoOsc(time)`, are
  **live-keyboard/MIDI-only** chord-level effects — see `chordState.js`
  below — the scheduler consumers never triggered them even before
  multi-track existed, so no per-track chord state was needed to make them
  correct here). `applyLFOWaveform()` swaps which source feeds the active
  track's `lfoMod` — the continuous `lfoOsc` for the four native waveforms,
  or `lfoShSource` for Sample & Hold (D1's gated 5th shape; there's no
  native `OscillatorType` for stepped random values) — mutually exclusive,
  called whenever `S.lfoWaveform` changes and at track-build time.
  `tickSampleHold()`, called once per frame from `main.js`'s rAF loop, steps
  **every** track's `lfoShSource` independently (not just the active one —
  a background track playing via the scheduler still needs its own stepped-
  random source advancing) to a fresh random value once per LFO cycle via
  scheduled `setValueAtTime` calls; a no-op for any track whose LFO shape
  isn't S&H. `previewPatch(patch, note, octave, duration)` plays a one-off
  note through a separate, throwaway voice pool built from an arbitrary
  `patch` object instead of live `S`, bypassing every track's own filter —
  used by the boss "Hear the target" button (B15) and hover-preview (D2) so
  auditioning a sound never touches the player's own held note. `makeImpulse`
  builds the reverb IR; `makeDriveCurve` builds the WaveShaper curve.
  Exports: `startAudio`, `voiceNoteOn`, `voiceNoteOff`, `releaseAllVoices`,
  `previewPatch`, `applyLFORouting`, `applyLFOWaveform`, `tickSampleHold`,
  `lfoDepthScaled`, `applyFilterEnv`, `releaseFilterEnv`, `restartLfoOsc`,
  `makeImpulse`, `makeDriveCurve`.
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
  `'lore-eq'`/`'lore-fx'`). The Learn panel now has two tabs — Learn
  (`teach()` output) and History (the stage-intro pioneer/instrument/fact)
  — switched by `progressionUI.js`'s `switchTeachView`, not `teach()`
  itself. **Lore facts rotate per playthrough**: `LORE_FACTS` (exported)
  holds a small pool of pioneers/stories per lore key rather than one fixed
  fact — several modules now have more than one (Oscillator: Bob Moog and
  Giorgio Moroder/"I Feel Love"; Filter: Moog and Daft Punk's filter-sweep
  aesthetic; LFO: Wendy Carlos and Vangelis's CS-80; FX: King Tubby, Lee
  "Scratch" Perry, and Prince Jammy's dub lineage — a module id, `mod-fx`,
  that had no lore button at all before this). `pickLoreFact(key)` (exported,
  pure aside from the memo) picks one at random and holds it fixed for the
  rest of the session, so reopening the same lore button never contradicts
  itself mid-playthrough; `rerollLore()` (exported) clears the memo, called
  from `progressionUI.js`'s reset handler so "Reset Progress" shows fresh
  picks without a full page reload (a plain reload already gets fresh picks
  for free, since this module's state starts empty on every import).
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
- `src/bossZap.js` — combat visual feedback: a jagged, glowing lightning
  bolt (`buildJaggedPath(x1,y1,x2,y2)`, pure and tested) from the corrupted
  module to the boss panel while damage is actively landing. A single
  full-viewport SVG overlay (`initBossZap()`, appended to `<body>` once,
  `pointer-events: none`) redrawn by `updateBossZap(moduleId, active)` —
  called from `progressionUI.js`'s existing `bossEngine.onDamage` callback
  (piggybacking on `bossEngine.tick()`'s already-running per-frame cadence,
  same as `bossAudio.js`/`updateHpBar`, rather than a new rAF loop of its
  own). Silently hides itself (no bolt drawn) whenever there's no single
  module to strike from (`moduleId` null — the capstone and some bonus
  challenges span more than one module, same case `enterBattle()` already
  handles) or the boss panel isn't currently on screen (a `#lower-tabs` tab
  other than Visualizers/Practice/Mixer hides `.keys-row`, per
  `sequencerUI.js`'s `body[data-stage="…"]` mechanism). `handleRestore()`
  (`progressionUI.js`) explicitly clears it on defeat rather than waiting
  for the next `onDamage` call to do so — the boss's HP resets to the next
  encounter's full `maxHp` as part of the same defeat sequence, so the heal
  branch (the only other path that would otherwise clear it) doesn't fire
  again until something actually damages the *next* encounter, which could
  be well after the ~1.2s restore transition already has the bolt visibly
  stuck aimed at a module that's no longer corrupted.
- `src/main.js` — entry point. Imports `style.css`; inits the keyboard, MIDI,
  signal-flow LEDs, diagnostics, controls, hover-preview, knobs, export,
  offline-.wav render, undo/redo (header buttons + Ctrl+Z/⇧+Ctrl+Z/Ctrl+Y),
  the transport clock + its consumers (metronome, sequencer, piano-roll),
  the transport bar UI, the sequencer UI, the piano-roll UI, the clips UI,
  boss audio, boss zap FX, presets, and project persistence; then on the `load` event
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
  **Tracks (E4 step 1)**: `tracks()`, `addTrack(name?)` (clones the active
  track's instrument+pattern by value as the cheapest useful starting point,
  undoable, does **not** change which track is active), `removeTrack(id)`
  (refuses to remove the last/active track). `applyState`'s track-count
  reconciliation (grow/shrink `_project.tracks` to match the incoming state
  before per-track fields apply) makes undo/redo/load correctly move
  between projects with different track counts.
  **`setActiveTrack(id)` (E4 step 2)**: switches which track is active —
  NOT undo-tracked, like a UI selection rather than a content edit — by
  *re-homing* `S` rather than reassigning it. `state.js`'s `S` is a single
  object reference captured once at import time
  (`export const S = store.params()`); every direct `S.x` read elsewhere
  (`audio.js`, `canvas.js`, `controls.js`) trusts that fixed identity, so
  simply repointing `activeTrackId` would split `S` from `store.params()`.
  Instead, `store.js` privately keeps `_sParamsRef` — the literal object `S`
  aliases (it doesn't need to import `state.js` back to get it; that object
  always was just `store.params()`'s return value at import time) — and a
  `rehomeSParamsRef()` helper makes sure `_sParamsRef` physically sits in
  whichever track `activeTrackId` currently names. It's called both from
  `setActiveTrack()` directly and again at the end of `applyState()`,
  because undo/redo can replay a snapshot from *before* a track switch
  happened, moving `activeTrackId` back across that boundary — field values
  alone getting reconciled isn't enough, the object holding the reference
  has to move too. `src/tracksUI.js` is the (graduation-gated) UI this
  unlocks. See `docs/brainstorms/2026-07-03-multitrack-mixer-
  requirements.md` for the full rollout — simultaneous multi-track
  *playback* now works too (E4 step 3, `audio.js`'s per-track `engine.
  tracks`); every track plays at once through its own instrument chain.
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
  survives a refresh. `.json` file import/export is still open (see the
  E-tier doc); `.mid` import/export shipped separately (L16a) as
  `midiFile.js`/`midiFileUI.js`.
- `src/tracksUI.js` — **a minimal track picker (E4 step 2), standing in for
  L9's real track-lane container** until there's a work area to dock lanes
  into. A `#tracks-bar` (`<select>` + "+ Add Track"/"Remove", reusing
  `.presets-bar` styling), gated on graduation like D5's Workspace picker
  and D6's Practice tab. Switching tracks calls `store.setActiveTrack(id)`
  (E4 step 2 in `store.js` — repoints `S`'s *contents* in place without
  ever reassigning its identity; see `store.js`'s own doc comment for the
  `_sParamsRef`/`rehomeSParamsRef()` mechanism) and then
  `applyPreset(store.params())` to resync the rack — the exact same trick
  `main.js`'s undo/redo resync already leans on, since nothing else
  re-syncs sliders/canvases from a store change made outside the normal
  DOM-event path. "Remove" always targets the active track; since
  `store.removeTrack()` refuses to remove the active one, the handler
  switches to a neighbor first. `resetToFirstTrack()` (called from
  `progressionUI.js`'s reset handler, alongside D5's era-reset and D1's
  gated-value clamp) switches back to the first track if progress resets
  while a later one is active — tracks themselves survive a reset, same as
  clips/patterns, only the active *selection* snaps back so a relocked
  picker never strands the player on an unreachable track. `switchTrack()`
  is exported so `mixerUI.js`'s channel-strip name buttons can reuse the
  exact same mechanism rather than reimplementing it.
- `src/mixerUI.js` — **a lean mixer view (E4 step 5 / L10).** A "Mixer" tab
  in the existing `#lower-tabs` strip — no region system needed; see
  `docs/brainstorms/2026-07-04-mixer-view-requirements.md`, which corrects
  the layout backlog's assumption that this needed L1/L3 first. One
  channel strip per track (name — click to `switchTrack()` — pan knob,
  gain fader, Mute/Solo buttons, a peak meter) plus a master strip (meter
  only; the header's existing `#master-vol` stays the sole fader for that
  value, so there's one control per value, not two). Two-tier render
  mirroring `sequencerUI.js`'s grid: `buildStrips()` only rebuilds the DOM
  when which tracks exist changes (add/remove/undo/redo/load), and
  `paintStrips()` cheaply updates existing controls' values on every other
  store change — rebuilding real SVG-skinned knobs on an unrelated slider
  drag elsewhere in the rack would be a visible regression, unlike
  `tracksUI.js`'s cheap `<option>` rebuild. `refreshMixerMeters()` (rAF
  loop, E8) reads each track's post-fader `tapOut` analyser (audio.js) via
  `signalFlow.js`'s existing `peakLevel()` helper, a no-op unless the Mixer
  tab is the active lower-tab, matching `practiceUI.js`'s pattern. Gated on
  graduation, like `tracksUI.js`'s bar.
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

### DAW surfaces (L2, L5–L8, L16a, E4 steps 2 & 5 — the visible DAW UI)

- `src/transportUI.js` — the transport bar (L2): Play/Stop, live
  `bar . beat . sixteenth` readout (pulled each frame in `main.js` — position is
  mutated in place, off the subscribe path), editable BPM, time signature,
  metronome/loop/count-in LED toggles, and a tap-tempo button. Reflects
  committed state via `store.subscribe`; exports `initTransportUI`,
  `refreshTransportPosition`, and the pure `formatPosition` helper.
- `src/sequencer.js` — the step-sequencer engine (L6), pure + testable. A
  diatonic `SCALE` (C-major, 8 degrees) with `rowToPitch`, `stepToColumn`,
  `activeNotesAt` (the chord in a column), `stepDuration`, `swingOffset`, and
  `createSequencerConsumer({ getTracks, getBpm, noteOn, noteOff, setCutoff,
  setResonance, setVolume, playKick, playSnare, playHat, … })` — a scheduler
  consumer that loops **every track** (`getTracks()` returns `[{id,
  pattern}, ...]`, read fresh each tick so a track added/removed later is
  picked up automatically — E4 step 3) and, per track, fires a **gated**
  polyphonic voice for each active pitch cell into that track's own engine
  (`noteOn`/`noteOff`/the automation setters all take a trailing `trackId`),
  triggers whichever drum lanes are hit (drums stay shared across tracks,
  straight to the master bus — see `audio.js`), and applies per-step
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
  the consumer), and `createPianoRollConsumer({ getTracks, getBpm, noteOn,
  noteOff, … })` — loops every track (E4 step 3, same `getTracks()` shape as
  `sequencer.js`'s consumer) and fires one gated voice per run at its
  leading edge into that track's own engine, held for the run's full length.
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
- `src/midiFile.js` — **Standard MIDI File encode/decode (L16a),** pure +
  testable, no DOM/audio deps. Targets the piano-roll lane specifically
  (chromatic, matches arbitrary MIDI pitches 1:1; the diatonic step-grid
  `cells` and drum lanes are out of scope — lossy/pitchless to round-trip).
  `encodePatternAsMidi(pattern, bpm)` writes a Format 0 file, one bar
  (`pattern.length` steps) long, from `pianoroll.js`'s `noteRunsStartingAt`.
  `decodeMidiFile(bytes)` parses Format 0/1 SMF (VLQ deltas, running status,
  note-on-velocity-0-as-note-off, meta/sysex skipping) into a flat, track-
  agnostic note list — a multi-track import collapses to one instrument
  rather than growing a track picker, keeping the piano roll's single-lane
  model intact for this lean step. `notesToPatternRoll(notes, ppq, rollRows,
  rollLow, rollHigh, steps)` quantizes onto the roll's 16-step/2-octave
  window: whole-octave-transposes a file whose average pitch falls outside
  the window (so an off-center bassline/lead still imports), drops whatever
  still doesn't fit or starts past the first bar, and reports `{ imported,
  dropped }` counts.
- `src/midiFileUI.js` — wires "Import .mid"/"Export .mid" buttons (in
  `#clips-bar`, alongside `clipsUI.js` — both edit `store.pattern()`) and a
  hidden file input to `midiFile.js`. Import writes the whole roll via one
  `store.setPath` (undoable, like every other pattern edit) and briefly
  flashes the import-count (or a parse-error message) on the button itself
  rather than a modal — the project's anti-goals rule out dialogs for
  anything short of the progress-reset confirm.
- **Help tab** (`#tab-help`/`#view-help` in `index.html`, no JS module) —
  the in-app home for `docs/MANUAL.md`'s content, per
  `docs/brainstorms/2026-07-04-inline-help-requirements.md`'s follow-up:
  a Help button was wanted, but a modal would have broken the same
  no-dialogs anti-goal `midiFileUI.js` cites above, so this is a plain
  `#lower-tabs` tab instead — picked up by `sequencerUI.js`'s existing
  generic tab-wiring (`querySelectorAll('.lower-tab')`/`.lower-view`) with
  zero JS changes. **Ungated**, unlike Practice/Mixer — a new player needs
  this from session one. Joins the `seq`/`roll` stages in
  `body[data-stage="…"] .lower-row { flex: 1 }` / `.keys-row { display:
  none }` (style.css) so its long content gets the full lower area instead
  of the small sliver Mixer/Practice's shorter content fits in — without
  that, `#help-body`'s `overflow-y: auto` had no bounded height to actually
  scroll within, and the tail of the content was silently clipped by an
  ancestor instead (caught by measuring `scrollHeight` vs the rendered
  `clientHeight` in a real browser, not visible from the DOM alone). Keep
  this and `docs/MANUAL.md` in sync by hand — there's no build step
  rendering one from the other.

### Differentiation layer (D1–D4, D6 — legibility/feedback/mastery bets)

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
- `src/practice.js` — **the practice gym (D6 v1), "an instrument you
  practice."** Pure core, no DOM/audio deps. `TARGETS`, a curated bank of
  named patches (`'Plucky Bell'`, `'Fat Bass'`, …); each is a complete,
  playable params object, but `matchIntensity(S, target)` only scores the
  ~9 dimensions `previewPatch()` actually renders audible (waveform,
  detune, attack/decay/sustain/release, osc2 waveform/octave/detune/mix,
  noise type/mix) — **not** cutoff/filterType/LFO, since the preview voice
  pool bypasses the shared filter and carries no LFO routing (see
  `audio.js`), so grading on either would ask the player to guess something
  they have no way to hear. `createPracticeSession()` mirrors B1's "reward
  sustained matching, not a single tick": `tick({S, isPlaying, dt})` returns
  `{ intensity, nailed }`, requiring a close match (`MATCH_THRESHOLD`) to
  hold for `HOLD_SECONDS` before it "nails" and auto-advances
  (`pickTarget`, avoiding an immediate repeat) — no HP, no boss, a
  repeatable free-play loop, not a one-shot unlock.
- `src/practiceUI.js` — wires the "Practice" tab (Hear Target / New Target
  buttons, a live closeness meter, the nailed-it flash). `refreshPractice
  (engine, S, dt)` runs off `main.js`'s single rAF dispatcher (E8) but is a
  no-op unless the Practice tab is the *active* lower-tab — so rounds can't
  silently advance while the player is looking at the Sequencer instead.
  Reuses `bossAudio.js`'s `playArp(RESTORE_ARP)` (newly exported there) for
  the nailed-it chime rather than duplicating tone-scheduling logic.
- `src/eraWorkspaces.js` — **era workspaces (D5), all 4 planned workspaces
  shipped.** Pure data, no DOM: `ERA_WORKSPACES`, each entry a `{ id, name,
  pioneer, tagline, presets }` — `presets` is a small curated bank in the
  same complete-params-object shape as `presets.js`'s `FACTORY` and
  `practice.js`'s `TARGETS`, kept in its own module rather than folded into
  either (see the brainstorm doc's "preset provenance" decision). `moog` (no
  curated presets — the existing default look already is the Moog palette),
  `arp` ("Static Voice," "Odyssey Lead"), `oberheim` ("Unison Drift,"
  "Numan Pulse"), `sequential` ("Prophet Memory" — a close callback to
  `stages.js`'s `MIMIC_PATCH` — and "Analog Poly"). Curated presets never
  set a D1-gated field (`chorusMix` > 0, `lfoWaveform: 'sampleHold'`) —
  `eraWorkspacesUI.js`'s `applyPreset()` call has no progression check of
  its own, so a gated value here would be a real unlock bypass, not just an
  inert field; a test locks this invariant in.
- `src/eraWorkspacesUI.js` — wires the History tab's "Workspace" picker:
  swatch buttons set `body[data-era]` (which `style.css`'s `[data-era="…"]`
  blocks read for `--era-accent`/`--era-accent-2`) and persist the choice to
  `localStorage` (`synthehol_era`); a preset-button row per active
  workspace loads one of its curated sounds via the existing `applyPreset()`
  path. `revealEraWorkspaces()` gates the whole picker on graduation
  (`progression.defeated.length === STAGE_IDS.length`), the same condition
  `revealPracticeTab()` (D6) uses — called on init and after every restore.
  The reset button (`progressionUI.js`) also reverts `body[data-era]` to
  `'moog'` and clears the localStorage key, mirroring D1's gated-value
  clamp, so a relocked picker never leaves a non-default palette active
  with no way to change it back.

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
  grant. Two entries so far, both requiring mastery of already-unlocked
  controls rather than the gated feature itself (which a challenge can't
  require as its own unlock condition): `'lfo-sh'` ("The Predictable",
  corrupted Buchla 266 Source of Uncertainty) gates the LFO's Sample & Hold
  shape via extreme LFO settings (Pitch dest, Square shape, Rate > 15 Hz,
  Depth > 70%); `'chorus'` ("The Solitary", corrupted Roland CE-1 Chorus
  Ensemble) gates a Chorus FX knob via *manually* building width — Osc 2
  Mix > 50% detuned past 20¢, Delay Mix and Feedback both > 30%.
  `CHALLENGES.find()` (in `bossEngine.js`) walks the array in order, so a
  returning player always resumes on the first entry still locked.
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
  called on init and after every restore), lore buttons (`switchTeachView(
  'learn')` first, *then* `teach('lore-' + id)` — a real pre-existing gap,
  fixed alongside the lore-pool work above: `teach()` only ever writes into
  the Learn tab's DOM, so clicking ⓘ while History was the active teach-tab
  used to silently update hidden elements with no visible feedback at all),
  and the reset button. The `body[data-layers]` attribute (0–4, capped — it does not track
  all 7 stages 1:1) advances each time a boss is restored and drives CSS
  era-layering effects. Note: the graduation banner text still reads "The
  Rack Is Restored" for the main progression only — bonus challenges (D1)
  intentionally don't get their own banner, just the boss panel re-engaging.
  **Boss intro/victory pacing beats**: `showBossTransition({tag, title,
  corrupted, lines, buttonLabel, onContinue})` is one reusable full-screen
  overlay (`#boss-transition-overlay`, a translucent backdrop + centered
  card — deliberately not styled like anything else in the app, since this
  is meant to read as a real pause, unlike the passive graduation banner)
  repurposed for both directions rather than two near-duplicate DOM
  structures. `presentBossIntro()` (replaces every direct `enterBattle()`
  call — init, reset, and the post-victory continuation below) shows a
  "Boss Incoming" card naming the corrupted instrument (`stage.boss.
  corruptedOf`), the taunt as flavor, and `stage.intro` as the "how to
  fight it" hint (this field existed in `stages.js` since B-tier but was
  never actually wired to any UI until now) — `enterBattle()`'s own effects
  (the corruption glitch, taunt, preview button) only run once "Fight!" is
  clicked, so a fresh encounter always gets a deliberate beat instead of
  starting silently. `presentVictory(stage)` (replaces `handleRestore()`'s
  old unconditional 1200ms `setTimeout`) shows a "Victory" card recapping
  what was just restored (`stage.instrument`) or unlocked
  (`stage.unlockLabel`, a D1 `CHALLENGES`-only field — a friendly name
  distinct from `unlocks`, the progression storage key) and previewing
  what's next via `bossEngine.activeEncounter()` (already advanced by
  `_defeat()` by the time this runs) — or a closing line if nothing's left
  to fight. The reveal-calls, the graduation-banner check, and the next
  encounter's own `presentBossIntro()` all move to run on "Continue"
  instead of a fixed timer, so the pause lasts as long as the player wants
  to read rather than a guessed delay. A short 700ms `setTimeout` still
  precedes the victory card itself, just long enough for the existing
  glitch-burst/restored-SVG swap to actually be seen first.

## DOM structure (index.html)

Key element ids that code writes to:

| id | owner |
|---|---|
| `status-pill` | `ui.js` via `setStatus()` |
| `boss-panel`, `boss-panel-name`, `.boss-svg-wrap`, `boss-taunt`, `boss-hp-fill`, `boss-preview-btn` | `progressionUI.js` + `bossArt.js` |
| `stage-intro-pioneer`, `stage-intro-instrument`, `stage-intro-fact` | `progressionUI.js` |
| `boss-transition-overlay`, `boss-transition-tag`, `boss-transition-title`, `boss-transition-corrupted`, `boss-transition-line1`, `boss-transition-line2`, `boss-transition-btn` | `progressionUI.js` (`showBossTransition()`) |
| `graduation-banner` | `progressionUI.js` |
| `reset-btn` | `progressionUI.js` |
| `keyboard`, `play-hint` | `keyboard.js` |
| `scope-canvas`, `spectrum-canvas` | `scope.js` |
| `diagnosis` | `diagnostics.js` |
| `teach-title`, `teach-body`, `teach-canvas`, `teach-view-learn`, `teach-view-history`, `.teach-tab` | `teaching.js` + `progressionUI.js` |
| `c-osc`, `c-osc2`, `c-noise`, `c-filter`, `c-eq`, `c-adsr`, `c-lfo`, `c-fx` | `canvas.js` |
| `mod-osc`, `mod-osc2`, `mod-noise`, `mod-filter`, `mod-eq`, `mod-adsr`, `mod-lfo`, `mod-fx` | `progressionUI.js` (lock classes) + `signalFlow.js` (LEDs) |
| `s-oct`, `s-detune`, `s-noisemix`, `s-osc2oct`, `s-osc2detune`, `s-osc2mix`, `s-cutoff`, `s-res`, `s-fenv`, `s-atk`, `s-dec`, `s-sus`, `s-rel`, `s-lforate`, `s-lfodepth`, `s-drive`, `s-eqlow`, `s-eqmid`, `s-eqhigh`, `s-delaytime`, `s-delayfb`, `s-delaymix`, `s-reverbmix`, `s-chorusmix` (D1-gated) | `controls.js` (`wire()`) |
| `v-oct`, `v-detune`, `v-noisemix`, `v-osc2oct`, `v-osc2detune`, `v-osc2mix`, `v-cutoff`, `v-res`, `v-fenv`, `v-atk`, `v-dec`, `v-sus`, `v-rel`, `v-lforate`, `v-lfodepth`, `v-drive`, `v-eqlow`, `v-eqmid`, `v-eqhigh`, `v-delaytime`, `v-delayfb`, `v-delaymix`, `v-reverbmix`, `v-chorusmix` (D1-gated), `master-vol` | `controls.js` |
| `wave-btns`, `noise-btns`, `osc2wave-btns`, `ftype-btns`, `lfodest-btns`, `lfowave-btns`, `lfowave-sh-btn` (D1-gated), `lfo-keysync` | `controls.js` (`wireToggleGroup()`) + `progressionUI.js` (reveals `lfowave-sh-btn`) |
| `ctrl-chorus` (D1-gated wrapper around `s-chorusmix`) | `progressionUI.js` (reveals it) |
| `undo-btn`, `redo-btn` | `main.js` |
| `export-btn` | `exporter.js` |
| `render-wav-btn` | `wavRender.js` |
| `share-btn` | `presets.js` |
| `preset-select`, `preset-load-btn`, `preset-name-input`, `preset-save-btn`, `preset-delete-btn` | `presets.js` |
| `tr-play`, `tr-pos`, `tr-bpm`, `tr-sig`, `tr-metro`, `tr-loop`, `tr-countin`, `tr-tap`, `transport-bar` | `transportUI.js` (L2) |
| `tracks-bar`, `track-select`, `track-add-btn`, `track-remove-btn`, `track-mute-btn` | `tracksUI.js` (E4 step 2) + `progressionUI.js` (reveals `tracks-bar`) |
| `lower-tabs`, `tab-scope`, `tab-seq`, `tab-roll`, `tab-practice` (graduation-gated), `tab-mixer` (graduation-gated), `tab-help`, `view-scope`, `view-seq`, `view-roll` | `sequencerUI.js` / `pianoRollUI.js` (lower-area tabs) + `progressionUI.js` (reveals `tab-practice`/`tab-mixer`) |
| `view-mixer`, `mixer-strips` | `mixerUI.js` (E4 step 5 / L10) |
| `view-help`, `help-body` | static content in `index.html` — no JS module; content mirrors `docs/MANUAL.md` |
| `seq-grid`, `seq-ruler`, `seq-length`, `seq-swing`, `seq-clear`, `seq-duplicate`, `seq-auto`, `seq-auto-param` | `sequencerUI.js` (L6) |
| `roll-grid`, `roll-ruler`, `roll-clear` | `pianoRollUI.js` (L7) |
| `clips-bar`, `clip-select`, `clip-load-btn`, `clip-save-btn`, `clip-duplicate-btn`, `clip-delete-btn`, `clip-name-input` | `clipsUI.js` (L8) |
| `mid-import-btn`, `mid-export-btn`, `mid-file-input` | `midiFileUI.js` (L16a) |
| `view-practice`, `practice-target-name`, `practice-meter-fill`, `practice-meter-label`, `practice-rounds`, `practice-hear-btn`, `practice-new-btn` | `practiceUI.js` (D6) |
| `era-workspaces`, `era-swatches`, `era-presets` | `eraWorkspacesUI.js` (D5) + `progressionUI.js` (reveals `era-workspaces`) |

## Testing

Tests use **Vitest** (`npm test` or `npm run test:watch`). Test environment is
`node` (not `jsdom`) — tests that need browser APIs mock them explicitly.
Full suite is currently **23 test files, 282 tests**.

Test files live alongside source files as `src/*.test.js`. Current coverage:

- `src/progression.test.js` — full unit coverage of `progression` singleton:
  fresh state, persistence round-trip, reset, malformed localStorage, `unlockNext`,
  `markDefeated`, `unlockFeature`/`hasFeature` (D1), and that `unlockedFeatures`
  defaults to `[]` on a legacy store that predates the field.
- `src/bossEngine.test.js` — covers `activateStage`, `tick` (no-damage,
  boolean and intensity-scaled damage, healing, XP flush, callbacks), the
  defeat/restore/next-stage sequence, full graduation across all seven
  stages, and `activeEncounter()`/the post-graduation bonus challenges (D1):
  the first challenge boss activates automatically on graduation, `tick` is
  *not* a no-op until every challenge is cleared, defeat unlocks the
  feature without touching `currentStageIndex`, `onRestore` fires with
  `challenge: true`, and clearing one challenge advances to the next
  (`CHALLENGES` walked in order). Uses a `makeLocalStorageMock()` helper with
  `vi.stubGlobal`; calls `bossEngine._clearListeners()` in `beforeEach`.
- `src/stages.test.js` — validates the `STAGES` array schema (required fields,
  boss fields, valid moduleIds), exports, ordering, `matchIntensity` scoring,
  every stage's `target` predicate with boundary values, and the `CHALLENGES`
  array schema (required fields, no id collisions with `STAGES`, and each
  challenge's `target` predicate — `lfo-sh` and `chorus`).
- `src/teaching.test.js` — verifies `teach()` doesn't throw for any lore key
  and writes non-empty title/body. Mocks `state.js`, `canvas.js`, and
  `document.getElementById` to avoid browser dependencies. Separately tests
  the `LORE_FACTS` pool directly: every entry has a non-empty title/body,
  every requested pioneer (Carlos, Vangelis, Moroder, Daft Punk, King Tubby,
  Prince Jammy, Perry) appears somewhere in the pool, `pickLoreFact()` is
  deterministic against a mocked `Math.random` and memoizes its pick until
  `rerollLore()` clears it — tested directly rather than statistically,
  since "run it many times and hope for variety" would be flaky.
- `src/store.test.js` — the project store (E1): set/setPath/setTransient,
  history coalescing, undo/redo, clip save/load/duplicate/delete, serialize/
  load round-trip, in-place apply. Plus tracks (E4 step 1): `addTrack`
  clones the active track by value (not reference) without touching which
  track is active, `removeTrack` refuses the last/active track, undo/redo
  resizes the live tracks array in both directions, and a multi-track
  serialize/load round trip preserves the `S` reference. Plus
  `setActiveTrack` (E4 step 2): switching repoints `S`'s contents without
  changing its identity, each track keeps independently-edited values
  across switches, it's not itself an undo step, and — the trickiest
  case — undo/redo crossing a track-switch boundary (an edit, then a
  switch, then another edit, then undoing/redoing back across the switch)
  correctly restores both the field value **and** which track physically
  holds the `S` reference, including when `reset()` truncates away the
  track that held it.
- `src/scheduler.test.js` — the lookahead core (E2) with an injected clock:
  windowing, step spacing at tempo, mid-run tempo change, stop, and the musical
  position/loop-wrap helpers.
- `src/audio.test.js` — `makeImpulse` (reverb IR) shape/decay/bounds.
- `src/voices.test.js` — the voice manager (E3) with a fake `AudioContext`:
  allocation, velocity-scaled ADSR, osc2/noise summing, release + `osc.stop`,
  self-clean, simultaneous voices, oldest-voice stealing, `releaseAll`.
- `src/sequencer.test.js` — the sequencer engine (L6): diatonic pitch mapping,
  column wrap, chord read-out, step duration, swing, gated note firing, and
  (E4 step 3) that the consumer plays every track's pattern each step,
  tagging notes and automation with the firing track's own id.
- `src/transportUI.test.js` — the pure `formatPosition` helper.
- `src/pianoroll.test.js` — the piano-roll engine (L7): row-to-pitch mapping,
  note-run detection, consumer gating/length, and (E4 step 3) multi-track
  playback tagging notes with the right trackId.
- `src/persistence.test.js` — auto-save/restore round-trip, debounce.
- `src/wavRender.test.js` — `audioBufferToWav` header/PCM correctness.
- `src/midi.test.js` — `midiNoteToPitch`, `pitchToMidiNote` (exact inverse
  across the full 0-127 range), `parseMidiMessage` (note-on/off,
  running-status note-on-with-zero-velocity).
- `src/midiFile.test.js` — the Standard MIDI File codec (L16a): VLQ
  encode/decode round trips including multi-byte boundaries, a well-formed
  SMF header, a hand-built byte sequence exercising running status and
  note-on-velocity-0-as-off, a full pattern → `.mid` bytes → pattern round
  trip that reproduces the original roll exactly, and `notesToPatternRoll`'s
  octave-transpose-to-fit heuristic, drop-when-still-out-of-range, drop-
  past-first-bar, and note-run-capped-at-pattern-end behavior.
- `src/chordState.test.js` — onset/release only fire on the first/last held
  note across simulated multi-source chords.
- `src/hoverPreview.test.js` — `buildHoverPreview` pure logic.
- `src/bossAudio.test.js` — `damageBlipFreq` pure pitch curve.
- `src/bossZap.test.js` — `buildJaggedPath`: exact endpoints regardless of
  jitter, correct point count for a given segment count, and zero jitter
  collapsing every intermediate point onto the straight line.
- `src/signalFlow.test.js` — `peakLevel` pure level extraction.
- `src/diagnostics.test.js` — `analyzeSpectrum`, `detectClipping`, `diagnose`
  band/threshold logic.
- `src/practice.test.js` — the practice gym (D6): `matchIntensity` scoring
  (exact/partial/zero match, non-numeric dims don't produce NaN),
  `pickTarget`'s avoid-repeat behavior, and `createPracticeSession`'s
  sustained-hold-to-nail logic (no partial credit for dropping mid-hold,
  `newTarget()` resets progress, not-playing scores 0 regardless of match).
- `src/eraWorkspaces.test.js` — era workspaces (D5): `ERA_WORKSPACES` schema
  (required fields, distinct ids, every curated preset is a complete
  playable params object), `workspaceById()` lookup/miss.

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
- **Hiding an element with the `hidden` attribute only works if nothing else
  sets its `display`.** Any class rule that sets `display` (`.tog-btn`,
  `.ctrl-knob`, `.teach-view`, …) beats the browser's default
  `[hidden]{display:none}` at equal specificity, since author styles always
  win over user-agent styles — the element stays visible (and clickable)
  despite `el.hidden === true`. This bit D1's first two challenges for a
  full commit each before anyone noticed (a screenshot, not the `hidden`
  *property*, is what caught it — checking `el.hidden` only proves the JS
  ran, not that the element actually disappeared).
  If you gate a new control this way, add a `<selector>[hidden] { display:
  none; }` override next to whatever rule sets that class's `display` —
  `.teach-view[hidden]`, `.tog-btn[hidden]`, and `.ctrl[hidden]` in
  `style.css` are the existing examples to copy.

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
  animation, graduation, a lightning-bolt combat visual (`bossZap.js`) from
  the corrupted module to the boss panel while damage lands, a boss
  intro/victory transition card pair (`showBossTransition()` in
  `progressionUI.js`) pacing every fight — what the boss is and how to
  fight it before, a recap and a preview of what's next after — and a
  rotating historical-lore pool (`teaching.js`'s `LORE_FACTS`) covering
  Bob Moog, Wendy Carlos, Alan Pearlman, Tom Oberheim, Vangelis, Giorgio
  Moroder, Daft Punk, King Tubby, Lee "Scratch" Perry, and Prince Jammy —
  replaying the game surfaces different pioneers each time.
  `docs/backlog.md`'s B1–B16 are all done.
- **Synth:** 2-osc + noise subtractive engine, filter + filter envelope,
  ADSR, LFO (4 waveforms + key-sync retrigger), 3-band EQ, drive/saturation,
  delay + reverb, 16-voice polyphony (live keyboard *and* MIDI *and*
  sequencer all share it — no mono path left), velocity, hardware knobs.
- **Engine (E-tier):** E1 project store + undo/redo (E7, surfaced in the UI),
  E2 transport/scheduler, E3 polyphony, E6 partial (localStorage auto-save +
  `.wav` offline render + `.mid` import/export; `.json` import/export still
  open), E8 partial (single rAF dispatcher; no dirty-region tracking yet),
  E9 partial (MIDI input; no MIDI output).
- **DAW surfaces (L-tier):** L2 transport bar, L5 lean-step ruler, L6 step
  sequencer (drums + multi-param automation + Duplicate), L7 piano-roll lean
  step, L8 pattern/clip management, L16a `.mid` import/export (piano-roll
  lane, one bar/2-octave window per import — see `midiFile.js`). **Not yet
  built:** L1 region-shell refactor (deliberately deferred — see the doc,
  nothing has needed it yet), L3 view-mode switch, L4 mobile mode, L9–L15/
  L16b/L17 (tracks/mixer/browser/arrangement/MIDI-learn — all but L16b
  depend on E4 multi-track, which doesn't exist yet).
- **Feature-gap (F-tier):** F1–F7 all shipped (automation, audio export,
  drive, EQ, drums, duplicate, count-in/tap-tempo).
- **Differentiation (D-tier):** D2 v1 (hover preview), D3 v1 (signal-flow
  LEDs), D4 v1 (sound diagnostics), D1 v1 (mastery-gated UI as permanent
  post-graduation identity — a `CHALLENGES` unlock track alongside `STAGES`,
  two entries: a Sample & Hold LFO shape and a Chorus FX knob, each gated
  behind its own bonus boss), D6 v1 (practice gym — a graduation-gated
  "Practice" tab, curated target-patch bank, sustained-match-to-nail
  scoring reusing The Mimic's approach), D5 (era workspaces — a
  graduation-gated "Workspace" picker in the History tab; all four planned
  workspaces shipped — Moog, ARP, Oberheim, Sequential — per
  `docs/brainstorms/2026-07-03-era-workspaces-requirements.md`) shipped.
  **Every D-tier bet now has at least a v1 slice, and D5 is fully done —
  no unfinished corner left in the differentiation backlog.**

**Biggest remaining structural gap:** L9 (real simultaneous multi-track
lanes) — everything else in the E4/D2 rollout is done. A graduated player
can create up to 4 tracks, each with its own instrument patch and pattern,
switch between them and balance them via a minimal picker and a mixer
view, and **every track plays simultaneously** through its own filter/LFO/
voice pool, summed into one shared drive/EQ/FX/master chain. **All 5 steps
shipped** — see `docs/brainstorms/2026-07-03-multitrack-mixer-
requirements.md`: an audit found `store.js`'s `tracks[]` array was
schema-only (one track ever created, `mixer`/`instrument.type` fields
inert), named the real hard problem (`audio.js`'s single global `engine`
— one filter/drive/EQ/FX/voice-pool singleton reused by everything), and
proposed a lean-step rollout gated behind graduation like D5/D6.
- **Step 1** (pure store-level work): `addTrack`/`removeTrack`, a
  `MAX_TRACKS = 4` ceiling, fixing `applyState`'s reconciliation guard.
- **Step 2** (track switching, re-sequenced ahead of its original slot once
  step 1 made clear nothing track-switching-shaped could ship safely — or
  be verified in a real browser — before the `S`-identity problem was
  solved): `store.setActiveTrack()`, the `_sParamsRef`/
  `rehomeSParamsRef()` fix keeping `S` correctly homed across undo/redo
  crossing a switch boundary, and a minimal graduation-gated `tracksUI.js`
  picker.
- **Steps 3–4** (the actual XL core — per-track instrument chains, plus
  multi-track scheduler playback, shipped together in one pass since step 3
  alone had no observable payoff without it): `audio.js`'s `engine.tracks`
  (a `Map` of trackId → its own vcf/voices/lfoOsc/lfoMod/lfoShSource/
  trackGain), reconciled automatically from `store.tracks()` on every store
  change; `engine.active()` replaces the old flat `engine.vcf`/`.voices`/
  etc. fields as a live lookup (no re-homing needed, unlike `S` — see
  `audio.js`'s own comment); `sequencer.js`/`pianoroll.js`'s consumers now
  loop every track (`getTracks()`, read fresh each tick) instead of just
  the active one, so every track's pattern plays through its own engine at
  once; mute got real per-track gain-node wiring (a button in
  `tracksUI.js`). Verified end-to-end in a real browser: two tracks with
  different cutoffs produce genuinely independent, simultaneously-audible
  signals; removing/undoing a track correctly tears down/rebuilds its
  engine; the live keyboard still only ever plays the active track.
  `wavRender.js`'s offline export is documented as still single-track (a
  known, deliberate gap, not silently wrong).
- **Step 5** (a lean **L10 mixer view**, `mixerUI.js`) — a new
  `#lower-tabs` "Mixer" tab, no region system needed, correcting this
  rollout's own framing that L10 was blocked on L1/L3 (see
  `docs/brainstorms/2026-07-04-mixer-view-requirements.md`). One channel
  strip per track (pan, gain fader, Mute/Solo, a peak meter reading a new
  post-fader `tapOut` analyser) plus a master meter. `audio.js` gained a
  `StereoPannerNode` per track and solo-aware `trackMixGain()` math (mute
  always wins). **L11** (per-track device chain) needed no new work —
  already functionally delivered by step 2's `switchTrack()` resync — and
  **L9** (real simultaneous multi-track lanes) is the one piece left
  deferred, consistent with L1's own "revisit when something concretely
  needs it" clause: it genuinely needs reserved work-area space that
  doesn't exist yet, unlike the tab-based slice everything else in this
  rollout used.

Live Web MIDI (E9) intentionally never hard-gates anything — it's
unavailable on all iOS and desktop Safari (see the architecture doc's
platform matrix). `.mid` file import/export (L16a) is the "works everywhere"
universal MIDI deliverable that covers that gap and is now shipped
(`midiFile.js` + `midiFileUI.js`); MIDI-map/learn (L16b) is still open.

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
- `docs/brainstorms/2026-07-03-era-workspaces-requirements.md` — D5's
  direction and rollout; all four planned workspaces (Moog, ARP, Oberheim,
  Sequential) shipped. Both open questions resolved during implementation:
  era choice persists to its own `localStorage` key, curated presets live in
  their own module (`eraWorkspaces.js`) rather than `presets.js`'s
  `FACTORY`.
- `docs/brainstorms/2026-07-03-multitrack-mixer-requirements.md` — E4's
  scoping pass and rollout tracker. Step 1 (store completion) shipped:
  `addTrack`/`removeTrack`/`MAX_TRACKS`, the `applyState` reconciliation
  fix. Step 2 (track switching) also shipped, re-sequenced ahead of its
  original slot once step 1 made clear it had to come before anything
  audio-graph-shaped: `store.setActiveTrack()` re-homes `S` (the
  `_sParamsRef`/`rehomeSParamsRef()` mechanism) rather than reassigning it,
  and a minimal graduation-gated picker (`tracksUI.js`) makes it usable.
  Steps 3–4 also shipped, together (step 3 alone had no observable payoff
  without step 4, so both landed in one pass): `audio.js`'s `engine.tracks`
  — a per-track instrument chain (vcf/voices/lfoOsc/lfoMod/trackGain)
  reconciled automatically from `store.tracks()` — feeding one shared
  FX/master rack (the scope boundary this doc set for v1, not full
  per-track FX inserts); `sequencer.js`/`pianoroll.js`'s consumers now loop
  every track instead of just the active one. A graduated player can now
  run up to 4 tracks that **play simultaneously**, each independently
  editable via the picker, verified end-to-end in a real browser. **Step 5
  also shipped** (a lean L10 mixer view, scoped and built in the follow-up
  doc below) — **all five steps of this rollout are now done.**
- `docs/brainstorms/2026-07-04-mixer-view-requirements.md` — E4 step 5's
  scoping pass, and now its build log. Corrected the parent doc's framing:
  L9/L10/L11's stated dependency on L1/L3 (both unstarted, L1 deliberately
  deferred) doesn't hold up the way L5–L8/D5/D6 actually shipped — a lean
  **L10 mixer view is shipped** (`mixerUI.js`) as a new `#lower-tabs` tab,
  no region system needed; **L11** (per-track device chain) turned out
  already functionally delivered by step 2's `switchTrack()` rack resync,
  no new work needed; only **L9** (real simultaneous multi-track lanes)
  stays deferred as a genuinely bigger ask. Shipped: `audio.js` gained a
  `StereoPannerNode` + post-fader `tapOut` analyser per track and
  solo-aware `trackMixGain()` math (mute always wins); `mixerUI.js` builds
  one channel strip per track (name — click to switch active — pan knob,
  gain fader, Mute/Solo, a peak meter) plus a master meter, using a
  two-tier render (rebuild DOM only when the track list changes, repaint
  values otherwise) to avoid tearing down real SVG-skinned knobs on every
  unrelated store change. Verified end-to-end in a real browser: fader/pan
  write through correctly, mute and solo interact correctly (mute always
  wins), clicking a channel name switches the active track, meters read
  live per-track signal. One real diagnostic finding along the way,
  documented rather than silently worked around: in this headless test
  environment specifically, a DOM reflow (e.g. switching lower-tabs) while
  the AudioContext has no concurrent audio activity can leave a just-
  scheduled `AudioParam` automation "stuck" indefinitely — confirmed via a
  manual direct node call bypassing all app logic, and confirmed resolved
  the instant any real audio activity resumes (a new note, or the
  sequencer playing). Doesn't reproduce under realistic conditions
  (verified muting mid-playback works correctly) and isn't specific to the
  mixer — an unrelated tab switch reproduces it too — so it's a headless/
  no-real-audio-device rendering artifact, not a code defect.
- `docs/brainstorms/2026-07-04-inline-help-requirements.md` — scoping pass
  for inline instructions/help across every module and feature, prompted by
  the DAW surfaces (transport, tracks, sequencer, mixer, era workspaces,
  …) having no equivalent of the synth rack's Learn panel. Audit found
  three help mechanisms already in production, just inconsistently
  applied: the Learn panel (`teach()`, synth-rack controls + lore/boss
  hints only), a static inline caption (Piano Roll/Practice/Mixer each
  have one; Sequencer — the one lower-tab with **nothing** — doesn't),
  and native `title=""` tooltips (everything else, including era
  workspaces, which already carries real pioneer/tagline copy, just
  hover-gated). Confirmed the Learn panel actually sits in the same grid
  row as the lower-tabs area on desktop (side by side, not hidden below),
  correcting an assumption from the conversation that raised this. Scopes
  a small v1: give the Sequencer tab a caption like its three siblings,
  and extend three title-only spots (Tracks bar, Mixer's existing caption,
  Era workspaces) with a short static line each — explicitly recommends
  **not** extending `teach()` to any DAW control, since none of their
  mental models need Tier 1's multi-paragraph depth. ✅ Shipped: four
  static caption lines added to `index.html`, all reusing the existing
  `.seq-ctrl` caption markup, zero new CSS/JS. The Sequencer's caption
  needed its own second toolbar row (the first row had no room left);
  Era workspaces' caption lives between the "Workspace" label and the
  swatch row. Verified in a real browser at 1400px — none of the four
  overflow or clip.
- `docs/daw-layout-backlog.md` — the living `L1–L17` layout backlog (region
  taxonomy, view modes, sequencer surfaces; status markers kept current).
- `docs/daw-feature-gap-backlog.md` — the living `F1–F7` feature-parity
  backlog (status markers kept current).
- `docs/backlog.md` — the `B1–B16` synth/gameplay polish backlog — **closed**,
  all done.
- `docs/plans/` — per-feature implementation plans (E1, E2, E3, L1 region shell).
- `docs/MANUAL.md` — the **player-facing** manual: every module/control's
  range and behavior, the boss-fight roster, and every DAW feature
  (transport, sequencer, piano roll, clips, MIDI import/export, tracks,
  mixer, practice gym, era workspaces), plus keyboard shortcuts. Living —
  update it alongside any change that adds, removes, or changes the
  range/behavior of a player-visible control. Also surfaced **in-app** as a
  condensed version in the ungated Help tab (`#view-help` in `index.html`
  — see the DAW-surfaces section above) so a player never has to leave the
  page to find it.
