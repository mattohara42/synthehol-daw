---
date: 2026-07-03
topic: era-workspaces
status: direction-proposed
---

# Synthehol — Era Workspaces (D5)

## Summary

D5 in the differentiation north-star doc pitches "eras as skins that are also
sounds" — switchable visual themes, each a period-correct preset bank plus
curated history, using the `data-era` system that "already exists." That
premise needs correcting before scoping this: **only one era palette
(`moog`) is actually implemented**, `data-era="moog"` is a static attribute
in `index.html` that no code ever changes, and there is no switcher UI
anywhere. D5 is closer to a new feature than a wiring-up of dormant
infrastructure. This doc scopes what actually has to be built.

## Where we are today

- `style.css`'s `[data-era="moog"]` block sets `--era-accent`/`--era-accent-2`
  (two CSS custom properties, used by boss-panel glow, knob caps, etc.).
  No `arp`/`oberheim`/`capstone` palette exists.
- `body[data-layers]` (0–4) is a **separate**, orthogonal system: it ramps
  panel chrome / accent stripe / label engraving as bosses are restored, and
  its layer-4 override (richer surface colors) is hard-coded to the Moog
  palette specifically — there's no equivalent "fully restored" treatment
  for any other era yet.
- Every `STAGES`/`CHALLENGES` entry already carries `era` (`'moog'` ×4,
  `'arp'`, `'oberheim'`, `'capstone'`, plus the D1 bonus challenges' `'buchla'`
  and `'roland'`) alongside `instrument`/`pioneer`/`historyYear`/
  `historyFact` — the lore content D5 wants to lean on is already written,
  just never surfaced as a switchable "workspace."
- `presets.js`'s `FACTORY` bank is 5 generic, era-less presets (Init, Bass,
  Brass, Lead, Pad) — nothing period-tagged exists to seed a "period-correct
  preset bank" from. `practice.js`'s `TARGETS` bank is the closest shape
  precedent (named, curated, complete params objects) but is scored/ear-
  training content, not preset content.
- No UI affordance for switching anything exists — the header is a compact
  strip (logo, tagline, master vol, status pill, undo/redo, reset).

## Key decisions

**Gate on graduation, like Practice (D6), not per-stage.** The north-star
doc frames this as something "the graduated DAW lets you" do — treat it as
free-play content, available once every module is taught, not a progressive
per-boss unlock. A half-available palette switcher (only some eras themed)
before graduation would read as broken, not earned.

**Ship the eras the game already has lore for — don't invent new ones.**
Four candidate workspaces, one per already-written pioneer/instrument
pairing spanning the roster: **Moog** (Bob Moog / Wendy Carlos — osc,
filter, envelope, LFO), **ARP** (Alan R. Pearlman — noise), **Oberheim**
(Tom Oberheim — osc2), **Sequential Circuits** (Dave Smith — the Mimic
capstone). Buchla/Roland (the two D1 bonus-challenge eras) are deliberately
**out of scope for v1** — they're secrets behind an optional bonus track,
not part of the main graduation story every player sees.

**A palette is 2 CSS custom properties plus a small curated preset set, not
a full skeuomorphic reskin.** Matches the hardware-redesign doc's "refined
modern-vintage, not heavy photoreal skeuomorphism" precedent. Concretely,
per era: `--era-accent`/`--era-accent-2` (already the mechanism `moog` uses)
tuned to that instrument's real panel colors, plus 2–3 curated presets
(reusing `presets.js`'s existing plain-params-object shape, just tagged with
`era` and surfaced only in that workspace) capturing a signature sound from
that pioneer's instrument — e.g. an ARP-era preset leans on the noise
module the way Ben Burtt's R2-D2 patches did (already the flavor text on
the noise stage's `historyFact`).

**Switching lives in the Learn panel's History tab, not the header.** The
History tab already renders per-stage lore; once graduated, add an era
picker there (four small labeled swatches) rather than crowding the already-
compact header with a new control. Picking an era: sets `body[data-era]`,
and offers to load one of that era's curated presets (doesn't force it —
switching the *look* and loading a *preset* are separate actions, matching
how `presets.js` already keeps "browse" and "load" as separate steps).

**Don't touch the `data-layers` system.** It's a *progression* signal
(how much of the story you've earned), era switching is a *taste* signal
(which restored instrument you want to look at right now) — keep them
decoupled. A future era's "layer 4" richness, if wanted, is its own slice,
not required for v1.

## Rollout

1. **Prototype one workspace end-to-end**: pick ARP (noise is the smallest,
   most self-contained module to theme, and its lore/history-fact content
   is already the most vivid). Build its palette, 2 curated presets, and the
   History-tab picker affordance — behind graduation, alongside the existing
   Moog default — before generalizing to Oberheim/Sequential Circuits.
2. If the feel holds up, roll the same pattern out to the remaining two
   (Oberheim, Sequential Circuits); Moog's palette already exists and just
   needs 2–3 curated presets tagged to match the pattern.
3. Buchla/Roland workspaces (the D1 bonus-challenge eras) — reconsidered
   only if the four main ones land well and there's appetite for rewarding
   the bonus track with its own cosmetic payoff too.

## Out of scope (this slice)

- Any change to the rack layout, module chrome, or boss art per era —
  D5 is a color/preset swap, not a redesign of the instruments themselves.
- Retroactively theming `data-layers`' progressive-chrome system per era.
- The two D1 bonus-challenge eras (Buchla, Roland) — see Key decisions.
- Persisting the chosen era across sessions vs. resetting to Moog on
  reload — deferred to planning (see below).

## Open questions

- **Persistence**: does the chosen era workspace save to `localStorage`
  (its own key, or folded into the E6 project-persistence blob) or reset to
  Moog every session? Leaning toward persisting — matches presets/patches,
  which already survive reloads — but not decided.
- **Preset provenance**: do era-tagged presets live in `presets.js`'s
  existing `FACTORY` array (with a new `era` field, filtered by the active
  workspace) or a separate small module (mirroring `practice.js`'s
  standalone `TARGETS` bank)? Leaning toward the latter — keeps
  `presets.js`'s existing factory-preset UX (the preset dropdown) untouched
  and era content addressable on its own, but not decided.
- Exact swatch/picker visual design in the History tab — left to
  implementation, no strong opinion yet.
