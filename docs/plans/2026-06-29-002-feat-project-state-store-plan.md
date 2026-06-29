---
date: 2026-06-29
topic: project-state-store
backlog-items: E1 (Architecture Layers 1–2); unblocks E2, E3, E4, E6, E7, and L1
status: proposed
---

# Plan — Project-state store (engine backlog E1)

## Context

The end goal is a DAW; the architecture doc
(`docs/brainstorms/2026-06-29-daw-architecture-and-feasibility.md`) identifies the
**global mutable `S`** (`src/state.js`) as the first structural blocker. `S` holds
*one instrument's* params and is read/written imperatively from everywhere
(`controls.js`, `audio.js`, `canvas.js`, `teaching.js`, `keyboard.js`,
`presets.js`, and the boss predicates). That cannot represent N tracks × M
devices × clips, and it blocks **serialization-as-source-of-truth, undo/redo, and
multiple instances** — all of which the sequencer, mixer, and save/load need.

E1 introduces a **serializable project tree behind a command/subscribe store**,
*without* breaking Act I. The trick: keep `S` as the literal params object that
now lives **inside** the project tree, so existing reads stay untouched, while
**writes route through the store** so it becomes the source of truth (and gains
undo, serialize, and change notification). This must land before L1 so the
layout's `viewState` can derive from the store rather than be retrofitted.

## Approach

### Project tree (new `src/store.js`)

A plain, serializable tree. One track today; shape ready for many:

```js
function createProject() {
  return {
    version: 1,
    transport: { bpm: 120, timeSig: [4, 4], playing: false,
                 loop: { enabled: false, startBar: 0, endBar: 4 },
                 position: { bar: 0, beat: 0, sixteenth: 0 } },
    tracks: [
      { id: 't1', name: 'Synth',
        instrument: { type: 'synth', params: { /* the current S defaults */ } },
        fx: [], clips: [],
        mixer: { gain: 1, pan: 0, mute: false, solo: false } },
    ],
    activeTrackId: 't1',
  };
}
```

`transport` is reserved here now; **E2** implements the clock that drives it.

### Keep `S` working — back it by the tree

- `store.js` owns `project`; the active instrument's `params` object **is** the
  object other modules know as `S`. Move the param defaults (today in
  `state.js`) into `createProject()`.
- `src/state.js` becomes a thin back-compat re-export:
  ```js
  import { store } from './store.js';
  export const S = store.params();   // === project.tracks[<active>].instrument.params
  ```
  Every `import { S } from './state.js'` keeps working; reads (`S.cutoff`) are
  unchanged and zero-cost. `store.js` imports nothing from the synth layer
  (no circular deps; it stays pure/serializable).

### Store API (`store.js`)

```js
export const store = {
  get(),                       // the project tree (read-only by convention)
  params(),                    // active instrument params object (=== S)
  set(key, value),             // write an active-instrument param + notify + history
  setPath(path, value),        // generic write (e.g. 'transport.bpm', track mixer)
  subscribe(fn),               // fn({ path, value }) after each committed change
  serialize(),                 // -> JSON string of the whole project
  load(json),                  // validate + apply IN PLACE (see below) + notify
  undo(), redo(),              // snapshot history
  reset(),                     // back to createProject()
};
```

- **`set`/`setPath`** mutate the tree, push a history snapshot (throttled/capped),
  and notify subscribers. `set('cutoff', 1200)` writes `S.cutoff` *through the
  store* so it's recorded and undoable.
- **`load` mutates in place.** Critical: many modules hold the `S` reference, so
  `load` must **`Object.assign` into the existing params object** (and transport,
  mixer) rather than replace it — otherwise stale references break. Validate
  shape first; fall back to no-op on malformed input.
- **Undo:** snapshot-based to start (deep-clone the tree on each committed change,
  cap history at e.g. 100, coalesce rapid same-path writes during a drag).
  Command-inverse is a later optimization — note it, don't build it.

### Migrate writes through the store (reads stay as-is)

- `controls.js`: each handler currently does `S.x = v; <audio>; <canvas>; teach()`.
  Change only the state write: `S.x = v` → `store.set('x', v)`. Side-effects
  (audio param, canvas, teach) **stay in the handler** for now — subscriber-driven
  rendering is Architecture Layer 5, out of scope here. ~14 mechanical edits.
- `keyboard.js`: the Z/X octave writes go through `store.set('octave', …)`.
- `presets.js`: `applyPreset` already dispatches `input` events on the sliders, so
  it flows through `controls.js` → `store.set` automatically — no change needed.
  (Unifying presets with the project format is later; E1 leaves presets alone.)
- **Drag coalescing:** `store.set` should treat a run of same-key writes (a slider
  drag) as one undo entry — coalesce while the key matches and the gap is small.

### Boss/progression stay independent

`bossEngine`/`progression` are untouched: the boss predicates still read the `S`
object passed in `notify({ S, isPlaying })`, which is the same in-tree params
object. No coupling introduced.

## Files

- `src/store.js` — new; project tree, `set`/`setPath`/`subscribe`/`serialize`/
  `load`/`undo`/`redo`/`reset`, snapshot history, in-place load.
- `src/state.js` — becomes a re-export of `store.params()` as `S`; param defaults
  move into `store.js`'s `createProject()`.
- `src/controls.js` — route the ~14 state writes through `store.set`.
- `src/keyboard.js` — octave write through `store.set`.
- `src/main.js` — `store` available for later (`layout.js`/`progressionUI` can
  subscribe at graduation); no behavior change now.
- `src/store.test.js` — new (see below).
- `src/main.js`/tests: confirm no import cycles.

No changes to the audio graph, `bossEngine`, `progression`, or `presets.js`.

## Verification

1. **Unit tests** (`store.test.js`):
   - defaults match the old `S` shape;
   - `set` updates `params()`/`S` and fires `subscribe` with `{path,value}`;
   - drag coalescing → one undo step for a run of same-key writes;
   - `undo`/`redo` round-trip a value;
   - `serialize` → `load` round-trips the project;
   - **`load` mutates in place** — capture the `S` reference, load, assert the
     same object now holds new values (reference identity preserved);
   - a boss predicate (import a `STAGES[i].target`) reads the post-`load` `S`
     correctly.
2. Full suite still green (75 existing + new), `npm run build` clean.
3. **Manual (headless ok):** move a control, `store.undo()` restores it (and the
   audio/canvas follow on the next interaction); `store.serialize()` then
   `reset()` then `load(json)` restores state; the boss fight, teaching panel,
   presets, and canvases behave exactly as before.

## Out of scope (later)

Subscriber-driven rendering (Layer 5), multi-track UI and the audio side of
tracks/mixer (E4), command-inverse undo, unifying presets into the project
format, and the transport *clock* (E2 — this plan only reserves `transport` as
data).
