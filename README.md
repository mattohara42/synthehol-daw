# Synthehol

An interactive browser synth and guided learning game. Players unlock analog
synthesis concepts one at a time — each stage ends in a **boss fight** won by
sculpting (or reproducing) the target sound. Defeating all nine bosses
graduates you into a free-play DAW sandbox — which already has a transport,
step sequencer, piano-roll, live MIDI input, undo/redo, project auto-save,
and audio export underneath it the whole time, ungated.

Built with the Web Audio API — no audio libraries, no backend, no framework.

## Where everything lives / getting the latest

- **Canonical repo:** `mattohara42/synthehol-daw` on GitHub
  (`https://github.com/mattohara42/synthehol-daw`).
- **`master` is the trunk** — the integrated, always-working version. Every
  feature lands here via a pull request. **To get the newest code, use `master`.**
- Active work happens on short-lived `claude/*` session branches (named per
  build session, so don't hardcode one here) that get merged back into
  `master`. Once a branch's PR is merged, treat it as history — check
  `master` (or the branch you were explicitly pointed at) for the current
  state rather than assuming any particular `claude/*` name is still live.

**First time on a new machine** (run from a *writable* folder such as your home
directory — not `/`, which is read-only on macOS):

```bash
cd ~
git clone https://github.com/mattohara42/synthehol-daw.git
cd synthehol-daw
npm install
npm run dev
```

**Already have it — pull the latest:**

```bash
cd ~/synthehol-daw          # wherever you cloned it
git checkout master
git pull origin master
npm install                 # only if dependencies changed
npm run dev
```

`npm run dev` prints a local URL (usually `http://localhost:5173`, or the next
free port like `5174` if that's taken). Open it, then **click a key or the Play
button once** — browsers block audio until a user gesture.

### Auto-syncing dev server (no more manual pulls)

If you're following along while changes land on `master`, use **`npm run dev:live`**
instead of `npm run dev`. It runs the same dev server *and* pulls new commits in
the background, so the browser hot-reloads to the latest without you ever running
`git pull` — leave it running and just watch. Ctrl-C stops it.

```bash
npm run dev:live              # tracks origin/master, checks every 15s
npm run dev:live -- main 30   # optional: different branch / interval (seconds)
```

It only fast-forwards, so it won't stomp local edits (it skips with a warning if
you have conflicting changes). macOS/Linux run it directly; on Windows use Git
Bash or WSL.

For a deeper map of the architecture (the state store, transport clock, voice
pool, sequencer, and how they fit together), see **`CLAUDE.md`** and the design
docs under **`docs/`** (`docs/backlog.md`, `docs/daw-layout-backlog.md`,
`docs/daw-feature-gap-backlog.md`, `docs/brainstorms/`, `docs/plans/`). For a
player-facing guide to every control and feature, see **`docs/MANUAL.md`**.

## How it works

Each stage teaches one synthesis concept and ends in a boss fight:

| Stage | Concept | Boss |
|-------|---------|------|
| 1 | Oscillator (VCO) | Vox Corruptus |
| 2 | Filter (VCF) | The Muffled |
| 3 | Envelope (ADSR) | Dronekeeper |
| 4 | LFO | The Still |
| 5 | Noise (VNO) | The Static |
| 6 | Second oscillator (VCO2) | The Dissonant |
| 7 | Tape delay (dub echo) | The Repeater |
| 8 | Spring/plate reverb (dub space) | The Void |
| 9 | Capstone — match a reference patch by ear | The Mimic |

Hold the target sound while playing → drain the boss's HP over time (letting
go heals it back — no wiggling past a threshold and stopping) → defeat the
boss → unlock the next module. Restore all nine to graduate into free-play.
The transport, step sequencer, piano-roll, undo/redo, and audio export are
all present and usable throughout — graduation doesn't unlock them, it just
means every synth module is unlocked too.

Graduation itself unlocks a few things: up to 4 simultaneous **tracks**, each
with its own instrument and pattern (picker + a **Mixer** tab with per-track
fader/pan/mute/solo/meter), a curated **Workspace** picker (Moog/ARP/Oberheim/
Sequential preset banks per synth-history era), and a **Practice** tab (an
ear-training loop — match a target patch by feel, no HP or boss involved).
Two bonus bosses are also available post-graduation, gating a 5th LFO shape
(Sample & Hold) and a Chorus effect behind mastery challenges.

## Running it

See [Where everything lives / getting the latest](#where-everything-lives--getting-the-latest)
above for the full setup. The short version:

```
npm install
npm run dev
```

Open the printed local URL, click a key (or press A–K on your keyboard) to start.

## Building

```
npm run build
npm run preview   # serve the production build locally
```

## Testing

```
npm test
```

## Project structure

```
index.html          markup — modules, transport bar, sequencer/roll tabs, keyboard, scope, teaching, boss panel
src/
  Synth layer
    main.js           entry point: wires synth, engine, progression, single rAF animation loop
    state.js          S — the active track's params (a view onto the store; read S, write via store)
    audio.js          Web Audio signal chain: voices → VCF → drive → EQ → master → scope (+ FX, + export tap)
    notes.js          note name / MIDI number → frequency + name tables
    chordState.js     chord-level onset/release bookkeeping shared by every note-input source
    keyboard.js       on-screen piano + computer-keyboard input (A–K, Z/X octave), fully polyphonic
    midi.js           live Web MIDI input (feature-detected, never hard-gates)
    controls.js       wires sliders/buttons to the store, audio params, canvas redraws, applyPreset()
    canvas.js         drawing primitives + per-module mini-canvases
    scope.js          live oscilloscope + spectrum (read the master AnalyserNode)
    teaching.js       per-control explanations + illustrations (Learn tab)
    knob.js           vertical-drag knob enhancer over native range inputs
    drums.js          three synthesized drum one-shots (kick/snare/hat)
    presets.js        save/load named synth presets + shareable URL patches (localStorage)
    ui.js             DOM helpers (status pill, slider fill %)
    style.css         all styling + era accent system + battle/transport/sequencer layout
  Engine layer (serializable DAW foundation)
    store.js          the project tree + undo/redo + pattern clips + tracks; S is store.params() (E1/E4)
    scheduler.js      pure lookahead step scheduler + musical-position helpers (E2)
    clock.worker.js   Web Worker coarse clock (throttle-proof timing) (E2)
    transport.js      play/stop/tempo/loop/count-in over the store; drives the scheduler (E2)
    metronome.js      first scheduler consumer — a click per beat (E2)
    voices.js         polyphonic voice pool (osc+osc2+noise) + voice stealing (E3)
    persistence.js    auto-saves/restores the whole project to localStorage (E6)
    exporter.js       real-time MediaRecorder capture → downloadable .webm (F2)
    wavRender.js      offline OfflineAudioContext render → downloadable .wav (E6)
    midiFile.js       Standard MIDI File (.mid) encode/decode for the piano-roll lane (L16a)
  DAW surfaces
    transportUI.js    the transport bar UI (Play/BPM/metronome/loop/count-in/tap-tempo) (L2)
    sequencer.js      step-sequencer engine: grid + drums + automation → scheduled polyphonic notes (L6)
    sequencerUI.js    the step-grid UI + ruler + transport-synced playhead (L5/L6)
    pianoroll.js      chromatic piano-roll engine: note runs → scheduled polyphonic notes (L7)
    pianoRollUI.js    the piano-roll grid UI + playhead (L7)
    clipsUI.js        save/load/duplicate/delete named pattern clips (L8)
    midiFileUI.js     Import .mid / Export .mid buttons wired to midiFile.js (L16a)
    tracksUI.js       track picker — switch/add/remove/mute tracks (graduation-gated) (E4)
    mixerUI.js        channel-strip mixer view — fader/pan/mute/solo/meter per track (E4/L10)
  Differentiation layer (legibility/feedback bets)
    signalFlow.js     per-module signal LEDs so you can watch audio move through the rack (D3)
    diagnostics.js    interprets the live spectrum into one actionable line (D4)
    practice.js       practice-gym engine — curated target patches + hold-to-nail scoring (D6)
    practiceUI.js     the graduation-gated Practice tab (D6)
    eraWorkspaces.js  curated preset banks per synth-history era (Moog/ARP/Oberheim/Sequential) (D5)
    eraWorkspacesUI.js the graduation-gated Workspace picker in the History tab (D5)
  Progression layer
    stages.js         7-stage progression data (osc/filter/envelope/lfo/noise/osc2/capstone) + target predicates
    progression.js    progression singleton (stage index, XP, defeated, localStorage)
    bossEngine.js     pure boss evaluator — ticked once/frame, drains/heals HP, fires damage/restore callbacks
    bossArt.js        inline SVG boss characters
    bossAudio.js      combat sound effects
    bossZap.js        lightning-bolt visual FX from the corrupted module to the boss panel
    progressionUI.js  boss panel, module lock/unlock, battle layout, graduation screen
```

Most files have a matching `*.test.js` beside them (Vitest — 22 files, 295
tests). `CLAUDE.md` has the authoritative, detailed description of each
module and the conventions.

## Signal flow

```
Voices (osc + osc2 + noise → per-voice ADSR) → Filter (VCF) → Drive → EQ (3-band) → Master → Oscilloscope → speakers
                                                                                        ↑
LFO ─────────────────────────────── routes to one of: filter cutoff, pitch, or amp
```

Every note — the on-screen/computer keyboard, live MIDI, the step sequencer,
and the piano-roll — allocates its own voice from the same polyphonic pool;
there is no separate mono path.

`synthehol.html` is the original single-file prototype this project was split
from — kept for reference, not part of the active build.
