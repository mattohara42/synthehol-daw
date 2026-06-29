# E3 — Polyphony / voice manager

**Status:** done · **Depends on:** E1 (store), E2 (transport/scheduler)
**Unblocks:** L5/L6 (step sequencer + real pattern playback), Act III (live polyphony)

## Goal

Remove the engine's monophonic limitation by adding a **polyphonic voice
manager**: a pool of independent voices (each its own oscillator + amp
envelope) summed into the existing filter → master → FX chain, with voice
allocation and oldest-voice stealing when the pool is exhausted.

## Guiding constraint — don't disturb Act I

The shipped Act I boss game and the live keyboard are deliberately monophonic
(a new key cuts the held note; `keyboard.js` tracks a single
`engine.currentNote`). The progression roadmap unlocks *live* polyphony in
**Act III**, not now. So E3 is **additive**:

- The existing mono path (`osc → ampEnv → vcf`, driven by
  `noteOnAt/noteOffAt/playNote/releaseNote`) is **left exactly as is**. The live
  keyboard and every Act I/II boss predicate keep their current behavior. Zero
  risk to the shipped game.
- The new polyphonic path (`voice.osc → voice.amp → voiceBus → vcf`) runs in
  parallel, silent until something drives it. Its first consumer is the
  **scheduler** (sequencer patterns, L6); Act III will later route the live
  keyboard through it.

Both paths feed the same `vcf`, so polyphonic notes get the full filter + FX +
scope chain for free. They never conflict: the mono osc sits at gain 0 between
live keypresses; voices are created on demand and self-destruct after release.

## Design

### `src/voices.js` — `createVoiceManager({ ctx, output, getParams, maxVoices })`

A pool manager independent of the rest of the engine (testable with a fake
`ctx`). `getParams()` returns the live `S` so each voice reads current
waveform/detune/ADSR at note-on time.

- **`noteOn(freq, time, velocity) → id`** — allocate a voice. If the pool is at
  `maxVoices`, steal the **oldest** active voice (fast-release it, then reuse the
  slot). Build `osc (type, detune) → amp` , schedule the attack/decay ADSR on
  `amp.gain` scaled by velocity, connect `amp → output`, `osc.start(time)`.
  Returns a voice id.
- **`noteOff(id, time)`** — release ramp on the voice's `amp.gain` over
  `S.release`, schedule `osc.stop(time + release + ε)`, and remove the voice
  from the active set on the oscillator's `onended` (self-cleaning).
- **`releaseAll(time)`** — panic / transport-stop: release every active voice.
- **`activeCount()`** — number of sounding voices (for tests + future HUD).

Voice ids are monotonic. Stealing is **oldest-first** (lowest `startedAt`),
the simplest musically-acceptable policy; note-stealing strategy can be
refined later without touching callers.

### `src/audio.js` integration

- Lazily create the voice manager in `startAudio()` after `vcf` exists:
  `engine.voices = createVoiceManager({ ctx, output: vcf, getParams: () => S, maxVoices: 16 })`.
  A dedicated `voiceBus` gain isn't required — voices connect straight to
  `vcf` — but we keep `output` injectable so a per-track bus can replace it in
  E4 (multi-track).
- Export thin helpers for consumers:
  - **`voiceNoteOn(note, octave, time, velocity) → id`** (`startAudio()` then
    `engine.voices.noteOn(noteFreq(...), time, velocity)`).
  - **`voiceNoteOff(id, time)`**.
  - **`releaseAllVoices(time)`** (wired to transport stop later).

### Known v1 limitations (documented, deferred)

- **Shared filter.** All voices pass through the one `vcf`, so the filter
  envelope and resonance are global, not per-voice. Classic poly synths have
  per-voice filters; that's an E4-era upgrade. The filter env retriggers on the
  mono path only.
- **LFO → pitch/amp on poly voices.** The LFO's per-voice destinations
  (`osc.detune`, `ampEnv.gain`) target the mono nodes. Poly voices honor the
  **filter** LFO (shared `vcf`) but not per-voice pitch/amp modulation in v1.
  Per-voice LFO fan-out is a later refinement.
- **No live-keyboard polyphony yet.** That's the Act III unlock; the manager is
  ready for it, but wiring `keyboard.js` through voices is out of scope here.

## Tests — `src/voices.test.js`

Fake `ctx` exposing `createOscillator`/`createGain` with `AudioParam` stubs
that record scheduled events. Cover:

- a voice is created on `noteOn`, connected to `output`, `osc.start(time)` called;
- ADSR attack/decay scheduled on the amp gain, scaled by velocity;
- `noteOff` schedules a release ramp + `osc.stop`;
- `activeCount` reflects on/off;
- **stealing**: with `maxVoices = 2`, a third `noteOn` steals the oldest voice
  (the first voice's slot is reclaimed; count stays ≤ 2);
- `releaseAll` releases every voice.

## Verification

- `npm test` green (existing 99 + new voice tests).
- `npm run build` clean.
- Headless: drive a 3-note chord through `voiceNoteOn` at one `time` and assert
  `engine.voices.activeCount() === 3` with audio running and no page errors;
  then `releaseAll` and confirm the count drains.

## Out of scope (explicit)

Live-keyboard polyphony (Act III), per-voice filters, per-voice LFO fan-out,
unison/detune stacking (Act II E-items), and sequencer UI (L6). E3 delivers the
tested voice-pool foundation those build on.
