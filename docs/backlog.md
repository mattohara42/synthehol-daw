# Synthehol — Product Backlog

Items surfaced from the June 2026 roadmap review. Ordered roughly by impact/effort ratio. Not all are committed — use this as the shopping list before planning each act.

---

## Critical gaps (things that undermine the current promise)

### The graduation screen is hollow
**Problem:** Defeating the final boss shows a banner and... the same synth you already had. The name "Synthehol DAW" and the graduation narrative ("you've become a DAW") are unfulfilled without sequencing or polyphony. A player who grinds six boss fights and hits this screen feels cheated.
**Fix path:** Don't ship the "you've graduated" screen as the final state. Either (a) ship Act IV (sequencer + polyphony) before calling graduation complete, or (b) reframe the current graduation as "end of Act II" and make the full DAW sandbox the Act IV payoff.

### The final boss is undefined
**Problem:** The original roadmap says MIDI is the climactic final boss — but R20 explicitly says MIDI never hard-gates (no MIDI device = never soft-locked). You can't make "does the user have a MIDI keyboard" a boss-fight gate. The final boss fight is currently undesigned.
**Fix path:** Either pick a non-MIDI final boss for Act IV (the sequencer is a better candidate — "build a four-bar pattern" is a clear, gateable target), or redesign the MIDI stage as an optional bonus that fires after graduation rather than blocking it.

---

## Quality gaps (things that make the current product feel unfinished)

### Teaching canvases are blank for newer modules ✅ FIXED
Noise and VCO2 teaching entries all had `draw: (c) => { setupCanvas(c); }` — an empty canvas. Fixed in this session.

### Boss fight difficulty doesn't escalate
**Problem:** Boss 6 (The Dissonant) feels the same as Boss 1 (Vox Corruptus) — same 100 HP, same 10 damage per hit, same static win condition. A player who has defeated 5 bosses should face something harder.
**Ideas:** Increase max HP on later bosses (100 → 150 → 200). Narrow the win-condition window (detune between 5–45 is wide; the later you go the tighter it should be). Add a time element ("deal 30 damage before the regeneration clock resets").

### Boss taunts are static
**Problem:** The boss says one line regardless of how close you are to the win condition. The taunt for The Dissonant: "Two voices locked in perfect unison. Perfectly sterile." — great as an opener, but it never changes when you're at 80% HP vs 5% HP.
**Fix path:** Add `taunt_phases: [{ hpThreshold: 100, text: '...' }, { hpThreshold: 50, text: '...' }, { hpThreshold: 10, text: '...' }]` to the stage data. `bossEngine` already fires `onDamage` — progressionUI just needs to pick the right phase copy.

---

## High-value features (not currently planned)

### URL-encoded sound sharing
Encode the full `S` state as a base64 URL hash (`?s=eyJ3YXZl...`). Zero infrastructure, no backend. Players share a patch they made with a link. Loading the URL restores the exact `S` state.

### Preset slots
Let players save 4–6 named patches to `localStorage` (`synthehol_presets`). One "save" button per slot, one "load" button. Low engineering cost, high emotional satisfaction — "save your favorite sound before moving on."

### Boss proximity feedback in the teaching panel
The teaching panel currently shows generic info about a control. During a boss fight, it could show how close the current settings are to the win condition — a percentage, a direction indicator, or a short "warmer / colder" hint. This makes the boss fight less trial-and-error.

### Ear training mode (future boss type)
The original requirements doc (R12) notes the engine is data-driven for new challenge types. A future boss type: play the target sound for 3 seconds, then the player has to match it by ear (no visual hint at what the setting should be). This is the right mechanic for Act IV where players have learned all the tools and should use their ears.

---

## Architecture concerns (flag before planning these)

### Polyphony requires a major engine rework
The current `engine` singleton is one voice: one `osc`, one `osc2`, one `noiseMixGain`, all sharing a single `ampEnv`. Polyphony means N copies of this entire graph per held note. The `engine` singleton pattern doesn't accommodate that. Before planning Act III (polyphony), design a `Voice` abstraction and a `voicePool`. This touches `audio.js`, `keyboard.js`, `controls.js`, and all stage predicates that read `engine.noteOn`.

### A reverb/delay act should precede polyphony
Going VCO2 → polyphony is a large conceptual jump. An **effects module** (reverb via `ConvolverNode`, delay via feedback `DelayNode`) would bridge the gap: it's a new sonic dimension, it's Web Audio one-liners, and it would make a natural Act III before polyphony in Act IV. "The Echo Chamber" or "The Wash" boss could require building a pad with reverb.

---

## Act roadmap (revised recommendation)

| Act | Capability | Status |
|-----|-----------|--------|
| I | VCO, VCF, ADSR, LFO | ✅ shipped |
| II | Noise, VCO2 | ✅ shipped |
| III | Effects (reverb + delay) | 📋 not planned, recommended addition |
| IV | Polyphony (chords) | 📋 planned, needs voice architecture design |
| V | Step sequencer + climactic boss | 📋 planned |
| VI | MIDI (optional, never hard-gates) | 📋 planned as optional bonus |
