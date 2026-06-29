---
date: 2026-06-25
topic: core-loop-and-filter-envelope
backlog-items: B1, B4, B3, B12
status: proposed
---

# Plan — Sustained-damage core loop + filter envelope (backlog first slice)

## Context

The Act I build works but the boss fight is trivially gameable and the synth is
missing the one feature that makes subtractive synthesis *sound* like synthesis.
This slice fixes both, plus two near-free correctness wins. Backlog: `docs/backlog.md`.

- **B1 (defect):** `bossEngine.notify()` deals a flat 10 damage on every control
  `input` event with no rate limit (`controls.js:16`, `bossEngine.js:31`).
  Holding a note and dragging a slider past a threshold emits dozens of events
  and kills a boss in a fraction of a second. The fight is won by slider-wiggle,
  not by listening — which guts the emotional payoff the progression layer exists for.
- **B4 (defect):** there is an amp ADSR but nothing modulates cutoff per note, so
  the iconic per-note filter sweep the teaching copy calls "one of the most
  iconic sounds in electronic music" (`teaching.js:31`) can't be made.
- **B3 (defect):** `progression.load()` validates shape but not bounds
  (`progression.js:15`); a corrupted index crashes `bossEngine` on load.
- **B12 (defect):** `engine.osc.detune.value = v` (`controls.js:77`) is a direct
  assignment, breaking the project's own "ramp, don't assign" convention.

**Outcome:** bosses must be *held in their target sound over time* to defeat,
the filter can sweep per note, and two latent crash/click bugs are gone.

---

## B1 — Time-based, sustained damage

Replace the per-event damage model with a per-frame drain driven by the existing
rAF loop, so HP falls only while the target sound is actually held and playing,
and recovers when it lapses.

### Data model — `src/stages.js`
- Replace each boss's `damagePerHit: 10` with `dps: 40` (damage/second; ~2.5 s of
  perfect sustain to clear at `maxHp: 100` — tune in play-testing). Keep `maxHp`.
- Add a shared `HEAL_RATE` (e.g. 15 dps) constant in `bossEngine.js` for recovery
  when the target lapses (boss "heals back," so dithering doesn't win).

### Engine — `src/bossEngine.js`
- Add `tick({ S, isPlaying, dt })`, the new single damage path:
  - Guard: `const stage = STAGES[progression.currentStageIndex]; if (!stage || this.graduated) return;` (also satisfies B3 at the call site).
  - If `isPlaying && stage.target(S, isPlaying)`: `currentHp = max(0, currentHp - dps*dt)`;
    accumulate `this._xpAccum += dps*dt`; fire `onDamage({ hp, maxHp })`.
  - Else if `currentHp < maxHp`: `currentHp = min(maxHp, currentHp + HEAL_RATE*dt)`;
    fire `onDamage` so the bar reflects recovery.
  - On `currentHp === 0`: run the existing defeat sequence (`markDefeated`,
    `unlockNext`, bonus `addXp(maxHp)`, `onRestore`, `activateStage`, graduation),
    then `flushXp()`.
- **XP / localStorage throttle:** `progression.addXp` currently `save()`s on every
  call (`progression.js:78`); a per-frame tick would write localStorage ~60×/s.
  Accumulate XP in `this._xpAccum` and flush via `flushXp()` (rounds to int, calls
  `progression.addXp`, keeps the remainder) at most every 0.5 s of fight time and
  on defeat. No per-frame writes.
- Remove `notify()` (its per-hit semantics are exactly what we're deleting). Keep
  `activateStage`, `onDamage`, `onRestore`, `_clearListeners` unchanged.

### Loop wiring — `src/main.js`
- `animate()` already runs each frame (`main.js:14`). Give it the rAF timestamp,
  compute `dt = clamp((now - last)/1000, 0, 0.05)` (clamp avoids a huge drain after
  a tab-away), and call `bossEngine.tick({ S, isPlaying: engine.noteOn, dt })`.
- Add imports: `{ bossEngine }`, `{ engine }`, `{ S }`. Reading `engine.noteOn`
  live each frame also resolves the B2 inconsistency for free (toggles vs. sliders
  vs. keypress now all behave identically).

### Remove event-driven damage
- Delete the `bossEngine.notify(...)` calls in `controls.js:16`, `controls.js:27`,
  and `keyboard.js:85`. The rAF tick reads `S` and `engine.noteOn` live, so control
  changes are reflected within one frame (~16 ms) while a note is held.

### Tests — `src/bossEngine.test.js`
- The current suite encodes the per-hit model (`damage: 10`, exact HP/XP steps) —
  rewrite it around `tick`:
  - `activateStage` HP test unchanged.
  - No-damage cases: `tick` with `isPlaying:false` or non-target `S` leaves HP at
    `maxHp` (and heal stays clamped at `maxHp`).
  - Damage: `tick({ S: oscS, isPlaying:true, dt:0.5 })` reduces HP by `dps*0.5`.
  - Heal: after some drain, a non-target `tick` raises HP back toward `maxHp`.
  - Restore/graduation: drive `tick` with a large `dt` (or a loop) to reach 0 and
    assert the existing defeat/advance/graduation outcomes (these assertions stay,
    only the drive mechanism changes). Replace `drainOsc`/`drainStage` helpers with
    a `drain(S)` that ticks with a dt large enough to zero HP in one call.

---

## B4 — Filter envelope (env → cutoff)

Add a single "Env Amount" control that sweeps the filter per note, **reusing the
existing ADSR times** (one envelope, two destinations — minimal UI, clean lesson).
Default amount `0` ⇒ behavior identical to today, so the filter boss
(`cutoff > 4000`) and all existing tests are unaffected.

### State — `src/state.js`
- Add `filterEnvAmount: 0` (octaves of upward cutoff sweep at envelope peak, 0–4).

### Audio — `src/audio.js`
- Add `applyFilterEnv(now)`, called from `playNote` after the osc frequency is set,
  active only when `S.filterEnvAmount > 0`:
  - `peak = S.cutoff * 2 ** S.filterEnvAmount`,
    `sustainHz = S.cutoff * 2 ** (S.filterEnvAmount * S.sustain)` (both clamped ≤ ~20 kHz).
  - Schedule `vcf.frequency` from `S.cutoff` → `peak` over `S.attack`, then →
    `sustainHz` over `S.decay`, mirroring the amp ADSR (`audio.js:108-109`).
- In `releaseNote`, when amount > 0, ramp `vcf.frequency` back toward `S.cutoff`
  over `S.release` (alongside the existing amp release).
- When amount is `0`, do not schedule `vcf.frequency` at all — the cutoff slider's
  live `setTargetAtTime` (`controls.js:84`) keeps sole control, preserving current
  behavior. (Known v1 limitation: moving the cutoff slider mid-note while the env
  is scheduled fights the schedule; acceptable, note in code comment.)

### UI — `index.html` + `src/controls.js`
- Add a slider row after Resonance (`index.html:126`) inside `#mod-filter`, copying
  the established `.ctrl` / `.ctrl-row` pattern: label "Env Amount", value span
  `v-fenv`, `<input id="s-fenv" type="range" min="0" max="4" step="0.1" value="0">`.
- Wire in `controls.js` with the existing `wire()` helper: set `S.filterEnvAmount`,
  update `v-fenv` (e.g. `+v.toFixed(1)+' oct'`), `drawModCanvas('filter')`,
  `teach('filter-env')`.

### Teaching — `src/teaching.js`
- Add a `'filter-env'` entry (title + body explaining env→cutoff and the per-note
  sweep) reusing `drawTeachFilterCurve` / the ADSR primitive, matching the existing
  `TEACHINGS` shape. `teaching.test.js` validates entry shape — confirm it passes.

### Canvas (optional polish) — `src/canvas.js`
- Optionally draw a faint "peak cutoff" marker on the filter mini-canvas when
  `filterEnvAmount > 0`, by extending `drawFilterCurveOnCanvas`. Not required for
  the slice; include only if cheap.

---

## B3 — Bound-check persisted progression

`src/progression.js`, in `load()` after the `isValid` check: clamp
`currentStageIndex` to `[0, STAGE_IDS.length-1]`, `unlockedCount` to
`[1, STAGE_IDS.length]`, and filter `defeated` to known `STAGE_IDS` (deduped). If
incoherent, fall back to `INITIAL_STATE()`. The `tick` stage-guard above is the
second line of defence.

## B12 — Ramp, don't assign

`src/controls.js:77`: replace `engine.osc.detune.value = v` with
`engine.osc.detune.setTargetAtTime(v, engine.ctx.currentTime, 0.01)`, matching the
sibling cutoff/res handlers.

---

## Files touched

- `src/stages.js` — `damagePerHit` → `dps`.
- `src/bossEngine.js` — `tick()`, `flushXp()`, `HEAL_RATE`; remove `notify()`.
- `src/main.js` — drive `tick` from `animate()` with clamped `dt`.
- `src/controls.js` — remove `notify` calls; add `s-fenv` wiring; B12 ramp fix.
- `src/keyboard.js` — remove `notify` call.
- `src/audio.js` — `applyFilterEnv`; filter release ramp.
- `src/state.js` — `filterEnvAmount`.
- `index.html` — Env Amount slider in `#mod-filter`.
- `src/teaching.js` — `filter-env` entry.
- `src/progression.js` — bound-checking in `load()`.
- Tests: `src/bossEngine.test.js` (rewrite around `tick`), `src/stages.test.js`
  (`damagePerHit` → `dps` in `REQUIRED_BOSS_FIELDS`). `progression.test.js` gains a
  case for out-of-range persisted state.

## Verification

1. `npm test` — all suites green, including the rewritten boss-engine tests and a
   new progression bound-check case.
2. `npm run dev`, then manually:
   - **B1:** hold a note on the Oscillator boss with a saw wave — HP drains
     steadily over ~2–3 s, not instantly; release the key and HP stops/recovers;
     wiggling a slider without holding a note deals no damage.
   - **B4:** raise Filter → Env Amount, hold a note — hear the per-note brightness
     sweep; the filter mini-canvas updates; at amount 0 the sound matches today.
   - **B3:** set `localStorage.synthehol_progress` to `{"currentStageIndex":99,...}`,
     reload — app loads at a valid stage instead of crashing.
   - **B12:** sweep detune while holding a note — no click/zipper artifact.
3. Confirm the filter boss is still beatable (default `filterEnvAmount` 0 leaves
   its `cutoff > 4000` target intact).

## Out of scope

Remaining backlog tiers (B2 explicit handling beyond the free fix, B5–B16) and all
Act II–IV roadmap work.
