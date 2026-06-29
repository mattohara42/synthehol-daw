---
date: 2026-06-29
topic: transport-clock-scheduler
backlog-items: E2 (Architecture Layer 4); unblocks L2, L5, L6 (sequencer)
status: proposed
depends-on: E1 (reads transport state from the store)
---

# Plan — Transport clock + lookahead scheduler (engine backlog E2)

## Context

A sequencer's hard prerequisite is **sample-accurate timing**, and we have none:
`audio.js` triggers notes immediately at `ctx.currentTime` with no clock,
transport, or scheduler. The architecture doc
(`docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md`, Layer 4)
calls for the **"A Tale of Two Clocks"** pattern — a coarse JS timer that looks
ahead and schedules events precisely against the Web Audio clock. This is more
fundamental to the DAW than any layout pixel: the transport bar (L2), playhead
(L5), and step sequencer (L6) all read from it.

E2 delivers the **clock + scheduler + transport controls + a metronome** (the
demonstrable, and genuinely useful, first consumer). It reads tempo from the
**E1** store's `transport` block, so E1 lands first.

## Approach

### Two clocks

- **Coarse timer in a Web Worker** (`src/clock.worker.js`): posts a `tick`
  message every ~25 ms. A worker (not `setInterval` on the main thread) is
  required because background tabs and mobile throttle main-thread timers, which
  would wreck timing. Fallback to `setInterval` only if `Worker` is unavailable.
- **Precise scheduling on the main thread** (`src/scheduler.js`): on each tick,
  look ahead a window (~0.1 s) and schedule every event whose time falls within
  `[now, now + lookahead)` using `AudioContext.currentTime`. Advance an internal
  `nextStepTime` by the step duration derived from BPM. Nothing is scheduled
  more than one window early, so tempo changes take effect within ~0.1 s.

### Testable scheduler core

Keep the timing math pure and injectable so it unit-tests without a worker or an
AudioContext:

```js
// scheduler.js
export function createScheduler({ now, schedule, getBpm, ppq = 4,
                                  lookahead = 0.1 }) {
  let running = false, nextStepTime = 0, step = 0;
  const stepDur = () => (60 / getBpm()) / ppq;     // ppq=4 → 16th notes
  return {
    start(at) { running = true; nextStepTime = at; step = 0; },
    stop()    { running = false; },
    isRunning: () => running,
    currentStep: () => step,
    // Called on every worker tick; schedules all due steps in the window.
    tick() {
      if (!running) return;
      while (nextStepTime < now() + lookahead) {
        schedule(step, nextStepTime);   // sink: metronome / sequencer / etc.
        nextStepTime += stepDur();
        step += 1;
      }
    },
  };
}
```

- `now()` → `engine.ctx.currentTime` in production; a controllable fake in tests.
- `schedule(step, time)` → the consumer sink (metronome now; sequencer at L6).
- `getBpm()` → `store.get().transport.bpm` (live tempo; reading per-tick means
  tempo changes apply immediately).

### Transport API (`src/transport.js`, updates the E1 store)

```js
transport.play()    // nextStepTime = ctx.currentTime + 0.05; start worker + scheduler
transport.stop()    // stop worker/scheduler; cancel pending; reset position
transport.toggle()
transport.setBpm(n) // store.setPath('transport.bpm', clamp(n)); takes effect next window
transport.toggleLoop(), transport.setLoop(startBar, endBar)
```

`play/stop` flip `transport.playing` in the store (so the transport-bar UI, L2,
reflects it). **Position tracking:** the scheduler maps `step` →
`{ bar, beat, sixteenth }` (using `timeSig`) and writes `transport.position` as
steps fire; a smooth visual playhead (L5) later interpolates between updates
using `ctx.currentTime`. **Loop:** when `step` reaches the loop's end, wrap
`step`/position back to the start (musical time wraps; `nextStepTime` keeps
advancing in real time).

### Time-aware note triggering (engine, `audio.js`)

The engine triggers immediately today. Add scheduled triggering so consumers can
play *at a time*:

```js
export function noteOnAt(note, octave, time, velocity = 1) { /* schedule env + osc at `time` */ }
export function noteOffAt(time) { /* schedule release at `time` */ }
```

Refactor `playNote`/`releaseNote` to delegate to these with `time =
ctx.currentTime` (no behavior change for the live keyboard). The engine is still
**monophonic**, so E2 demonstrates a *mono* sequence + metronome; polyphonic
step playback (chords) needs the voice manager (**E3**) and is out of scope.

### Metronome — the first consumer (and a real feature)

`src/metronome.js`: registered as the scheduler sink (or alongside it). On each
beat (every `ppq` steps) play a short click via a dedicated gain → destination
(reuse the `bossAudio.js` tone approach: a brief oscillator blip, accented on
beat 1). Gated by a `transport.metronome` flag. This makes the clock audible and
verifiable, and is the metronome the transport bar (L2) will toggle.

### Wiring (`src/main.js`)

Instantiate the worker, build the scheduler with `now`/`schedule`/`getBpm` from
the engine + store + metronome, but **do not auto-play**. Vite worker form:
`new Worker(new URL('./clock.worker.js', import.meta.url), { type: 'module' })`.
No transport UI yet (that's L2) — expose `transport` so a temporary button or the
console can drive it for verification.

## Files

- `src/clock.worker.js` — new; interval `tick` poster with start/stop/setInterval.
- `src/scheduler.js` — new; `createScheduler` core (pure, tested) + worker glue.
- `src/transport.js` — new; play/stop/setBpm/loop, updates `store.transport`,
  position mapping.
- `src/metronome.js` — new; click consumer gated by `transport.metronome`.
- `src/audio.js` — add `noteOnAt`/`noteOffAt`; `playNote`/`releaseNote` delegate.
- `src/main.js` — instantiate worker + scheduler + metronome; expose `transport`.
- `src/scheduler.test.js` — new (see below).

Depends on **E1** for `store.transport`. No changes to `bossEngine`/`progression`.

## Verification

1. **Unit tests** (`scheduler.test.js`, no audio/worker needed):
   - `stepDur` math: 120 BPM, ppq 4 → 0.125 s/step;
   - lookahead inclusion: with a fake `now()`, `tick()` schedules exactly the
     steps inside `[now, now+lookahead)` and no more, and advances `nextStepTime`
     correctly across several ticks;
   - tempo change mid-run (change `getBpm` return) alters subsequent step spacing;
   - loop wrap: `step`/position returns to the loop start at the boundary while
     real time keeps advancing;
   - position mapping: step N → expected `{bar,beat,sixteenth}` for 4/4.
2. Full suite green, `npm run build` clean (incl. the worker bundling).
3. **Manual (headless ok):** call `transport.play()` from the console → audible
   metronome at 120 BPM; `transport.setBpm(160)` speeds it within ~0.1 s;
   `transport.stop()` silences and resets; backgrounding the tab keeps timing
   steady (worker, not main-thread timer); the live keyboard still plays
   immediately (delegation unchanged).

## Out of scope (later)

The transport-bar UI (L2), the step-sequencer/piano-roll surfaces and a
non-metronome event source (L5/L6), **polyphonic** scheduled playback (needs E3),
swing/groove (a small offset on odd steps — note as an easy follow-up),
automation playback (E-tier/L15), and a smooth interpolated playhead (L5).
