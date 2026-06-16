// Small shared UI helpers (status pill, slider fill).

export function setStatus(text, active) {
  const el = document.getElementById('status-pill');
  el.textContent = text;
  el.className = 'status-pill' + (active ? ' active' : '');
}

export function fillSlider(el) {
  const min = +el.min, max = +el.max, val = +el.value;
  el.style.setProperty('--pct', ((val - min) / (max - min) * 100).toFixed(1) + '%');
}
