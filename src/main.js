// Entry point: wires up the keyboard, controls, canvases, and animation
// loop once the DOM has loaded.

import './style.css';
import { S } from './state.js';
import { store } from './store.js';
import { engine, voiceNoteOn, voiceNoteOff, releaseAllVoices } from './audio.js';
import { bossEngine } from './bossEngine.js';
import { initKeyboard } from './keyboard.js';
import { initControls, applyPreset } from './controls.js';
import { drawOscCanvas, drawOsc2Canvas, drawNoiseCanvas, drawFilterCanvas, drawADSRCanvas, drawLFOCanvas, drawFXCanvas, advanceLfoPhase } from './canvas.js';
import { drawScope, drawSpectrum } from './scope.js';
import { initProgressionUI } from './progressionUI.js';
import { initBossAudio } from './bossAudio.js';
import { initPresetsUI } from './presets.js';
import { initExport } from './exporter.js';
import { initKnobs } from './knob.js';
import { transport } from './transport.js';
import { metronomeConsumer } from './metronome.js';
import { initTransportUI, refreshTransportPosition } from './transportUI.js';
import { createSequencerConsumer } from './sequencer.js';
import { initSequencerUI, refreshSequencerPlayhead } from './sequencerUI.js';

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
}));
initTransportUI();
initSequencerUI();
initBossAudio();
initPresetsUI(applyPreset);

let lastFrame = 0;

function animate(now) {
  requestAnimationFrame(animate);
  advanceLfoPhase();
  drawLFOCanvas();
  refreshTransportPosition();
  refreshSequencerPlayhead();

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
