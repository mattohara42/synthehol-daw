---
date: 2026-07-04
topic: manual
status: living
---

# Synthehol — Manual

A player-facing reference for every control and feature. Everything here is
also taught in smaller pieces inside the app itself (the Learn/History tabs,
boss taunts, and the inline captions on each DAW tab) — this manual is the
one place it's all written down together, in one order, for reference.

## Getting started

Browsers block audio until you interact with the page. **Click or press a
key on the on-screen keyboard once** to start sound — after that, everything
plays normally.

The on-screen keyboard also responds to your computer keyboard:

| Keys | Plays |
|---|---|
| `A S D F G H J K` | White keys, C through the C an octave up |
| `W E` · `T Y U` | Black keys (sharps), interleaved above the white row |
| `Z` / `X` | Shift the whole keyboard down / up an octave (range: 1–7) |

Pointer position on a key also matters: pressing low on a key plays louder
(velocity), same as a real keybed. Every note — the on-screen/computer
keyboard, live MIDI, the step sequencer, and the piano roll — shares one
16-voice polyphonic pool, so chords and overlapping notes from different
sources always coexist correctly.

## The boss fights

The game teaches one synthesis concept at a time. Each stage ends in a
**boss fight**: hold the target sound while playing to drain the boss's HP
over time — letting go heals it back, so you can't wiggle past the target
for an instant and stop, you have to actually commit to the sound. Defeat
all nine to graduate. While you're actively dealing damage, a lightning
bolt arcs from the module you're fighting with to the boss panel — a quick
visual cue that what you're doing right now is working.

Every fight is bookended by a full-screen card: a **"Boss Incoming"** card
names the corrupted instrument and hints how to fight it before you begin
(click **Fight!** when you're ready), and a **"Victory"** card recaps what
you just restored (or unlocked) and previews what's next once you win
(click **Continue** to move on). Take your time reading either one — nothing
elapses while they're up.

| Stage | Concept | Boss |
|---|---|---|
| 1 | Oscillator (VCO) | Vox Corruptus |
| 2 | Filter (VCF) | The Muffled |
| 3 | Envelope (ADSR) | Dronekeeper |
| 4 | LFO | The Still |
| 5 | Noise (VNO) | The Static |
| 6 | Second oscillator (VCO2) | The Dissonant |
| 7 | Tape delay (dub echo — King Tubby) | The Repeater |
| 8 | Spring/plate reverb (dub space — Lee "Scratch" Perry) | The Void |
| 9 | Capstone — match a reference patch by ear | The Mimic |

Each module unlocks in the rack as you clear the stage before it (the delay
and reverb stages share the single **Effects** rack, so it stays locked until
you reach the dub "Act IV" pair, then opens for both fights). To beat **The
Repeater**, mix in an audible echo at a rhythmic Delay Time and enough Feedback
that the repeats sustain; to beat **The Void**, open the Reverb Mix wide enough
to genuinely fill the room. The
**History** tab (next to Learn) always shows the current stage's pioneer,
instrument, and historical fact. The ⓘ button on each module's header
switches to the **Learn** tab and opens a short piece of history for that
specific module — and several modules pull from a small pool of stories
rather than just one, so replaying the game surfaces different pioneers
each time: the Oscillator might credit Bob Moog's 1964 debut or Giorgio
Moroder's sequenced "I Feel Love" bassline; the Filter might tell Moog's
ladder-filter story or Daft Punk's filter-sweep house records; the LFO
might cover Wendy Carlos's Minimoog vibrato or Vangelis's CS-80 ribbon
controller; and the Effects module rotates between three dub pioneers —
King Tubby, Lee "Scratch" Perry, and Prince Jammy — who turned echo and
reverb into instruments in their own right.

Everything else in the app — the transport, step sequencer, piano roll,
undo/redo, and audio export — is present and usable from the very start.
Graduating doesn't unlock those; it unlocks every synth module, plus a
handful of free-play features described below.

## The synth rack

Every module below writes into the currently active track's patch (see
**Tracks**, further down, once you've graduated). Ranges are the actual
slider bounds in the app.

- **Oscillator (VCO)** — Waveform (Sine/Square/Sawtooth/Triangle), Octave
  (2–6), Detune (±50 cents), Mono (a real monophonic mode — overlap a new
  note over one you're still holding on the keyboard or a MIDI controller
  and it glides into the new pitch instead of starting a second voice),
  Glide (10 ms–1 s, how long that slide takes — only audible while Mono is
  on). Mono/Glide only affect live playing; the step sequencer and piano
  roll always play polyphonically regardless of this setting.
- **Filter (VCF)** — Type (Low Pass/High Pass/Band Pass), Cutoff (60 Hz–18
  kHz), Resonance (0.5–18 Q), Filter Env Amount (0–4, how far the envelope
  below sweeps the cutoff per note).
- **Envelope (ADSR)** — Attack (1 ms–3 s), Decay (1 ms–3 s), Sustain
  (0–100%), Release (1 ms–5 s). Shared by every voice; retriggers per note.
- **LFO** — Destination (Off/Filter/Pitch/Amp), Rate (0.05–20 Hz), Depth
  (0–100%), Waveform (Sine/Triangle/Square/Sawtooth, plus a hidden 5th
  shape — **Sample & Hold** — unlocked by a post-graduation bonus boss), and
  a Key-Sync toggle that restarts the LFO's phase on every new note instead
  of running free.
- **Noise (VNO)** — Type (White/Pink), Mix (0–100%, blended in alongside the
  oscillators).
- **Second Oscillator (VCO2)** — Waveform, Octave (±2), Detune (±50 cents),
  Mix (0–100%) — layer a second voice for thickness or wide detuned unison.
- **Equalizer** — 3-band Low/Mid/High, each ±12 dB.
- **FX** — Drive (0–100% waveshaper saturation), Delay (time 30 ms–800 ms,
  feedback 0–85%, mix 0–100%), Reverb (mix 0–100%), and **Chorus** (mix
  0–100% — hidden until unlocked by a second post-graduation bonus boss).

Hovering an unselected option in most toggle groups (waveform, filter type,
noise type, LFO destination/shape) previews it — a quick A/B against your
current patch — without touching your held note or committing to the
change.

## Post-graduation bonus challenges

Two extra boss fights become available once you graduate, each gating one
extra control behind proving you can get most of the way there by hand
first:

- **The Predictable** (corrupted Buchla 266) — unlocks the LFO's **Sample &
  Hold** waveform. Gate: LFO → Pitch, Square shape, Rate above 15 Hz, Depth
  above 70%, while playing.
- **The Solitary** (corrupted Roland CE-1) — unlocks the **Chorus** FX
  control. Gate: Osc 2 Mix above 50% detuned more than 20 cents, Delay Mix
  and Feedback both above 30%, while playing.

## The DAW

### Transport

Play/Stop, a live `bar . beat . sixteenth` position readout, an editable
BPM field (20–300, tap the **Tap** button a few times in rhythm to set it by
feel instead), a fixed 4/4 time signature display, and three toggles:
**Metronome** (a click per beat, accented on the downbeat), **Loop** (repeats
the current pattern instead of stopping at the end), and **Count-in** (one
bar of clicks before the *next* time you press Play — not retroactive to a
run already playing).

### Step Sequencer

An 8-note diatonic grid (C major scale, one row per scale degree) times up
to 16 steps — click a cell to toggle a note. Directly below the pitch rows
is an **Accent** lane — a single row (not per-voice like the drum lanes
below it): click a step to mark it accented, and any note in that column
plays louder (a TB-303-style accent). Below that are five **drum lanes**
(Kick/Snare/Hat/Cowbell/Clap — the last two are synthesized in the
TR-808's own style, not samples). Below those, an **automation lane**: pick
a parameter (Cutoff/Resonance/Volume) from the Automate dropdown, then drag
in the strip to draw a value curve per step (drag to the floor to clear a
point). **Steps** switches between an 8- or 16-step pattern; **Swing**
delays every other 16th note for a shuffled feel; **Duplicate** copies the
first half of the pattern (notes, accent, drums, automation) into the
second half; **Clear** wipes everything.

### Piano Roll

A chromatic 2-octave grid (24 rows) sharing the same 16-step timeline as the
Sequencer. Click to add a note, drag its right edge to lengthen it, click an
existing note to remove it. Unlike the step grid, a piano-roll note can span
multiple steps as one held note rather than one blip per cell.

### Pattern clips

A "Pattern" bar above the Sequencer/Piano Roll shares one library of named
snapshots per track — **Save** the current pattern (steps, drums,
automation, and piano roll together) under a name, **Load** it back,
**Duplicate** it, or **Delete** it. Independent from the synth **Presets**
bar, which saves the *sound*, not the *pattern*.

### MIDI

**Live input**: if your browser supports Web MIDI (not Safari, not iOS), a
connected controller plays notes through the same polyphonic pool as the
on-screen keyboard — chords from both sources interleave correctly.

**File import/export**: "Import .mid" / "Export .mid" (next to the Pattern
bar) round-trip the Piano Roll lane specifically as a Standard MIDI File —
one bar, a 2-octave window. Importing a file whose notes sit outside that
window automatically transposes it by whole octaves to fit; anything that
still doesn't fit is dropped, and the button briefly reports how many notes
were imported (or why the file couldn't be read).

### Tracks *(graduation-gated)*

A track picker above the transport: switch which track the whole rack is
editing, **+ Add Track** (clones the current track's instrument and pattern
as a starting point, up to 4 tracks total), **Remove** (always removes the
*active* track — switches to a neighbor first if needed), and a quick
**Mute** toggle for whichever track is active. Every track plays
simultaneously through its own instrument chain — this isn't a "the last
one you touch is the only one that plays" picker, all of them sound at
once.

### Mixer *(graduation-gated)*

A "Mixer" tab with one channel strip per track — click a track's name to
switch to it (same effect as the Tracks picker), a pan knob, a gain fader,
Mute/Solo buttons, and a live peak meter. Soloing a track silences every
*other* non-soloed track; **muting always wins over soloing** — a muted
track stays silent even if you solo it. The rightmost strip is the Master
bus: a meter only, no separate fader (the header's Vol slider is still the
one control for that).

### Undo / Redo

`Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`), or the header buttons. Covers every
edit — slider tweaks, sequencer/piano-roll changes, track add/remove, mixer
fader/pan/mute/solo — coalescing a slider drag into one undo step rather
than one step per pixel moved.

### Presets, sharing, and export

The **Presets** bar (top of the rack) saves/loads a full synth patch by
name to your browser's local storage. **Share** copies a link that encodes
the current patch in the URL — sending it to someone loads your exact
sound the instant they open it. **Export** records the live output in
real time to a `.webm` file (start it, play, stop it, download); **Render
WAV** instead renders the current pattern offline to a `.wav` file
instantly, with no need to press Play first.

Your whole project — every track, the pattern, and transport settings —
also auto-saves to local storage as you work and restores itself on
reload, so a refresh never loses progress.

## Practice gym *(graduation-gated)*

A "Practice" tab: **Hear Target** plays a curated reference patch, then dial
in your own Oscillator/Detune/Envelope/Osc 2/Noise controls to match it by
ear — a live closeness meter shows how close you are. Hold a close match for
under a second to nail it and automatically advance to a new target,
**New Target** skips ahead manually. The filter and LFO aren't scored here
(the preview that plays the target bypasses both), so trust what you hear
over the sliders' own positions.

## Era workspaces *(graduation-gated)*

A "Workspace" picker in the History tab: five palettes — four matching the
synths that taught you (Moog, ARP, Oberheim, Sequential Circuits), plus
**Acid**, a squelchy resonant-filter recipe in the style of the Roland
TB-303. Its two presets turn Mono on with a snappy Glide time, so playing
them legato on the keyboard or a MIDI controller actually slides between
notes — the accent lane in the step sequencer is a separate control (see
above) for programmed patterns, since Mono's glide only applies to live
playing, not the sequencer. Each workspace recolors the rack's accent and
offers a couple of curated presets true to its sound. Hover a workspace's
name for its pioneer and a one-line history note. Purely cosmetic + a
preset shortcut — it doesn't gate any control's behavior.

## Skeuomorphic skin

A **Skin** button in the header (next to Undo/Redo) toggles the whole rack
between the default flat look and a wood-and-brushed-metal hardware skin —
deeper panel bevels, knurled metal knob caps, milled fader caps, and
press-in buttons. Purely cosmetic (no control's behavior or value changes)
and available from the very first session, unlike the graduation-gated Era
workspaces above — it's a rendering preference, not a reward. Your choice
persists across reloads.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `A S D F G H J K` / `W E T Y U` | Play notes |
| `Z` / `X` | Octave down / up |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |

## Tips

- If nothing plays, click a key first — every browser requires a user
  gesture before it will start an `AudioContext`.
- Live MIDI input needs a browser with Web MIDI support (Chrome/Edge; not
  Safari or iOS) — file-based `.mid` import/export works everywhere as the
  universal fallback.
- Undo/redo, project auto-save, and audio export all work identically
  whether or not you've graduated — none of the free-play foundation is
  gated, only the extra modules/tabs described above are.
