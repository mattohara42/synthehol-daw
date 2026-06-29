---
date: 2026-06-29
topic: hardware-redesign
status: direction-agreed
---

# Synthehol — Hardware-Authentic Redesign

## Summary

Overhaul the look toward an authentic vintage-synth panel (Moog era) without
sacrificing mouse usability. The previous knob-based look read as more authentic
and the two-row module layout was liked, but the old knobs used **rotary drag**
(turn the mouse in a circle) which is the universal anti-pattern. The fix is to
keep knobs but change the *gesture* to **vertical drag**, and to render each knob
as a visual skin over the existing native `<input type="range">` so accessibility
and all current wiring survive untouched.

Aesthetic direction (agreed): **refined modern-vintage** — strong hardware cues
(knobs with tick rings, walnut end-cheeks, silkscreen labels, LED jewels, a
CRT-style scope) but clean and legible, not heavy photoreal skeuomorphism.
Knobs: **black skirted body, white pointer, tick ring, colored cap** tinted with
each module's existing accent color.

## Problem frame

`src/controls.js` wires every control through `wire(id, handler)` and
`src/ui.js#fillSlider` writes a `--pct` CSS variable; the current control is a
horizontal fader (`input[type="range"]`, styled in `style.css`). Faders are easy
with a mouse but read as generic, not like hardware. Knobs read as hardware but
were unusable because the old implementation required circular dragging.

## Key decisions

- **Keep the native range input; skin a knob over it.** A new `Knob` enhancer
  hides the input visually (but keeps it focusable) and draws an SVG knob that
  reflects the value and translates pointer gestures into value changes by
  dispatching `input` events. This preserves:
  - the `wire()` / teaching-panel / boss-engine plumbing (they listen for
    `input` on the same element — no rewiring),
  - the B10 accessibility work (aria-label, keyboard arrows, screen readers),
  - `applyPreset()` (it dispatches `input`; the knob re-renders from that).

- **Interaction model (the actual usability fix):**
  - **Vertical drag** = adjust (up = increase). The primary gesture.
  - **Scroll wheel** = step (already present in `initSliderEnhancements`).
  - **Shift** = fine (×0.2 sensitivity); **Ctrl/Cmd** = coarse.
  - **Double-click** = reset to the control's default (`input.defaultValue`).
  - **Hover/drag** = value readout stays visible (the existing `.ctrl-val`).
  - Knobs never require circular motion.

- **Knob visual spec:**
  - ~54 px skirted black body; value sweeps a **270° arc** (−135° at min to
    +135° at max). Bipolar knobs (e.g. Detune) sit at 12 o'clock for 0.
  - A static **tick ring** around the dial; stepped params (e.g. Octave) get a
    tick per detent.
  - A **colored cap/indicator** in the module accent (`--track-color`) so groups
    read at a glance; white pointer line for the value.
  - Focus-visible glow on the knob driven by the underlying input's focus.

- **Layout: two rows of module panels, by signal flow.**
  - Row 1 (the voice): **VCO → VCF → VCA/Envelope** left-to-right.
  - Row 2 (motion & space): **LFO → FX** (+ future Noise, Osc 2 in Act II).
  - The rack is framed by **walnut end-cheeks** (reuse `--era-accent-2`), with an
    engraved brand nameplate. Presets strip, CRT scope + FFT, teaching placard,
    and keyboard keep their roles.

- **Respect the existing progressive-chrome system.** `style.css` already ramps
  panel chrome / accent stripes / engraved labels via `[data-layers]` as bosses
  are defeated. The redesign extends this rather than replacing it: knobs and
  panel materials are the "fully restored hardware" end state.

## Accessibility & input

- The range input remains the single source of truth and stays keyboard- and
  screen-reader-operable; the knob is `aria-hidden` decoration over it.
- Touch: pointer events (not mouse-only); `touch-action: none` on the knob so a
  vertical drag adjusts instead of scrolling.
- `prefers-reduced-motion`: no spin animations; the pointer just reflects value.

## Rollout

1. **Prototype the VCO module** (Octave + Detune knobs) behind the new `Knob`
   enhancer, plus the refined-vintage panel styling, so the *feel* can be judged
   on real controls before touching the other ~12.
2. If approved, roll the enhancer across all continuous controls (filter, ADSR,
   LFO, FX, master) — toggle groups stay as rocker-style buttons.
3. Then the two-row layout + walnut framing + CRT/nameplate chrome.

## Acceptance feel-check (prototype)

- Octave/Detune adjust smoothly by dragging up/down with a mouse; scroll steps;
  Shift fines; double-click resets to default; the value readout tracks.
- Tab/arrow keys still operate the controls; screen reader still announces them.
- Presets still move the knobs (via the dispatched `input` event).
- No regression in the boss-fight tick, teaching panel, or canvases.

## Out of scope (this slice)

Rolling knobs to every module, the full two-row re-layout, walnut framing, and
the CRT/nameplate chrome — all follow once the knob feel is signed off.
