---
title: Act III — VCO2 Second Oscillator
date: 2026-06-22
status: draft
tags: [act3, vco2, oscillator, progression]
---

# Act III — VCO2 Second Oscillator

## Problem Frame

Act I taught the four core synthesis modules. Act II introduced noise as a
texture source. Act III introduces the second oscillator — arguably the single
most powerful trick in analog synthesis. Two oscillators tracking the same
note, slightly out of tune, produce the chorus-like warmth that defines classic
synth leads and pads. The module teaches that imperfection is a tool: a second
voice perfectly in tune adds almost nothing; a second voice drifting a few
cents adds everything.

## Goals

- Add a VCO2 module that fans into the signal chain alongside VCO1 and noise
- Teach the player that slight detuning between two oscillators creates richness
- Introduce Tom Oberheim / Oberheim Two-Voice (1975) as the lore anchor
- Follow the established stage → boss → unlock pattern without deviation

## Scope Boundaries

**In scope:**
- VCO2 waveform, octave offset, detune, and mix controls
- VCO2 audio node fan-in at the same point as noise (into ampEnv)
- A new stage entry ("osc2") with boss, era, and lore fields
- Teaching entries for each VCO2 control and a lore entry
- `data-layers="6"` CSS and progressionUI cap extension

**Out of scope:**
- Hard sync between VCO1 and VCO2
- FM ratio or ring modulation between oscillators
- Independent filter or envelope per oscillator
- VCO2 mod-canvas visualization (no canvas in this module)
- Any change to VCO1's existing controls

## Requirements

### R1 — VCO2 State

Four new parameters added to `S` in `src/state.js`:

| Key | Type | Default | Range |
|-----|------|---------|-------|
| `osc2Waveform` | string | `'sawtooth'` | sine / square / sawtooth / triangle |
| `osc2Octave` | number | `0` | −2, −1, 0, +1, +2 (offset from VCO1's octave) |
| `osc2Detune` | number | `7` | −50 to +50 cents |
| `osc2Mix` | number | `0` | 0–1 |

Default detune of 7¢ means VCO2 sounds interesting the moment the player
unlocks it and turns up mix — no hunting for the sweet spot from 0.

### R2 — VCO2 Audio Node

VCO2 is a second `OscillatorNode` started alongside VCO1 in `startAudio()`.
It connects through an `osc2MixGain` GainNode and fans into `ampEnv` — the
same fan-in pattern used by the noise module's `noiseMixGain`.

Signal chain with VCO2 active:
```
osc          ─┐
noiseSource  ─┤→ noiseMixGain ─┤
osc2         ─┘ osc2MixGain  ─┤→ ampEnv → vcf → master → scope → destination
```

VCO2 tracks the same keyboard frequency as VCO1 (`noteFreq(note, S.octave +
S.osc2Octave)`), with its own detune applied on top.

### R3 — VCO2 Controls (Module UI)

The VNO module section in `index.html` is the closest structural reference.
VCO2's section (`id="mod-osc2"`) contains:

- **Waveform** — 4-button toggle group (`#osc2-wave-btns`) with sine/square/saw/tri, same SVG icons as VCO1
- **Octave offset** — 5-button toggle group (`#osc2-oct-btns`) with labels −2 / −1 / 0 / +1 / +2, default 0 active
- **Detune** — range slider `#s-osc2detune`, min=−50 max=50 step=1, value display `#v-osc2detune` in cents
- **Mix** — range slider `#s-osc2mix`, min=0 max=1 step=0.01, value display `#v-osc2mix` in percent
- **Lore button** — `data-lore="osc2"`
- **Lock overlay** — `.mod-lock` div

### R4 — Controls Wiring

`src/controls.js` wires all four VCO2 controls following the existing
`wireToggleGroup` / `wire` pattern. Each change:
1. Updates `S`
2. Applies to the live audio node if the engine is running
3. Calls `bossEngine.notify()`
4. Calls `teach()` with the appropriate key

Audio application:
- Waveform: `engine.osc2.type = S.osc2Waveform`
- Octave offset: retune osc2 via `setTargetAtTime` on frequency (requires
  recalculating from the current note)
- Detune: `engine.osc2.detune.setTargetAtTime(S.osc2Detune, ...)`
- Mix: `engine.osc2MixGain.gain.setTargetAtTime(S.osc2Mix, ...)`

### R5 — Note Tracking

`playNote()` in `src/audio.js` must set frequency on osc2 as well as osc1,
applying `S.octave + S.osc2Octave` as the octave. `releaseNote()` requires no
change (both oscillators share the ampEnv envelope).

### R6 — Stage Entry

New sixth stage appended to `STAGES` in `src/stages.js`:

```js
{
  id: 'osc2',
  moduleId: 'mod-osc2',
  era: 'oberheim',
  instrument: 'Oberheim Two-Voice',
  pioneer: 'Tom Oberheim',
  historyYear: '1975',
  historyFact: "Tom Oberheim hand-wired two SEM modules into a single case, creating the first commercial two-voice synthesizer. That pair of slightly drifting oscillators became the signature warmth behind OMD, Gary Numan, and Van Halen's synth leads.",
  intro: 'Two voices. Same note. Let them drift — and the sound comes alive.',
  boss: {
    name: 'The Dissonant',
    corruptedOf: 'Oberheim Two-Voice Oscillator Pair',
    taunt: 'Two voices locked in perfect unison. Perfectly sterile. Wake them up — detune them until you can feel the beating.',
    maxHp: 100,
    damagePerHit: 10,
  },
  target: (S, isPlaying) =>
    S.osc2Mix > 0.3 &&
    Math.abs(S.osc2Detune) >= 5 &&
    Math.abs(S.osc2Detune) <= 45 &&
    isPlaying,
}
```

**Win condition rationale:** Mix above 30% ensures VCO2 is audible. Detune
between 5–45¢ is the perceptual sweet spot — below 5¢ is nearly inaudible
beating, above 45¢ starts to sound out-of-tune rather than warm. The player
must discover this range by ear.

### R7 — STAGE_IDS Extension

`STAGE_IDS` in `src/progression.js` gains `'osc2'` as the sixth entry.
No other changes needed — graduation check and `unlockNext()` ceiling are
data-driven.

### R8 — Era CSS

New `[data-era="oberheim"]` block added to `src/style.css`:

```css
[data-era="oberheim"] {
  --era-accent: #4a90d0;
  --era-accent-2: #1a4870;
}
```

Cool steel blue, distinct from Moog amber (`#d4960a`) and ARP orange (`#e07020`).

Extend all `[data-layers]` selector groups to include `[data-layers="6"]`.
Add layer-6 color block (planning will resolve exact palette values).

### R9 — Boss SVG

New `'osc2'` key added to `BOSS_SVG` in `src/bossArt.js`. Visual concept:
two identical oscillator waveforms, one slightly phase-shifted from the other,
cancelling in the middle — representing the "locked in unison, no life" state.
Same constraints as existing SVGs: `viewBox="0 0 140 110"`, `fill="none"`,
`stroke="currentColor"`.

### R10 — Teaching Entries

Four control entries and one lore entry added to `TEACHINGS` in
`src/teaching.js`:

| Key | Title | Core message |
|-----|-------|-------------|
| `osc2-wave` | VCO2 Waveform | Layering different waveforms creates new timbres |
| `osc2-oct` | Octave Offset | Sub-octave thickens bass; +1 octave adds sparkle |
| `osc2-detune` | Detune — The Sweet Spot | 5–20¢ = warm chorus; 30–50¢ = dramatic beating |
| `osc2-mix` | VCO2 Mix | Low mix = subtle thickening; high mix = full dual-voice |
| `lore-osc2` | Tom Oberheim · Oberheim Two-Voice · 1975 | historyFact text from R6 |

### R11 — progressionUI Cap

In `src/progressionUI.js`, raise the `data-layers` cap in `handleRestore()`
from 5 to 6, and change the graduation `document.body.dataset.layers` from
`'5'` to `'6'`.

### R12 — Tests

Test files to update:

- `src/stages.test.js` — count 5→6, order includes 'osc2', VALID_MODULE_IDS
  includes 'mod-osc2', valid eras includes 'oberheim', osc2 target predicate
  tests (pass, mix boundary, detune dead-zone low, detune dead-zone high,
  isPlaying=false)
- `src/progression.test.js` — STAGE_IDS length 5→6, `[5] === 'osc2'`
- `src/bossEngine.test.js` — graduation drain 5→6 stages, add `osc2S` fixture
- `src/teaching.test.js` — LORE_IDS gains 'lore-osc2', TEACHINGS tests for
  osc2-wave / osc2-detune / osc2-mix / osc2-oct

## Success Criteria

- VCO2 module appears locked until noise boss is defeated
- Turning up mix blends VCO2 into the sound without clicks
- Octave offset shifts VCO2 pitch in clean octave steps
- Detune slider produces audible beating/chorus effect
- Boss is defeatable by the stated target predicate
- All existing tests continue to pass; new tests cover the above
- Graduation requires defeating all six stages

## Dependencies

- Acts I and II fully shipped (done as of 2026-06-22)
- No external dependencies

## Outstanding Questions

None — all product decisions resolved in brainstorm.
