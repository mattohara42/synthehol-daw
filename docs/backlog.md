---
date: 2026-06-25
topic: synthehol-prioritized-backlog
status: living
---

# Synthehol — Prioritized Backlog

A living, prioritized list of fixes and enhancements distilled from a code review
of the Act I build (boss engine + four-module subtractive synth). Items are
ordered by leverage: how much they improve the core "fun first, teach through
sound" loop per unit of effort.

Tiers:
- **P0** — core-loop correctness/feel; the product premise depends on these.
- **P1** — high-value sound & teaching gaps; big payoff, contained scope.
- **P2** — robustness, polish, and reach.
- **P3** — net-new scope beyond the existing Act roadmap.

**Status:** ✅ all done — B1 through B16. See
`docs/plans/2026-06-25-001-feat-core-loop-filter-env-plan.md` for the first
slice.

Effort is a rough t-shirt size (S / M / L). "Source" notes whether an item came
from a review *defect* (something wrong today) or a review *idea* (additive).

> Note: the existing Act II–IV roadmap (noise source, second oscillator,
> polyphony, sequencer, MIDI) lives in
> `docs/brainstorms/2026-06-21-synthehol-progression-to-daw-requirements.md`.
> This backlog deliberately does **not** duplicate those acts — it sharpens the
> current loop and adds cross-cutting ideas that aren't already scheduled.

---

## P0 — Core loop

### ✅ B1. Damage must reward *sustained* matching, not a single tick — S/M · defect — DONE
Today `bossEngine.notify()` deals a flat 10 damage on every control `input`
event, with HP 100 and no rate limit or cooldown (`controls.js:16`,
`bossEngine.js:31`). Holding one note and dragging a slider past the threshold
emits dozens of input events and kills a boss in a fraction of a second. The
fight is won by slider-wiggle, which contradicts the "fights land emotionally"
success criterion.
- **Change:** drain HP over time while the target sound is held *and* playing;
  boss slowly heals when the target lapses. Decouple damage from raw input-event
  count (tick on a timer/RAF while `isPlaying && target`, not per-event).
- **Why first:** single highest-leverage change; converts wiggle into
  performance. Unlocks the emotional payoff the whole progression layer is for.

### B2. Make `isPlaying` consistent across input types — S · defect
Damage only lands when `engine.noteOn` is true at the moment a control changes,
so toggling a waveform with no key down does nothing, with a key down does 10,
and dragging a slider with a key down can one-shot — same intent, different
result (`controls.js:16,27`, `keyboard.js:85`). A beginner can't form a mental
model from this. Falls out naturally once B1 moves to a time-based tick, but
worth calling out as its own acceptance check.

### ✅ B3. Bound-check persisted progression state — S · defect — DONE
`progression.load()` validates shape but not bounds (`progression.js:15`). A
corrupted `currentStageIndex` past the last stage passes `isValid`, then
`bossEngine.notify` calls `STAGES[i].target(...)` with no guard
(`bossEngine.js:21-24`) → crash on load. Clamp indices and guard the lookup.

---

## P1 — Sound & teaching gaps

### ✅ B4. Add a filter envelope (env → cutoff amount) — M · defect — DONE
There's an amp ADSR but nothing modulates cutoff per note, so the iconic
per-note filter sweep — which the teaching copy itself calls "one of the most
iconic sounds in electronic music" (`teaching.js:31`) — literally can't be made.
Biggest musical gap and a strong teaching beat. Natural future boss ("the
Sweep").
- **Change:** add `filterEnv` amount + its own ADSR (or reuse amp ADSR with an
  amount knob to start), routed to `vcf.frequency` in `audio.js`.

### ✅ B5. Built-in time-based FX (delay + small reverb) — M · idea — DONE
The dry osc→VCA→VCF chain sounds sterile; a touch of delay/reverb is what makes
a toy feel good under the fingers and directly serves "every control should
sound good to play with." Feedback delay + a short convolver reverb, CSP-safe
(generate the impulse in code, no external asset).

### ✅ B6. Combat audio juice — S/M · defect — DONE
It's an ears-first game but bosses react only visually (`--gi` glitch). Add hit
blips, a defeat stinger, and a boss drone that detunes/distorts as HP drains and
resolves to a clean chord on defeat. The one sense the product is about is
currently silent during its climaxes.

### ✅ B7. Live spectrum (FFT) view — M · idea — DONE
An `AnalyserNode` already exists (`audio.js:32`). Add an FFT spectrum beside the
scope so players *see* the odd harmonics of a square, all harmonics of a saw,
etc. that the teaching text describes — teach-through-sight to match
teach-through-sound.

### ✅ B8. LFO depth: waveform choice + retrigger — S · defect — DONE
Added a Shape toggle (Sine/Tri/Square/Saw) and a Key Sync toggle (restarts the
LFO's phase at note-on instead of running free). Sample-and-hold was skipped —
it isn't a native `OscillatorNode` type and needs real scheduling infra, unlike
the other three shapes; revisit if wanted as its own item. **Follow-up:**
shipped as the pilot for D1 (mastery-gated UI) in the differentiation
north-star doc — a 5th Shape button, gated behind a post-graduation bonus
boss rather than handed over for free like the other three.

---

## P2 — Robustness & polish

### ✅ B9. First-second onboarding nudge — S · idea — DONE
The entire premise is the unaided cold first run on a public URL, but nothing
tells a newcomer to press a key. Add a pulsing "press A" prompt that clears on
first note.

### ✅ B10. Mobile + accessibility pass — M · defect — DONE
Touch-native cues, tap targets, and the a11y pass (labels/roles on sliders and
toggle groups) shipped first. Responsive layout reflow shipped last: two
breakpoints (1180px, 820px) reflow the same layout — rack rows drop from 3 to
2 columns, then the whole app switches from a locked 100vh shell to a
normally-stacking scrolling page. A full one-panel-at-a-time mobile mode is
still a separate, bigger item (L4).

### ✅ B11. Velocity / dynamics — M · idea — DONE
Every note is full-blast. Even a coarse velocity (e.g. from sustained-hold or a
mod) adds life and gives the envelope something to teach against.

### ✅ B12. Honor the "ramp, don't assign" convention — S · defect — DONE
`engine.osc.detune.value = v` is a direct assignment (`controls.js:77`),
breaking the project's own click-avoidance rule. Use `setTargetAtTime`.

### ✅ B13. Collapse redundant progression counters — S · defect — DONE
`currentStageIndex`, `unlockedCount`, and `defeated.length` are semi-redundant
and can drift (`progression.js`). Derive `unlockedCount` rather than storing it,
to remove a class of state-sync bugs.

### ✅ B14. Throttle teaching-panel redraw on slider drag — S · defect — DONE
`teach()` fires on every continuous `input` tick (`controls.js`), swapping panel
content as you drag across modules. Debounce or only re-`teach` on
control-focus/change.

---

## P3 — Net-new scope (beyond the Act roadmap)

### ✅ B15. "Match-the-sound" ear-training boss type — L · idea — DONE
A 7th capstone stage, "The Mimic" (Sequential Circuits Prophet-5, 1978).
`bossEngine.tick()` was generalized by one line so `target()` can return a
0..1 closeness intensity instead of just a boolean — damage scales with how
close the live patch is to a 7-dimension reference patch (waveform, cutoff,
attack, sustain, LFO dest+depth, osc2 mix), not a single pass/fail line. A
"Hear the target" button previews the reference patch's tone (waveform/
envelope/osc2) without touching the player's own sound.

### ✅ B16. Shareable patches via URL-encoded `S` — S/M · idea — DONE
A Share button encodes the full live params into a `#patch=<json>` hash,
updates the address bar, and copies the link to the clipboard. Loading a
shared link applies the patch via the existing preset path.

---

## Suggested first slice

B1 + B4 together change the *feel* of the product more than any new act: B1 makes
the fights real, B4 makes the synth sound like a synth. B3 and B12 are nearly
free correctness wins to fold in alongside.
