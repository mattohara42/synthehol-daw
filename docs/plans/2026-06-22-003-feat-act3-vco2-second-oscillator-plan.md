---
title: "feat: Act III — VCO2 Second Oscillator"
date: 2026-06-22
origin: docs/brainstorms/2026-06-22-act3-vco2-requirements.md
---

# feat: Act III — VCO2 Second Oscillator

## Summary

Add a second oscillator (VCO2) module to Synthehol's Act III progression. VCO2
fans into the signal chain alongside VCO1 and noise, controlled by waveform,
octave offset (±2), independent detune, and mix. The boss fight — "The
Dissonant," a corrupted Oberheim Two-Voice — is defeated by bringing up mix
and landing detune in the 5–45¢ richness zone. Defeating it unlocks the module
and advances to a sixth layer. Tom Oberheim / Oberheim Two-Voice (1975) provides
the lore anchor for the new Oberheim era.

---

## Problem Frame

Two oscillators slightly out of tune produce the chorus-like warmth that
defines classic synth leads and pads. The module teaches that imperfection is
a tool: a second voice drifting a few cents creates richness; perfect unison
adds almost nothing. (see origin: docs/brainstorms/2026-06-22-act3-vco2-requirements.md)

---

## Requirements Trace

| Req | Covered by |
|-----|-----------|
| R1 — VCO2 state params | U1 |
| R2 — VCO2 audio node fan-in | U2 |
| R3 — VCO2 module HTML | U6 |
| R4 — Controls wiring | U7 |
| R5 — Note tracking in playNote | U2 |
| R6 — Stage entry (osc2 / The Dissonant) | U3 |
| R7 — STAGE_IDS extension | U3 |
| R8 — Oberheim era CSS + data-layers="6" | U8 |
| R9 — Boss SVG | U4 |
| R10 — Teaching entries | U5 |
| R11 — progressionUI cap 5→6 | U9 |
| R12 — Test updates | U10 |

---

## Key Technical Decisions

**VCO2 as a permanent OscillatorNode (always running, mix = 0 at rest).**
VCO2 is created in `startAudio()` and runs continuously, with `osc2MixGain`
at 0 when the module is locked or unused — identical to the noise fan-in
pattern. The alternative (create/destroy on note events) would require
restarting the oscillator after each note, causing audible glitches when
the module is first used.

**Octave offset as a relative ±2 toggle, not an absolute slider.**
VCO2's octave is always `S.octave + S.osc2Octave`. This makes the concept
teachable ("shift VCO2 one octave up from whatever VCO1 is playing") and
avoids confusion when the player changes VCO1's octave.

**Live octave-offset updates read `engine.currentNote`.**
When the player changes `osc2Octave` while a note is held, the controls
handler reads `engine.currentNote` (already stored by `playNote`) and
`S.octave` to recalculate the live frequency:
`noteFreq(engine.currentNote, S.octave + S.osc2Octave)`.
If no note is held (`engine.currentNote === null`), the handler skips the
frequency update — the new offset takes effect on the next note press.

**Win condition uses |osc2Detune| in 5–45¢ range, not just > 0.**
The dead zone below 5¢ is intentional: the player must turn it far enough
to hear audible beating. The upper bound at 45¢ keeps the stage about
richness, not out-of-tune noise. Mix > 0.3 ensures VCO2 is audible.

---

## Scope Boundaries

**In scope:** VCO2 waveform, octave offset, independent detune, mix; audio
fan-in; boss stage; era CSS; teaching entries; test updates.

**Out of scope:** hard sync, FM ratio, ring modulation, independent filter/
envelope per oscillator, VCO2 mod-canvas, any change to VCO1 controls.

### Deferred to Follow-Up Work

- LFO pitch destination currently modulates `osc.detune` only (VCO1). Routing
  LFO pitch to VCO2 as well is a natural follow-up once VCO2 ships.

---

## Implementation Units

### U1. Add VCO2 state params to state.js

**Goal:** Extend `S` with the four VCO2 parameters so all other modules can
read them without circular imports.

**Requirements:** R1

**Dependencies:** none

**Files:**
- Modify: `src/state.js`

**Approach:** Add a `// VCO2` comment block after the `// Noise (VNO)` block,
mirroring that block's style. Four params: `osc2Waveform: 'sawtooth'`,
`osc2Octave: 0`, `osc2Detune: 7`, `osc2Mix: 0`. Default detune of 7¢ gives
an immediately interesting sound once the player turns up mix.

**Patterns to follow:** `src/state.js` — Noise block at lines 23–24.

**Test scenarios:** `Test expectation: none — pure config, no behavioral logic.`

**Verification:** `S.osc2Waveform`, `S.osc2Octave`, `S.osc2Detune`, `S.osc2Mix`
are accessible from any module that imports `S`.

---

### U2. Add VCO2 audio nodes to audio.js

**Goal:** Create the osc2 oscillator and osc2MixGain nodes, connect them into
the signal chain, start osc2 alongside osc and lfoOsc, and update `playNote()`
to set osc2's frequency on each note event. Export `setOsc2Mix()` and
`applyOsc2Octave()` for the controls layer.

**Requirements:** R2, R5

**Dependencies:** U1

**Files:**
- Modify: `src/audio.js`

**Approach:**

*Engine object* — add `osc2: null` and `osc2MixGain: null` to the `engine`
export object alongside the existing noise fields.

*startAudio()* — after the noise nodes are created, create `osc2` as an
`OscillatorNode` and `osc2MixGain` as a `GainNode`. Config:
`osc2.type = S.osc2Waveform`, `osc2.frequency.value = 440`,
`osc2.detune.value = S.osc2Detune`, `osc2MixGain.gain.value = S.osc2Mix`.
Connect: `osc2 → osc2MixGain → ampEnv`. Store both on `engine`. Call
`osc2.start()` alongside the existing `osc.start()`.

*playNote()* — after setting `osc.frequency`, set
`osc2.frequency.setValueAtTime(noteFreq(note, octave + S.osc2Octave), now)`
and `osc2.detune.setValueAtTime(S.osc2Detune, now)`.

*New exports:*

```
setOsc2Mix(v)         — setTargetAtTime on osc2MixGain.gain
applyOsc2Octave()     — if engine.currentNote !== null, recalculate and
                        setTargetAtTime osc2.frequency from
                        noteFreq(engine.currentNote, S.octave + S.osc2Octave)
```

`playNote` already receives `octave` as an argument, but `applyOsc2Octave`
must derive the octave from `S.octave + S.osc2Octave` at call time because
it fires from a live control change, not a note event.

**Patterns to follow:** `src/audio.js` — noise fan-in pattern (lines 46–57,
86–90, 101–102); `setNoiseMix` and `applyNoiseType` exports (lines 135–138).

**Test scenarios:** `Test expectation: none — audio graph wiring is exercised
by browser playback; unit-testable behavior lives in playNote via integration
(covered at verification stage).`

**Verification:** Start audio in browser, hold a note; VCO2 is silent at
mix 0 and audible at mix 0.5. Change waveform and detune while note is held —
audio updates without clicks. Change octave offset while note is held — pitch
shifts cleanly.

---

### U3. Add osc2 stage entry and extend STAGE_IDS

**Goal:** Append The Dissonant as the sixth stage in `STAGES` and add `'osc2'`
to `STAGE_IDS`, making the graduation check data-driven.

**Requirements:** R6, R7

**Dependencies:** U1

**Files:**
- Modify: `src/stages.js`
- Modify: `src/progression.js`
- Test: `src/stages.test.js`
- Test: `src/progression.test.js`

**Approach:** Append the stage object after the existing `'noise'` entry in the
`STAGES` array. STAGE_IDS in `progression.js` gains `'osc2'` as the sixth
element — no other logic changes because graduation and unlock ceiling are
derived from `STAGE_IDS.length`.

Stage object fields (see origin R6 for exact values): `id: 'osc2'`,
`moduleId: 'mod-osc2'`, `era: 'oberheim'`, `instrument: 'Oberheim Two-Voice'`,
`pioneer: 'Tom Oberheim'`, `historyYear: '1975'`, `historyFact` (the OMD /
Gary Numan / Van Halen warmth fact), `intro`, `boss` (name: 'The Dissonant',
maxHp: 100, damagePerHit: 10), `target` predicate.

**Target predicate:**
```
(S, isPlaying) =>
  S.osc2Mix > 0.3 &&
  Math.abs(S.osc2Detune) >= 5 &&
  Math.abs(S.osc2Detune) <= 45 &&
  isPlaying
```

**Patterns to follow:** `src/stages.js` — noise stage entry (appended last).
`src/progression.js` — `STAGE_IDS` array literal.

**Test scenarios:**

`src/stages.test.js`:
- Stage count is now 6 (`toHaveLength(6)`)
- Stage order ends with `'osc2'` at index 5
- `VALID_MODULE_IDS` includes `'mod-osc2'`
- Valid eras set includes `'oberheim'`; Act I stages have `'moog'`, noise has `'arp'`, osc2 has `'oberheim'`
- `osc2 target predicate — pass`: `osc2Mix: 0.4`, `osc2Detune: 10`, `isPlaying: true` → true
- `osc2 target predicate — mix too low`: `osc2Mix: 0.2`, `osc2Detune: 10`, `isPlaying: true` → false
- `osc2 target predicate — detune dead-zone (too small)`: `osc2Mix: 0.4`, `osc2Detune: 3`, `isPlaying: true` → false
- `osc2 target predicate — detune too large`: `osc2Mix: 0.4`, `osc2Detune: 48`, `isPlaying: true` → false
- `osc2 target predicate — negative detune in range`: `osc2Mix: 0.4`, `osc2Detune: -20`, `isPlaying: true` → true
- `osc2 target predicate — not playing`: `osc2Mix: 0.4`, `osc2Detune: 10`, `isPlaying: false` → false

`src/progression.test.js`:
- `STAGE_IDS` has length 6
- `STAGE_IDS[5] === 'osc2'`

**Verification:** Running `npx vitest run src/stages.test.js src/progression.test.js` passes all tests.

---

### U4. Add The Dissonant boss SVG to bossArt.js

**Goal:** Add the `'osc2'` key to `BOSS_SVG` with an illustration of two
overlapping oscillator waveforms locked in destructive phase.

**Requirements:** R9

**Dependencies:** none

**Files:**
- Modify: `src/bossArt.js`

**Approach:** The visual concept: two sine waves drawn as parallel paths, one
slightly phase-shifted so they overlap and visually "cancel" in the center,
representing locked-in sterile unison. A body panel rectangle (dark fill) holds
them. Surround with faint horizontal lines suggesting a frequency-domain
silhouette. Style consistent with existing SVGs: `viewBox="0 0 140 110"`,
`fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`.

Add before or after the `'noise'` entry — order within `BOSS_SVG` is
arbitrary (it's a plain object).

**Patterns to follow:** `src/bossArt.js` — `noise` entry SVG structure.

**Test scenarios:** `Test expectation: none — SVG string content is visual;
no behavioral logic.`

**Verification:** After wiring progressionUI, The Dissonant's SVG renders in
the boss panel when the osc2 stage is active.

---

### U5. Add VCO2 teaching entries to teaching.js

**Goal:** Add five entries to `TEACHINGS` — four for VCO2 controls and one
lore entry for the Oberheim era.

**Requirements:** R10

**Dependencies:** none

**Files:**
- Modify: `src/teaching.js`
- Test: `src/teaching.test.js`

**Approach:** Add a `// VCO2 module entries` block before the lore entries
section, mirroring the noise block pattern. Each entry: `title`, `body`,
`draw: (c) => { setupCanvas(c); }` (no custom canvas draw needed for these
controls — plain canvas background is sufficient).

Entry bodies:
- `osc2-wave` — layering different waveforms creates new timbres (e.g., sine + sawtooth = fundamental + brightness)
- `osc2-oct` — octave offset shifts VCO2 up or down an octave; −1 adds sub-bass weight, +1 adds shimmer
- `osc2-detune` — 5–20¢ creates warm beating (chorus); 30–50¢ creates dramatic pitch beating; 0¢ = sterile unison
- `osc2-mix` — low mix (0.1–0.3) adds subtle thickening; high mix (0.7–1.0) = full dual voice

Add `lore-osc2` after `lore-noise` in the lore section:
```
title: 'Tom Oberheim · Oberheim Two-Voice · 1975'
body: historyFact text from R6
```

**Patterns to follow:** `src/teaching.js` — noise entries (lines 75–85); lore-noise entry.

**Test scenarios:**

`src/teaching.test.js`:
- `LORE_IDS` gains `'lore-osc2'` (length becomes 6)
- `teach('lore-osc2')` does not throw
- `lore-osc2` title includes `'Oberheim'`
- `teach()` does not throw for `osc2-wave`, `osc2-oct`, `osc2-detune`, `osc2-mix`
- `osc2-detune` body text is non-empty (> 20 chars) and written to `#teach-body`

**Verification:** Running `npx vitest run src/teaching.test.js` passes all tests.

---

### U6. Add VCO2 module section to index.html

**Goal:** Insert the `<section id="mod-osc2">` block into the modules row,
after the noise section.

**Requirements:** R3

**Dependencies:** none

**Files:**
- Modify: `index.html`

**Approach:** Insert after the closing `</section>` of `mod-noise`, before
the closing `</div>` of the modules row. Start as `class="module locked"` —
progressionUI controls the locked/unlocked state at runtime.

Section structure:
- Header: `VCO` tag, `Oscillator 2` name, `second voice` subtitle, lore button `data-lore="osc2"`
- Waveform toggle group `#osc2-wave-btns` — 4 buttons with SVG wave icons
  (copy icons from VCO1's `#wave-btns`; default `active` on sawtooth to match
  `S.osc2Waveform` default)
- Octave offset toggle group `#osc2-oct-btns` — 5 buttons: `data-oct="-2"` through
  `data-oct="2"`, labels `−2 / −1 / 0 / +1 / +2`, default active on `0`
- Detune slider `#s-osc2detune`, min=`-50` max=`50` step=`1` value=`7`,
  display `#v-osc2detune`
- Mix slider `#s-osc2mix`, min=`0` max=`1` step=`0.01` value=`0`,
  display `#v-osc2mix`
- `.mod-lock` overlay

**Patterns to follow:** `index.html` — VNO noise section; VCO1 waveform
toggle group (SVG icons).

**Test scenarios:** `Test expectation: none — HTML structure; visual/integration
verified in browser.`

**Verification:** Module section renders with waveform buttons, octave toggles,
detune and mix sliders, and lock overlay.

---

### U7. Wire VCO2 controls in controls.js

**Goal:** Wire all four VCO2 controls — waveform toggle, octave offset toggle,
detune slider, mix slider — into `S`, the audio engine, `bossEngine.notify()`,
and `teach()`.

**Requirements:** R4

**Dependencies:** U1, U2, U6

**Files:**
- Modify: `src/controls.js`

**Approach:** Import `setOsc2Mix` and `applyOsc2Octave` from `audio.js`
alongside the existing noise imports. Add four wiring calls at the end of
`initControls()`:

*Waveform toggle* (`wireToggleGroup('osc2-wave-btns', ...)`):
`S.osc2Waveform = b.dataset.wave`; if `engine.osc2`, set
`engine.osc2.type = S.osc2Waveform`; `teach('osc2-wave')`.

*Octave offset toggle* (`wireToggleGroup('osc2-oct-btns', ...)`):
`S.osc2Octave = Number(b.dataset.oct)`; call `applyOsc2Octave()`;
`teach('osc2-oct')`.

*Detune slider* (`wire('s-osc2detune', ...)`):
`S.osc2Detune = v`; display `v + ' ¢'` in `#v-osc2detune`;
`engine.osc2.detune.setTargetAtTime(v, ctx.currentTime, 0.01)`;
`teach('osc2-detune')`.

*Mix slider* (`wire('s-osc2mix', ...)`):
`S.osc2Mix = v`; display `Math.round(v * 100) + '%'` in `#v-osc2mix`;
`setOsc2Mix(v)`; `teach('osc2-mix')`.

Guard audio calls with `if (engine.osc2)` / `if (engine.ctx)` — engine
may not have started yet when controls fire.

**Patterns to follow:** `src/controls.js` — noise control wiring (lines 139–150).

**Test scenarios:** `Test expectation: none — DOM wiring; behaviors exercised
via browser.`

**Verification:** In browser: turning Mix slider up makes VCO2 audible; Detune
slider produces beating; Waveform toggle changes timbre; Octave offset shifts
VCO2 pitch.

---

### U8. Add Oberheim era CSS and data-layers="6" selectors

**Goal:** Define the `[data-era="oberheim"]` palette and extend all three
`[data-layers]` selector groups to include `data-layers="6"`.

**Requirements:** R8

**Dependencies:** none

**Files:**
- Modify: `src/style.css`

**Approach:**

After the `[data-era="arp"]` block, add:
```css
[data-era="oberheim"] {
  --era-accent: #4a90d0;
  --era-accent-2: #1a4870;
}
```
Steel blue, distinct from Moog amber (`#d4960a`) and ARP orange (`#e07020`).

Extend the three `[data-layers]` groups (unlock-1, unlock-2, unlock-3) to
include `[data-layers="6"]` alongside the existing `[data-layers="5"]`.

Add a new `[data-layers="6"]` color block using the same five CSS vars as
the layer-5 block (`--surface`, `--surface2`, `--border`, plus per-module
color vars). The layer-6 palette can be identical to layer-5 or introduce
subtle warm tones for the Oberheim stage — implementation discretion.

**Patterns to follow:** `src/style.css` — `[data-era="arp"]` block (line 37);
`[data-layers="5"]` block (line 81).

**Test scenarios:** `Test expectation: none — CSS; visual verification in browser.`

**Verification:** After graduation (all six stages beaten), `body.dataset.layers`
is `'6'` and the UI shows the layer-6 palette.

---

### U9. Raise data-layers cap to 6 in progressionUI.js

**Goal:** Update two hardcoded values in `handleRestore()` so the sixth layer
unlocks correctly on graduation.

**Requirements:** R11

**Dependencies:** U8

**Files:**
- Modify: `src/progressionUI.js`

**Approach:** Two targeted changes, mirroring the Act II noise edit:
1. `Math.min(current + 1, 5)` → `Math.min(current + 1, 6)`
2. `document.body.dataset.layers = '5'` → `document.body.dataset.layers = '6'`

No other changes.

**Patterns to follow:** `src/progressionUI.js` — `handleRestore()` function
(lines 188–198); the noise module made the same change (5 cap, graduation '5').

**Test scenarios:** `Test expectation: none — the effect is verifiable only
via full progression integration in browser (graduation banner, CSS layer).`

**Verification:** Resetting progress and defeating all six stages causes
`body.dataset.layers` to reach `'6'` and the graduation banner to appear.

---

### U10. Update all test files for the sixth stage

**Goal:** Bring all four test files up to date with the sixth stage, new
`osc2S` fixture, and VCO2 teaching entries.

**Requirements:** R12

**Dependencies:** U3, U5

**Files:**
- Modify: `src/stages.test.js`
- Modify: `src/progression.test.js`
- Modify: `src/bossEngine.test.js`
- Modify: `src/teaching.test.js`

**Approach:**

`src/stages.test.js`:
- Change `toHaveLength(5)` → `toHaveLength(6)`
- Add `'osc2'` to the stage order array
- Add `'mod-osc2'` to `VALID_MODULE_IDS`
- Add `'oberheim'` to valid eras; add assertion that `stages[5].era === 'oberheim'`
- Add `osc2 target predicate` describe block with 6 scenarios (pass, mix too
  low, detune dead-zone small, detune too large, negative detune in range,
  isPlaying false) matching the test scenarios in U3

`src/progression.test.js`:
- Update `STAGE_IDS` length assertion to 6
- Add `STAGE_IDS[5] === 'osc2'` assertion

`src/bossEngine.test.js`:
- Add `osc2S` fixture: `{ ...defaultS, osc2Mix: 0.5, osc2Detune: 15 }`
  (satisfies target predicate). `defaultS` should gain `osc2Mix: 0` and
  `osc2Detune: 0` to avoid undefined reads in the target function.
- Update graduation describe block: add `drainStage(osc2S)` as the sixth drain
  in all three graduation tests; update description from "all 5 stages" → "all 6 stages"

`src/teaching.test.js`:
- Add `'lore-osc2'` to `LORE_IDS`
- Add assertion: `teach('lore-osc2')` title contains `'Oberheim'`
- Add `osc2 TEACHINGS entries` describe block: no-throw tests for
  `osc2-wave`, `osc2-oct`, `osc2-detune`, `osc2-mix`; content assertion
  that `osc2-detune` body is non-empty

**Patterns to follow:**
- `src/bossEngine.test.js` — `noiseS` fixture and graduation block (added in Act II)
- `src/stages.test.js` — noise target predicate describe block
- `src/teaching.test.js` — noise TEACHINGS entries describe block

**Verification:** `npx vitest run` — all 4 test files green, count increases
by ~10 tests over the Act II baseline (73 → ~83).

---

## System-Wide Impact

The graduation check in `bossEngine.js` reads `STAGE_IDS.length` dynamically,
so no changes are needed there. `unlockNext()` in `progression.js` also uses
`STAGE_IDS.length - 1` as its ceiling, so it self-updates. The stage-intro
banner, boss panel, and module lock/unlock machinery in `progressionUI.js`
are all data-driven from `STAGES` — they handle the new stage automatically.

---

## Risks & Dependencies

**Audio glitch on osc2 start:** OscillatorNodes cannot be restarted after
`.stop()`. Since osc2 is started in `startAudio()` and never stopped
individually, this is not a risk — osc2 runs at `noiseMixGain = 0` (silent)
until unlocked and mixed in.

**playNote frequency update for osc2:** The `octave` argument to `playNote`
is VCO1's octave (from `S.octave`). VCO2's effective octave is
`octave + S.osc2Octave`. The `playNote` signature already receives `octave` —
the implementation just applies the offset for osc2. No API change needed.

**defaultS in bossEngine.test.js lacks osc2 fields:** The target predicate for
the osc2 stage will read `S.osc2Mix` and `S.osc2Detune`. `defaultS` does not
declare these today, so they will be `undefined`, which is falsy — the
predicate will return false for all non-osc2 stages (correct). But explicitly
adding `osc2Mix: 0, osc2Detune: 0` to `defaultS` makes the intent clear and
future-proofs against stricter predicates.

---

## Deferred to Implementation

- Exact SVG path coordinates for The Dissonant illustration (U4)
- Layer-6 CSS color palette choices beyond the two era-accent values (U8)
- Whether `osc2-wave` teaching entry should reuse `drawTeachWave` or stay as
  a plain `setupCanvas` — implementer's call based on canvas visual quality

---

## Sources & Research

Origin requirements document: `docs/brainstorms/2026-06-22-act3-vco2-requirements.md`

No external research required — this plan follows the established Act II noise
module pattern exactly, with only the audio and state specifics differing.
