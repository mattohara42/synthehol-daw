---
date: 2026-06-22
topic: boss-visuals-historical-context
---

# Boss visuals and historical context

## Summary

Add a boss character panel to the right of the keyboard — an SVG rack-unit illustration per boss with CSS glitch effects that intensify during battle — and surface historical context about each module's inventor and first use in two places: a lore card shown when a boss first appears, and a persistent info icon on each module header.

---

## Key Decisions

**SVG + CSS glitch, not canvas or sprites.** SVG characters are authored in code as inline markup, requiring no image assets from the user. CSS animations (scanlines, flicker, frame corruption) layer over the SVG and respond to HP level. This keeps the rendering pipeline consistent with the existing `canvas.js` visual stack and makes the defeat animation straightforward to keyframe.

**Boss panel replaces keyboard shortcut hints during battle.** The `.kb-info` div (shortcut reference text) is hidden when `battle-active` is set; the boss panel occupies that space. Shortcut hints return when no battle is active. This avoids adding a new layout row and keeps the keyboard area compact.

**Historical content in two surfaces, not one.** The lore card (intro) and the lore button (persistent) serve different moments: the card sets narrative stakes before the fight; the button satisfies curiosity at any time without interrupting play. The teaching panel is the delivery mechanism for both, reusing the established `teach()` pattern from `controls.js`.

**Each Act I boss gets a unique hand-authored SVG.** Generic procedural generation produces characters that read as the same thing with different colors. Rack-unit faces with module-specific visual motifs (knobs, waveform shapes, patch cables) make the character legible as the instrument it represents.

---

## Requirements

**Boss character panel**

- R1. A boss character panel appears to the right of the keyboard when a battle is active, replacing the keyboard shortcut hints for the duration of the battle.
- R2. Each Act I boss has a unique SVG character illustration authored entirely in code; no image assets are required.
- R3. Each SVG character uses visual motifs drawn from the module it guards: oscillator boss uses knob-eyes and waveform mouth; filter boss uses cutoff-sweep shapes; envelope boss uses ADSR contour lines; LFO boss uses sinusoidal ripple elements.
- R4. CSS glitch effects (scanlines, eye flicker, frame corruption) are layered over the SVG character during battle; effect intensity scales proportionally as HP decreases toward zero.
- R5. On boss defeat, the glitch effects resolve to a clean "restored instrument" visual state before the panel transitions away.
- R6. The boss panel is absent and shortcut hints are shown when no battle is active: on fresh load if all stages are cleared, and after graduation.

**Historical context — intro lore card**

- R7. When a new battle begins, the stage-intro strip (above the modules row) shows expanded lore content: pioneer name, year/era, instrument name, and one historical fact sentence — using the same dismiss behavior as the existing intro text (5 seconds or first keypress).
- R8. The lore card auto-dismisses after 5 seconds; pressing any piano key also dismisses it immediately.
- R9. The lore card does not obscure the module controls or the keyboard.

**Historical context — persistent lore button**

- R10. Each module header displays a small `ⓘ` icon at all times, including while the module is locked.
- R11. Clicking the `ⓘ` icon populates the teaching panel with the module's historical content — pioneer, era, instrument, historical fact — using the same display mechanism as control-change teachings.
- R12. The lore button is available before, during, and after the boss fight for that module.

**Stage data**

- R13. `stages.js` gains two new fields per stage entry: `historyYear` (string) and `historyFact` (one sentence). The existing `pioneer` and `instrument` fields fulfill the remaining lore content needs without modification.

---

## Key Flows

- F1. **Battle start.** When `bossEngine.activateStage()` fires: keyboard shortcut hints hide; boss SVG panel slides in to the right of the keyboard; lore card appears with pioneer/year/fact; glitch effects initialize at low intensity. After 5 seconds or first keypress, lore card dismisses. **Covers R1, R2, R4, R7, R8.**

- F2. **HP drain.** Each `bossEngine.onDamage()` callback: HP bar updates; CSS glitch intensity recalculates from the new HP fraction. **Covers R4.**

- F3. **Boss defeat.** `bossEngine.onRestore()` fires: glitch effects peak briefly, then resolve to the restored-instrument SVG state; restoration animation runs ~1.2 seconds; panel transitions away as the next stage activates. **Covers R5.**

- F4. **Lore button click.** User clicks `ⓘ` on any module header: teaching panel title and body update with that module's historical content; any active synthesis teaching is replaced. **Covers R10, R11, R12.**

---

## Scope Boundaries

**Deferred for later**
- Act II–IV boss SVG characters (the pattern is established with Act I; designs ship with each Act).
- Synth-based hit sounds on HP loss events.

**Out of scope**
- User-provided sprite or image assets — all art is code-generated.
- Mobile / narrow-viewport responsive layout for the boss panel.
- Localization of historical text.

---

## Dependencies / Assumptions

- `stages.js` stage entries are extended with `historyYear` and `historyFact`; `pioneer` and `instrument` fields remain unchanged.
- The `.kb-info` div is conditionally hidden in `battle-active` state without removing it from the DOM, so shortcut hints remain accessible to screen readers and restore cleanly.
- The teaching panel (`#teach-title`, `#teach-body`) is available for lore content without structural change — same surface `teaching.js` already writes to.

---

## Outstanding Questions

**Deferred to planning**
- Exact pixel dimensions and positioning of the boss panel within `keys-row` (depends on measured keyboard width at various viewport sizes).
- Whether the restored-instrument SVG state is a distinct second SVG per boss or a CSS class toggle on the same SVG.
