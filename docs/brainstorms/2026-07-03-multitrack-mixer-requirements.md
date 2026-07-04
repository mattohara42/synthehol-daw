---
date: 2026-07-03
topic: multitrack-mixer-requirements
status: step-2-shipped
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

1. **Store completion (no UI)** — ✅ SHIPPED. `store.tracks()`,
   `addTrack(name?)` (clones the active track's instrument+pattern by value,
   undoable), `removeTrack(id)`; the `applyState` reconciliation guard is
   gone, so undo/redo/load correctly resize the live tracks array to match.
   Fully unit-tested (`store.test.js`) plus a real-browser smoke check, zero
   audio/UI risk, exactly the spirit E1/E2/E3 shipped in.
   **`setActiveTrack()` turned out not to belong in this step, and doesn't
   exist yet:** implementing it surfaced that `state.js`'s `S` is a single
   object reference captured *once*, at module-import time
   (`export const S = store.params()`) — not re-derived per read. Every
   consumer (`audio.js`, `canvas.js`, `controls.js`'s direct `S.x` reads)
   trusts that fixed identity. If `setActiveTrack()` repointed
   `activeTrackId`, `store.params()`/`store.set()` would immediately start
   reading/writing the newly-active track's object while `S` — and
   everything that reads it — kept silently looking at the *previous*
   track. That's a real split-brain bug, not a rough edge, so `addTrack()`
   deliberately never changes `activeTrackId`, and `removeTrack()` refuses
   to remove the active track. Making track-switching safe needs either
   resyncing `S`'s contents in place the moment the active track changes
   (the same trick `applyPreset()` already uses to make undo/redo visible —
   see `main.js`'s `resyncControlsFromStore()`) or retiring the `S`
   singleton pattern outright. That design decision now belongs to
   whichever of steps 2/4 below builds the mechanism that would actually
   *use* a switchable active track — it would have been premature (and
   silently unsafe) to ship as inert API surface in step 1.
2. **Track switching (a minimal UI, not a mixer)** — ✅ SHIPPED, and
   **re-sequenced ahead of where this doc originally put it.** Originally
   this was going to be step 4, after the audio engine had already been
   split per-track. That turned out backwards: step 1's finding meant
   *nothing* touching `activeTrackId` could ship safely without solving the
   `S`-identity problem first, and building the engine-duplication work
   blind — with no UI to switch tracks and thus no way to actually verify
   "two tracks, two independently editable sounds" in a real browser — would
   have been exactly the kind of unverifiable, hard-to-review change this
   project's discipline avoids. So the switching mechanism moved up and
   folded together with a cut-down version of the original step 4.
   **What shipped:** `store.setActiveTrack(id)` (not undo-tracked, like a
   tab switch — see below for why undo/redo still works correctly across
   it); a `#tracks-bar` (`src/tracksUI.js`) — a `<select>` + "+ Add
   Track"/"Remove" buttons, styled with the existing `.presets-bar` classes,
   gated on graduation like D5/D6. Switching calls `applyPreset(store.
   params())` afterward, reusing the exact resync `main.js`'s undo/redo
   already leans on. **The `S`-identity fix, concretely:** `store.js` keeps
   a private reference to the literal object `state.js`'s `S` aliases
   (`_sParamsRef` — it was always just `store.params()`'s return value at
   import time, so `store.js` doesn't need to import `state.js` back to
   reference it). `setActiveTrack()` doesn't reassign `S`; it re-homes it —
   a `rehomeSParamsRef()` helper ensures `S` always physically sits in
   whichever track's slot `activeTrackId` currently names, called both from
   `setActiveTrack()` directly and at the end of `applyState()` (covering
   undo/redo/load/reset), since **undo/redo can replay a snapshot from
   before a track switch happened** — the switch itself isn't a history
   step, but crossing that boundary backward/forward must still re-home `S`
   correctly, not just restore field values. Verified with a dedicated test
   in `store.test.js` that does exactly this (edit → switch → edit → undo
   twice → redo twice) plus a real-browser Playwright check exercising the
   actual `<select>`/buttons. **What this does *not* yet deliver:**
   simultaneous multi-track playback — there's still one shared filter/LFO/
   envelope, so only the *active* track's pattern plays. That's still
   step 3 below; this step's payoff is "N independently-editable
   instruments and patterns, one auditioned at a time," which is real DAW
   value on its own (closer to a preset/scene switcher than an arrangement)
   but not the full vision.
3. **Instrument-chain duplication.** Refactor `audio.js`'s per-track nodes
   (osc/osc2/noise/voices/filter/envelope/LFO) out of the module-level
   `engine` singleton into a builder function invocable once per track,
   each instance's output landing on a new per-track gain/pan node that
   feeds the *existing* shared drive/EQ/FX/master chain. This is the actual
   XL core of E4 — everything else is glue around it. Not started.
4. **Multi-track playback.** Scheduler consumers iterate every track, not
   just the active one, per the section above — this is what actually
   makes step 3's per-track engines *simultaneously* audible rather than
   just independently editable. Not started.
5. **L9/L10/L11 proper**, once the above is live and something is actually
   being mixed. Full channel strips, meters, per-track device rack — the
   layout-backlog items, now unblocked; step 2's flat `<select>` picker was
   always meant as a stand-in for L9, not the real thing. Not started.

Steps 3–4 are the actual remaining E4 payload (simultaneous audio engines +
playback); step 5 is already-scoped layout-backlog work that just needs
steps 3–4 to exist.

## Open questions

- **Track cap — resolved, ✅ shipped.** `store.js`'s `MAX_TRACKS = 4`;
  `addTrack()` returns `null` past it. Matches how `voices.js`'s own
  `maxVoices` (16 live) already caps per-instrument polyphony for the same
  CPU-predictability reason, and sidesteps needing scroll/virtualization in
  the lean-step track list (step 4).
- **What does "Add Track" start from? — resolved, ✅ shipped.**
  `addTrack()` clones the active track's instrument + pattern by value.
  Cheapest to build, mirrors `clipsUI.js`'s "Duplicate" precedent.
- **Solo/mute semantics** (still open — decide before step 2 starts).
  `mixer.mute`/`mixer.solo` fields already exist in the schema; do they
  gain gain-node wiring in step 2, or is that deferred to the mixer-view
  step (5)? Recommend wiring mute in step 2 (trivial — a gain of 0) and
  deferring solo (needs cross-track coordination: "am I the only un-muted
  track") to whichever step ships the track list, since solo is
  meaningless without seeing the other tracks to solo against.
- **Does `wavRender.js` need to handle multi-track before step 4 ships, or
  can offline export stay single-track (documented as a known gap) until a
  later pass?** Recommend the latter — flag it explicitly in that
  module's header rather than silently under-rendering a multi-track
  project.

## Status

**Steps 1–2 of 5 are shipped.** Step 1 (store completion): `store.tracks()`/
`addTrack()`/`removeTrack()`, the `applyState` reconciliation fix,
`MAX_TRACKS = 4`, the duplicate-current default. Step 2 (track switching,
re-sequenced ahead of its original slot — see above): `store.
setActiveTrack()`, the `_sParamsRef`/`rehomeSParamsRef()` fix that keeps
`S` correctly homed across undo/redo crossing a switch boundary, and a
minimal `#tracks-bar` picker (`tracksUI.js`) gated on graduation. Both
steps are fully unit-tested (`store.test.js`) plus real-browser Playwright
checks — including a screenshot confirming the bar actually renders
(the `.presets-bar[hidden]` CSS trap from D6's writeup would have bitten
this too; caught and fixed the same way, `.tracks-bar[hidden] {
display: none; }`, before it could repeat). Player-visible result today:
a graduated player can add up to 4 tracks, each with its own instrument
patch and pattern, switch between them via the picker, and undo/redo
correctly follows across switches — though only the *active* track's
pattern plays, since the audio engine underneath is still one shared
instance (step 3).

Steps 3–5 remain their own follow-up passes — this is genuinely bigger
than any single slice shipped so far (D1–D6 combined were still each a few
files), and splitting it the way L5→L8 shipped incrementally is what
keeps each piece reviewable. Step 3 (instrument-chain duplication, the
actual XL core, and the one that finally makes tracks play
*simultaneously*) still needs the solo/mute-semantics question answered
before it starts.
