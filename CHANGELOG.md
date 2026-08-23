# Changelog

All notable changes to Synthehol are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-20

First tagged release. Synthehol is a browser synth and guided learning game,
built on plain JS (ES modules) + Web Audio API + Canvas 2D, bundled with Vite —
no framework, no audio library. Players learn synthesis one concept at a time by
winning boss fights, then graduate into a free-play DAW sandbox.

### Progression & learning game

- Nine boss-gated stages teaching one synthesis concept each: oscillator, filter,
  envelope, LFO, noise, a second oscillator, a Jamaican-dub "Act IV" pair (tape
  delay "The Repeater" and spring reverb "The Void"), and a "match the sound"
  Prophet-5 capstone ("The Mimic").
- Time-based boss damage, XP, defeat/restore animation, and a graduation screen.
- Boss intro/victory transition cards pacing every fight, plus a lightning-bolt
  combat visual from the corrupted module to the boss panel.
- A rotating historical-lore pool covering Bob Moog, Wendy Carlos, Alan Pearlman,
  Tom Oberheim, Vangelis, Giorgio Moroder, Daft Punk, King Tubby, Lee "Scratch"
  Perry, and Prince Jammy — different pioneers surface on each playthrough.
- Post-graduation bonus challenges: a Sample & Hold LFO shape and a Chorus FX
  knob, each gated behind its own boss.

### Synth engine

- Two-oscillator + noise subtractive engine with filter, filter envelope, ADSR,
  a four-waveform LFO with key-sync retrigger, a 3-band EQ, drive/saturation, and
  delay + reverb.
- 16-voice polyphony shared by the live keyboard, MIDI, and sequencer.
- Velocity sensitivity, hardware-style rotary knobs, and an optional Mono toggle
  with Glide (portamento) for live keyboard/MIDI play.
- Skeuomorphic UI skin option and graduation-gated era workspaces (Moog, ARP,
  Oberheim, Sequential, Acid) with curated presets.

### DAW foundation & surfaces

- Serializable project store with undo/redo, a worker-clock transport/scheduler,
  and localStorage project auto-save.
- Transport bar, step sequencer (drums, multi-param automation, duplicate),
  piano roll, and pattern/clip management.
- Up to four simultaneously-playing tracks, each with its own instrument patch,
  pattern, filter/LFO/voice pool, and mixer strip (pan, gain, mute/solo, meters).
- Audio export (real-time `.webm`/`.opus` and offline `.wav` render) and Standard
  MIDI File import/export for the piano-roll lane.
- Live Web MIDI input where supported.

### Differentiation bets

- Visible signal-flow LEDs per rack module.
- Sound diagnostics — "a grammar checker for sound" — surfacing at most one short,
  actionable line about the current tone.
- A graduation-gated practice gym with a curated target-patch bank and
  sustained-match-to-nail scoring.

### Tooling

- Vitest test suite (23 files, 306 tests) and a Vite production build.
- GitHub Pages auto-build and deploy on every push to `master`.

[0.1.0]: https://github.com/mattohara42/synthehol-daw/releases/tag/v0.1.0
