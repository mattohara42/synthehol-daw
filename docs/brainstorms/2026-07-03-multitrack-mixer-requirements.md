---
date: 2026-07-03
topic: multitrack-mixer-requirements
status: direction-proposed
---

# Synthehol — Multi-Track + Mixer (E4) Requirements

Scoping pass for E4 (`docs/brainstorms/2026-06-29-daw-architecture-and-
feasibility.md`'s "N instruments → per-track FX → mixer → master," rated XL,
called out in `CLAUDE.md` as "the biggest remaining structural gap") before
any code gets written. E4 is the audio-side prerequisite for the whole D2
layout tier (L9 track-lane container, L10 mixer view, L11 per-track device
chain) and for a real sampler down the line. This doc audits how far the
data model already gets us, names the actual hard problem, and proposes a
lean first slice — the same shape of pass `2026-07-03-era-workspaces-
requirements.md` did for D5 before any code.

## Where we actually are today (an audit, not an assumption)

The architecture doc's Layer 1 sketch already shipped almost verbatim in
`store.js`: `project.tracks` is a real array, and each entry already has the
right shape —
```js
{ id, name, instrument: { type, params }, fx, clips, pattern, mixer: { gain, pan, mute, solo } }
```
This reads like multi-track is half-built. It is not. Three things are true
at once:

1. **Exactly one track is ever created.** `createProject()` hardcodes a
   single `t1` entry; there is no `addTrack()`/`removeTrack()` on `store`,
   and no UI that could call one if it existed.
2. **`mixer` is inert.** `gain`/`pan`/`mute`/`solo` are serialized but never
   read — `audio.js` always takes master volume from `S.masterVol`
   (`store.params().masterVol`), not `track.mixer.gain`. There's no pan node
   anywhere in the graph.
3. **`instrument.type` is inert too.** It's always the string `'synth'` and
   nothing branches on it. There is exactly one instrument implementation —
   the hand-built osc/filter/envelope/LFO/FX chain in `audio.js` — not a
   family of instrument types to pick between. This matters for scoping:
   **multi-track here means N instances of the same synth, not N kinds of
   instrument.** Anything implying an instrument picker/browser (L12) is out
   of scope for E4 itself.

The deeper issue is `audio.js`'s `engine` object: `ctx.vcf`, `.drive`,
`.eqLow/Mid/High`, `.master`, `.delay`/`.reverb`/`.chorusDelay`, and
`.voices` are each built **once**, as module-level singletons, in
`startAudio()`. Every control in `controls.js` and every consumer in
`main.js` reaches through this one `engine` and one `S`. There is currently
no way to have two independently-sculptable sounds playing at once — that's
the actual gap, and it's a rewrite of the instrument layer, not an addition
to the store.

One thing already **is** ready: `voices.js`'s `createVoiceManager({ ctx,
output, getParams, maxVoices, lfoMod })` takes its dependencies as
parameters rather than reaching into the global `engine`/`S` — CLAUDE.md
already flagged this as "decoupled from the engine... so it's testable and
reusable per-track once E4 lands." `wavRender.js` already proves the
pattern by building a second, independent instance of it. The voice pool is
not the hard part; the shared filter/drive/EQ/FX rack is.

`store.setPath`/undo/persistence are tree-based and don't structurally care
how many tracks exist — except `applyState()`'s track loop, which has a
standing `if (!track) return; // multi-track reconciliation is later (E4)`
guard. Loading a saved project (undo, refresh-restore, or a future `.json`
import) with a different track count than the live tree silently drops the
extra tracks today. That guard has to come out as part of E4, independent
of whatever UI ships.

## What "N instances of the same synth" actually costs

Each additional track needs its own **instrument** — oscillators, noise,
osc2, filter, envelope, LFO — so two tracks can hold genuinely different
sounds. It does *not* obviously need its own **FX rack**. `audio.js`'s
reverb is a `ConvolverNode` running a ~2-second stereo impulse response;
delay is a feedback loop; chorus is a second LFO-swept delay. Duplicating
all three per track is real CPU cost (mobile matters — see the
architecture doc §1) for a payoff most players won't use (most tracks in a
short pattern-based sketch don't need their own independent reverb tail).

**Proposed scope boundary for v1:** each track gets its own instrument
chain (osc/osc2/noise → filter → envelope → LFO) feeding a per-track
gain/pan node (finally giving `mixer.gain`/`mixer.pan` a job), which sums
into **one shared** drive → EQ → delay/reverb/chorus → master chain — the
existing rack, unchanged, now fed by N sources instead of one. This is
explicitly a narrower promise than L11's eventual "per-track device chain
... generalizes today's single global rack" — full per-track FX is a
later step once the shared-bus version has proven multi-track is worth the
complexity. Worth saying plainly: **real per-track FX inserts are
deferred, not abandoned** — this doc only scopes the lean slice.

## How this interacts with the boss/progression layer

Bosses fight against the single active track's `S` (`bossEngine.tick`
reads `store.params()`, which is `activeTrack().instrument.params`).
Nothing about that breaks if a second track exists — `S` just re-points
when the active track changes, the same as it does today when the store's
active-track index changes. But it does mean: **if a player adds a second
track while a D1 bonus challenge is still in progress and switches to it,
that challenge stops taking damage** (its target predicate reads whichever
track is active) until they switch back — the same as if they'd turned the
wrong knob. Not a bug, just worth stating so it isn't rediscovered as one.

Given that, and following the precedent D5 (era workspaces) and D6
(practice gym) already set — both graduation-gated, both framed as "the
free-play DAW sandbox" identity rather than part of the teaching path —
**this doc recommends gating "Add Track" behind graduation**, same
condition `revealEraWorkspaces()`/`revealPracticeTab()` already use
(`progression.defeated.length === STAGE_IDS.length`). Pre-graduation, the
single implicit track behaves exactly as it does today; nothing about the
boss-fight flow changes. This is a real scope decision, not just tidiness
— it means E4 doesn't have to define what "fighting a boss on track 2"
means, because that state can't occur.

The sequencer/piano-roll/clips tabs are *not* graduation-gated today (L6
shipped mid-progression, "Act IV's first challenge"). Multi-track diverges
from that precedent on purpose: those surfaces only ever touched the one
track that already existed, so they needed no track-management UI at all.
Adding a second track is a structurally different ask (a picker, a mixer,
per-track playback) that the "fun first" pacing doesn't obviously want
mid-progression, on top of the CPU cost of a second live instrument chain
while a player is still learning to use the first one.

## Playback: the other half of the work

Today, `transport.registerConsumer` callbacks (the sequencer and
piano-roll consumers wired in `main.js`) read `store.pattern()` —
the **active** track's pattern only. A second track's pattern never plays,
even if it has notes in it, because nothing schedules it. Multi-track
playback needs the scheduler to walk **every** track's pattern each tick
and fire notes into **that track's own voice manager** — not a small
tweak, a second structural change alongside the audio-graph split. Likely
shape: `main.js` builds one sequencer-consumer + one piano-roll-consumer
*per track* (or a single consumer that internally loops tracks), each
pointed at that track's `getPattern`/`noteOn`/`noteOff`. `wavRender.js`'s
offline render has the same problem in miniature — it currently renders
one track's pattern into one graph; a `.wav` export of a multi-track
project needs to walk all of them.

## Suggested phased plan (lean steps, matching how L5–L8 shipped)

1. **Store completion (no UI).** `addTrack()`/`removeTrack()`/
   `setActiveTrack()` on `store`; remove the `applyState` reconciliation
   guard so undo/redo and persistence handle a changing track count
   correctly. Fully testable without touching `audio.js` at all — this is
   the same spirit as E1/E2/E3 shipping as pure, store-level work before
   any UI existed for them.
2. **Instrument-chain duplication.** Refactor `audio.js`'s per-track nodes
   (osc/osc2/noise/voices/filter/envelope/LFO) out of the module-level
   `engine` singleton into a builder function invocable once per track,
   each instance's output landing on a new per-track gain/pan node that
   feeds the *existing* shared drive/EQ/FX/master chain. This is the actual
   XL core of E4 — everything else is glue around it.
3. **Multi-track playback.** Scheduler consumers iterate every track, not
   just the active one, per the section above.
4. **Minimal UI: a track list, not a mixer.** An "Add Track"/track-picker
   list (name, mute, solo, a duplicate-of-L8's-clip-select shape) —
   deliberately *not* L10's full channel-strip mixer view with meters yet.
   Switching the active track swaps which instrument the rack/Learn
   panel/keyboard edit, the same mental model clip-switching already uses
   for patterns. This is the L5-style "lean step, not the full region" — a
   flat list stands in for L9's real track-lane container until there's a
   work-area to put lanes in.
5. **L9/L10/L11 proper**, once the above is live and something is actually
   being mixed. Full channel strips, meters, per-track device rack — the
   layout-backlog items, now unblocked.

Steps 1–3 are the actual E4 payload (audio engine + playback); step 4 is
the minimum UI to make it observable/testable by a human; step 5 is
already-scoped layout-backlog work that just needed step 1–3 to exist.

## Open questions (need a decision before step 2 starts)

- **Track cap.** Unlimited tracks is unlikely to be the right default —
  each one is a live polyphonic voice pool plus filter/envelope/LFO nodes.
  A small fixed ceiling (4? 8?) keeps CPU predictable and sidesteps
  needing scroll/virtualization in the lean-step track list. Suggest 4 for
  v1, matching how `voices.js`'s own `maxVoices` (16 live) already caps
  per-instrument polyphony for the same reason.
- **What does "Add Track" start from?** A fresh default patch (today's
  `defaultParams()`), a copy of the currently-active track's patch, or a
  small picker (blank / duplicate current / a factory preset)? Duplicate-
  current is the cheapest to build and mirrors `clipsUI.js`'s "Duplicate"
  precedent already in the codebase.
- **Solo/mute semantics.** `mixer.mute`/`mixer.solo` fields already exist
  in the schema; do they gain gain-node wiring in step 2, or is that
  deferred to the mixer-view step (5)? Recommend wiring mute in step 2
  (trivial — a gain of 0) and deferring solo (needs cross-track
  coordination: "am I the only un-muted track") to whichever step ships
  the track list, since solo is meaningless without seeing the other
  tracks to solo against.
- **Does `wavRender.js` need to handle multi-track before step 4 ships, or
  can offline export stay single-track (documented as a known gap) until a
  later pass?** Recommend the latter — flag it explicitly in that
  module's header rather than silently under-rendering a multi-track
  project.

## Suggested first slice

Step 1 (store completion) is the natural starting point: it's pure,
fully unit-testable the way E1/E2/E3 were, has zero audio/UI risk, and
unblocks everything after it without committing to any of the open
questions above except the reconciliation-guard removal. Recommend
scoping steps 2–5 into their own follow-up passes once step 1 has landed
and the open questions have answers — this is genuinely bigger than any
single slice shipped so far (D1–D6 combined were still each a few
files), and splitting it the way L5→L8 shipped incrementally is what
keeps each piece reviewable.
