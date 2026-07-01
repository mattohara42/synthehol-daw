---
date: 2026-06-29
topic: daw-architecture-and-feasibility
status: direction-proposed
---

# Synthehol — DAW Architecture & Feasibility

Captures the platform constraints we must design around (MIDI, mobile, audio),
an honest assessment of whether today's architecture can carry a full DAW, and a
recommended architecture that can — plus the engine/platform backlog that the
layout backlog (`docs/daw-layout-backlog.md`) doesn't cover.

---

## 1. Platform feasibility (verified, not assumed)

### MIDI — do **not** assume Web MIDI is available

Verified browser support (June 2026):

| Platform | Web MIDI (live hardware I/O) |
|---|---|
| Chrome / Edge / Opera (desktop) | ✅ supported |
| Chrome for Android | ✅ supported |
| Firefox 108+ | ⚠️ supported, but the **first `requestMIDIAccess` prompts the user to install a generated add-on** |
| Safari (macOS) | ❌ not supported, any version |
| **iOS / iPadOS — every browser** | ❌ not supported. All iOS browsers use WebKit, which has **no Web MIDI and no roadmap** (Apple cites fingerprinting) |

Implications:
- A large share of users — **all of iOS**, plus desktop Safari — have **zero**
  live-MIDI capability. Web MIDI also requires a **secure context (HTTPS)** and a
  **permission prompt**; sysex needs a second prompt.
- This confirms roadmap **R20** (MIDI never hard-gates) and forces a split:

  - **Live MIDI I/O** (`navigator.requestMIDIAccess`) — **progressive
    enhancement only.** Feature-detect; if absent, hide the feature silently.
    Frictionless only on Chromium desktop/Android.
  - **MIDI *file* import/export** (`.mid` parse/write in pure JS) — **works
    everywhere, including iOS.** This is the universal interop path and should be
    the primary "MIDI" deliverable; hardware I/O is the bonus.

### Mobile & audio — real gotchas

- **iOS silent switch mutes Web Audio.** With the hardware mute switch on, Web
  Audio produces no sound (unlike `<audio>`/`<video>`), so users think the app is
  broken. Mitigation: the known "unmute" trick — play a short silent clip through
  an `<audio>` element on the first user gesture alongside resuming the
  `AudioContext`. Needs an explicit "tap to enable sound" affordance.
- **AudioContext requires a user gesture** to start/resume (we already lazy-start
  on first key — keep that, and add resume-on-visibility for backgrounded tabs).
- **Touch loses three of our knob interactions:** scroll-wheel (fine-tune),
  hover (readout), double-click (reset). Need touch equivalents (long-press /
  two-finger / double-tap). Vertical-drag and velocity-from-Y already work.
- **Computer-keyboard note input is meaningless on phones** — the on-screen
  keyboard becomes the only input (bigger, scrollable).
- **CPU budget:** convolver reverb and (future) per-voice graphs are heavy on
  phones, on top of several always-on `requestAnimationFrame` loops. A timeline
  playhead + meters multiply this. Needs a render budget (see §3).
- **A full DAW at ~375 px wide is a different product.** Responsive shrinking is
  not enough; mobile needs a **single-panel-at-a-time mode with a bottom tab
  bar** — a distinct layout *mode*, not a media-query tweak.

### Browser support matrix (decision needed)

We have not committed to a target matrix. Proposed baseline: **evergreen Chromium
(desktop + Android) and Safari (macOS + iOS) fully supported; Firefox supported;**
live MIDI only where the platform allows. Everything degrades; nothing hard-gates.

---

## 2. Does today's architecture scale to a DAW?

Honest answer: **the current architecture is well-tuned for a single-voice
teaching toy and will not carry a DAW without a structural layer beneath it.**
The friction points:

- **Single mutable global `S`** (`state.js`) holds *one instrument's* params. A
  DAW is N tracks × M devices × clips × arrangement. A global singleton can't
  represent that, and blocks **serialization-as-source-of-truth, undo/redo, and
  multiple instances**.
- **Direct imperative wiring.** `controls.js` writes `S`, the audio param, *and*
  the canvas in each handler. There's no single source of truth, so you can't
  reconstruct the UI/audio from saved state, can't record automation cleanly, and
  every new surface re-pokes everything.
- **Fixed monophonic graph** (`engine`) — one osc, one amp env, one note. No
  voices, no tracks, no mixer buses.
- **No clock/scheduler.** Sequencing needs sample-accurate, lookahead scheduling;
  none exists.
- **rAF sprawl.** Each visual runs its own `requestAnimationFrame` loop; this
  won't scale to a timeline/meters and is costly on mobile.

None of this means the current code is "wrong" — it's optimal for Act I. It means
a DAW needs an **application architecture layered beneath the readable-synth
aesthetic**, introduced additively.

### Options considered

- **A. Evolve plain JS into a layered, state-driven app** (store + commands +
  audio reconciler + worker scheduler + voice/track/mixer). Keeps the vanilla,
  teachable ethos. **← recommended.**
- **B. Adopt a UI framework (React/Svelte/Solid).** Helps DAW-scale UI (track
  lanes, mixer), but erodes the "plain-JS synthesis reference" identity, adds
  build weight, and the audio still needs an imperative reconciler. Possible
  *minimal* reactive layer for the DAW shell only — defer the decision.
- **C. Adopt an audio framework (Tone.js).** Gives transport/scheduling/voices
  for free, but directly contradicts `CLAUDE.md` ("no audio library — the signal
  chain is hand-built so the code stays readable as a synthesis reference"). The
  whole Act I teaching premise is the hand-built nodes. **Reject for the core.**
- **D. AudioWorklet for DSP/timing.** Powerful but not yet needed; plain nodes +
  a worker-timer scheduler suffice until we need custom DSP. Keep in reserve.

---

## 3. Recommended architecture — layered & state-driven

Keep the hand-built, readable synth nodes as the **instrument layer** (preserves
teaching + Act I). Introduce an application architecture around them:

**Layer 1 — Project state model (serializable, single source of truth).**
A plain, serializable tree:
```
project = {
  transport: { bpm, timeSig, playing, loop, position },
  tracks: [ { id, name, instrument: { type, params }, fxChain: [...],
             clips: [...], mixer: { gain, pan, mute, solo } } ],
  arrangement: [...],
}
```
Today's `S` becomes `project.tracks[0].instrument.params`. Unlocks save/load,
undo, and multiple tracks/instances.

**Layer 2 — Commands + store (unidirectional flow).**
UI never touches audio directly; it dispatches commands
(`setParam(trackId, path, v)`, `addTrack`, `noteOn`, `transport.play`). A small
store applies them to project state and notifies subscribers. **State → derive UI
+ audio**, not UI → poke both. Undo/redo = inverse commands or state snapshots.

**Layer 3 — Audio reconciler + engine.**
Given desired state, the engine builds/updates the real Web Audio graph: a
**voice pool** per instrument (polyphony), per-track instrument+FX chains, and a
**mixer** (track gain/pan → master bus). On change, reconcile (create/destroy/
retarget nodes) — a "virtual audio graph". The hand-built node code lives inside
each device builder, preserved as the teaching reference.

**Layer 4 — Transport / scheduler (timing).**
A **lookahead scheduler** ("A Tale of Two Clocks") driven by a **Web Worker
timer** (immune to tab throttling), reading BPM/PPQ from transport state and
scheduling note events against `AudioContext.currentTime`. Prerequisite for any
sequencer — more fundamental than any pixel in the layout backlog.

**Layer 5 — View / render.**
Derive UI from state. Keep vanilla DOM + Canvas, but a **single rAF dispatcher
with dirty-region flags** instead of N independent loops (also the mobile perf
fix). The L1 region shell's `viewState` is the seed of this layer; `rack`,
`daw`, and `mobile` are alternate derivations from the same project state.

**Cross-cutting:** persistence (serialize to IndexedDB + file import/export;
render audio via `OfflineAudioContext`), feature-detection (MIDI, audio-unlock),
and a render/CPU budget.

### Why this is better *and* not a rewrite

It's **additive and migratable**; Act I keeps working throughout:
1. Introduce the project store; move `S` into `project.tracks[0].instrument.params`
   (synth reads its params from one place).
2. Route control changes through commands (still one track) — gains undo + save.
3. Wrap `engine` in a voice/track manager + reconciler (polyphony, then tracks).
4. Add the worker scheduler when the sequencer (Act IV) arrives.

Each step is independently shippable.

---

## 4. New backlog — engine & platform (E-tier)

Not covered by the layout backlog; several are the real long-poles.

- **E1. Project state model + store (Layers 1–2)** — L · foundation. Replace the
  global `S` with a serializable project tree behind a command/subscribe store.
  Unblocks undo, save/load, and multi-track. *Do alongside L1.*
- **E2. Transport/clock + lookahead scheduler (Layer 4)** — L · foundation.
  Worker-timer + `AudioContext.currentTime` lookahead; BPM/PPQ transport state.
  Hard prerequisite for the sequencer (L5/L6).
- **E3. Polyphony / voice manager** — L. Voice pool + allocation/stealing;
  removes the monophonic limitation (Act III).
- **E4. Multi-track graph + mixer routing (Layer 3)** — XL. N instruments → per-
  track FX → mixer → master; the audio side of L9/L10/L11.
- **E5. Audio reconciler** — M. Diff desired state → real node graph; create/
  destroy/retarget. Glue for E1↔E3/E4.
- **E6. Project persistence + export** — L. 🟡 PARTIAL: the whole project
  (synth params, pattern, clips, transport) now auto-saves to localStorage on
  every change and restores on load (`src/persistence.js`) — work survives a
  refresh. `.wav` offline render also shipped (`src/wavRender.js` — an
  `OfflineAudioContext` rebuild of the signal chain, walks the pattern
  directly instead of a real-time scheduler, encodes to 16-bit PCM). Still
  open: `.json` project import/export (backup/sharing across machines, maybe
  IndexedDB instead of localStorage for size), `.mid` import/export
  (universal, see §1).
- **E7. Undo/redo** — M. Command-inverse or snapshot history; falls out of E1.
- **E8. Render-loop budget** — M. 🟡 PARTIAL: consolidated to a single rAF
  dispatcher (main.js's `animate()`) — scope.js's drawScope/drawSpectrum used
  to each self-schedule their own rAF loop, three running independently.
  Still open: dirty-region tracking, an explicit mobile CPU ceiling. No
  evidence of an actual perf problem to fix there yet — most canvases are
  already pull-based; only LFO/scope/spectrum animate continuously, and
  hidden canvases already cheaply no-op. (Layer 5.)
- **E9. Live MIDI I/O (Web MIDI)** — M · enhancement. 🟡 PARTIAL: input
  shipped (`src/midi.js`) — feature-detected, silently no-ops where Web MIDI
  is unavailable or permission is denied. MIDI notes share the same
  polyphonic voice pool and chord-level bookkeeping (`src/chordState.js`,
  extracted from keyboard.js so a MIDI chord and a keyboard chord interleave
  correctly) as every other input path. Still open: MIDI output. Chromium-
  desktop/Android only, as expected.
- **E10. Audio-unlock + mobile input** — S/M. iOS silent-switch unmute trick,
  "tap to enable sound", resume-on-visibility, and touch equivalents for the
  knob wheel/hover/double-click interactions.

### Updates this implies for `docs/daw-layout-backlog.md`

- Split **L16 (MIDI-map)** scope: live-MIDI mapping is enhancement-only; add a
  universal **MIDI-file import/export** surface instead.
- Promote a **`mobile` layout mode** (single-panel + bottom tab bar) from the L4
  "responsive" bullet to a first-class mode in the L1 region system.
- Note that L2/L5/L6 (transport, work-area, sequencer) depend on **E2** (the
  clock), and that L1's `viewState` should be derivable from the **E1** store.

---

## 5. Open decisions

- **Browser support matrix** — commit to the proposed baseline (§1)?
- **DAW mode vs. teaching layout at graduation** — replace or coexist?
- **Minimal reactive layer for the DAW shell** — home-grown subscribe/render, a
  signals micro-lib, or stay fully manual? (Decide when DAW-shell UI complexity
  actually bites, not now.)
- **Clip model** — session/launcher (Ableton) vs. linear arrangement first?
- **How much boss/progression framing carries into DAW mode, if any.**

## Sources

- [Web MIDI API — Can I use](https://caniuse.com/midi)
- [Web MIDI in 2026: Which Browsers Actually Work — Super Simple Piano](https://www.supersimplepiano.com/blog/web-midi-browser-compatibility-2026)
- [WebKit Bugzilla 836897 — Implement the Web MIDI API (Mozilla meta)](https://bugzilla.mozilla.org/show_bug.cgi?id=836897)
- [WebKit Bug 237322 — Web Audio is muted when the iOS ringer is muted](https://bugs.webkit.org/show_bug.cgi?id=237322)
- [feross/unmute-ios-audio](https://github.com/feross/unmute-ios-audio)
