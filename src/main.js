// Entry point: wires up the keyboard, controls, canvases, and animation
// loop once the DOM has loaded.

import './style.css';
import { S } from './state.js';
import { store } from './store.js';
import { engine, voiceNoteOn, voiceNoteOff, releaseAllVoices } from './audio.js';
import { bossEngine } from './bossEngine.js';
import { initKeyboard } from './keyboard.js';
import { initControls, applyPreset } from './controls.js';
import { drawOscCanvas, drawOsc2Canvas, drawNoiseCanvas, drawFilterCanvas, drawEqCanvas, drawADSRCanvas, drawLFOCanvas, drawFXCanvas, advanceLfoPhase } from './canvas.js';
import { drawScope, drawSpectrum } from './scope.js';
import { initProgressionUI } from './progressionUI.js';
import { initBossAudio } from './bossAudio.js';
import { initPresetsUI, readPatchFromHash } from './presets.js';
import { initExport } from './exporter.js';
import { initWavRender } from './wavRender.js';
import { initKnobs } from './knob.js';
import { transport } from './transport.js';
import { metronomeConsumer } from './metronome.js';
import { initTransportUI, refreshTransportPosition } from './transportUI.js';
import { createSequencerConsumer } from './sequencer.js';
import { initSequencerUI, refreshSequencerPlayhead } from './sequencerUI.js';
import { createPianoRollConsumer } from './pianoroll.js';
import { initPianoRollUI, refreshPianoRollPlayhead } from './pianoRollUI.js';
import { initClipsUI } from './clipsUI.js';
import { initPersistence } from './persistence.js';
import { playKick, playSnare, playHat } from './drums.js';

// Debug/integration hooks: the project store (E1), transport (E2), and the
// polyphonic voice path (E3). Future UI (sequencer, undo) and console
// verification reach them here.
window.synthStore = store;
window.synthTransport = transport;
window.synthAudio = { engine, voiceNoteOn, voiceNoteOff, releaseAllVoices };

initKeyboard();
initControls();
initKnobs();
initExport();
initWavRender();

// Undo/redo (E7): a header button pair plus the standard Ctrl+Z / Ctrl+Shift+Z
// (and Ctrl+Y) shortcuts. store.undo()/redo() already existed and were fully
// tested but had no UI — this just surfaces them.
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
function syncUndoRedoButtons() {
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
}
// store.undo()/redo() only revert the plain params object — nothing re-syncs
// the sliders, toggle buttons, engine AudioParams, or mini-canvases from it
// (controls.js only wires DOM → store/audio, never the reverse). applyPreset
// already does exactly that resync (it's built for loading a saved preset),
// so reusing it here is what actually makes undo/redo visible and audible.
function resyncControlsFromStore() {
  applyPreset(store.params());
  syncUndoRedoButtons();
}
undoBtn?.addEventListener('click', () => { if (store.undo()) resyncControlsFromStore(); });
redoBtn?.addEventListener('click', () => { if (store.redo()) resyncControlsFromStore(); });
store.subscribe(syncUndoRedoButtons); // any edit can flip canUndo/canRedo (a fresh edit clears the redo stack)
syncUndoRedoButtons();

window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't hijack native text-field undo
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) { e.preventDefault(); if (store.undo()) resyncControlsFromStore(); }
  else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); if (store.redo()) resyncControlsFromStore(); }
});

// Transport clock + metronome + transport-bar UI (L2). Registered eagerly;
// nothing plays until the user hits Play. The bar's live position readout is
// pulled each frame in animate() (position is mutated in place, off the
// subscription path — see transportUI.js).
transport.init();
transport.registerConsumer(metronomeConsumer);

// Step sequencer (L6): the pattern grid plays through the polyphonic voice path.
transport.registerConsumer(createSequencerConsumer({
  getPattern: () => store.pattern(),
  getBpm: () => store.get().transport.bpm,
  noteOn: voiceNoteOn,
  noteOff: voiceNoteOff,
  setCutoff: (v, t) => { if (engine.vcf) engine.vcf.frequency.setTargetAtTime(v, t, 0.02); },
  setResonance: (v, t) => { if (engine.vcf) engine.vcf.Q.setTargetAtTime(v, t, 0.02); },
  setVolume: (v, t) => { if (engine.master) engine.master.gain.setTargetAtTime(v, t, 0.02); },
  playKick: (t) => playKick(engine.ctx, engine.master, t),
  playSnare: (t) => playSnare(engine.ctx, engine.master, t),
  playHat: (t) => playHat(engine.ctx, engine.master, t),
}));

// Piano-roll (L7 lean step): a chromatic lane in the same pattern, played
// through the same polyphonic voice path, held notes instead of one-step blips.
transport.registerConsumer(createPianoRollConsumer({
  getPattern: () => store.pattern(),
  getBpm: () => store.get().transport.bpm,
  noteOn: voiceNoteOn,
  noteOff: voiceNoteOff,
}));
initTransportUI();
initSequencerUI();
initPianoRollUI();
initClipsUI();
initBossAudio();
initPresetsUI(applyPreset);

// Project persistence (E6 lean step): restore a saved project, if any,
// before the shared-patch-link check below so an explicit shared link still
// wins over the passively auto-restored project.
initPersistence(store, applyPreset);

// Shared-patch link (B16): apply a `#patch=...` in the URL, if present, over
// the defaults. Never throws on a malformed/missing hash.
const sharedPatch = readPatchFromHash();
if (sharedPatch) applyPreset(sharedPatch);

let lastFrame = 0;

function animate(now) {
  requestAnimationFrame(animate);
  advanceLfoPhase();
  drawLFOCanvas();
  refreshTransportPosition();
  refreshSequencerPlayhead();
  refreshPianoRollPlayhead();

  // Drive the boss fight: drain HP while the target sound is held + playing.
  // Clamp dt so a backgrounded tab doesn't dump a huge drain on return.
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
  lastFrame = now;
  bossEngine.tick({ S, isPlaying: engine.noteOn, dt });
}

window.addEventListener('load', () => {
  setTimeout(() => {
    drawOscCanvas();
    drawOsc2Canvas();
    drawNoiseCanvas();
    drawFilterCanvas();
    drawEqCanvas();
    drawADSRCanvas();
    drawFXCanvas();
    animate();
    drawScope();
    drawSpectrum();
  }, 80);
  initProgressionUI();
});

window.addEventListener('resize', () => {
  drawOscCanvas();
  drawFilterCanvas();
  drawADSRCanvas();
  drawFXCanvas();
});
