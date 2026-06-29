---
date: 2026-06-29
topic: region-layout-shell
backlog-items: L1 (also unblocks L2, L3, L4, L5)
status: proposed
---

# Plan — Region/panel layout shell (DAW backlog L1)

## Context

The end goal is a full DAW (see `docs/daw-layout-backlog.md` and the feature
roadmap). Today the screen is a hard-coded CSS grid in `index.html` / `style.css`:
`main` is a `2fr / 1fr` grid with three children — `.main-content` (the module
rack, spanning the top two-thirds full width), `.stage-region` (lower-left:
scope/spectrum + keyboard), and `.teach-panel` (lower-right Learn panel).

Adding a transport bar, a sequencer work-area, tracks, or a mixer to that fixed
grid means surgically re-cutting the layout every time — and the riskiest future
change (a horizontal, zoomable **timeline axis**) wants the main stage that the
rack currently owns. L1 makes the layout **data-driven**: named regions whose
visibility and placement come from a `viewState` object, so future components
dock into a region and toggle on, instead of forcing a structural rewrite.

**This is a pure refactor.** It must reproduce today's layout pixel-for-pixel and
change no synth/audio/progression behavior. Its only new capability is the
*mechanism* to show/move regions.

## Approach

### Region taxonomy

Top-level, placeable regions (each a DOM container tagged `data-region`):

| region | today's content | default visible |
|---|---|---|
| `transport` | — (empty placeholder) | no |
| `browser` | — (empty placeholder) | no |
| `rack` | the module rack (was `.main-content`) | yes |
| `work-area` | — (empty placeholder; future timeline/sequencer) | no |
| `stage` | scope + spectrum + keyboard (was `.stage-region`) | yes |
| `inspector` | the Learn panel (was `.teach-panel`) | yes |

`header` stays outside the region grid (it's always-on chrome). The empty
placeholders ship hidden — they prove the system works and give L2/L5 a home
without another structural change.

### View-state model — new `src/layout.js`

Pure view-state, no audio/DOM-business logic beyond applying classes/attributes:

```js
export const layout = {
  mode: 'rack',                 // 'rack' | 'daw'
  regions: {
    transport: { visible: false },
    browser:   { visible: false },
    rack:      { visible: true  },
    workArea:  { visible: false },
    stage:     { visible: true  },
    inspector: { visible: true  },
  },
  setMode(mode) { ... apply() },
  showRegion(name, on = true) { ... apply() },
  apply() { /* set data-layout-mode + [hidden] on region els from state */ },
};
export function initLayout() { layout.apply(); }
```

`apply()` writes `data-layout-mode` on the layout root and toggles a `hidden`
attribute (or `.region-hidden`) on each region element. **CSS owns the actual
placement** per mode via `grid-template-areas` — JS never sets pixel sizes.

### CSS — placement per mode (`style.css`)

The layout root (today's `main`) becomes `[data-layout-mode]` with grid-area
templates. The `rack` template reproduces today exactly:

```css
.layout {
  display: grid;
  min-height: 0; overflow: hidden;
}
.layout[data-layout-mode="rack"] {
  grid-template-columns: 1fr 360px;
  grid-template-rows: 2fr 1fr;
  grid-template-areas:
    "rack  rack"
    "stage inspector";
}
[data-region="rack"]      { grid-area: rack; }
[data-region="stage"]     { grid-area: stage; }
[data-region="inspector"] { grid-area: inspector; }
[data-region][hidden]     { display: none; }
```

A **stub `daw` template** is added (documented, not yet used) so L3 can flesh it
out — e.g. `transport` across the top, `browser` left, `work-area` center,
`stage`/`inspector` docked smaller:

```css
.layout[data-layout-mode="daw"] {
  grid-template-columns: 200px 1fr 320px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "transport transport transport"
    "browser   work-area  inspector"
    "browser   stage      inspector";
}
```

The existing region-internal CSS (`.rack`, `.stage-region` → `[data-region=stage]`,
`.teach-panel` → `[data-region=inspector]`, and their fill/flex rules) is reused
unchanged; only the **outer placement** moves from fixed grid to named areas.

### DOM — `index.html`

- Rename `main` usage to the layout root (keep `<main>` but add
  `class="layout" data-layout-mode="rack"`).
- Tag the three existing containers with `data-region` (`rack`, `stage`,
  `inspector`) instead of relying on their current class-based grid placement.
- Add three empty, `hidden` placeholder containers:
  `<div data-region="transport" hidden></div>`, `browser`, `work-area`.
- No content moves between containers; only attributes/wrappers change.

### Wiring — `src/main.js`

Call `initLayout()` once at startup (after the DOM exists, before/with the other
inits). Expose `layout` so `progressionUI.js` can later call
`layout.setMode('daw')` at graduation (L3) — **not wired in this slice**, just
available.

## Files

- `src/layout.js` — new; `viewState`, `apply()`, `initLayout()`, `setMode`,
  `showRegion`.
- `index.html` — tag regions with `data-region`, add hidden placeholders, set
  `data-layout-mode` on the layout root.
- `src/style.css` — replace the fixed `main` grid with `[data-layout-mode]`
  grid-area templates (`rack` = parity; `daw` = stub); map `[data-region]` →
  areas; `[data-region][hidden] { display:none }`.
- `src/main.js` — `initLayout()` call + export hook.

No changes to `state.js`, the audio graph, `progression`/`bossEngine`, or any
control wiring.

## Verification

1. **Visual parity (the key check):** screenshot before/after in a headless
   browser at the same viewport — the `rack` layout must be pixel-identical
   (rack ≈ 631px top, stage/inspector ≈ 315px bottom at 946px main height, as
   measured for the current layout). No visible change.
2. `npm test` — all 75 still pass (no logic touched).
3. `npm run build` — clean.
4. **Mechanism proof:** temporarily `layout.showRegion('transport', true)` from
   the console (or a throwaway call) and confirm the placeholder appears in the
   reserved area and the grid reflows — then remove. Confirms regions toggle
   without structural edits.
5. Confirm progression still locks/unlocks modules and the boss flow is
   unaffected (regions are just containers).

## Out of scope (later backlog items)

Transport content (L2), view-mode switch + rack docking + graduation transition
(L3), responsive/min-size rules for `daw` mode (L4), and any work-area/sequencer
content (L5+). This slice ships the empty shell and the `rack`-mode parity only.
