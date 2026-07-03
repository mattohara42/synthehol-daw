---
date: 2026-07-01
topic: daw-differentiation-north-star
status: direction-proposed
---

# Synthehol — DAW Differentiation North Star

How the eventual fully-unlocked DAW beats Ableton/Logic — not on feature
count (they win that forever), but on the three things they're structurally
bad at: **legibility, feedback, and earned complexity**. Synthehol already
has the bones for each; this doc names the bets so future feature work aims
at them instead of chasing parity.

Companion to the existing tiers: L-tier (`docs/daw-layout-backlog.md`) says
where things live on screen, E-tier (`2026-06-29-daw-architecture-and-
feasibility.md`) says what the engine needs, F-tier
(`docs/daw-feature-gap-backlog.md`) tracked content parity. This is the
**D-tier**: differentiation bets that make the DAW *better*, not just
complete.

---

## Where Ableton/Logic actually hurt

1. **Wall-of-everything on day one.** A thousand controls visible, zero
   guidance on which matter. The industry's answer is hiding things in
   menus — which trades overwhelm for invisibility.
2. **Invisible signal flow.** Routing lives in dropdowns and abstract
   sends. Nobody can *see* where their sound goes.
3. **No "why does this sound bad."** DAWs show a spectrum; none interpret
   it. Muddy mix? Frequency masking? Clipping? You're on your own.
4. **Docs divorced from sound.** Manual pages describe controls
   generically — never against *your* patch, *right now*.
5. **No skill loop.** Pro DAWs assume mastery and never build it. There is
   no feedback mechanism for getting better inside the tool.

## The bets

### D1. Mastery-gated UI as permanent identity — not just onboarding — 🟡 v1 SHIPPED
The unlock system shouldn't end at graduation; it **is** the product.
Post-graduation, advanced features (sidechain, mod matrix, whatever ships
later) each arrive via a boss/challenge that teaches them first. "The DAW
you earn." No pro DAW dares gate features on demonstrated skill; for a
learning-first DAW it's the moat.
- **Bones already built:** the bossEngine is data-driven for exactly this
  (origin R12); The Mimic proved distance-based challenges plug in without
  engine changes.
- **Shipped v1** (`stages.js`'s `CHALLENGES`, `progression.js`'s
  `unlockedFeatures`/`unlockFeature`/`hasFeature`, `bossEngine.js`'s
  `activeEncounter()`): a second, independent unlock track that starts once
  the main 7-stage progression graduates. The pilot gate is the LFO's 5th
  shape — **Sample & Hold** (stepped random modulation; deferred from B8 in
  `docs/backlog.md` since it needs real scheduling, not a native
  `OscillatorType`) — hidden (`#lfowave-sh-btn[hidden]`) until the player
  defeats a bonus boss, **The Predictable** (corrupted Buchla 266 Source of
  Uncertainty, 1966), by proving mastery of the LFO they already have
  (Pitch dest, Square shape, Rate > 15 Hz, Depth > 70%) — the challenge
  can't require the gated shape itself as its own unlock condition. On
  defeat, `bossEngine._defeat()` branches on whether the encounter carries
  an `unlocks` key (a challenge) vs. a stage `id` (the main track), so
  `graduated` and `currentStageIndex` are untouched by challenge outcomes.
  `audio.js`'s `applyLFOWaveform()`/`tickSampleHold()` drive a
  `ConstantSourceNode` stepped by scheduled `setValueAtTime` calls once per
  LFO cycle — the S&H "source," swapped in for the continuous oscillator.
  **Second challenge shipped**, proving the pattern generalizes beyond the
  LFO: `'chorus'` gates a Chorus FX knob (single-knob like Reverb Mix — a
  fixed-rate LFO sweeping a short delay, mirrored into `wavRender.js` for
  offline-render parity) behind **The Solitary** (corrupted Roland CE-1
  Chorus Ensemble, 1976). Its target requires *manually* building width with
  controls the player already has — Osc 2 wide + detuned, Delay Mix and
  Feedback both up — before handing over the automated version; the two
  challenges' `unlockedFeatures` entries (`lfoSampleHold`, `chorusFx`) are
  tracked independently, and `CHALLENGES.find()` walks them in array order
  so a returning player always resumes on the first one still locked.
  **Next, if wanted:** more challenges (each is ~one `CHALLENGES` entry plus
  whatever the gated feature is), and reusing `activeEncounter()`'s pattern
  for D6 (practice gym) once that's picked up.

### D2. The Learn panel becomes a live "why" inspector — 🟡 v1 SHIPPED
Click anything → an explanation rendered against *your current patch*, not
generic docs (already true — teaching.js draws with live `S` values). Hover
any knob → hear a short before/after preview.
- **Shipped v1** (`src/hoverPreview.js`): hovering an inactive option in any
  toggle group (Sine/Square/Saw/Tri, Low/High/Band Pass, White/Pink, LFO
  dest/shape, ...) plays the current patch then the same patch with that
  option swapped, so you hear the difference before clicking. Reuses
  `previewPatch()` as-is, so it never touches the live sound.
- **Deferred:** slider hover-preview — no natural "hover value" without
  computing a position from the mouse, and continuous A/B is fuzzier than a
  discrete swap. Revisit if wanted.

### D3. Visible signal flow — ✅ v1 SHIPPED
The chain is already physically laid out left-to-right as rack modules. Add
per-module signal presence — a small level glow on each module as audio
passes through — and the whole signal path becomes *watchable*: you see
your sound move through VCO → VCF → FX. Nobody else shows this because
their routing is a graph, not a rack.
- **Shipped v1** (`src/signalFlow.js`): a signal LED per audio-path module
  (7 total; LFO excluded — modulation, not audio), driven by three analyser
  taps (summed voices / post-VCF / post-EQ) plus the existing scope for FX.
  The FX LED keeps glowing through delay/reverb tails after the dry signal
  stops — itself a teaching moment. **Next, if wanted:** animated
  inter-module "cable" glow, per-source separation (needs per-source buses).

### D4. Sound diagnostics — a "grammar checker for sound" — ✅ v1 SHIPPED
The spectrum analyser exists; add interpretation: "energy piling up
200–400 Hz — cut EQ Low or raise the filter cutoff." No DAW ships this.
- **Shipped v1** (`src/diagnostics.js`): a short, actionable line under the
  Spectrum visualizer. Buckets the existing scope analyser's frequency data
  into 6 bands, flags whichever dominates (muddy low-mid, harsh high, boomy
  sub, thin low end), reports "balanced" when nothing does, and separately
  catches sustained clipping from time-domain data (always takes priority —
  it's a technical problem, not a taste call). Stays hidden near silence
  rather than nagging.
- **Next, if wanted:** per-module diagnosis (tie a finding to *which* knob
  caused it, using the D3 taps), a "fix it for me" one-click apply.

### D5. Eras as skins that are also sounds — 🟡 direction-proposed
The graduated DAW lets you switch **era workspaces** — a visual theme that
is also a period-correct preset bank plus lore. Taste and curated history
baked into the tool. Logic has skeuomorphism; nobody has curated history.
- **Scoped** in `docs/brainstorms/2026-07-03-era-workspaces-requirements.md`.
  Corrects this entry's premise: only the `moog` palette actually exists
  today (`data-era` is a static, never-switched attribute) — `arp`/
  `oberheim` palettes don't exist yet. Direction: gate on graduation (like
  D6), 4 workspaces matching the roster's already-written lore (Moog/ARP/
  Oberheim/Sequential Circuits — the D1 bonus-challenge eras out of scope
  for v1), a picker in the History tab, prototype one (ARP) before
  generalizing. Not yet implemented.

### D6. Practice gym — ✅ v1 SHIPPED
Generalize The Mimic into an ongoing ear-training mode inside the DAW —
match-the-sound drills against generated or curated target patches, scored
by the parameter-distance machinery that already ships. The DAW as an
instrument you practice, not just software you operate.
- **Bones already built:** `matchIntensity()` scoring, `previewPatch()`
  audition, the capstone stage as the template.
- **Shipped v1** (`src/practice.js` + `src/practiceUI.js`): a "Practice" tab
  in the lower-tabs strip (alongside Visualizers/Sequencer/Piano Roll),
  gated on graduation itself rather than a D1 challenge — its target bank
  spans osc2/noise dimensions that only make sense once every module has
  been taught. A curated bank of 6 named target patches (`TARGETS`) is
  scored on only the params `previewPatch()` actually renders audible
  (waveform, detune, ADSR, osc2, noise — **not** cutoff/filterType/LFO,
  since the preview voice pool bypasses the shared filter and carries no
  LFO routing, so grading on either would ask the player to guess something
  they have no way to hear). `createPracticeSession()` mirrors B1's "reward
  sustained matching, not a single tick": a close match must hold for
  `HOLD_SECONDS` before it "nails," then auto-advances to a new target and
  plays `bossAudio.js`'s resolving chime (`playArp`, newly exported for
  reuse here) — no HP, no boss, purely a repeatable free-play loop, ticked
  from `main.js`'s single rAF dispatcher (E8) but only while the tab is
  actually active, so rounds can't advance in the background.
- **Bug found along the way:** `.tog-btn`/`.ctrl-knob` both set
  `display: flex`, which silently beats the browser's default
  `[hidden]{display:none}` (author styles always win over UA styles at
  equal specificity) — meaning D1's S&H button and Chorus knob had been
  visible and clickable the whole time, ungated, since their original
  commits. `.teach-view[hidden]{display:none}` already existed as a fix for
  the same trap elsewhere; `.tog-btn[hidden]`/`.ctrl[hidden]` now follow the
  same pattern. Caught only once a real screenshot was taken — the earlier
  browser verification checked the `hidden` *property* changed correctly,
  never actual rendered visibility, which is the gap that let it through.

## Anti-goals

Written down so they stay decisions, not accidents:

- **No feature-parity chase.** Ableton has 20 years of features; matching
  them is a losing race and dilutes the identity.
- **No menu diving.** Everything stays on the rack, knobs-first, like
  hardware. If a feature needs a nested menu to exist, redesign it.
- **No modal dialogs.** The one `confirm()` (progress reset) is already the
  outer limit.
- **No audio recording / audio tracks.** Restated from the F-tier backlog:
  Synthehol teaches synthesis; it is not a recording studio.

## Suggested first slice

D3 (visible signal flow) — smallest surface, biggest immediate legibility
payoff, and it makes the "hand-built rack" identity *do* something no
competitor does. D2 hover-preview is the natural second (previewPatch is
sitting there). D1's two challenges (Sample & Hold, Chorus) shipped next,
proving the mastery-gate pattern generalizes; D6 followed, reusing
`previewPatch()`/`matchIntensity`'s shape directly (not `CHALLENGES` itself
— D6 is graduation-gated free play, not a boss fight). D4/D5 are bigger
design efforts worth their own brainstorms when picked up — D5 (era
workspaces) is now the only un-started bet left.
