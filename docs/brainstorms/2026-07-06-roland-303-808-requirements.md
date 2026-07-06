---
date: 2026-07-06
topic: roland-303-808-requirements
status: phase-1-shipped
---

# Synthehol — Roland TB-303 / TR-808 Requirements

Scoping pass for "can we add Roland 303/808 patches or modules," prompted
by a direct question about feasibility. Same audit-first shape as the D5
era-workspaces and E4 mixer docs — read what already exists and what's
genuinely missing before proposing anything.

## The honest answer up front

**Patches: yes, cheaply, reusing an existing mechanism.** A curated preset
bank is exactly what `eraWorkspaces.js`/`eraWorkspacesUI.js` (D5) already
does for Moog/ARP/Oberheim/Sequential — a new entry there is a same-day
addition, not new architecture.

**A full, authentic 303/808 module: no, not without real new engine work,**
and the gap isn't cosmetic. The 303's whole character is **slide**
(portamento between notes) and **accent** (a per-step performance flag that
punches a note louder and brighter) — neither exists anywhere in this
codebase today. The 808's character is its *distinct per-voice circuits*
(cowbell, clap, toms, open vs. closed hihat) — `drums.js` only has three
voices (kick/snare/hat) today. Both are addressable, but not as "add a
preset" — they touch the voice manager, the sequencer schema, and every
place that currently assumes exactly three drum lanes.

## Audit: what already exists to build on

- **`eraWorkspaces.js`/`eraWorkspacesUI.js` (D5)** — the exact "curated
  preset bank + pioneer + palette, gated on graduation" mechanism. Already
  anticipated this exact moment: its own requirements doc explicitly
  deferred a Roland workspace ("reconsidered only if the four main ones
  land well and there's appetite for rewarding the bonus track with its own
  cosmetic payoff too") — they landed, so this is that reconsideration.
- **A naming collision worth resolving before writing code**: `stages.js`'s
  D1 bonus challenge "The Solitary" already tags its era as `'roland'` (the
  Roland CE-1 Chorus Ensemble, 1976, credited to Ikutaro Kakehashi). Adding
  a *second*, differently-themed "Roland" workspace (TB-303/TR-808, 1980–82,
  same real-world founder) risks a player who's cleared that bonus challenge
  seeing a "Roland" workspace with completely different instruments than
  the one they just fought. `eraWorkspaces.js`'s own `id` list is
  independent of `stages.js`'s `era` tags (no technical collision), but the
  *label* a player sees needs to disambiguate — recommend naming the new
  entry after the instrument, not the brand (**"TB-303"** or **"Acid"**,
  not bare "Roland"), keeping Kakehashi as the credited pioneer for both
  without implying they're the same workspace.
- **The synth engine can approximate 303 timbre today, incompletely.** The
  core acid recipe — sawtooth/square oscillator → resonant lowpass filter
  with the envelope driving cutoff — is precisely what `filterEnvAmount`
  (0–4) plus `resonance` (0.5–18 Q) already do. A curated preset (high
  resonance, fast decay, moderate filter-env amount) gets a real "squelch."
  What it **cannot** reproduce: the diode-ladder filter's specific
  resonance curve (a self-oscillating, slightly unstable character the
  Moog-style ladder filter here doesn't replicate — out of scope, same as
  every other era workspace's "palette + presets, not a circuit-accurate
  reskin" precedent) and, critically, slide/accent (below).
- **`drums.js` is a good pattern to extend, but the wiring is 4-deep.**
  Each voice is a small pure `(ctx, dest, time) => void` function — adding
  `playCowbell`/`playClap`/`playTom` alongside `playKick`/`playSnare`/
  `playHat` is easy in isolation. The part that isn't free: **every new
  voice needs updating in four places** to actually reach the sequencer —
  `sequencerUI.js`'s `DRUM_VOICES` array (grid rows) and its pattern
  normalization (legacy patterns predating a new lane need a default empty
  array, the same accommodation already made once for the original three),
  `sequencer.js`'s consumer (the `if (drums?.newvoice?.[col])` dispatch),
  `main.js`'s wiring (`playNewVoice: (t) => ...`), and `wavRender.js`'s
  offline render (duplicates the live wiring on purpose — see its own doc
  comment on why it never shares code with the live engine). None of this
  is hard, but it's five coordinated edits per new voice, not one.
- **No glide, no accent, anywhere.** Confirmed by reading `voices.js`:
  every note allocates a **brand-new voice** with `osc.frequency.
  setValueAtTime(freq, time)` — an instant, hard-set pitch. There is no
  "retune the currently-sounding oscillator" path at all, because the
  polyphonic voice pool's whole model is "spawn a fresh voice per note,
  steal the oldest past `maxVoices`." Real 303-style slide is monophonic
  by nature (one voice glides *into* the next note rather than a second
  voice starting) — grafting that onto a polyphonic pool isn't a parameter
  tweak, it's a second, different note-triggering path. Accent is smaller
  (a per-step boolean multiplying velocity/brightness) but still needs a
  new sequencer lane, schema field, and consumer wiring, matching the
  drum-lane pattern above.

## Proposed scope

### Phase 1 (this slice) — patches + drum voices, no new mechanisms

1. **A "TB-303 / Acid" era workspace** (or however phase-1 naming lands —
   see the collision note above), gated on graduation like the other four,
   with 2–3 curated presets built from what the engine already has: sawtooth
   or square wave, `filterType: 'lowpass'`, high `resonance` (10–16), a
   meaningful `filterEnvAmount` (2–3), short `decay`/`sustain` near 0 for
   the classic "blip," reusing `presets.js`'s plain-params-object shape
   exactly like every other workspace preset.
2. **Two to four new synthesized drum voices in `drums.js`**, following the
   exact shape of `playKick`/`playSnare`/`playHat`: a cowbell (two detuned
   square oscillators through a bandpass filter — the real 808 circuit's
   own recipe, cheaply approximable), a clap (3–4 fast noise bursts
   followed by a longer tail), and optionally low/high toms (pitched sine
   thumps at different base frequencies, same shape as the kick). Each is a
   self-contained pure function — no shared-state risk.
3. **Wire the new voices through the four existing call sites** named in
   the audit above, plus a pattern-schema/normalization update for old
   saved projects. This is the bulk of the real work in phase 1 — not
   difficult, just needs doing consistently everywhere drums are already
   threaded through.

**Explicitly out of scope for phase 1**: any new UI surface (a dedicated
"drum machine view," a 303-style single-screen module) — reuse the
existing step-sequencer drum lanes and the existing era-workspace preset
picker rather than building new chrome for this; a circuit-accurate diode
ladder filter model; slide; accent.

### Phase 2 (separate follow-up, if wanted) — glide + accent

The part that would make a 303 preset actually *sound* like a 303 instead
of just resembling one. Two genuinely separate, smaller features, each
non-trivial on its own:

- **Glide/portamento**: a per-track (or per-preset) toggle that, when a new
  note starts while a previous one from the same source is still sounding,
  ramps the *existing* voice's frequency (`osc.frequency.
  linearRampToValueAtTime` / `exponentialRampToValueAtTime` over a glide-
  time parameter) into the new pitch instead of starting a fresh voice.
  Needs a monophonic-mode concept somewhere between `voices.js`'s pool and
  the note-input sources (keyboard/sequencer) — a real design decision
  (does glide apply per-track globally, or only within the step sequencer's
  own note stream?) that deserves its own scoping pass, not a guess buried
  in this doc.
- **Accent**: a fourth-ish sequencer lane (alongside the existing pitch
  cells / drum lanes / automation lane) marking a step as accented; the
  sequencer consumer reads it and scales that step's velocity/filter-env
  amount up, matching the 303's own accent circuit (louder *and* brighter,
  not just louder). Smaller than glide, and a more direct extension of the
  existing per-step-boolean-lane pattern the drum lanes and step-grid
  itself already use — likely the easier of the two if only one gets built.

Neither is required to ship phase 1's patches/drum-voice slice — they're
independently valuable and independently risky, which is exactly why they
're split out rather than bundled into "add 303/808 support" as one lump.

## Suggested first slice

Phase 1 only, and within phase 1, the drum voices before the era workspace
(the workspace is pure data + zero new plumbing once the voices exist,
while the voices are the part touching multiple files) — build
`playCowbell`/`playClap` first, wire them through the four call sites plus
pattern normalization, verify in a real browser (screenshot the new drum
grid rows, confirm old saved patterns without the new lanes still load
without throwing), then add the acid-preset workspace entry on top as the
much smaller remaining piece.

## Status: phase 1 shipped

Built in exactly the order this doc recommended: drum voices first, era
workspace on top.

**`drums.js`**: `playCowbell` (two square oscillators at 540/800 Hz — a
non-harmonic ratio, the real TR-808 circuit's own recipe — through one
bandpass filter) and `playClap` (three fast noise bursts 12ms apart, a
"flam," followed by a longer tail, all through one bandpass filter,
distinguishing it from the snare's single burst).

**Wired through all five places** the audit identified, not just the four
originally counted — a fifth turned up during implementation:
`sequencerUI.js` (`DRUM_VOICES`, `emptyDrums()`, `drumCellEls`),
`sequencer.js`'s consumer, `main.js`'s wiring, `wavRender.js`'s offline
render, and (found while implementing, not anticipated in the audit above)
**`store.js`'s `applyState()`** — the undo/redo/load reconciliation path
hardcoded `{ kick, snare, hat }` when cloning a track's drums during a
snapshot restore, which would have silently dropped cowbell/clap on any
undo/redo crossing a track boundary. Fixed by making it generic over
whatever keys the incoming pattern actually has (mirroring how it already
handled `automation` two lines below), rather than hardcoding a fourth
place to update every time a voice is added.

**`ensureDrums()` rewritten**, not just extended: the old version checked
only whether `drums.kick` was an array to decide "does this pattern need
its drums object reset" — fine when there were only ever three voices added
all at once, but wrong for a pattern that already has kick/snare/hat and is
simply missing the two new ones. Rewrote it to backfill each **individual**
missing voice array, and moved the call from init-only to also running on
every `render()` — a track switch, clip load, or undo/redo can swap in an
old-shaped pattern mid-session, not just a fresh page load. Verified this
exact scenario directly: constructed a legacy project (drums with no
cowbell/clap keys at all) in `localStorage`, loaded it, and clicked a
cowbell cell — confirmed no throw and the correct value landed, where
before this fix it would have thrown on `drums[voice][col]` reading
`undefined[col]`.

**`eraWorkspaces.js`**: a fifth workspace, **Acid** (not "Roland" — see the
naming-collision section above), with two presets — "Acid Bassline"
(sawtooth, octave 2, cutoff 400 Hz, resonance 14, filter env amount 3.2,
near-zero decay/sustain) and "Square Squelch" (square wave, resonance 16,
filter env amount 3.5) — both verified to apply correctly (checked every
field lands in the store) and to play without error.

**Explicitly not built** (still phase 2, unstarted): glide/portamento and
accent. The naming-collision test (`eraWorkspaces.test.js`) locks in that
neither the new workspace's `id` nor its `name` is `'roland'`, so this
doesn't silently regress if someone reaches for the obvious name later.

Verified in a real browser throughout: the 5-lane drum grid renders and
toggles correctly, transport playback actually triggers the new voices
with no console errors, the legacy-pattern self-heal works as described
above, and the Acid workspace's swatch/presets apply and play correctly
post-graduation.
