// Small shared UI helpers (status pill, slider fill).

export function setStatus(text, active) {
  const el = document.getElementById('status-pill');
  el.textContent = text;
  el.className = 'status-pill' + (active ? ' active' : '');
}

export function fillSlider(el) {
  const min = +el.min, max = +el.max, val = +el.value;
  const pct = (val - min) / (max - min);
  el.style.setProperty('--pct', (pct * 100).toFixed(1) + '%');
  // Rotary knobs read --deg from their wrapper: 270° sweep, -135°…+135°.
  const knob = el.closest('.knob');
  if (knob) knob.style.setProperty('--deg', (pct * 270 - 135).toFixed(1) + 'deg');
}
