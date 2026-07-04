---
date: 2026-07-04
topic: mixer-view-requirements
status: shipped
---

# Synthehol — Mixer View (E4 step 5 / L9–L11) Requirements

Scoping pass for what's left of E4 (`docs/brainstorms/
2026-07-03-multitrack-mixer-requirements.md`'s step 5) before any code gets
written — same audit-first shape as that doc and D5's. Multi-track audio is
now real: up to 4 tracks, each with its own instrument chain, playing
simultaneously (steps 1–4, shipped). What's missing is a way to *see* and
*balance* them beyond `tracksUI.js`'s one-at-a-time `<select>`.

## Correcting a premise before scoping anything

The layout backlog (`docs/daw-layout-backlog.md`) marks L9/L10/L11 as
depending on **L3** (a general view-mode switch + rack-docking mechanism),
which itself depends on **L1** (a region/panel-shell refactor) — and both
L1 and L3 are unstarted; L1 is explicitly `⏸ DEFERRED`, with a note that
reads: *"Revisit if a concrete feature actually needs region docking, and
build the region system as part of that feature instead of speculatively
first."*

Taken at face value, that dependency chain says a mixer view can't ship
until two foundational, unstarted layout systems exist first. **That's not
quite right, and the backlog's own history proves it wrong**: L5 (ruler),
L6 (step sequencer), L7 (piano roll), L8 (clips), D5 (era workspaces), D6
(practice gym), and this project's own `tracksUI.js` picker all shipped as
direct additions to the existing `#lower-tabs` strip / DOM, with zero
region-system work, and zero conflicts. The dependency notes in the
backlog describe an *idealized* future architecture, not a hard
prerequisite — L1's own deferral note says so explicitly.

**Applying that same precedent here:** a lean mixer view can be a new
`#lower-tabs` tab (`"Mixer"`, alongside Visualizers/Sequencer/Piano Roll/
Practice), exactly like every other lower-area feature this project has
shipped. Confirmed by reading the actual mechanism (`sequencerUI.js`'s
`selectView()`): it already generically toggles *any* `.lower-tab`/
`.lower-view` pair via `data-view`/`view-<id>` — adding a new tab needs
**zero changes to existing code**, just new HTML and a new UI module
(mirroring `practiceUI.js`'s shape). No region system, no view-mode
switch, no L1/L3 required.

This reframes the actual scope split:

- **L10 (mixer view) is achievable now**, the same lean way L6–L8/D5/D6
  were. This doc scopes it.
- **L9 (real track-lane container — simultaneous multi-track pattern
  editing, not just a picker)** is a genuinely bigger structural ask: it
  wants to show N tracks' step-grids/piano-rolls stacked and scrollable at
  once, which the current single-editor-per-tab model can't do without
  real new work-area space. This is the one place L1's deferred region
  system would actually earn its keep. **Recommend leaving L9 deferred**,
  consistent with L1's own "revisit when something concretely needs it"
  clause — the `tracksUI.js` picker plus this doc's mixer view together
  cover the functional need (edit any track, balance all of them) without
  requiring simultaneous on-screen lanes.
- **L11 (per-track device chain) is already functionally delivered**,
  not by new work but by E4 step 2: `tracksUI.js`'s `switchTrack()`
  already resyncs the *entire* rack (every slider, toggle, canvas) from
  whichever track becomes active, via `applyPreset(store.params())`. The
  rack has been "per-selected-track" since step 2 shipped. What's
  genuinely missing is L11's *docking* framing (a collapsible bottom
  device drawer instead of an always-visible top rack) — that's cosmetic
  layout, which is squarely L3's job, not a new functional gap. **No new
  work recommended here** beyond what's already shipped.

## What a lean mixer view needs (an audit of what already exists)

The schema has been ready since before any of E4 shipped: every track
already carries `mixer: { gain, pan, mute, solo }`
(`store.js`'s `createProject()`/`addTrack()`). Where each field stands
today:

- **`mixer.gain`** — read by `audio.js`'s `trackMixGain()` into each
  track's `trackGain` node, but nothing ever *writes* it except the
  default (`1`). No fader exists anywhere. A mixer view is the first
  reachable UI for this field.
- **`mixer.mute`** — real, live-wired since E4 step 3 (`trackGain.gain`
  gated to 0), with one UI entry point: `tracksUI.js`'s "Mute" button,
  which only ever affects the *active* track. A mixer view needs mute
  reachable per-track regardless of which one is active — mechanically
  trivial (`store.setPath` already takes any track index), no audio
  change needed.
- **`mixer.pan`** — fully inert. There is no `StereoPannerNode` anywhere
  in the graph yet; every track's output is implicitly mono until it hits
  the (stereo) reverb convolver. Wiring it is new, small plumbing: one
  `StereoPannerNode` per track, inserted after `trackGain` before
  `mixBus` (post-fader pan, the common convention), torn down alongside
  the rest of `destroyTrackEngine()`.
- **`mixer.solo`** — fully inert, and deliberately left that way through
  steps 3–4 (the earlier doc's resolved open question: "wiring solo-aware
  gain math with no UI that could ever set it would be dead code"). A
  mixer view is exactly the UI that makes solo legible — this is where it
  should finally get built. Mechanically small: `trackMixGain()` gains
  cross-track awareness (`if any track has solo=true, only soloed tracks
  are audible, mute still always wins`), and since `reconcileTrackEngines()`
  already recomputes every track's gain on every store change, extending
  the read logic is enough — no new reconciliation plumbing.
- **Metering** — no precedent for a level-meter bar exists (`signalFlow.js`'s
  LEDs are a single glow, not a bar), but the *math* is already written
  and tested: `signalFlow.js`'s pure `peakLevel(data)` helper, reused
  as-is. What's missing is a tap positioned to read it correctly: `vcf`'s
  existing per-track `tapFilter` sits *before* gain/mute/pan, so a muted
  or soloed-out channel would still show a false "live" reading on it. A
  mixer meter needs a new **post-fader** analyser per track (after pan,
  before summing into `mixBus`) so a muted channel correctly reads silent.
- **Fader/pan control styling** — no existing vertical-fader component;
  every slider in this codebase (including `master-vol`) is the same
  horizontal `input[type="range"]` (+ optional `data-knob` rotary skin via
  `knob.js`). **Recommend reusing the horizontal slider for gain** rather
  than building a new vertical-fader component — smaller v1, consistent
  with the rest of the rack's controls. Pan is a natural fit for the
  existing rotary knob skin (`data-knob`, centered default). Channel
  strips are built dynamically (one per track, count changes) so each
  new pan knob needs an explicit `enhanceKnob()` call — `initKnobs()`
  itself only sweeps the DOM once, at startup.

## Proposed scope for v1

A new **"Mixer" tab** in `#lower-tabs`, gated on graduation (same
condition as `tracksUI.js`'s bar and the Practice tab — a mixer only
makes sense once there's more than one track, and this rollout has
consistently framed multi-track as free-play DAW territory, not part of
the teaching path). Content: one **channel strip per track** (up to
`MAX_TRACKS = 4`) —

- Track name (read from `track.name`; clicking it calls the same
  `switchTrack()` `tracksUI.js` already exports, so the mixer view is a
  second entry point to "which track is active," not a competing one —
  there is still exactly one active-track concept, not two to keep in
  sync).
- A gain fader (horizontal slider, `mixer.gain`, `0`–`1.5` say, mirroring
  `master-vol`'s range).
- A pan knob (`data-knob`, `mixer.pan`, `-1`..`1`, center detent at `0`).
- Mute / Solo toggle buttons (reusing `.preset-btn`-style buttons, like
  `tracksUI.js`'s existing Mute button, but addressable per-strip rather
  than "whichever track is active").
- A peak-level meter (a small bar, opacity/height driven by `peakLevel()`
  off the new post-fader tap, refreshed each rAF frame the same way
  `signalFlow.js`'s LEDs already are — no new render loop).

**A master strip**, rightmost: a peak meter off the existing shared
`engine.scope` tap (the *actual* final output, post every track's sum and
the shared FX chain) — but **deliberately no separate fader**. The header
already has a master volume control (`#master-vol`); a second slider
bound to the same `S.masterVol` in a different part of the screen would
be a duplicate control for one value, not a new capability. Meter only.

**Explicitly out of scope for v1** (mirroring the discipline the earlier
doc used for FX inserts): per-track EQ or FX sends (still the shared
rack), a "solo-safe" concept (some DAWs let you mark a track as always
audible even under solo — not needed at 4-track scale), meter ballistics
beyond a simple instantaneous peak (no RMS/LUFS/peak-hold), drag-to-
reorder channel strips (track order already exists implicitly as array
order; reordering is a separate, small feature if ever wanted).

## Audio-side changes needed

All of this lands in `audio.js`, extending `buildTrackEngine()`/
`destroyTrackEngine()`/`reconcileTrackEngines()` — the exact same
functions E4 step 3 already built, no new architecture:

1. Add a `pan` (`StereoPannerNode`) and a `tapOut` (`AnalyserNode`,
   `fftSize = 256` matching the other taps) to each track engine, wired
   `trackGain → pan → tapOut → mixBus` (`tapOut` is a parallel tap, like
   `tapSource`/`tapFilter` already are — it doesn't sit in the signal
   path, just observes it).
2. Extend `trackMixGain(trackId)` to be solo-aware (mute still always
   wins over solo, matching every DAW's convention).
3. Write `mixer.pan` into the new `pan.pan.value` at build time and
   whenever it changes (same `reconcileTrackEngines()` pass already
   recomputes gain on every store change; extend it to also refresh pan).

No changes needed to `sequencer.js`/`pianoroll.js`/the scheduler — the
mixer view only touches mixer-level routing, not note-firing.

## Suggested first slice

Everything above is one coherent, small-ish feature (smaller than E4
steps 3–4 combined) rather than a multi-step rollout like the parent E4
doc needed — there's no equivalent to the `S`-identity problem here, no
undo/redo-across-a-boundary subtlety, just wiring three new-but-simple
audio nodes per track and a new tab reusing an already-proven UI pattern.
Recommend building it as a single pass: audio-side plumbing (pan/tapOut/
solo-aware gain) first and unit-testable in isolation (extend
`store.test.js`-adjacent coverage for the solo gain math, pure function),
then the Mixer tab UI on top, verified in a real browser the same way
every other E4 step was — multiple tracks with different pan/gain/mute/
solo settings, confirmed both by reading node values *and* by ear/analyser
data, not just DOM state.

## Status: shipped

Built as the single pass this doc recommended, in the exact shape scoped
above — no re-scoping needed once implementation started.

**Audio side** (`audio.js`): `buildTrackEngine()` now wires `trackGain →
pan (StereoPannerNode) → tapOut (AnalyserNode, fftSize 256) → mixBus`;
`destroyTrackEngine()` disconnects both alongside the rest. `trackMixGain()`
is now solo-aware — mute wins unconditionally, then "any track soloed →
non-soloed tracks silent" — as a small extension of the same function, no
new reconciliation plumbing. `reconcileTrackEngines()`'s existing
per-store-change pass now also refreshes `pan.pan` from `track.mixer.pan`
alongside the gain it already recomputed. A `trackMixer(trackId)` helper
(`store.tracks().find(...).mixer`) was added after an early bug: `mixer` is
a sibling of `instrument.params` on a track, not nested inside it, so the
first attempt to read `params.mixer?.pan` silently always fell through to
the `?? 0` default.

**UI side** (new `src/mixerUI.js`): a `#tab-mixer` lower-tab, gated on
graduation exactly like `tracksUI.js`'s bar (`revealMixerTab()`, called
from the same three spots `revealTracksBar()` already is — init, reset,
and post-restore). One channel strip per track plus a master strip (meter
only, no fader — the header's `#master-vol` stays the sole control for
that value, per this doc's explicit call above). Each strip: a clickable
name (reusing `tracksUI.js`'s exported `switchTrack()`, so the mixer view
is a second entry point onto the one active-track concept, not a
competing one), a horizontal gain fader, a `data-knob` pan control (needs
an explicit `enhanceKnob()` call per new strip, since `initKnobs()` only
sweeps the DOM once at startup), Mute/Solo buttons, and a peak meter
reusing `signalFlow.js`'s `peakLevel()` off the new post-fader `tapOut`.
Renders via a two-tier pattern (rebuild the strip DOM only when the track
list's identity changes; cheap-repaint values otherwise) mirroring
`sequencerUI.js`'s grid, so knobs aren't torn down and re-skinned on every
unrelated store tick. `refreshMixerMeters()` runs off `main.js`'s shared
rAF loop, gated on the Mixer tab actually being the active lower-tab (same
convention as `practiceUI.js`'s `refreshPractice()`).

**Verified in a real browser** (Playwright): fresh/pre-graduation players
never see the tab; graduating reveals it; adding a track adds a strip;
dragging a strip's fader/pan writes through to the store and the live
`AudioParam`; muting a strip zeroes that track's `trackGain` while leaving
others alone; soloing a track silences a third, non-muted/non-soloed
track (confirming mute-wins-over-solo and the cross-track solo check both
work); clicking a strip's name switches the active track and resyncs the
whole rack; undo/redo across add-track calls correctly grows/shrinks the
strip count while the Mixer tab is open.

**Diagnostic finding, not a code defect:** mid-verification, muting a
track showed `trackGain.gain.value` staying frozen at its pre-mute value
indefinitely, including under manual direct `setTargetAtTime` calls
bypassing all app logic. Systematically ruled out: reconcile-logic bugs
(manual calls failed identically), node-identity mismatches (confirmed
same node via reference equality), mixer-specific causes (reproduced by
switching to the unrelated Sequencer tab), and CDP-synthetic-click
artifacts (reproduced with plain `el.click()`). Isolated the actual
trigger: a DOM reflow (even just toggling `document.body.dataset.stage`)
while the `AudioContext` has no concurrent audio activity can leave a
just-scheduled `AudioParam` ramp stuck in this headless-Chromium/no-
real-audio-device test environment; playing a single note immediately
"unstuck" it. Confirmed mute/solo/pan all behave correctly under realistic
conditions (sequencer actively playing). Recorded here so this doesn't get
mistaken for a real bug if it resurfaces in a future headless test run.

All 5 steps of the E4/L9–L11 rollout are now complete except L9 itself
(real simultaneous multi-track lanes), which this doc recommends leaving
deferred — see the parent doc's own Status section.
