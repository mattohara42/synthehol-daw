---
date: 2026-06-22
plan: feat-act2-noise-generator
origin: docs/brainstorms/2026-06-22-act2-noise-requirements.md
status: ready
---

# feat: Add Act II noise generator module (VNO)

Add the first Act II stage — a **VNO (Voltage-controlled Noise Oscillator)** module gated by the
"The Static" boss fight. The player sculpts white or pink noise using the already-unlocked filter
and envelope, learning noise as a texture layer alongside pitch. Defeating the boss unlocks the VNO
module permanently and advances the era palette to ARP.

---

## Problem Frame

Act I's four modules are unlocked. Act II must introduce the next synthesis concept — noise — with
the same stage → boss → unlock pattern. The new module shares the existing filter and ADSR signal
chain; the boss fight requires all three to be engaged simultaneously, paying off Act I learning.

---

## Requirements Trace

All 15 requirements from the origin document are addressed:

| Req | Coverage |
|-----|----------|
| R1 VNO module (locked until Act II defeat) | U6 HTML, U8 CSS |
| R2 Type toggle + mix knob | U6 HTML, U7 controls |
| R3 Controls fire teaching panel | U7 controls |
| R4 Mix defaults to 0 | U1 state, U2 audio |
| R5 Boss name "The Static" | U3 stages |
| R6 Target predicate (noiseMix/cutoff/decay/isPlaying) | U3 stages |
| R7 Boss taunt | U3 stages |
| R8 maxHp 100 / damagePerHit 10 | U3 stages |
| R9 pioneer / instrument / historyYear / historyFact | U3 stages |
| R10 Intro text | U3 stages |
| R11 noise-type teaching entry | U5 teaching |
| R12 noise-mix teaching entry | U5 teaching |
| R13 era: 'arp', data-era update | U3 stages, U8 CSS |
| R14 data-layers extends to 5 | U8 CSS, U9 progressionUI |
| R15 Boss SVG — The Static | U4 bossArt |

---

## Key Technical Decisions

**Pink noise via always-in-path lowshelf biquad.** A `BiquadFilterNode` with `type: 'lowshelf'`
and `frequency: 1000` sits permanently in the noise path. When `noiseType === 'white'` its
`gain = 0` (transparent); when `noiseType === 'pink'` its `gain = -6` (rolls off highs, giving
a warmer perceived quality). This is acoustically imprecise but satisfies "fun first, accurate
second" with zero extra nodes. (see origin: R11, deferred pink noise quality question)

**Additive noise blend, not crossfade.** `noiseMixGain.gain` equals `S.noiseMix` directly (0–1).
The oscillator signal always enters `ampEnv` at full level; noise is added on top. At
`noiseMix = 1` the combined signal doubles, which is fine at game volume. Crossfading would muffle
the oscillator as noise increases — undesirable for the "texture layer" teaching goal.

**Noise shares the VCA and VCF.** `noiseSource → pinkFilter → noiseMixGain → ampEnv` joins the
oscillator before the envelope stage. Both signals then pass through `ampEnv → vcf → master`.
Filter and ADSR shaping apply equally to noise and oscillator — the payoff moment for Act I
learning. No separate signal chain needed.

**Always-running noise source.** `noiseSource` (a looping `BufferSourceNode`) starts alongside
`osc` in `startAudio()`. Silence is achieved by `noiseMixGain.gain = 0` (default), not by
stopping/starting the source node. This avoids the complexity of lazily starting a second audio
node and matches how the LFO oscillator is always running.

**White noise buffer size.** A 2-second mono buffer at the context sample rate contains enough
random variation that audible looping artifacts don't appear in practice.

**STAGE_IDS drives graduation automatically.** Adding `'noise'` to the `STAGE_IDS` array in
`progression.js` is the only change needed to extend the graduation check
(`defeated.length === STAGE_IDS.length`). `unlockNext()` already uses `STAGE_IDS.length - 1` as
its ceiling. No changes to `bossEngine.js` are required.

**ARP era accent color.** `[data-era="arp"]` gets `--era-accent: #e07020` (warm orange) and
`--era-accent-2: #7b3a10` (dark complement). This is clearly distinct from Moog's amber-gold
(`#d4960a`). (see origin: R13 outstanding question resolved here)

---

## High-Level Technical Design

New noise path inserted before the VCA:

```
osc ─────────────────────────────────┐
                                      ▼
noiseSource → pinkFilter → noiseMixGain → ampEnv → vcf → master → scope → destination
                                      ▲
lfoOsc → lfoMod ─────────────────────┘ (existing LFO routing unchanged)
```

`pinkFilter` (lowshelf, 1000 Hz) is always in path; `noiseMixGain` gates the contribution.
The `ampEnv` node receives multiple inputs — Web Audio supports fan-in natively.

---

## Implementation Units

### U1. Add noiseType and noiseMix to state

**Goal:** Extend `S` with the two new VNO parameters so all other modules can read them.

**Requirements:** R4

**Dependencies:** none

**Files:**
- Modify: `src/state.js`

**Approach:** Add `noiseType: 'white'` and `noiseMix: 0` to the `S` export object, following the
existing group-by-module comment structure. Insert after the LFO block, before `masterVol`.

**Patterns to follow:** `src/state.js` field ordering and comment style

**Test scenarios:**
- Test expectation: none — these are plain default values with no logic. Coverage comes from unit
  tests in U3 (predicate reads `S.noiseMix`) and U7 (controls write to `S`).

**Verification:** `S.noiseType === 'white'` and `S.noiseMix === 0` on fresh page load.

---

### U2. Noise audio nodes in audio engine

**Goal:** Add the noise source, pink approximation filter, and mix gain node to the Web Audio graph.

**Requirements:** R2, R4 (mix default 0), R13 (noise passes through shared VCF/ADSR)

**Dependencies:** U1

**Files:**
- Modify: `src/audio.js`

**Approach:**
- Add four fields to `engine`: `noiseBuffer`, `noiseSource`, `pinkFilter`, `noiseMixGain`
- In `startAudio()`, after the existing node creation block:
  - Create a 2-second mono `AudioBuffer` filled with `Math.random() * 2 - 1` samples
  - `noiseSource = ctx.createBufferSource()` with `loop = true` and buffer set
  - `pinkFilter = ctx.createBiquadFilter()` with `type: 'lowshelf'`, `frequency.value = 1000`,
    `gain.value = 0` (white by default)
  - `noiseMixGain = ctx.createGain()` with `gain.value = 0` (silent by default)
  - Connect: `noiseSource → pinkFilter → noiseMixGain → ampEnv`
  - Call `noiseSource.start()` alongside the existing `osc.start()`
- Export `applyNoiseType()`: reads `S.noiseType`, ramps `pinkFilter.gain` via `setTargetAtTime`
  to `0` (white) or `-6` (pink)
- Export `setNoiseMix(v)`: ramps `noiseMixGain.gain` via `setTargetAtTime(v, ...ctx.currentTime, 0.01)`

**Patterns to follow:** `startAudio()` node creation sequence; `setTargetAtTime` ramp pattern from
existing filter/LFO controls; `applyLFORouting()` export shape

**Test scenarios:**
- After `startAudio()`, `engine.noiseMixGain.gain.value` is `0` (noise silent at launch)
- `applyNoiseType()` with `S.noiseType = 'pink'` results in `pinkFilter.gain.value` near `-6`
- `applyNoiseType()` with `S.noiseType = 'white'` results in `pinkFilter.gain.value` near `0`
- `setNoiseMix(0.5)` results in `noiseMixGain.gain.value` near `0.5`
- Integration: with `noiseMix > 0` and a note held, noise is audible through the filter sweep
  (verified in browser)

**Verification:** Play a note with `noiseMix = 0.5` — noise is audible and responds to filter
cutoff and ADSR changes. Toggling white/pink changes the spectral character (brighter vs warmer).

---

### U3. Act II stage entry and STAGE_IDS extension

**Goal:** Add the noise boss stage to the STAGES array and extend STAGE_IDS so graduation
requires 5 defeats.

**Requirements:** R5–R10, R13

**Dependencies:** U1

**Files:**
- Modify: `src/stages.js`
- Modify: `src/progression.js`
- Test: `src/stages.test.js`
- Test: `src/progression.test.js`

**Approach:**
- In `src/progression.js`: append `'noise'` to `STAGE_IDS`. No other changes — `unlockNext()` and
  the graduation check are already data-driven.
- In `src/stages.js`: append a new stage object to `STAGES`:
  - `id: 'noise'`, `moduleId: 'mod-noise'`, `era: 'arp'`
  - `instrument: 'ARP 2600'`, `pioneer: 'Alan R. Pearlman'`, `historyYear: '1971'`
  - `historyFact`: the R2-D2/Ben Burtt fact from R9
  - `intro`: "Noise is raw, unformed sound. Filter it and shape it in time — and it becomes anything."
  - `boss.name: 'The Static'`, `boss.taunt`: from R7, `boss.maxHp: 100`, `boss.damagePerHit: 10`
  - `target`: `(S, isPlaying) => S.noiseMix > 0.2 && S.cutoff < 5000 && S.decay < 0.2 && isPlaying`

**Patterns to follow:** existing stage entries in `src/stages.js`; STAGE_IDS array in
`src/progression.js`

**Test scenarios:**
- `STAGE_IDS.length === 5`
- `STAGE_IDS[4] === 'noise'`
- `STAGES[4].id === 'noise'`
- `STAGES[4].moduleId === 'mod-noise'`
- `STAGES[4].boss.maxHp === 100` and `STAGES[4].boss.damagePerHit === 10`
- Target predicate returns `true` when `noiseMix = 0.3, cutoff = 4000, decay = 0.1, isPlaying = true`
- Target predicate returns `false` when `noiseMix = 0.1` (below threshold)
- Target predicate returns `false` when `cutoff = 6000` (too bright)
- Target predicate returns `false` when `decay = 0.3` (too long)
- Target predicate returns `false` when `isPlaying = false`
- `progression.unlockNext()` from index 3 advances to index 4

**Verification:** Boss fight triggers on noise stage; defeating it advances past index 4; all
5 defeats trigger graduation.

---

### U4. Boss SVG — The Static

**Goal:** Add The Static's rack-unit face illustration to `BOSS_SVG`.

**Requirements:** R15

**Dependencies:** none (parallel with U3)

**Files:**
- Modify: `src/bossArt.js`

**Approach:** Add a `noise` key to `BOSS_SVG`. Visual motif per R15:
- Dense dot-pattern eyes (stipple grid of small `<circle>` elements inside rounded-rect irises)
- Erratic mouth: series of vertical lines of varying height drawn as short `<line>` or `<polyline>`
  elements suggesting static waveform
- Noise-cloud halo: scattered small circles around the head border suggesting signal spray
- Body panel and screws following the same `<rect>` outer frame convention as other bosses
- `viewBox="0 0 140 110"`, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`

**Patterns to follow:** existing `osc`, `filter`, `envelope`, `lfo` entries in `src/bossArt.js`

**Test scenarios:**
- `BOSS_SVG['noise']` is a non-empty string
- String contains `viewBox`
- String contains `currentColor`
- Visual correctness verified in browser during battle

**Verification:** The Static's SVG renders in the boss panel during the noise stage fight; glitch
animation (`--gi`) affects it; `.boss-svg-restored` fades it post-defeat.

---

### U5. Teaching entries for noise controls and lore

**Goal:** Add `noise-type`, `noise-mix`, and `lore-noise` entries to `TEACHINGS`.

**Requirements:** R9, R11, R12

**Dependencies:** U1

**Files:**
- Modify: `src/teaching.js`

**Approach:** Insert three entries after the lore block (before the closing `}`):

- `'noise-type'`: title "White vs Pink Noise", body explains the spectral difference —
  white noise has equal energy at every frequency (bright, TV static); pink noise rolls off
  at −3dB/octave (warmer, rain on a roof). Draw function can call `setupCanvas(c)` (blank,
  no data to visualize).
- `'noise-mix'`: title "Noise Mix", body explains blending — low mix (0.1–0.2) adds breathiness
  to a pitched tone; high mix (0.7–1.0) makes noise dominant; the blend point shows noise and
  pitch coexist. Draw function calls `setupCanvas(c)`.
- `'lore-noise'`: title "Alan R. Pearlman · ARP 2600 · 1971", body includes the Ben Burtt / R2-D2
  fact from R9. Draw function calls `setupCanvas(c)`.

**Patterns to follow:** existing lore entries (`lore-osc` etc.) in `src/teaching.js`

**Test scenarios:**
- `teach('noise-type')` does not throw
- `teach('noise-type')` writes non-empty title and body (body length > 20)
- `teach('noise-mix')` does not throw
- `teach('noise-mix')` writes non-empty title and body (body length > 20)
- `teach('lore-noise')` does not throw
- `teach('lore-noise')` title contains `'Pearlman'`
- `teach('lore-noise')` body length > 20

**Verification:** Touching noise type toggle and mix slider each update the teaching panel with
correct content; clicking the VNO ⓘ button shows Pearlman / ARP 2600 / R2-D2 lore.

---

### U6. VNO module HTML section

**Goal:** Add the VNO module section to `index.html`, locked by default, with the type toggle,
mix slider, and lore button.

**Requirements:** R1, R2, R3

**Dependencies:** U3 (needs `mod-noise` module id to exist in STAGES before progression logic runs)

**Files:**
- Modify: `index.html`

**Approach:** Insert a new `<section id="mod-noise" class="module locked">` after the LFO module
section. Structure mirrors the existing module sections:

```
module header:
  <h3>VNO — Noise</h3>
  <button class="lore-btn" data-lore="noise" aria-label="Noise history">ⓘ</button>

noise type toggle group (id="noise-type-btns"):
  button data-ntype="white" class="tog-btn active" — "White"
  button data-ntype="pink" class="tog-btn" — "Pink"

mix knob row:
  label "Mix"
  input#s-noisemix type="range" min="0" max="1" step="0.01" value="0"
  span#v-noisemix "0%"
```

**Patterns to follow:** existing module sections in `index.html`; `.lore-btn` pattern from R9;
`.tog-btn` / toggle group pattern from wave-btns and ftype-btns

**Test scenarios:**
- Test expectation: none — structural HTML. Verified in browser: module is visible and locked
  before Act II; toggle and slider render correctly.

**Verification:** VNO section renders in the modules row; `mod-noise` has class `locked` initially;
lore button is clickable (pointer-events override from existing `.lore-btn` CSS).

---

### U7. Controls wiring for VNO

**Goal:** Wire the noise type toggle and mix slider to state, audio engine, and teaching panel.

**Requirements:** R2, R3

**Dependencies:** U1, U2, U6

**Files:**
- Modify: `src/controls.js`

**Approach:**
- Add `applyNoiseType, setNoiseMix` to the import from `./audio.js`
- In `initControls()`, add two wires after the LFO block:
  - `wireToggleGroup('noise-type-btns', b => { S.noiseType = b.dataset.ntype; applyNoiseType(); teach('noise-type'); })`
  - `wire('s-noisemix', v => { S.noiseMix = v; document.getElementById('v-noisemix').textContent = Math.round(v*100)+'%'; setNoiseMix(v); teach('noise-mix'); })`
- Both routes call `bossEngine.notify()` automatically via `wire` / `wireToggleGroup` internals

**Patterns to follow:** `wireToggleGroup('ftype-btns', ...)` for the toggle; `wire('s-cutoff', ...)` for the slider with display update; LFO import additions for audio exports

**Test scenarios:**
- Clicking 'pink' toggle button sets `S.noiseType === 'pink'` and calls `applyNoiseType()`
- Clicking 'white' toggle button sets `S.noiseType === 'white'`
- Setting mix slider to 0.5 sets `S.noiseMix === 0.5` and the `#v-noisemix` span shows "50%"
- Both controls fire `bossEngine.notify()` (inherited from wire/wireToggleGroup)
- Integration: moving mix slider while holding a note updates noise level in real time (browser)

**Verification:** Mix slider moves noise level audibly; type toggle changes spectral character;
teaching panel updates on every interaction; boss HP drains when all three target conditions met.

---

### U8. CSS — ARP era accent and data-layers 5

**Goal:** Add the ARP era color palette and extend visual unlock selectors to cover layer 5.

**Requirements:** R13, R14

**Dependencies:** none (parallel with other units)

**Files:**
- Modify: `src/style.css`

**Approach:**
- In the era palettes section, add after `[data-era="moog"]`:
  ```css
  [data-era="arp"] {
    --era-accent: #e07020;
    --era-accent-2: #7b3a10;
  }
  ```
- Extend each existing `[data-layers]` selector group to include `[data-layers="5"]`:
  - Panel chrome group: add `[data-layers="5"]`
  - Module accent stripe group: add `[data-layers="5"]`
  - Engraved label group: add `[data-layers="5"]`
- No new visual behavior needed at layer 5 beyond what layer 4 already provides (R14 specifies
  minimum viable is a clean state)

**Patterns to follow:** `[data-era="moog"]` block; existing `[data-layers]` selector groups

**Test scenarios:**
- Test expectation: none — pure CSS. Visual: era accent changes to orange when ARP battle begins;
  layer-5 state retains all layer-4 visual treatments.

**Verification:** At Act II battle start, `data-era="arp"` on body causes UI chrome to shift from
amber-gold to warm orange; after final graduation, `data-layers="5"` keeps all visual polish active.

---

### U9. Progression UI — raise data-layers cap to 5

**Goal:** Update `handleRestore()` so defeating the 5th boss yields `data-layers="5"` and
graduation sets the correct value.

**Requirements:** R14

**Dependencies:** U3

**Files:**
- Modify: `src/progressionUI.js`

**Approach:** Two targeted changes in `handleRestore()`:
1. Change `Math.min(current + 1, 4)` → `Math.min(current + 1, 5)`
2. Change `document.body.dataset.layers = '4'` (graduation line) → `'5'`

**Patterns to follow:** existing `handleRestore()` implementation

**Test scenarios:**
- After defeating the 5th (noise) boss, `document.body.dataset.layers` becomes `'5'`
- After graduation (all 5 defeated), `document.body.dataset.layers` is `'5'` not `'4'`
- Defeating earlier bosses (1-4) still yields `data-layers` 1–4 respectively (no regression)

**Verification:** Defeating The Static sets `data-layers="5"` in the DOM; graduation banner
appears; layer-5 visual treatments (from U8 CSS) are active.

---

### U10. Teaching tests for noise entries

**Goal:** Extend `src/teaching.test.js` to cover the three new teaching entries from U5.

**Requirements:** R11, R12 (verify teaching content meets spec)

**Dependencies:** U5

**Files:**
- Modify: `src/teaching.test.js`

**Approach:**
- Add `'noise-type'` and `'noise-mix'` to a new `NOISE_IDS` array (separate from `LORE_IDS`
  since they have different assertions)
- Add `'lore-noise'` to the existing `LORE_IDS` array so it participates in the existing
  no-throw / non-empty title / non-empty body tests
- Add a new test: `teach('lore-noise')` title contains `'Pearlman'`
- Add assertions: `teach('noise-type')` body length > 20; `teach('noise-mix')` body length > 20

**Patterns to follow:** existing test structure in `src/teaching.test.js` (vi.mock, document stub,
teach import)

**Test scenarios (these are the tests):**
- `teach('noise-type')` does not throw
- `teach('noise-type')` writes non-empty title (length > 0)
- `teach('noise-type')` writes non-empty body (length > 20)
- `teach('noise-mix')` does not throw
- `teach('noise-mix')` writes non-empty title (length > 0)
- `teach('noise-mix')` writes non-empty body (length > 20)
- `teach('lore-noise')` does not throw
- `teach('lore-noise')` title contains `'Pearlman'`
- `teach('lore-noise')` body length > 20

**Verification:** `npx vitest run src/teaching.test.js` passes; test count increases by ~9.

---

## Scope Boundaries

### In scope
- White noise source (AudioBuffer + BufferSourceNode)
- Pink noise approximation via single BiquadFilterNode lowshelf
- Noise mix knob (additive blend with oscillator, 0–1)
- Boss fight requiring noise + filtered cutoff + short decay simultaneously
- ARP era accent color
- data-layers extending to 5

### Deferred to Follow-Up Work
- True pink noise accuracy (Voss-McCartney algorithm, IIR approximation) — good-enough approximation ships here
- `data-layers="5"` graduation visual flourish beyond clean state — minimum viable ships here
- Noise-only mode (muting oscillator entirely) — out of scope per brainstorm

### Outside this scope
- Noise as LFO source (S&H effects) — Act III+ territory
- Additional noise colors (brown, blue, violet)
- Boss fight distinguishing white vs pink noise type — type is purely exploratory

---

## Deferred to Implementation

- Exact SVG path data for The Static (U4) — determined at implementation time; the motif
  (dot-eyes, jagged mouth, spray halo) is specified
- Exact `setTargetAtTime` time constant for pink filter gain ramp — match existing 0.01s constant
  unless it sounds abrupt
- Whether `v-noisemix` display format ("50%" vs "0.50") — match the closest existing control
  (suggest percentage like `s-sus`)

---

## Open Questions

None blocking. The one outstanding question from the brainstorm (ARP era accent hue) is resolved
in Key Technical Decisions above.

---

## Sources & Research

Origin document: `docs/brainstorms/2026-06-22-act2-noise-requirements.md`

No external research conducted — local patterns (existing stage entries, controls wiring, boss SVG
convention, teaching entry format) are sufficient and well-established across 4 prior modules.
