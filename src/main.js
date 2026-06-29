// Entry point: wires up the keyboard, controls, canvases, and animation
// loop once the DOM has loaded.

import './style.css';
import { S } from './state.js';
import { store } from './store.js';
import { engine } from './audio.js';
import { bossEngine } from './bossEngine.js';
import { initKeyboard } from './keyboard.js';
import { initControls, applyPreset } from './controls.js';
import { drawOscCanvas, drawFilterCanvas, drawADSRCanvas, drawLFOCanvas, drawFXCanvas, advanceLfoPhase } from './canvas.js';
import { drawScope, drawSpectrum } from './scope.js';
import { initProgressionUI } from './progressionUI.js';
import { initBossAudio } from './bossAudio.js';
import { initPresetsUI } from './presets.js';
import { initKnobs } from './knob.js';
import { transport } from './transport.js';
import { metronomeConsumer } from './metronome.js';

// Debug/integration hooks: the project store (E1) and transport (E2). Future UI
// (transport bar, undo) and console verification reach them here.
window.synthStore = store;
window.synthTransport = transport;

initKeyboard();
initControls();
initKnobs();

// Transport clock + metronome (no UI yet — that's L2; driven from the console
// or future transport bar). Registered eagerly; nothing plays until play().
transport.init();
transport.registerConsumer(metronomeConsumer);
initBossAudio();
initPresetsUI(applyPreset);

let lastFrame = 0;

function animate(now) {
  requestAnimationFrame(animate);
  advanceLfoPhase();
  drawLFOCanvas();

  // Drive the boss fight: drain HP while the target sound is held + playing.
  // Clamp dt so a backgrounded tab doesn't dump a huge drain on return.
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
  lastFrame = now;
  bossEngine.tick({ S, isPlaying: engine.noteOn, dt });
}

window.addEventListener('load', () => {
  setTimeout(() => {
    drawOscCanvas();
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
