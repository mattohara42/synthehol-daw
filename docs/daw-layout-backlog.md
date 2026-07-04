---
date: 2026-06-29
topic: daw-layout-backlog
status: living
---

# Synthehol — DAW Layout Backlog

A forward-looking, prioritized backlog for evolving the UI from today's
single-instrument rack into a full DAW shell that can host a transport,
sequencer, tracks, and mixer — without repainting into a corner as each Act
lands.

This is the **layout/architecture companion** to the feature roadmap in
`docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md`
(Act II noise + 2nd osc → Act III polyphony → Act IV sequencer + MIDI → DAW
sandbox graduation). That doc says *what* unlocks; this one says *where it
lives on screen* and *what scaffolding has to exist first*.

> **Read alongside `docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md`.**
> Platform constraints (MIDI is unavailable on all of iOS; the iOS silent switch
> mutes Web Audio; mobile needs a distinct layout, not responsive shrinking) and
> the audio-engine long-poles (project-state store **E1**, transport/clock
> **E2**, polyphony, mixer, persistence) live there. Several items below depend
> on that E-tier — the sequencer surfaces (L5/L6) need the **E2 clock** more than
> any pixel, and L1's `viewState` should be derivable from the **E1** store.

Tiers are by dependency order, not just value:
- **D0 — Foundation:** must land before the Act IV sequencer or we rebuild twice.
- **D1 — Sequencing surfaces:** the transport + pattern/piano-roll editors (Act IV).
- **D2 — Tracks & mixer:** multi-voice / multi-instrument era (Act III+).
- **D3 — Browser & inspector:** content and device navigation.
- **D4 — Arrangement & pro features:** the long tail.

Effort is a rough t-shirt size (S / M / L / XL).

---

## Where we are today

`index.html` + `style.css` lay out a fixed single screen:

- `header` — nameplate, master volume, status pill, boss HUD.
- `main` — a `2fr / 1fr` CSS grid:
  - top two-thirds (`.main-content`, spans full width): the **module rack**
    (`.rack` → two `.rack-row`s of `.module` panels), framed by walnut cheeks,
    plus the presets bar;
  - lower-left (`.stage-region`): scope + spectrum, then the keyboard;
  - lower-right (`.teach-panel`): the Learn panel.
- Progression drives `body[data-layers]` and per-module lock/unlock; the
  graduation banner fires when Act I is cleared.

This is great for *one instrument being taught*. It has **no transport, no
timeline, no track concept, and no view switching** — all of which a DAW needs,
and all of which want horizontal timeline space the current grid doesn't reserve.

### Guiding principles

1. **Two modes, one shell.** "Learn/Rack mode" (today's teaching-forward layout)
   and "DAW mode" (transport + sequencer + tracks). The shell is the same region
   system; modes change which regions are visible and how big. Graduation is the
   transition, but components appear progressively as Acts unlock — the shell
   must support partial states (e.g. a transport with only a step lane in Act IV
   before tracks exist).
2. **Progressive disclosure, not a second app.** Never dump a full DAW on a
   beginner. Regions fade in as they're earned; the rack never disappears, it
   *docks* (becomes a device panel) when the timeline takes the main stage.
3. **Reserve the timeline axis early.** The single most disruptive future change
   is introducing a horizontal, scrollable, zoomable time axis. Decide its home
   (the main work area) before building it so the rack, scope, and teaching panel
   already know to yield that space.
4. **Keep the synth layer untouched.** Layout is DOM/CSS + a thin view-state
   module; `S` (state.js), the audio graph, and the progression singletons stay
   independent, exactly as today.

---

## D0 — Foundation (before the Act IV sequencer)

### L1. Region/panel shell refactor — L · foundation — ⏸ DEFERRED (2026-07-01)
Replace the hard-coded `main` grid with a small **layout manager**: named regions
(`transport`, `work-area`, `device-rack`, `browser`, `inspector`, `meters`,
`keyboard`) whose visibility, size, and dock position are driven by a
`viewState` object rather than fixed CSS. Today's screen becomes the default
"rack" arrangement of those regions.
- **Deferred:** its own justification ("every later item docks into a region,
  otherwise they fight") didn't hold up — L5 (ruler), the L6 drum/automation
  lane extensions, and B10 (responsive reflow) all shipped as direct CSS/HTML
  edits with zero conflicts. Revisit if a concrete feature (L3 view-mode
  switch, L4 mobile mode, L7 piano-roll) actually needs region docking, and
  build the region system as part of *that* feature instead of speculatively
  first.
- **Touch (if picked back up):** `index.html` structure, `style.css` grid → CSS grid areas or a
  fl/grid driven by data attributes, a new `src/layout.js` (pure view-state, no
  audio).

### L2. Transport bar region — M · foundation
A persistent top strip (below the header) reserved for transport: play / stop /
record, **tempo (BPM)**, time signature, bar:beat position, loop toggle,
metronome. Hidden until Act IV unlocks it; appears as the first DAW component.
- **Why now:** defines the clock UI that the sequencer, automation, and
  arrangement all read from. Cheap to stub, expensive to retrofit.
- **Depends on:** L1. **Pairs with:** a transport/clock model in the audio layer
  (out of scope here; see feature roadmap).

### L3. View-mode switch + rack docking — M · foundation
Introduce the **three layout modes** — `rack` (today's teaching layout), `daw`
(transport + work-area + tracks), and `mobile` (see L4) — and the mechanism for
the module rack to **collapse from the main stage into a bottom "device rack"
drawer** (like a DAW's instrument/device view) so the work area can host the
timeline. Include the graduation transition animation hook (reuse the existing
graduation banner / `data-layers` system).
- **Depends on:** L1.

### L4. `mobile` layout mode + responsive strategy — L · foundation
**Mobile is a distinct mode, not a media-query shrink.** A full DAW at ~375 px is
a different product: the `mobile` mode shows **one panel at a time with a bottom
tab bar** (instrument / sequencer / mixer / keyboard), large touch targets, and
the on-screen keyboard as the only note input. Also covers the desktop reflow/
overflow rules for narrower windows (the current fixed grid already strains —
see B10 in `docs/backlog.md`). Pairs with the touch-input and audio-unlock work
in **E10** (touch equivalents for the knob wheel/hover/double-click; the iOS
silent-switch "tap to enable sound" affordance).
- **Depends on:** L1.

---

## D1 — Sequencing surfaces (Act IV)

### L5. Main work-area with a time ruler — L · sequencer — 🟡 lean step SHIPPED
**Shipped**: a bar/beat ruler strip (`#seq-ruler`) above the step grid in the
Sequencer tab, with a transport-synced playhead marker, shared as the time
reference for the pitch grid, drum lanes, and automation lane. **Deferred**:
scroll and zoom — patterns are currently fixed at 8/16 steps (max one bar in
4/4), so there's nothing to scroll or zoom yet; add once patterns can span
multiple bars (L8) or the piano-roll (L7) lands. This is still the home
reserved by principle 3, just not yet the full work-area region.
- **Depends on:** L1, L2.

### L6. Step-sequencer lane — M · sequencer (Act IV first challenge) — ✅ v1 shipped
The Act IV step grid (the first sequencing UI players meet): a row of steps per
pattern, velocity per step, pattern length, swing. Lives in the work area as a
compact lane; doubles as the boss-fight surface for the sequencer stage.
- **Depends on:** L5. **Note:** the boss/challenge framing means this needs a
  "target pattern" overlay, mirroring how module canvases show boss hints today.
- **Shipped v1** (`src/sequencer.js`, `src/sequencerUI.js`, store `pattern`
  model): an 8-row diatonic (C-major) × up-to-16-step grid in a "Sequencer" tab
  that takes over the lower-left area (hides the keyboard while active). Plays
  through the E3 polyphonic voice path (stacked cells = chords), with pattern
  length, swing, clear, click-to-toggle (undoable), and a transport-synced
  playhead. **Deferred to a later pass:** per-step velocity, the boss-fight
  "target pattern" overlay, and a proper L5 work-area home (the tab is an interim
  home until L3/L5 give time-based editors real estate); chromatic/scale
  selection and a wider pitch range belong with L7 (piano-roll).

### L7. Piano-roll editor — L · sequencer — ✅ lean step SHIPPED
**Shipped**: a "Piano Roll" tab with a chromatic (24-row, 2-octave) pitch ×
time grid, reusing the step sequencer's ruler/playhead/CSS. Click to add a
note, drag right to lengthen it, click a note to remove it. **Deferred**:
quantized to the same 16-step grid (not freeform placement), fixed range (no
scroll/zoom), one shared clip rather than switchable-per-clip — all wait on
L8 (pattern/clip management) and a real time-ruler work-area (L5's full
scope).

### L8. Pattern / clip management — M · sequencer — ✅ SHIPPED
A "Pattern" bar (shared by the Sequencer and Piano Roll tabs) to save, load,
duplicate, and delete named pattern snapshots — exactly the preset model
(save/load/duplicate/delete), scoped to `track.clips` instead of a global
sound library. Now that L7's piano-roll can point at it: switching clips
swaps the whole `track.pattern` (step grid + drums + automation + piano
roll together), so it's already "switchable per clip," just one clip active
at a time rather than a launchable multi-clip grid (that's L14 territory).

---

## D2 — Tracks & mixer (Act III polyphony and beyond)

E4's audio-side scoping pass (`docs/brainstorms/
2026-07-03-multitrack-mixer-requirements.md`) proposes a lean-step rollout
that ends with L9–L11 below. Its step 2 ("track switching," shipped —
`tracksUI.js`'s `#tracks-bar`) is a deliberately smaller stand-in for L9
until there's a real work area to dock lanes into: a flat `<select>`
picker, not lanes. Steps 3–4 (also shipped) mean every track now plays
*simultaneously*, each through its own instrument chain.

A follow-up scoping pass, `docs/brainstorms/
2026-07-04-mixer-view-requirements.md`, corrects the dependency chain
below: L9/L10/L11 read as blocked on L3 (and transitively L1), both
unstarted — but L5–L8/D5/D6 all shipped the same way L10 now can, as a
lean `#lower-tabs` tab, with zero region-system work. That doc concludes
**L10 is achievable now** (scoped there in full) and **L11 is already
functionally delivered** by step 2's rack-resync — only **L9** genuinely
needs the deferred region system first.

### L9. Track-lane container — L · tracks
Vertical stack of **track lanes** in the work area (one per instrument/voice once
multiple instruments exist), each with a header (name, arm, mute, solo) and a
content lane (clips/steps/notes). The single-instrument view is the
"one track" special case.
- **Depends on:** L5; multi-instrument capability (shipped, E4 steps 1–4).
  Still genuinely blocked on real work-area space (L1/L3) — see the
  2026-07-04 doc's reasoning for why this is the one piece of D2 actually
  worth deferring.

### L10. Mixer view — L · mixer — ✅ SHIPPED (E4 step 5)
Per-track channel strips (level, pan, mute/solo, meters) + master section. A
distinct view-mode (or a docked bottom panel) toggled from the transport.
- **Depends on:** ~~L3 (view modes), L9~~ — corrected in `docs/brainstorms/
  2026-07-04-mixer-view-requirements.md`: shipped as a lean `#lower-tabs`
  tab (`#tab-mixer`, `src/mixerUI.js`), the same way L6–L8/D5/D6 shipped
  without a view-mode system. One channel strip per track (name, fader, pan
  knob, Mute/Solo, peak meter) plus a meter-only master strip; `audio.js`
  gained a `StereoPannerNode` + post-fader `AnalyserNode` per track and
  solo-aware `trackMixGain()` (mute always wins over solo). Verified in a
  real browser: independent fader/pan/mute/solo per track, undo/redo across
  track adds with the tab open, clicking a strip's name switches the active
  track. See that doc's Status section for the full account.

### L11. Per-track device chain — M · tracks — ✅ effectively shipped (E4 step 2)
The module rack (D0 device drawer) becomes **per-selected-track**: selecting a
track shows its instrument + FX chain in the device rack. Generalizes today's
single global rack.
- **Depends on:** ~~L3, L9~~ — turns out unnecessary: `tracksUI.js`'s
  `switchTrack()` (E4 step 2) already resyncs the *entire* rack from
  whichever track becomes active via `applyPreset(store.params())`. The
  rack has been per-selected-track since that shipped; what's left is
  purely the *docking* framing (a collapsible device drawer vs. the
  always-visible top rack), which is L3's cosmetic-layout job, not a new
  functional gap here.

---

## D3 — Browser & inspector

### L12. Left browser sidebar — M · browser
Collapsible left rail for presets, (future) samples, instruments, and patterns —
a real home for the content the preset bar hints at today.
- **Depends on:** L1.

### L13. Right inspector / context panel — M · inspector
The Learn panel generalizes into a context inspector: teaching copy in learn
mode, selected-clip / selected-device parameters in DAW mode. Same lower-right
region, mode-dependent contents.
- **Depends on:** L1; reuses `.teach-panel` region.

---

## D4 — Arrangement & pro features (long tail)

### L14. Arrangement timeline — XL · arrangement
Full song arrangement: clips placed along the timeline across all tracks, with
scroll/zoom, marker/section lanes, and a loop region. The "scale up from a
pattern to a song" surface.

### L15. Automation lanes — L · arrangement
Per-parameter automation drawn under track lanes; ties the knobs (now hardware
knobs) to recorded/automated movement.

### L16a. MIDI-file import/export surface — M · io (universal) — ✅ lean step SHIPPED
The **primary** "MIDI" deliverable, since it works on every platform including
iOS: import a `.mid` into a pattern/clip and export patterns/arrangement back
out. Pure JS; no Web MIDI required. (Audio side: **E6**.)
- **Shipped** (`src/midiFile.js` + `src/midiFileUI.js`): "Import .mid"/
  "Export .mid" buttons in the clips bar (shared by the Sequencer and Piano
  Roll tabs). Targets the piano-roll lane specifically — chromatic, so
  arbitrary MIDI pitches map 1:1, unlike the diatonic step-grid `cells`.
  Export writes a Format 0 SMF for the pattern's one bar; import parses
  Format 0/1 (running status, note-on-vel-0-as-off), flattens every track's
  notes into one list (a multi-track file collapses to one instrument),
  whole-octave-transposes an off-center file to fit the roll's 2-octave
  window, and drops whatever still doesn't fit or falls past the first bar
  — reporting the import/drop counts on the button itself rather than a
  dialog. **Deferred:** exporting/importing the diatonic step grid or drum
  lanes, multi-bar patterns, a track picker for multi-instrument files —
  all wait on patterns spanning more than one bar or a real multi-track
  model (E4).

### L16b. Live MIDI-map / learn overlay — M · io (enhancement only)
A mapping UI for live hardware: highlight a control, move a knob, bind it.
**Feature-detected and hidden where Web MIDI is unavailable** — that's all of
iOS and desktop Safari, and Firefox only behind an add-on prompt (see the
feasibility doc §1). Never hard-gates (roadmap R20). (Audio side: **E9**.)

### L17. Detachable / resizable panels — L · pro
Drag-to-resize splitters and optionally pop-out windows for multi-monitor use.
Only worth it once the region system (L1) and several views exist.

---

## Suggested sequencing

*(Original planning, read historically — actual delivery order diverged:
L1/L3/L4 stayed deferred throughout, and L2/L5/L6/L7/L8 all shipped as
lean direct-CSS additions instead, which is what motivated deferring L1 in
the first place. D2 (tracks/mixer) followed the same lean pattern — see
the 2026-07-03 and 2026-07-04 docs.)*

1. **L1 + L4** now-ish, even before Act IV — the region shell and responsive
   strategy are the foundation everything else docks into, and they de-risk the
   biggest layout change (the timeline axis).
2. **L2 + L3** alongside the first transport/clock work.
3. **L5 + L6** with Act IV's step sequencer (the first DAW component players earn).
4. Tracks/mixer (D2) follow multi-instrument support; browser/inspector (D3) can
   slot in opportunistically; D4 is post-graduation polish.

## Open questions

- Does "DAW mode" replace the teaching layout wholesale at graduation, or do they
  coexist (teaching available on demand inside the DAW)? Principle 1 assumes
  coexist; confirm.
- Is the device rack a bottom drawer (Ableton-style) or a separate view
  (Logic-style)? Affects L3/L11.
- Clip model: pattern-based launcher (Ableton Session) vs. linear arrangement
  first? Affects L8/L14 ordering.
- How much of the boss/progression framing carries into DAW mode, if any?
