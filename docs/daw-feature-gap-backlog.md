---
date: 2026-06-30
topic: daw-feature-gap-backlog
status: living
---

# Synthehol — DAW Feature-Gap Backlog (F-tier)

A feature-parity pass against mainstream DAWs (Ableton, Logic, FL, Bitwig,
GarageBand). Complements the existing tiers:

- `docs/daw-layout-backlog.md` — **L-tier** (where features live on screen).
- `docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md` — **E-tier**
  (engine/platform long-poles).

This doc is the **F-tier**: *content/feature* gaps a DAW has that Synthehol does
not, and that are **not already captured** in L- or E-tier. Ordered by
fit-to-mission × value ÷ risk. "Fit" = how well it serves "fun-first synthesis
learning → DAW sandbox" (a touchable control should *teach* what it did).

## Status of the parity audit (2026-06-30)

Shipped: 2-osc + noise subtractive synth, filter, ADSR, LFO, delay + reverb,
16-voice polyphony, transport (tempo/sig/loop/metronome), 8×16 step sequencer
(swing, length), presets (localStorage), basic undo, scope + spectrum.

Already planned elsewhere (not repeated here): piano-roll (L7), pattern/clip
mgmt (L8), mixer UI (L10/E4), multi-instrument (E4), per-track FX chain (L11),
project file + export (E6), MIDI file + live MIDI (E9 / feasibility §1), mobile
+ touch (L4/E10), per-step velocity (L6 deferred).

---

## F1 — Parameter automation — L · sequencer/engine — ✅ v1 SHIPPED (cutoff)
**Shipped v1**: a per-step **filter-cutoff** automation lane under the step grid
(`automation.cutoff[]` in the pattern; drag a bar to set, drag to the floor to
clear; log-mapped 60–18kHz). The sequencer consumer applies each step's value to
the VCF at step time, even across rests. **Next:** generalize to other params
(volume, resonance), and freeform breakpoint curves once a time-ruler work-area
(L5) exists.

Record/draw a parameter (filter cutoff, volume, any knob) as a curve over time,
played back by the transport. The single most glaring absence vs every DAW, and
the **best teaching fit we have**: it literally shows what a control does as time
moves. Builds directly on the shipped transport/clock (E2) and store (E1).
- **MVP:** one automation lane in the sequencer area; draw/clear breakpoints for
  cutoff; scheduler reads it alongside note steps. Generalize to any param later.
- **Depends on:** L5 work-area (interim: a lane under the step grid), E2 clock.
- **Boss candidate:** "automate a filter sweep across the bar."

## F2 — Audio export / render to file — M · I/O · HIGH payoff — ✅ v1 SHIPPED
**Shipped** (`src/exporter.js`, "Export" button in the presets bar): real-time
MediaRecorder capture of the post-FX bus → downloadable webm/opus. Offline `.wav`
render still deferred (needs OfflineAudioContext rebuild).

Bounce the current loop/patch to a downloadable audio file. Massive
share/keepsake payoff for low surface area. E6 covers `.json` project export but
**not audio render**.
- **MVP (low risk):** `MediaStreamAudioDestinationNode` + `MediaRecorder` on the
  master bus, capture one loop in real time → download `.webm`.
- **Better (later):** offline `OfflineAudioContext` re-render → encode `.wav`
  (needs the engine to build into a passed-in context; a real refactor).
- **Pairs with:** the old "URL-encoded patch sharing" idea in `docs/backlog.md`.

## F3 — Drive / distortion effect — S · effect — ✅ SHIPPED
A `WaveShaperNode` saturation stage (Drive amount, 0 = clean). Cheap, fun, loud,
and a clean teaching module ("clipping creates harmonics"). Follows the exact
delay/reverb module pattern. Lives in the existing FX module (no new rack cell).
- **Boss candidate:** later, an Act-V "overdrive" stage.

## F4 — EQ effect — M · effect — ✅ SHIPPED
A 2–3 band EQ (`BiquadFilterNode` peaking/shelf). Teaches frequency shaping
distinct from the resonant VCF. Per-track once L11 lands; global meanwhile.

## F5 — Second instrument type: drums / sampler — XL · instrument · HIGH value
One synth alone can't make a full track — no rhythm section. A simple drum
voice (noise/sine percussion) or a one-shot sampler. High value but a genuine
new instrument type; leans on multi-track (E4).
- **Lean first step:** a synthesized drum module (kick = pitch-dropping sine,
  snare = noise burst, hat = filtered noise) playable from the step grid.

## F6 — Editing: quantize + copy/paste/duplicate notes — M · sequencer
Standard note editing the piano-roll (L7) will need: snap timing, copy/paste,
duplicate a pattern region. Trivial on the step grid, essential on the roll.

## F7 — Count-in + tempo nicety pass — S · transport
Pre-roll count-in before record/play, and tap-tempo. Small, expected, cheap.

---

## Intentionally out of scope (mission mismatch)
- **Audio recording (mic/line) / audio tracks** — Synthehol is a *synthesis*
  teacher, not a recording studio. Large surface (input perms, latency,
  waveform editing) for little mission value. Revisit only if identity shifts.
- **VST/AU plugin hosting** — not possible on the web platform as native plugins.
- **Sidechain / advanced bus routing** — pro-tier; defer until a mixer exists.

---

## Suggested order
F3 (drive) → F2 (audio export) → F1 (automation) → F5 (drums) → F4/F6/F7.
Rationale: ship the two low-risk crowd-pleasers (drive, export) first to build
momentum, then take on automation (the marquee gap) with the transport already
proven, then drums for real musical range.
