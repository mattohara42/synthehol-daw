# Synthehol

An interactive, in-browser synthesizer that teaches the building blocks of analog synthesis: oscillator, filter, envelope (ADSR), and LFO. Every control comes with a live teaching panel explaining what it does and why it sounds that way.

Built with the Web Audio API — no audio libraries, no backend.

## Running it

```
npm install
npm run dev
```

Open the printed local URL, click a key (or press A–K on your keyboard) to hear it.

## Building

```
npm run build
npm run preview   # serve the production build locally
```

## Project structure

```
index.html        markup only — modules, keyboard, scope, teaching panel
src/
  main.js         entry point: wires everything up on load
  state.js        S — the single source of truth for all synth params
  audio.js        Web Audio signal chain: osc → VCA → VCF → master → scope
  notes.js        note name → frequency
  keyboard.js     on-screen piano + computer-keyboard input
  controls.js     wires sliders/buttons to state, audio params, redraws
  canvas.js       shared drawing primitives + the four per-module mini-canvases
  scope.js        the live oscilloscope (reads the master AnalyserNode)
  teaching.js     the "what does this do" copy + illustrations
  ui.js           tiny DOM helpers (status pill, slider fill %)
  style.css       all styling
```

## Signal flow

```
Oscillator (VCO) → Envelope (VCA) → Filter (VCF) → Master → Oscilloscope → speakers
                                                        ↑
LFO ───────────────────────────── routes to one of: filter cutoff, pitch, or amp
```

`synthehol.html` is the original single-file prototype this project was split from — kept for reference, no longer the active build.
