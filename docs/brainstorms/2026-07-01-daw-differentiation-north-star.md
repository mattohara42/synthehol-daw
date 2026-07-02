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

### D1. Mastery-gated UI as permanent identity — not just onboarding
The unlock system shouldn't end at graduation; it **is** the product.
Post-graduation, advanced features (sidechain, mod matrix, whatever ships
later) each arrive via a boss/challenge that teaches them first. "The DAW
you earn." No pro DAW dares gate features on demonstrated skill; for a
learning-first DAW it's the moat.
- **Bones already built:** the bossEngine is data-driven for exactly this
  (origin R12); The Mimic proved distance-based challenges plug in without
  engine changes.

### D2. The Learn panel becomes a live "why" inspector
Click anything → an explanation rendered against *your current patch*, not
generic docs. Hover any knob → hear a short before/after preview. Ableton's
closest equivalent is a static info bar.
- **Bones already built:** teaching.js already draws with live `S` values
  (~80% of the way there); `previewPatch()` (built for The Mimic) already
  plays a demo of an arbitrary params object without touching the live
  sound.

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

### D4. Sound diagnostics — a "grammar checker for sound"
The spectrum analyser exists; add interpretation: "energy piling up
200–400 Hz — cut EQ Low or raise the filter cutoff." The teaching engine
already has the copy voice for it. No DAW ships this.
- **Bones already built:** `engine.scope` (AnalyserNode) has the data;
  teaching.js has the delivery surface and tone.

### D5. Eras as skins that are also sounds
`data-era` palettes (moog/arp/oberheim) already exist. The graduated DAW
lets you switch **era workspaces** — a visual theme that is also a
period-correct preset bank plus lore. Taste and curated history baked into
the tool. Logic has skeuomorphism; nobody has curated history.

### D6. Practice gym
Generalize The Mimic into an ongoing ear-training mode inside the DAW —
match-the-sound drills against generated or curated target patches, scored
by the parameter-distance machinery that already ships. The DAW as an
instrument you practice, not just software you operate.
- **Bones already built:** `matchIntensity()` scoring, `previewPatch()`
  audition, the capstone stage as the template.

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
sitting there). D1/D6 ride on future boss content; D4/D5 are bigger design
efforts worth their own brainstorms when picked up.
