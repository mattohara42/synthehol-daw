---
date: 2026-06-21
topic: vintage-aesthetic-and-history
---

# Synthehol: Vintage Aesthetic + Synthesis-History Layer

## Summary

Give Synthehol a vintage-hardware visual identity and weave the history of
synthesis into the boss progression. The app wears one cohesive vintage panel
whose palette, knobs, and labels shift per era as the player advances. Each boss
is a *corrupted* icon of its era; sculpting the stage's target sound **restores**
the real instrument — which becomes the unlocked module and awards that era's
pioneer as a collectible lore card. A revisitable "museum" gathers the cards on a
timeline of eras and lets the player hear each era's signature patch. Six acts
march chronologically from the birth of voltage-controlled synthesis to the
Eurorack revival, with a hidden Act 0 (Delia Derbyshire / BBC Radiophonic
Workshop) as an unlockable prologue that pre-dates the synthesizer entirely. This
is decided now so the Phase 1 UI is built vintage-correct rather than re-skinned
later.

---

## Problem Frame

Synthehol's current look is a modern dark-neon skin (amber/cyan/purple/green
accents). It's clean but generic — it carries none of the romance of the
instruments the tool is teaching, and it gives the history of synthesis no
presence at all. For a public teaching tool, that's a missed hook: the eras and
pioneers (Moog, Carlos, Vangelis, Kraftwerk) are exactly what makes synthesis
feel worth learning. The boss progression is already being built; if its UI lands
in the generic skin first, the vintage identity becomes a costly re-skin instead
of the thing it's built to.

---

## Key Decisions

- **Hybrid skin: cohesive base + per-era accents.** One vintage panel identity
  throughout, with palette, control styling, and label flavor shifting per
  stage/era — not a full separate reskin per era. Captures "the eras evolve"
  feeling at a fraction of the build cost.

- **Bosses are corrupted machines you restore.** Each boss is an alien-cyborg
  corruption of its era's iconic instrument; beautiful playing purifies it,
  restoring the real instrument. This fuses the grotesque-boss tone with reverence
  for the hardware — the gross thing *is* the beautiful thing, corrupted, and
  beauty heals it. It also gives the progression a story: you're rescuing the
  history of synthesis.

- **Restoration drives unlock and reward.** Restoring the instrument is what
  unlocks the module (binding to the existing completion-gated unlock) and awards
  that era's pioneer as a lore card.

- **Six acts + one hidden prologue.** Acts I–VI march chronologically from the
  birth of voltage-controlled synthesis through the Eurorack revival. Act 0
  (hidden, unlocked by completing Act I) pre-dates the synthesizer: Delia
  Derbyshire and the BBC Radiophonic Workshop, tape splicing as the original
  electronic instrument. Act VI (Eurorack modular revival) closes the circle back
  to Act I's patch cables — and is where the full DAW sandbox unlocks.

- **Medium "museum" content depth.** Collectible lore cards earned on restore,
  plus a revisitable timeline/gallery and "hear it" signature presets — richer
  than flavor text, short of a full encyclopedia.

- **Signature presets are Synthehol's own patches, not recordings.** "Hear the
  Switched-On Bach sound" loads a set of Synthehol synth parameters played by the
  existing engine — never an audio clip. Keeps it CSP-safe and IP-safe.

- **IP-safe homage.** Original "inspired-by" visuals evoke classic hardware; no
  trademarked logos, product photos, brand trade dress, or real-person likeness
  photos. Factual names and contributions in an educational context are fine.

- **All vintage rendering is CSS/SVG in-app.** The no-build setup and CSP
  (`img-src 'self'`) rule out external image assets, so wood, brushed metal, and
  engraving are drawn in code.

- **Visual complexity is earned, not assumed.** The skin starts minimal; each
  stage restore unlocks a new visual layer — panel chrome, knob detail, engraved
  labels, era animation. The full act palette is the act-completion reward, not
  the default starting state. Acts II–VI add their own layers on the same system.

- **Boss fights break into a dedicated battle screen.** Entering a fight
  transitions to an arena layout — Street Fighter / Dr. Mario style: the synth
  panel (player side) faces the corrupted instrument (boss side), HP bars frame
  the top, taunt copy floats between them. This is a CSS layout mode on the
  existing page, not a separate page; the keyboard stays live and the audio engine
  keeps running throughout. Exiting (restore or retreat) transitions back.

---

## Era Map

The act→era spine. Per-stage boss→instrument and per-card pioneer assignments are
content design, deferred to planning; Act I is sketched here because Phase 1 needs it.

| Act | Theme | Era | Iconic machines | Pioneers (starter) |
|---|---|---|---|---|
| 0 🔒 hidden — Before the synthesizer | Tape splicing as the original electronic instrument | Early 1960s | BBC Radiophonic Workshop reel-to-reel | Delia Derbyshire |
| I — Make a tone | Birth of voltage-controlled synthesis | Late 1960s–70s | Moog modular, Minimoog | Bob Moog, Wendy Carlos |
| II — Shape and transform | Tape era, analog processing, dub | 1960s–70s | ARP 2600, Roland Space Echo RE-201 | Lee "Scratch" Perry, King Tubby, Terry Riley, Suzanne Ciani |
| III — Play like an instrument | Polyphonic expression + electronic pop | Late 70s–early 80s | Yamaha CS-80, Prophet-5, Juno-60 | Vangelis, Giorgio Moroder |
| IV — Become the machine | Rhythm machines, MIDI, global beat | 1980s | Roland TR-808/909, TB-303, Yamaha DX7 | Kraftwerk, Afrika Bambaataa |
| V — The revolution goes digital | Rave, software synthesis, digital effects | 1990s–2000s | Akai MPC, early DAWs, VST era | Aphex Twin, Daft Punk |
| VI — Full circle | Eurorack modular revival | 2000s–present | Eurorack modular systems | Suzanne Ciani (returns), modular community |

Act 0 unlocks after completing Act I; it has no prerequisite synthesis concept and
plays as a pure historical/atmospheric stage. Act VI is the final act; restoring
its boss unlocks the full DAW sandbox graduation.

Within Act I, the four bosses are corrupted signature elements of the Moog era
(oscillator bank, the famous ladder filter, the contour/envelope generator, the
modulation/LFO); restoring them rebuilds the era's instrument and earns the Act I
pioneers.

---

## Requirements

### Visual identity

- R1. The app adopts a cohesive vintage-hardware visual identity — panels, knobs, sliders, engraved labels — evoking classic analog synths.
- R2. The base identity shifts per stage/era through accents (palette, control styling, label flavor) on the shared panel, without full per-stage reskins.
- R3. All vintage textures and ornamentation are rendered in-app with CSS/SVG; no external image assets.
- R4. The vintage identity replaces the current modern-neon styling as the default look.

### Narrative & boss reframe

- R5. Each boss is a corrupted version of its era's iconic instrument; meeting the stage's target sound visibly restores the instrument.
- R6. Restoring a boss's instrument is what unlocks the corresponding module/capability.
- R7. Restoring an instrument awards that era's pioneer as a collectible lore card.
- R8. Six acts map chronologically from voltage-controlled synthesis (Act I) through the Eurorack revival (Act VI); a hidden Act 0 (pre-synthesizer tape era) unlocks after Act I completes.

### History content & museum

- R9. A revisitable "museum" collects earned lore cards on a timeline of eras and pioneers.
- R10. Each lore card carries the era's iconic machine and key pioneer, a short factual description, and a memorable fact or landmark work.
- R11. The museum lets the player hear an era's signature sound via a preset — a saved set of Synthehol's own synth parameters, not a recording.
- R12. Lore and museum content is read-only reference and never gates progression.

### IP & sourcing constraints

- R13. Visual designs are original "inspired-by" homages; no trademarked logos, product photos, or brand trade dress are reproduced.
- R14. Pioneer content uses factual names and contributions with original or public-domain/properly-licensed art; no real-person likeness photos.

### Integration with the progression

- R15. These decisions update the existing progression work: boss/stage data gains era/instrument/pioneer theming, and the Phase 1 UI is built to the vintage identity from the start.
- R16. The app starts with a minimal visual state; each stage restore unlocks a new visual layer (panel chrome, knob detail, engraved labels, era animation). The full act palette is earned by completing the act, not present on first load.
- R17. Entering a boss fight triggers a battle-screen layout transition: synth panel facing the corrupted instrument, HP bars at top, taunt text between them. The keyboard stays live during battle; exiting returns to the exploration layout.

---

## Key Flows

- F1. Restore a machine
  - **Trigger:** A boss (corrupted era instrument) is active and the player meets that stage's target sound.
  - **Steps:** The boss's health drains as the target is hit → at zero, a restoration plays (corruption falls away, the real instrument emerges) → the corresponding module unlocks → that era's pioneer lore card is awarded → the museum timeline updates.
  - **Outcome:** The instrument is restored and playable; the collection grows; the next era's stage becomes available.
  - **Covers:** R5, R6, R7, R9.

---

## Acceptance Examples

- AE1. **Covers R5, R6.** Given the Filter boss is a corrupted Moog-style ladder filter, when the player meets the filter target, the boss is restored into the now-unlocked Filter module.
- AE2. **Covers R7, R9.** When an instrument is restored, a new lore card is awarded and appears on the museum timeline.
- AE3. **Covers R11.** Given the museum, when the player selects an era's "hear it" preset, the existing synth engine loads those parameters and plays — no audio file is involved.
- AE4. **Covers R2.** When the player advances from Act I to a later era, the panel's accent palette and label flavor change while the underlying layout stays the same.
- AE5. **Covers R12.** When the player ignores or closes the museum and lore cards, progression continues with no penalty.
- AE6. **Covers R16.** On first load the app is visually minimal; after the Oscillator boss is restored a new visual layer appears (panel chrome, knob ticks, etc.) that was not present before.
- AE7. **Covers R17.** When the Oscillator boss becomes active the layout shifts to the battle screen (synth panel facing the corrupted VCO, HP bar visible); when the boss is restored the layout returns to exploration mode.

---

## Scope Boundaries

### Deferred for later

- Deep-encyclopedia content — detailed bios, "play in the style of X" challenges, source citations.
- Full per-era visual reskins (the hybrid accent system is the chosen path).
- Pioneers and eras beyond the starter set — the museum can grow over time.

### Future expansion concept: video game audio + hardware-constrained genres

A companion track (or additional acts) tracing how video game hardware limitations
both constrained and enabled iconic soundtracks — and how those constraints became
aesthetics that modern genres still deliberately seek out.

**Era spine:** early arcade bleeps (Space Invaders, 1978) → C64 SID chip (filter
resonance as the defining sound) → NES (5-channel PSG: pulse × 2, triangle, noise,
DPCM; arpeggiated chords as a workaround for 2-voice polyphony) → Game Boy → Sega
Genesis (Yamaha YM2612 FM chip — direct lineage from the DX7 in Act IV) → SNES
(SPC700 wavetable, pushed furthest by David Wise / Donkey Kong Country).

**Key composers:** Koji Kondo, Nobuo Uematsu, Yuzo Koshiro, Hirokazu Tanaka,
Yasunori Mitsuda, Rob Hubbard (C64), David Wise.

**Modern genres that reclaim the hardware:** chiptune (Game Boy via LSDJ, Famitracker),
synthwave/retrowave (808, Juno, DX7 as deliberate aesthetic), lo-fi hip hop (tape
saturation, MPC), vaporwave, demoscene.

**Narrative thread:** the corrupted-machine restoration mechanic applies here in
reverse — hardware *limitations* were the machine's "corruption," and composers
found beauty anyway. The synthesis concepts taught are the same ones; this track
contextualises them through a different cultural lens.

**Integration note:** the FM synthesis connection (Sega Genesis YM2612 ↔ DX7) ties
directly into Act IV; this expansion is additive, not a rework.

### Outside this product's identity

- Real audio recordings, product photos, brand logos/trade dress, and real-person likeness images.
- Any online/shared museum or accounts — the collection and progress stay local.

---

## Dependencies / Assumptions

- Builds on and reshapes the progression work: `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md` and the Phase 1 plan `docs/plans/2026-06-21-001-feat-progression-boss-engine-plan.md`. The boss/stage theming and UI units there must absorb these decisions before being built.
- Vintage rendering is CSS/SVG only, bounded by the no-build setup and CSP (`img-src 'self'`).
- "Signature presets" are Synthehol synth-parameter sets played by the existing engine, not external audio.
- The current look is a modern dark-neon skin in `src/style.css`, to be replaced.

---

## Outstanding Questions

### Deferred to planning / content design

- The exact era→stage→corrupted-instrument mapping for Acts II–VI and Act 0 (Act I is sketched).
- Which pioneer lore card is earned at which stage within an act.
- The museum's UI surface, placement, and navigation, and whether preset playback lives there, on the card, or both.
- How the per-era accent system is structured so the base identity stays cohesive across eras.
- How many lore cards exist per era and their exact card format.

---

## Sources / Research

- `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md` — the boss progression this themes.
- `docs/plans/2026-06-21-001-feat-progression-boss-engine-plan.md` — Phase 1 plan whose boss/stage data and UI units (the progression UI and boss-rendering units) this reshapes.
- `src/style.css` — the current modern-neon palette to be replaced.
- `src/canvas.js` — in-app drawing primitives available for vintage rendering and boss/instrument art.
- `CLAUDE.md` — "fun first, accurate second", the no-build architecture, and the CSP that forces CSS/SVG-only visuals.
