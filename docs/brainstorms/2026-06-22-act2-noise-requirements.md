---
date: 2026-06-22
topic: act2-noise-generator
---

# Act II — Noise Generator Module

## Summary

Add a fifth synthesis module — **VNO (Voltage-controlled Noise Oscillator)** — as the first Act II stage. It introduces white and pink noise as sound sources, gated by a boss fight that requires the player to sculpt noise using the already-unlocked filter and envelope modules. Defeating the boss unlocks the noise module permanently and advances the era palette from Moog to ARP.

---

## Key Decisions

**Boss fight requires filter + envelope together.** Noise alone is trivial to produce — just turning it on is not enough. The target predicate requires noise to be audible, the cutoff pulled into a musical range (not fully bright), and the decay kept short (percussive). This forces the player to apply two previously learned skills simultaneously.

**White/pink toggle + mix knob.** The player blends noise into the existing oscillator signal; they are not replacing the oscillator. This teaches noise as a texture layer — breathiness, grit, percussive transient. The type toggle is a teaching moment (spectral density difference), not a boss fight requirement.

**Noise passes through the shared filter and ADSR.** No separate signal chain. The existing filter and envelope modules become more powerful as soon as noise is introduced — a strong payoff moment for Act I learning.

**ARP 2600 era.** Alan R. Pearlman's ARP 2600 (1971) anchors the historical context. Ben Burtt's use of ARP 2600 noise to create R2-D2's voice is the canonical teaching example — memorable, specific, and directly demonstrates filter + envelope shaping of noise.

---

## Requirements

**Module**

- R1. A new module section — **VNO** — appears after the LFO module in the modules row. It is locked until the Act II boss is defeated.
- R2. The VNO module has two controls: a white/pink noise type toggle and a mix knob (0–1, blending noise into the oscillator signal).
- R3. Adjusting either control fires the teaching panel with relevant content (see Teaching below).
- R4. The mix knob defaults to 0 (noise off); noise becomes audible above approximately 0.2.

**Boss fight**

- R5. The Act II boss is named **The Static** — a corrupted ARP 2600 noise source stuck at full white noise with no shaping.
- R6. The boss fight target predicate is satisfied when: noise mix is audible (`noiseMix > 0.2`), cutoff is in a musical range (not fully bright — `cutoff < 5000`), decay is short (`decay < 0.2`), and a note is being held (`isPlaying`).
- R7. The boss's taunt communicates the problem: all noise, no shape. Example: *"Just static. Formless. Give it a body — filter it, shape it, make it mean something."*
- R8. The boss follows the same damage/restore/graduation pattern as Act I bosses: `maxHp: 100`, `damagePerHit: 10`.

**Historical context**

- R9. The VNO stage carries `pioneer: 'Alan R. Pearlman'`, `instrument: 'ARP 2600'`, `historyYear: '1971'`, and `historyFact: "Ben Burtt shaped R2-D2's voice by filtering and enveloping white noise from an ARP 2600 — the same spectral sculpting technique you're learning here."` These populate the stage-intro lore strip and the module's ⓘ lore button.
- R10. The intro text reads: *"Noise is raw, unformed sound. Filter it and shape it in time — and it becomes anything."*

**Teaching panel entries**

- R11. `noise-type` — fires when the white/pink toggle changes. Title: "White vs Pink Noise". Body teaches: white noise has equal energy at every frequency (bright, harsh — TV static); pink noise rolls off at higher frequencies (−3dB/octave — warmer, more natural — rain on a roof). Neither type is required by the boss fight; both are valid materials.
- R12. `noise-mix` — fires when the mix knob moves. Title: "Noise Mix". Body teaches: low mix (0.1–0.2) adds subtle breathiness or grit to a pitched tone; high mix (0.7–1.0) makes noise the dominant voice; the blend point teaches that noise and pitch coexist, not compete.

**Era**

- R13. The VNO stage has `era: 'arp'`. The `data-era` attribute on `<body>` is updated to `'arp'` when the Act II battle begins, changing the `--era-accent` CSS custom property to an ARP-era color (amber/orange, distinct from Moog warm-amber). Exact hue resolved at planning time.
- R14. `data-layers` extends to 5 when all five stages are cleared. The Act II graduation state (`data-layers="5"`) may add a subtle visual flourish (resolved at planning time — minimum viable is a clean state with no regression on Act I visuals).

**Boss SVG**

- R15. The Static has an SVG rack-unit illustration following the `src/bossArt.js` convention (`viewBox="0 0 140 110"`, `currentColor`, `fill="none"`). Visual motif: static-filled eyes (dense dot patterns), a flat or erratic mouth drawn as random-height vertical lines, and a noise-cloud or spray halo around the head.

---

## Key Flows

- **F1. Battle start.** VNO boss activates: module row shows VNO as locked/corrupted, boss panel loads The Static SVG, lore strip shows "Alan R. Pearlman — ARP 2600 (1971)" + R2-D2 historical fact. Covers R5, R9, R10, R13.

- **F2. Sculpting noise.** Player holds a note, hears noise in the mix, adjusts filter and envelope. Teaching panel updates on each control touch. Boss HP drains when all target conditions are met simultaneously. Covers R6, R11, R12.

- **F3. Boss defeat.** The Static resolves to the restored ARP 2600 noise source. VNO module unlocks, becomes fully interactive. `data-layers` increments to 5. Covers R1, R8, R14.

- **F4. Lore button.** Player clicks ⓘ on VNO at any time. Teaching panel shows `lore-noise` content (Alan R. Pearlman / ARP 2600 / 1971 / R2-D2 fact). Follows existing `teach()` pattern. Covers R9.

---

## Scope Boundaries

**Deferred for later**
- Pink noise quality: a true pink filter requires more than a flat generator; implementation approach (biquad approximation vs buffer-based) deferred to planning.
- The boss fight does not distinguish white from pink — type choice is purely exploratory. A future refinement could reward using pink noise specifically for certain sounds, but this is not Act II scope.
- `data-layers="5"` graduation visual flourish — minimum viable is a clean state; embellishment is future work.

**Out of scope**
- Noise-only mode (oscillator muted entirely).
- Noise as an LFO source (noise-rate modulation, S&H effects) — Act III+ territory.
- Additional noise colors (brown, blue, violet noise).

---

## Dependencies / Assumptions

- All four Act I stages are cleared before Act II begins; filter and ADSR modules are fully unlocked and functional.
- The `S` state object gains `noiseType` and `noiseMix` fields; the audio engine gains a noise source node connected to the existing signal chain.
- `data-layers` cap raised from 4 to 5; CSS `[data-layers="5"]` selector added without breaking existing `[data-layers="4"]` styles.
- The `bossEngine` and `progression` singletons are data-driven from `STAGES` — adding a fifth entry is the primary extension point; no architectural changes required (assumption to verify at planning).

---

## Outstanding Questions

- Should `isPlaying` gate apply the same way to noise as to the oscillator (requiring a held key), or should noise be always-on when `noiseMix > 0`? The boss fight target currently requires `isPlaying` — this ensures the player hears the filter and envelope in action, not just in static preview. **Recommendation: keep `isPlaying` gate.** Deferred to planning if audio implementation requires otherwise.
- Exact `--era-accent` hue for "arp" era — deferred to planning; should contrast visually with the Moog warm-amber and feel distinctly ARP (orange-amber or cool gray-orange).
