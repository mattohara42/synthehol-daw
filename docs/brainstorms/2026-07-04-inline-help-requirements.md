---
date: 2026-07-04
topic: inline-help-requirements
status: direction-proposed
---

# Synthehol — Inline Instructions & Help (per module/feature) Requirements

Scoping pass for "does every module and feature explain itself," prompted by
noticing the DAW-tier surfaces shipped since E4/D5/D6/L10 have no equivalent
of the synth rack's Learn panel. Same audit-first shape as the E4/mixer docs
— read what actually exists before proposing anything new.

## Correcting a premise before scoping anything

The working assumption going in was "the synth rack has rich help; the DAW
surfaces have none." That's not quite right — reading every UI module turned
up **three different help mechanisms already in production**, just applied
inconsistently:

1. **The Learn panel** (`teaching.js`'s `teach(key)` → `#teach-title`/
   `#teach-body`/`#teach-canvas`) — multi-sentence explanation plus a little
   diagram, triggered on every control change. Wired **exclusively** from
   `controls.js` (every synth-rack slider/toggle) and `progressionUI.js`
   (lore buttons, boss hints). Zero calls from any DAW-surface UI module
   (`transportUI.js`, `sequencerUI.js`, `pianoRollUI.js`, `tracksUI.js`,
   `mixerUI.js`, `clipsUI.js`, `midiFileUI.js`, `practiceUI.js`,
   `eraWorkspacesUI.js`) — confirmed by grepping every `teach(` call site.
2. **A static inline caption** — one persistent sentence living directly in
   a tab's own toolbar/body (`<span class="seq-ctrl" style="color:var(--text-dim)">`
   or a dedicated hint `<div>`), always visible, no click needed. Already
   used by **three of the four post-graduation lower-tabs**: Piano Roll
   ("Click to add a note, drag right to lengthen…"), Practice (a full
   paragraph on what's scored and how matching works), and Mixer ("Click a
   track's name to switch to it"). The Sequencer tab — the oldest of the
   four — never got one.
3. **Native `title=""` tooltips** — hover-only, one phrase, everywhere else:
   the transport bar, tracks bar, clips bar, MIDI import/export, presets
   bar, mixer channel-strip controls (`Level`/`Pan`/`Mute`/`Solo` — single
   words), and — worth calling out since it's easy to miss in a static grep
   — **era workspace swatches and presets, which already carry real
   historical context** (`eraWorkspacesUI.js` sets `btn.title =
   '${era.pioneer} — ${era.tagline}'` dynamically), just gated entirely
   behind a hover a player has no particular reason to attempt.

So the real gap isn't "no help exists," it's **inconsistency** (three tiers,
applied per-module with no stated rule for which a new feature should use)
plus **one truly bare spot**: the Sequencer tab's own toolbar and grid have
no caption and no tooltips explaining the diatonic row mapping or what the
automation lane actually controls — the one lower-tab with strictly nothing
beyond a control's own visible label.

Two more existing mechanisms are adjacent but answer a different question
entirely, and shouldn't be touched here: `hoverPreview.js` (D2) teaches *by
ear* (an A/B toggle-group preview), and `diagnostics.js` (D4) reacts to the
*current sound* ("Energy piling up 250–500 Hz…"), not to a control. Neither
overlaps with "what does this button do."

**A layout premise also needed checking, not just assumed**: does the Learn
panel even sit somewhere visible while a player's looking at a DAW tab? Yes,
on desktop — `style.css`'s `main` grid places `.stage-region` (the lower-tabs
area + keyboard) and `.teach-panel` **side by side in the same grid row**
(row 2, columns 1 and 2), so a Learn-panel update is visible without
switching away from whatever tab is open. Below the existing mobile
breakpoint, `main` collapses to `display: block` and `.teach-panel` stacks
*after* everything else (a pre-existing constraint for the synth rack's own
`teach()` calls too, not something this work would newly introduce).

## Audit: what help already exists, module by module

| Module / feature | Tier today | Notes |
|---|---|---|
| Oscillator, Osc2, Noise, Filter, Envelope, LFO, EQ, FX | 1 — Learn panel | Full coverage, tested (`teaching.test.js`). |
| Module History/lore (ⓘ buttons) | 1 — Learn panel (History tab) | Per synth-rack module only. |
| Boss hints | 1 — Learn panel (per-encounter) | Combat-specific, separate keys. |
| Piano Roll | 2 — static caption | Explains click/drag/remove. |
| Practice | 2 — static caption | Explains scoring dimensions and hold-to-nail. |
| Mixer | 2 — static caption | Explains the name-click-to-switch affordance only — nothing about mute/solo interaction, fader range, or what pan does. |
| **Sequencer** | **4 — nothing** | No caption (unlike its three sibling tabs); no explanation that rows are scale degrees, what "Automate" actually writes, or that drum lanes exist below the pitch grid. |
| Transport bar | 3 — title only | BPM/loop/count-in/metronome/tap-tempo are all one-word tooltips; no explanation of e.g. what loop actually loops (the pattern, not a selection) or that count-in only affects the *next* Play press. |
| Tracks bar | 3 — title only | No caption explaining what a "track" is at this stage (an independent instrument + pattern) or that Remove can't target the last/active track. |
| Era workspaces | 3 — title only (richer than most, still hover-gated) | Sits inside the **History** tab, not Learn — the one place extending `teach()` doesn't fit the existing structure (see below). |
| Clips bar | 3 — title only (partial) | Only the `<select>` and the two MIDI buttons have titles; Save/Load/Duplicate/Delete rely on their own labels. |
| Mixer channel-strip controls | 3 — title only | Single-word titles (`Pan`, `Level`); no explanation that mute always wins over solo. |
| Presets bar | 3 — title only | Export/Render/Share explained; Load/Save/Delete rely on labels. |
| Header (Undo/Redo/Reset/master vol) | 3 — title only | Keyboard shortcuts shown; adequate as-is. |

## Proposed scope for v1

Two moves, both reusing an existing mechanism rather than inventing a
fourth:

1. **Give the Sequencer tab the caption its three siblings already have** —
   a `.seq-ctrl`-styled sentence in its toolbar (zero new CSS, exact same
   markup Piano Roll/Mixer already use) covering: rows are scale degrees
   (C major), the automation lane writes per-step cutoff/resonance/volume
   for whichever param is selected, and drum lanes sit below the pitch
   grid. Closes the one real "nothing at all" gap.
2. **Add the same style of caption to three more spots that only have
   title-only coverage today, because each has a genuine non-obvious
   mental model a label alone doesn't convey**:
   - **Tracks bar** — what a track *is* here (own instrument + pattern,
     not a bus) and that Remove always targets the active track.
   - **Mixer** — extend the existing one-line caption to also state the
     mute-always-wins-over-solo rule, since that's the one piece of
     mixer behavior a player can't infer from the strip's own controls.
   - **Era workspaces** — currently the single richest-but-most-hidden
     spot (real pioneer/tagline copy sitting behind a hover nobody's
     prompted to try). Add a short static line in the `#era-workspaces`
     block itself (its own Tier-2 caption, *not* a `teach()`/Learn-panel
     call — see the open question below for why).

**Recommend *not* extending `teach()`/the Learn panel to any DAW-surface
control.** The audit didn't turn up a DAW-tier concept that actually needs
Tier 1's depth (multi-paragraph explanation + diagram) the way filter
cutoff or ADSR genuinely do — transport/tracks/mixer/sequencer mental
models are all one-sentence-explainable. Reusing Tier 2 for all of them
keeps one consistent shape across every post-graduation tab instead of
introducing a second competing pattern that would need its own "which tier
does a new feature use" judgment call every time.

## Open question

Era workspaces live inside the **History** tab (`#teach-view-history`), not
Learn — the one place in this audit where "just call `teach()`" doesn't
mechanically fit, since a `teach()` call writes to the Learn view and would
require also force-switching the visible teach-tab away from History (where
the picker the player is looking at actually lives) back to Learn, fighting
whatever the player was doing. Resolving this by giving `#era-workspaces`
its own inline caption (Tier 2, in-place) sidesteps the conflict entirely
and was assumed above — flagging it explicitly in case there's an appetite
for a richer treatment (e.g. a fourth teach-tab, or reusing the lore-button
`ⓘ` pattern) instead. No functional downside either way; recommend the
cheaper option unless there's a reason to want more.

## Explicitly out of scope for v1

A fourth help mechanism of any kind (onboarding tour, coach marks,
first-run modal) — the project's anti-goals already rule out dialogs for
anything short of the one progress-reset confirm, and every existing
mechanism here is either always-visible (captions) or a hover a player
naturally reaches for (titles), so nothing needs to *interrupt* to be seen.
Extending lore/history-style "why does this exist" framing to DAW features
(e.g. a short console/tape-era history note for the Mixer) — plausible
future D-tier bet, but a separate, smaller decision from "does this control
explain what it does," not needed to close the gap this doc is scoping.

## Suggested first slice

One small pass, no multi-step rollout needed — this is even smaller than
the L10 mixer view was: four caption strings added to existing DOM
elements (Sequencer toolbar, Tracks bar, Mixer's existing caption extended,
Era workspaces), zero new CSS classes, zero new audio/store plumbing, zero
new JS modules. Verify by reading the rendered captions in a real browser
per tab (a screenshot per lower-tab is enough — there's no interactive
behavior to exercise beyond what already ships) rather than new unit tests,
matching the project's existing convention that DOM-caption text doesn't
get dedicated test coverage (`teach()`'s *dynamic* logic is tested; static
strings in `index.html` are not, the same way Piano Roll/Practice/Mixer's
existing captions aren't).
