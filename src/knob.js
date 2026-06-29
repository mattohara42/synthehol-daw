// Knob — a hardware-style rotary skin over a native <input type="range">.
//
// The input stays the single source of truth: it remains focusable and fully
// keyboard / screen-reader operable, and every value change is dispatched as an
// 'input' event so the existing wire() handlers, teaching panel, boss engine,
// and applyPreset() all keep working untouched. The knob only translates
// pointer gestures (vertical drag + wheel) into value changes and re-renders
// itself from the input's value — so presets move it too.
//
// Interaction: drag up = increase (never circular). Wheel = step. Shift = fine,
// Ctrl/Cmd = coarse. Double-click = reset to the control's default.

const SWEEP = 270;   // degrees of travel
const START = -135;  // angle at min value (0° = pointing up, clockwise positive)
const DRAG_FULL_PX = 200; // pixels of vertical drag for the full range

const SVGNS = 'http://www.w3.org/2000/svg';

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, r, a0, a1) {
  const [sx, sy] = polar(cx, cy, r, a1);
  const [ex, ey] = polar(cx, cy, r, a0);
  const large = (a1 - a0) <= 180 ? 0 : 1;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

function el(tag, attrs) {
  const node = document.createElementNS(SVGNS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

// Shared SVG defs (the skirt gradient) injected once.
function ensureDefs() {
  if (document.getElementById('knob-defs')) return;
  const svg = el('svg', { id: 'knob-defs', width: 0, height: 0, 'aria-hidden': 'true' });
  svg.style.position = 'absolute';
  const grad = el('radialGradient', { id: 'knob-skirt', cx: '38%', cy: '30%', r: '75%' });
  grad.appendChild(el('stop', { offset: '0%',   'stop-color': '#322b22' }));
  grad.appendChild(el('stop', { offset: '55%',  'stop-color': '#1d1812' }));
  grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#0f0c08' }));
  const defs = el('defs', {});
  defs.appendChild(grad);
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

export function enhanceKnob(input) {
  const min = +input.min, max = +input.max;
  const step = +input.step || 1;
  const range = (max - min) || 1;
  const ctrl = input.closest('.ctrl');
  if (!ctrl) return;
  ctrl.classList.add('ctrl-knob');
  ensureDefs();

  const cx = 28, cy = 28;
  const angleFor = () => START + ((+input.value - min) / range) * SWEEP;

  const knob = document.createElement('div');
  knob.className = 'knob';
  knob.setAttribute('aria-hidden', 'true');
  const svg = el('svg', { viewBox: '0 0 56 56', class: 'knob-svg' });

  // Tick ring — one tick per detent for low step counts, else a fixed number.
  const ticks = (range / step <= 12) ? Math.round(range / step) : 8;
  for (let i = 0; i <= ticks; i++) {
    const a = START + (i / ticks) * SWEEP;
    const [x1, y1] = polar(cx, cy, 25, a);
    const [x2, y2] = polar(cx, cy, 27.5, a);
    svg.appendChild(el('line', { x1, y1, x2, y2, class: 'knob-tick' }));
  }

  svg.appendChild(el('path', { d: arcPath(cx, cy, 22, START, START + SWEEP), class: 'knob-track' }));
  const valueArc = el('path', { class: 'knob-arc' });
  svg.appendChild(valueArc);
  svg.appendChild(el('circle', { cx, cy, r: 15, class: 'knob-body' }));
  const ring = el('circle', { cx, cy, r: 15, class: 'knob-ring' });
  svg.appendChild(ring);
  const pointer = el('line', { x1: cx, y1: cy - 3, x2: cx, y2: cy - 13, class: 'knob-pointer' });
  svg.appendChild(pointer);
  knob.appendChild(svg);
  ctrl.insertBefore(knob, ctrl.firstChild);

  function render() {
    const a = angleFor();
    valueArc.setAttribute('d', arcPath(cx, cy, 22, START, a));
    pointer.setAttribute('transform', `rotate(${a.toFixed(2)} ${cx} ${cy})`);
  }
  render();
  input.addEventListener('input', render);

  function setValue(v) {
    v = Math.min(max, Math.max(min, v));
    const snapped = +(Math.round((v - min) / step) * step + min).toFixed(6);
    if (snapped !== +input.value) {
      input.value = snapped;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // --- vertical drag ---
  let dragging = false, lastY = 0, acc = 0;
  knob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    lastY = e.clientY;
    acc = +input.value;
    knob.setPointerCapture(e.pointerId);
    input.focus();
  });
  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = lastY - e.clientY;
    lastY = e.clientY;
    const fine = e.shiftKey ? 0.25 : (e.ctrlKey || e.metaKey) ? 4 : 1;
    acc = Math.min(max, Math.max(min, acc + dy * (range / DRAG_FULL_PX) * fine));
    setValue(acc);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { knob.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  knob.addEventListener('pointerup', endDrag);
  knob.addEventListener('pointercancel', endDrag);

  // --- wheel + reset ---
  knob.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const mult = e.shiftKey ? 1 : (e.ctrlKey || e.metaKey) ? 10 : 1;
    setValue(+input.value + dir * step * mult);
  }, { passive: false });

  knob.addEventListener('dblclick', (e) => {
    e.preventDefault();
    setValue(+input.defaultValue);
  });
}

export function initKnobs(root = document) {
  root.querySelectorAll('input[type="range"][data-knob]').forEach(enhanceKnob);
}
