---
date: 2026-06-25
title: "feat: Act IV — Tape Effects (Delay + Reverb)"
type: feat
status: shipped-adapted
---

> **As shipped on `master` (2026-07-07).** This plan originated on the
> `archive/documents-act2-3-4` branch (PR #17), an early divergent lineage of
> the project that shares no git history with `master`. Its *design* — two dub
> boss stages, "The Repeater" (delay, King Tubby) and "The Void" (reverb, Lee
> "Scratch" Perry) — shipped into `master`, but the *implementation* below was
> written against that older codebase and differs from what actually landed.
> The delta, for anyone reading this as the record of what's in the code:
>
> - **The audio was already there.** `master` had long since shipped delay and
>   reverb as free-play FX controls (F-tier) with params `delayTime`,
>   `delayFeedback`, `delayMix`, `reverbMix`. Act IV added *boss stages around
>   the existing effects*, not the audio nodes/params/`fxBus`/signal-chain
>   refactor this plan describes (R2–R4, KTD1–KTD3, most of the Implementation
>   Phases). Those requirements were effectively pre-satisfied.
> - **One merged FX module, not two.** `master` keeps drive/delay/reverb/chorus
>   in a single `mod-fx` rack, so both stages point at `moduleId: 'mod-fx'`
>   (not the separate `mod-delay`/`mod-reverb` of R8/R10). `progressionUI.js`'s
>   `renderLocks()` was extended to group stages by module so the shared rack
>   unlocks when its *earliest* stage is reached. No new module HTML/mini-canvas
>   was added.
> - **No `reverbDecay`.** This engine's reverb is a fixed impulse with only a
>   wet/dry `reverbMix`, so the reverb boss target keys on `reverbMix > 0.4`
>   alone (R3/KTD2/KTD5's decay control doesn't exist here).
> - **`era: 'kingston'` is metadata only.** Stage `era` doesn't drive a
>   `[data-era]` CSS palette on `master` (the buchla/roland challenge eras have
>   no CSS block either), so R12/R13's Kingston era CSS + `data-layers` cap
>   raise were unnecessary.
> - **Teaching already covered it.** `lore-fx` already credits King Tubby and
>   Lee Perry, and `fx-delay`/`fx-reverb` control-teaching entries exist, so
>   R11 needed nothing new.
> - **Stages sit before the Mimic capstone** (not "extend the ladder from 6 to
>   8"): `STAGE_IDS` is now `…osc2, delay, reverb, mimic` (nine). A pre-Act-IV
>   save re-engages the returning player on the two new stages crash-safely.
>
> Net new code on `master`: two `STAGES` entries (`stages.js`), two boss SVGs
> (`bossArt.js`), the `renderLocks()` group-by-module fix, and tests. The
> original plan is preserved below as the design's provenance.

# feat: Act IV — Tape Effects (Delay + Reverb)

## Summary

Add two new progression stages — tape delay and spring reverb — extending the ladder from 6 to 8 stages. Both are rooted in Jamaican dub studio history: King Tubby's invention of real-time echo manipulation (delay stage) and Lee "Scratch" Perry's Black Ark spring reverb (reverb stage). Each follows the existing one-stage-one-concept-one-boss pattern: new audio nodes, new state params, a new module section in the UI, a boss SVG, teaching entries, a mini-canvas visualization, and era-specific CSS. The two bosses are "The Repeater" (corrupted tape echo machine) and "The Void" (corrupted spring reverb tank).

---

## Problem Frame

Synthehol currently ends at VCO2 (stage 6). The original roadmap places polyphony and sequencer next, but effects are a natural and historically rich bridge — dub producers invented the idea of using effects as a compositional instrument, which is the same pedagogical claim Synthehol is making about every module. Delay and reverb also have clear, immediate ear-candy payoff: a learner hears the echo or the wash within seconds of touching the control, making them strong motivating modules. The two stages add depth without requiring any new input paradigm (no polyphony, no MIDI). Note: by inserting delay and reverb as stages 7–8, this plan moves polyphony and sequencer forward to Act V+.

---

## Requirements

- R1. Two new stages added to `STAGE_IDS`: `'delay'` and `'reverb'`, in that order after `'osc2'`.
- R2. Delay stage: new state params `delayTime` (0.05–1.0s), `delayFeedback` (0–0.8), `delayMix` (0–1). Audio implemented via `DelayNode` + feedback `GainNode` + wet `GainNode`.
- R3. Reverb stage: new state params `reverbDecay` (0.1–4s), `reverbMix` (0–1). Audio implemented via `ConvolverNode` with a synthetically generated exponential-decay impulse response. Regenerated when `reverbDecay` changes.
- R4. Signal chain extended: `master → fxBus → scope → destination`, where `fxBus` mixes the dry signal with delay and reverb wet signals in parallel.
- R5. Each stage follows the existing boss pattern: `target(S, isPlaying)` predicate, `maxHp`, `damagePerHit`, `tauntPhases`, `onActivate` where needed.
- R6. Each stage has `historyYear`, `historyFact`, `pioneer`, `instrument` matching the dub era.
- R7. Two new boss SVGs in `bossArt.js`: "The Repeater" (tape spools, unraveling tape, echo waves) and "The Void" (spring coils, expanding reverb rings).
- R8. Two new module HTML sections in `index.html` matching the existing module structure (`mod-delay`, `mod-reverb`).
- R9. Controls wired in `controls.js` following the existing `wire()` / `wireToggleGroup()` pattern; each control calls `drawModCanvas` and `teach`.
- R10. Mini-canvas for each module: delay shows a waveform echo (fading repeated copies), reverb shows a density/decay envelope.
- R11. Teaching entries for each control in `teaching.js`.
- R12. One new era CSS block: `[data-era="kingston"]`, covering both `data-layers="7"` (delay) and `data-layers="8"` (reverb) with a unified Kingston/dub studio palette. Distinct from Moog amber, ARP orange, and Oberheim blue. (See KTD6 — a single era name covers both stages.)
- R13. `progressionUI.js` data-layers cap raised from 6 to 8.
- R14. All existing tests continue to pass; new test coverage added to `stages.test.js` and `bossEngine.test.js`.

---

## Key Technical Decisions

**KTD1 — Serial inserts with complementary dry-cut.**
Effects are implemented as serial inserts with wet/dry mix controls rather than aux-send architecture. The `fxBus` node acts as the effects chain head. Each wet send (`delayMix`, `reverbMix`) is paired with a complementary dry-cut gain (`1 - mix`) so that as the wet level rises, the dry level falls — total output volume stays constant and the learner hears a true crossfade from dry to wet, matching the teaching copy's "100% wet = pure echo, no direct signal" claim. Without the dry-cut, the topology is additive (louder at high mix values), which is confusing and acoustically wrong.

**KTD2 — Synthetic impulse response generation; decay updates on slider release only.**
The `ConvolverNode` requires an `AudioBuffer` IR. We generate it procedurally: white-noise buffer multiplied by an exponential decay envelope shaped by `S.reverbDecay`. This avoids external assets and respects the project's no-import philosophy. Replacing `convolver.buffer` mid-playback causes an audible click/dropout on all major Web Audio engines. To avoid this, the `s-reverbdecay` slider is wired to the `change` event (fires on release) rather than `input` (fires continuously during drag). This makes reverb decay a "set before playing" parameter — musically natural, since learners adjust decay, stop playing to hear the new room size, then play again. The `setReverbDecay` setter also clamps its input: `v = Math.max(0.1, Math.min(4.0, v))` before calling `generateReverbIR`, preventing a `DOMException` from a zero-length buffer.

**KTD3 — Delay feedback loop stays below 0.8.**
The `delayFeedback` GainNode re-routes the delay output back into the delay input. The UI cap of 0.8 prevents runaway infinite feedback. The state param is clamped before setting the gain value.

**KTD4 — Delay boss target: rhythmic range + feedback.**
The delay stage teaches timing-based echo. The boss predicate fires when `delayMix > 0.2 && delayTime >= 0.2 && delayTime <= 0.6 && delayFeedback > 0.25 && isPlaying` — rewarding a musically interesting, audible delay rather than extreme or inaudible settings.

**KTD5 — Reverb boss target: wet + long decay.**
The reverb stage teaches spatial ambience. The boss predicate fires when `reverbMix > 0.3 && reverbDecay > 1.2 && isPlaying` — rewarding a genuinely room-filling reverb sound.

**KTD6 — Era name `'kingston'` covers both delay and reverb stages.**
A single era name for both stages (rather than two distinct era names) keeps the CSS simpler and reflects that both effects come from the same Kingston/Jamaican studio context. The palette uses deep reggae greens and golds — distinct from Moog amber, ARP orange, and Oberheim blue.

---

## High-Level Technical Design

### Signal chain extension

```
Current:
  (osc, noise, osc2) → ampEnv → vcf → master → scope → destination

After:
  (osc, noise, osc2) → ampEnv → vcf → master → fxBus → scope → destination
                                                    ↓
                                             delayWetSend
                                                    ↓
                                             delayNode ←── delayFeedbackGain ↩
                                                    ↓
                                             delayReturn → fxBus output mix
                                             
                                             reverbWetSend → convolver → reverbReturn → fxBus output mix
```

`fxBus` is a `GainNode` (gain=1) that accepts the dry signal from `master`. A `delayWetSend` GainNode (gain = `delayMix`) taps from `fxBus` and feeds the `DelayNode`. The delay output connects back through `delayFeedbackGain` (gain = `delayFeedback`) to form the feedback loop, and also connects via a separate `delayReturn` GainNode to the final `scope` node. Similarly, `reverbWetSend` (gain = `reverbMix`) taps from `fxBus`, feeds the `ConvolverNode`, and connects via `reverbReturn` to `scope`. The dry signal passes directly from `fxBus` to `scope`.

### State params added

| param | type | range | default |
|---|---|---|---|
| `delayTime` | number | 0.05–1.0 s | 0.05 |
| `delayFeedback` | number | 0–0.8 | 0.3 |
| `delayMix` | number | 0–1 | 0 |
| `reverbDecay` | number | 0.1–4.0 s | 1.5 |
| `reverbMix` | number | 0–1 | 0 |

### Stage summary

| # | ID | Boss name | Pioneer | Instrument | Target predicate |
|---|---|---|---|---|---|
| 7 | delay | The Repeater | Osbourne Ruddock (King Tubby) | King Tubby's Hi-Fi / Roland Space Echo RE-201 | delayMix > 0.2 && delayTime 0.2–0.6s && delayFeedback > 0.25 |
| 8 | reverb | The Void | Lee "Scratch" Perry | EMT 140 / Black Ark spring reverb | reverbMix > 0.3 && reverbDecay > 1.2s && isPlaying |

---

## Scope Boundaries

### In scope
- Two new stages: delay and reverb
- New audio nodes (DelayNode, ConvolverNode, feedback loop)
- New state params, controls, HTML module sections
- Two new boss SVGs
- New teaching entries and mini-canvases
- Kingston era CSS palette (data-layers 7 and 8)
- Test coverage for new stages and updated bossEngine tests

### Deferred to Follow-Up Work
- Chorus / flanger / phaser effects (modulation effects family)
- Distortion / saturation (would need clipping node)
- Stereo panning / width control
- LFO routing to delay time (tape wow/flutter effect)
- Convolver with real IR audio files (sample import)

### Outside scope
- Polyphony, sequencer, MIDI (previously roadmapped as Act III/IV; this plan inserts delay and reverb as stages 7–8, pushing polyphony and sequencer to Act V+)
- Any changes to the existing 6 stages

---

## Implementation Units

### U1. Add delay and reverb params to state.js

**Goal:** Add the five new effect params to the `S` singleton.

**Requirements:** R2, R3

**Dependencies:** none

**Files:**
- `src/state.js` (modify)

**Approach:** Add `delayTime: 0.05`, `delayFeedback: 0.3`, `delayMix: 0`, `reverbDecay: 1.5`, `reverbMix: 0` to the `S` object in the appropriate grouping (after `osc2Mix`). `delayTime` defaults to `0.05s` (below the boss's valid range of 0.2–0.6s) so the player must actively move the slider to defeat the boss.

**Patterns to follow:** `src/state.js` existing param structure — flat object, sensible defaults, no imports.

**Test scenarios:**
- Test expectation: none — pure data, no behavioral logic.

**Verification:** `S.delayTime`, `S.delayFeedback`, `S.delayMix`, `S.reverbDecay`, `S.reverbMix` all present with correct defaults when the module is imported.

---

### U2. Add delay and reverb audio nodes to audio.js

**Goal:** Extend the signal chain with a parallel-send FX bus carrying delay and reverb wet paths.

**Requirements:** R2, R3, R4

**Dependencies:** U1

**Files:**
- `src/audio.js` (modify)

**Approach:**
Add to `engine`: `fxBus`, `dryGain`, `delayWetSend`, `delayNode`, `delayFeedbackGain`, `delayReturn`, `reverbWetSend`, `convolver`, `reverbReturn`.

In `startAudio()`:
1. Create the nodes.
2. Wire: Remove the existing `master.connect(scope)` call (do not supplement — Web Audio `connect()` is additive; the old connection must be replaced, not bypassed, or `master` fans out to both `fxBus` and `scope`, doubling the dry signal). Call `master.connect(fxBus)`. Dry path: `fxBus → dryGain → scope` where `dryGain.gain.value = 1 - S.delayMix - S.reverbMix` (clamped ≥ 0). Wet paths: `fxBus → delayWetSend → delayNode`; `delayNode → delayFeedbackGain → delayNode` (feedback loop); `delayNode → delayReturn → scope`. `fxBus → reverbWetSend → convolver → reverbReturn → scope`.
3. Set initial values: `delayNode.delayTime.value = S.delayTime`, `delayFeedbackGain.gain.value = S.delayFeedback`, `delayWetSend.gain.value = S.delayMix`, `reverbWetSend.gain.value = S.reverbMix`, `dryGain.gain.value = 1 - S.delayMix - S.reverbMix`.
4. Generate initial IR: call a helper `generateReverbIR(ctx, S.reverbDecay)` that returns an `AudioBuffer` of exponential white-noise decay and sets it on `convolver.buffer`.

Export control functions: `setDelayTime(v)`, `setDelayFeedback(v)`, `setDelayMix(v)`, `setReverbDecay(v)` (generates new IR — see KTD2), `setReverbMix(v)`.

`setDelayMix(v)` and `setReverbMix(v)` must also update `dryGain.gain` using `setTargetAtTime` to maintain the complement: `dryGain.gain = clamp(1 - S.delayMix - S.reverbMix, 0, 1)`.

`setReverbDecay(v)`: clamp `v = Math.max(0.1, Math.min(4.0, v))`, then call `generateReverbIR` and set `convolver.buffer`.

`generateReverbIR(ctx, decaySeconds)` — creates a mono buffer of length `ctx.sampleRate * decaySeconds`, fills with `Math.random() * 2 - 1`, multiplies each sample by `Math.exp(-3 * i / totalSamples)`. Returns the buffer.

**Patterns to follow:** `setNoiseMix`, `applyNoiseType`, `setOsc2Mix` in `src/audio.js` for the setter pattern; existing signal chain connection style.

**Test scenarios:**
- Test expectation: none — runtime audio nodes, not unit-testable in Vitest's JSDOM context (no AudioContext).

**Verification:** With the dev server running, adjusting delay mix and playing a note produces a repeating echo. Adjusting reverb mix produces spatial wash. No console errors on `startAudio()`.

---

### U3. Add delay and reverb stage entries to stages.js

**Goal:** Add two new stage objects to `STAGES` and extend `STAGE_IDS`.

**Requirements:** R1, R4, R5, R6

**Dependencies:** U1

**Files:**
- `src/stages.js` (modify)
- `src/progression.js` (modify — extend `STAGE_IDS`)
- `src/stages.test.js` (modify)

**Approach:**
Append to `STAGES` array (after `osc2` entry):

```
{
  id: 'delay',
  moduleId: 'mod-delay',
  era: 'kingston',
  instrument: 'Roland Space Echo RE-201',
  pioneer: 'Osbourne Ruddock (King Tubby)',
  historyYear: '1974',
  historyFact: 'King Tubby built custom mixing boards at his home studio in Kingston, Jamaica, routing echo and reverb sends live during playback — the first person to treat the mixing desk itself as a musical instrument, creating "version" tracks that transformed Jamaican music.',
  intro: 'Echo is time made audible. Set the delay and let it repeat.',
  boss: {
    name: 'The Repeater',
    corruptedOf: 'Roland Space Echo RE-201',
    taunt: 'Every echo of yours fades into nothing.',
    maxHp: 100,
    damagePerHit: 10,
    tauntPhases: [
      { threshold: 75, text: 'Your signal decays before it reaches me.' },
      { threshold: 40, text: 'I feel the rhythm... but it won\'t last.' },
      { threshold: 10, text: 'The echo is taking over. You\'re almost there.' },
    ],
  },
  target(S, isPlaying) {
    return isPlaying && S.delayMix > 0.2 && S.delayTime >= 0.2 && S.delayTime <= 0.6 && S.delayFeedback > 0.25;
  },
}
```

Similarly for `'reverb'`:
```
{
  id: 'reverb',
  moduleId: 'mod-reverb',
  era: 'kingston',
  instrument: 'EMT 140 Plate Reverb / Black Ark Spring Reverb',
  pioneer: 'Lee "Scratch" Perry',
  historyYear: '1974',
  historyFact: 'Lee Perry opened the Black Ark studio in his backyard in Washington Gardens, Kingston, in 1974. He described his spring reverb as a living thing, burying master tapes in the garden and recording insects — treating the studio as an instrument as much as anything played inside it.',
  intro: 'Reverb is space made audible. Open the room and let it breathe.',
  boss: {
    name: 'The Void',
    corruptedOf: 'EMT 140 Plate Reverb',
    taunt: 'Your sound dies the moment it leaves you.',
    maxHp: 100,
    damagePerHit: 10,
    tauntPhases: [
      { threshold: 75, text: 'I hear no room around your sound.' },
      { threshold: 40, text: 'The walls are starting to answer you back.' },
      { threshold: 10, text: 'The space is infinite now. I\'m dissolving.' },
    ],
  },
  target(S, isPlaying) {
    return isPlaying && S.reverbMix > 0.3 && S.reverbDecay > 1.2;
  },
}
```

Add `'delay'` and `'reverb'` to `STAGE_IDS` in `src/progression.js`.

**Patterns to follow:** Existing stage entries in `src/stages.js`; `_oscUsed` pattern for stateful targets (delay/reverb targets are stateless so no `onActivate` needed).

**Test scenarios:**
- `STAGES` has length 8.
- Stage order: `['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2', 'delay', 'reverb']`.
- Both new stages have all required fields (`id`, `moduleId`, `era`, `instrument`, `pioneer`, `historyYear`, `historyFact`, `intro`, `boss`, `target`).
- Both new bosses have all required boss fields and `tauntPhases` of length 3 with thresholds 75/40/10.
- `era` for both new stages is `'kingston'`.
- `historyYear` matches `/^\d{4}$/` for both.
- Delay `target`: returns true when `delayMix > 0.2 && delayTime ∈ [0.2, 0.6] && delayFeedback > 0.25 && isPlaying`; false outside those ranges; false when not playing.
- Reverb `target`: returns true when `reverbMix > 0.3 && reverbDecay > 1.2 && isPlaying`; false at boundary values; false when not playing.
- `VALID_MODULE_IDS` in `stages.test.js` updated to include `'mod-delay'` and `'mod-reverb'`.
- `VALID_ERAS` updated to include `'kingston'`.

**Verification:** All `stages.test.js` tests pass including new ones for the delay and reverb target predicates.

---

### U4. Add boss SVGs for The Repeater and The Void to bossArt.js

**Goal:** Provide SVG artwork for the two new bosses.

**Requirements:** R7

**Dependencies:** none (can be developed in parallel with U3)

**Files:**
- `src/bossArt.js` (modify)

**Approach:**
Add two new keys to the `BOSS_SVG` object, keyed by **stage ID** (matching the `BOSS_SVG[stage.id]` lookup in `progressionUI.js` line 127):

- `'delay'`: A corrupted tape echo machine ("The Repeater"). Visual elements: two visible reel hubs (concentric circles), unraveling tape loops escaping the housing, concentric arcs suggesting echo waves emanating outward, mechanical housing with knobs/sliders. Colors: aged rust orange, copper, dark chrome.

- `'reverb'`: A corrupted spring reverb tank ("The Void"). Visual elements: a rectangular housing, visible spring coils inside (zigzag line), expanding ring echoes emanating from both ends, cracks in the housing. Colors: deep teal-green, dark silver, void-black.

Both SVGs use the existing `viewBox="0 0 200 160"` convention and the glitch animation classes (`boss-svg-active`, `boss-svg-restored`) already defined in CSS.

**Patterns to follow:** Existing entries in `BOSS_SVG` in `src/bossArt.js` — inline SVG strings, no external assets, CSS class hooks for glitch animation.

**Test scenarios:**
- Test expectation: none — SVG strings are visual content, not behavioral logic.

**Verification:** Advancing to stage 7 in the app displays The Repeater SVG in the boss panel; stage 8 displays The Void.

---

### U5. Add delay teaching entries to teaching.js

**Goal:** Teaching panel entries for delay time, feedback, and mix controls, plus the lore entry.

**Requirements:** R11

**Dependencies:** U1

**Files:**
- `src/teaching.js` (modify)
- `src/teaching.test.js` (modify)

**Approach:**
Add to `TEACHINGS`:
```
'delay-time': { title: 'Delay Time', body: '...', draw: drawTeachDelayTime }
'delay-feedback': { title: 'Feedback', body: '...', draw: drawTeachDelayFeedback }
'delay-mix': { title: 'Delay Mix', body: '...', draw: drawTeachDelayMix }
'lore-delay': { title: 'King Tubby & the Echo', body: '...', draw: null }
'reverb-decay': { title: 'Reverb Decay', body: '...', draw: drawTeachReverbDecay }
'reverb-mix': { title: 'Reverb Mix', body: '...', draw: drawTeachReverbMix }
'lore-reverb': { title: 'Lee Perry & the Void', body: '...', draw: null }
```

Body copy emphasis:
- `delay-time`: rhythmic values (0.25s = quarter note at 240bpm; 0.5s = quarter note at 120bpm); what "predelay" means.
- `delay-feedback`: how feedback multiplies repetitions; why 0.8 is the practical ceiling (runaway).
- `delay-mix`: blend of dry and wet; 100% wet = pure echo, no direct signal.
- `reverb-decay`: how long the room "rings"; short = tiled bathroom, long = cathedral.
- `reverb-mix`: how much "room" to add; extreme reverb is a dub signature.

Draw functions: `drawTeachDelayTime` shows a waveform followed by fading repeated copies at the current delay time distance. `drawTeachDelayMix` shows the blend bar (like `drawTeachNoiseMix`). `drawTeachReverbDecay` shows a waveform followed by a decaying density cloud. `drawTeachReverbMix` shows dry vs. wet blend.

**Patterns to follow:** `drawTeachNoiseMix` and `drawTeachNoiseType` in `src/teaching.js` for draw function structure; existing body copy style (practical, ears-first).

**Test scenarios:**
- `teach('delay-time')` returns an object with `title` and `body` properties.
- `teach('delay-feedback')` same.
- `teach('delay-mix')` same.
- `teach('reverb-decay')` same.
- `teach('reverb-mix')` same.
- `teach('lore-delay')` same.
- `teach('lore-reverb')` same.
- All new teaching entries have `body.length > 20`.

**Verification:** All `teaching.test.js` tests pass including new entries; clicking a delay or reverb control in the app shows the teaching panel with relevant content.

---

### U6. Add delay and reverb module sections to index.html

**Goal:** Two new `<section class="module locked">` blocks, one for each effects module.

**Requirements:** R8

**Dependencies:** U3, U5

**Files:**
- `index.html` (modify)

**Approach:**
Insert after the `mod-osc2` section. Each section follows the exact same structure as existing modules:
- `<section class="module locked" id="mod-delay">` with `data-era` attribute if needed (or era applied via CSS `data-layers`)
- Module header: `<span class="mod-tag">FX1</span>`, `<span class="mod-name">Delay</span>`, `<span class="mod-subtitle">tape echo</span>`, lore button
- Controls:
  - Delay Time: range slider `id="s-delaytime"` min=0.05 max=1.0 step=0.01, value display `id="v-delaytime"`
  - Feedback: range slider `id="s-delayfeedback"` min=0 max=0.8 step=0.01, value display `id="v-delayfeedback"`
  - Mix: range slider `id="s-delaymix"` min=0 max=1 step=0.01
- Canvas: `<canvas id="c-delay" class="mod-canvas" style="height:52px">`
- Lock overlay

For `mod-reverb` (`FX2`, "Reverb", "spring hall"):
- Decay: range slider `id="s-reverbdecay"` min=0.1 max=4.0 step=0.1
- Mix: range slider `id="s-reverbmix"` min=0 max=1 step=0.01
- Canvas: `<canvas id="c-reverb" class="mod-canvas" style="height:52px">`

**Patterns to follow:** `mod-noise` and `mod-osc2` sections in `index.html`.

**Test scenarios:**
- Test expectation: none — HTML structure, no behavioral logic at the DOM level.

**Verification:** Both module sections render in the browser (locked, as expected); they unlock when data-layers reaches 7 and 8.

---

### U7. Wire delay and reverb controls in controls.js

**Goal:** Connect the new HTML inputs to `S`, to audio setters, and to `drawModCanvas`/`teach`.

**Requirements:** R9

**Dependencies:** U1, U2, U6

**Files:**
- `src/controls.js` (modify)

**Approach:**
Import `setDelayTime`, `setDelayFeedback`, `setDelayMix`, `setReverbDecay`, `setReverbMix` from `audio.js`.

Wire each control with the existing `wire()` helper, except `s-reverbdecay` which uses the `change` event to avoid IR regeneration clicks during continuous drag (see KTD2):
```
wire('s-delaytime', v => { S.delayTime = v; setDelayTime(v); display; drawModCanvas('delay'); teach('delay-time'); })
wire('s-delayfeedback', v => { S.delayFeedback = v; setDelayFeedback(v); display; drawModCanvas('delay'); teach('delay-feedback'); })
wire('s-delaymix', v => { S.delayMix = v; setDelayMix(v); display; drawModCanvas('delay'); teach('delay-mix'); })
wire('s-reverbmix', v => { S.reverbMix = v; setReverbMix(v); display; drawModCanvas('reverb'); teach('reverb-mix'); })
```
For `s-reverbdecay`, wire manually on the `change` event (not `input`) so IR regeneration only fires on slider release:
```js
const el = document.getElementById('s-reverbdecay');
el.addEventListener('change', () => {
  const v = +el.value;
  S.reverbDecay = v;
  document.getElementById('v-reverbdecay').textContent = v.toFixed(1) + ' s';
  setReverbDecay(v);
  drawModCanvas('reverb');
  teach('reverb-decay');
  bossEngine.notify({ S, isPlaying: engine.noteOn });
});
fillSlider(el);
```

**Patterns to follow:** `wire('s-noisemix', ...)` and `wire('s-osc2mix', ...)` in `src/controls.js`.

**Test scenarios:**
- Test expectation: none — imperative wiring, behavior verified in browser.

**Verification:** Moving each slider in the browser updates the value display and triggers a canvas redraw; the audio effect is audible.

---

### U8. Add delay and reverb mini-canvases to canvas.js

**Goal:** `drawDelayCanvas()` and `drawReverbCanvas()` functions, wired into `drawModCanvas`.

**Requirements:** R10

**Dependencies:** U1

**Files:**
- `src/canvas.js` (modify)
- `src/main.js` (modify — add initial draw calls and resize handler entries)

**Approach:**
`drawDelayCanvas()`:
- Gets `c-delay` canvas element.
- Draws the original waveform (full brightness, using current `S.waveform`) plus 2-3 fading echo copies offset to the right by `S.delayTime * W` (clamped so they stay in frame), each at reduced opacity proportional to `S.delayFeedback`.
- Bottom bar: mix indicator (like noise canvas).

`drawReverbCanvas()`:
- Gets `c-reverb` canvas element.
- Draws a waveform pulse on the left, followed by a spreading density cloud: multiple overlapping sine waves at increasing phases, opacity decaying exponentially based on `S.reverbDecay` and position.
- Bottom bar: mix indicator.

Add `case 'delay': drawDelayCanvas(); break;` and `case 'reverb': drawReverbCanvas(); break;` to `drawModCanvas`.

Export `drawDelayCanvas` and `drawReverbCanvas`. Add initial calls in `main.js` `load` handler alongside existing canvas draws. Add to resize handler.

**Patterns to follow:** `drawNoiseCanvas()` and `drawOscCanvas()` in `src/canvas.js`.

**Test scenarios:**
- Test expectation: none — canvas drawing, not unit-testable.

**Verification:** Delay and reverb canvases render visibly when mix > 0; updating controls redraws them.

---

### U9. Add Kingston era CSS and data-layers 7–8 selectors to style.css

**Goal:** New era palette for the Kingston/dub stages; unlock layer rules extended to include layers 7 and 8.

**Requirements:** R12

**Dependencies:** none

**Files:**
- `src/style.css` (modify)

**Approach:**
Add era palette:
```css
[data-era="kingston"] {
  --era-accent: #3a9e5f;    /* deep reggae green */
  --era-accent-2: #1a5c35;
}
```

Extend all existing `data-layers` selector lists to include `[data-layers="7"]` and `[data-layers="8"]` (Layer 1+, Layer 2+, Layer 3+ rules).

Add new layer-specific rules:
```css
[data-layers="7"] {
  /* delay stage: Kingston studio visual cues */
}
[data-layers="8"] {
  /* reverb stage: Black Ark visual cues */
}
```

Mirror the approach used for `data-layers="5"` (ARP) and `data-layers="6"` (Oberheim).

**Patterns to follow:** Existing layer rules in `src/style.css` — `data-layers="5"` and `data-layers="6"` blocks.

**Test scenarios:**
- Test expectation: none — visual CSS.

**Verification:** With `document.body.dataset.layers = '7'` in the browser console, Kingston-green accents appear; `'8'` shows appropriately themed layer-8 visuals.

---

### U10. Raise data-layers cap to 8 in progressionUI.js

**Goal:** `handleRestore` increments `data-layers` correctly up to 8; `data-layers` is initialized correctly on page load.

**Requirements:** R13

**Dependencies:** U3

**Files:**
- `src/progressionUI.js` (modify)

**Approach:**
Two changes in `progressionUI.js`:
1. Change `Math.min(current + 1, 6)` to `Math.min(current + 1, 8)` in `handleRestore` (line 190).
2. Change `document.body.dataset.layers = '6'` to `document.body.dataset.layers = '8'` in the `if (bossEngine.graduated)` branch (line 199). Without this, the graduation path resets `data-layers` to `'6'`, hiding the Kingston-era CSS at the exact moment the graduation banner fires.

`document.body.dataset.layers = String(progression.defeated.length)` in `initProgressionUI` already uses `defeated.length` for page-load hydration, which will naturally reach 7 or 8.

**Patterns to follow:** The existing `Math.min(current + 1, 6)` line in `handleRestore`.

**Test scenarios:**
- Test expectation: none — progression UI behavior verified in integration.

**Verification:** Defeating the delay boss advances `data-layers` to 7; defeating the reverb boss advances to 8.

---

### U11. Update all test files for eighth stage

**Goal:** Ensure existing and new tests cover 8 stages end-to-end.

**Requirements:** R14

**Dependencies:** U3

**Files:**
- `src/stages.test.js` (modify)
- `src/bossEngine.test.js` (modify)

**Approach:**
`stages.test.js`:
- Update `has exactly 6 stages` → 8.
- Update stage order assertion to include `'delay'` and `'reverb'`.
- Update `VALID_MODULE_IDS` to include `'mod-delay'`, `'mod-reverb'`.
- Update `VALID_ERAS` to include `'kingston'`.
- Add `describe` blocks for delay and reverb target predicates matching the pattern used for noise and osc2.
- Update era distribution test: moog (osc–lfo), arp (noise), oberheim (osc2), kingston (delay, reverb).

`bossEngine.test.js`:
- Add `delayS` and `reverbS` snapshot objects satisfying each stage's target.
- Update graduation test to drain all 8 stages in order.
- Update `sets currentHp to 0 after graduation` and `activateStage is a no-op when graduated` tests to chain all 8 drain calls.

**Patterns to follow:** Existing test structure in both files — `drainStage(S)` helper for non-osc stages.

**Test scenarios:**
- All 87 existing tests continue to pass.
- New delay target tests: true when all three conditions met; false at each boundary (mix ≤ 0.2, time < 0.2, time > 0.6, feedback ≤ 0.25, not playing).
- New reverb target tests: true when both conditions met; false at each boundary.
- Graduation test chains through all 8 stages and sets `graduated = true`.

**Verification:** `npm test` passes with all new tests included.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `ConvolverNode` IR regeneration causes audio glitches when `reverbDecay` changes during play | **Resolved (KTD2):** `s-reverbdecay` uses `change` event (fires on release only), not `input` — IR only regenerates on slider release |
| Delay feedback runaway if gain ≥ 1.0 | Hard cap `delayFeedback` at 0.8 in the setter and the UI slider max |
| Serial wet/dry insert adds volume instead of crossfading | **Resolved (KTD1):** `dryGain` node maintains complement: `dryGain = clamp(1 - delayMix - reverbMix, 0, 1)` |
| Signal chain refactor breaks existing audio (osc, filter, noise, osc2) | Test signal chain before and after; the `fxBus` insertion is transparent at mix=0 |
| `data-layers` gap if a player has existing localStorage with `defeated.length` = 6 | Already handled — `initProgressionUI` sets `data-layers = progression.defeated.length`, which naturally extends to 7/8 |

---

## Open Questions

- **Delay time display**: Show milliseconds (e.g. "300ms") or seconds ("0.30s")? Milliseconds is more standard in DAW contexts.

~~**IR length ceiling**: Resolved — `setReverbDecay` clamps to `[0.1, 4.0]` (see KTD2 and U2).~~

---

## Sources & Research

No external research dispatched — local codebase patterns are sufficient and well-established across 6 prior stages. The signal chain extension (parallel send via GainNode tap) is a standard Web Audio API pattern; the synthetic IR approach is the canonical no-asset reverb technique for Web Audio.

Historical facts verified from general knowledge; specific year citations (1974 for RE-201 release and Black Ark opening) are accurate.
