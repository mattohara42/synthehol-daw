// Entry point: wires up the keyboard, controls, canvases, and animation
// loop once the DOM has loaded.

import './style.css';
import { initKeyboard } from './keyboard.js';
import { initControls } from './controls.js';
import { drawOscCanvas, drawFilterCanvas, drawADSRCanvas, drawLFOCanvas, advanceLfoPhase } from './canvas.js';
import { drawScope } from './scope.js';
import { initProgressionUI } from './progressionUI.js';
import { initSharing } from './sharing.js';

initSharing();
initKeyboard();
initControls();

function animate() {
  requestAnimationFrame(animate);
  advanceLfoPhase();
  drawLFOCanvas();
}

window.addEventListener('load', () => {
  setTimeout(() => {
    drawOscCanvas();
    drawFilterCanvas();
    drawADSRCanvas();
    animate();
    drawScope();
  }, 80);
  initProgressionUI();
});

window.addEventListener('resize', () => {
  drawOscCanvas();
  drawFilterCanvas();
  drawADSRCanvas();
});
