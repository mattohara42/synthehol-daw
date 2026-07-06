// Step-sequencer UI (L6). Renders the pattern grid (pitch rows × steps), wires
// clicks to undoable store edits, and animates a playhead synced to the
// transport. Lives in the lower-left "Sequencer" tab alongside the visualizers.
//
// The grid is driven entirely from the store: clicking a cell toggles it via
// store.setPath (so it's undoable and persists), and a store subscription
// repaints the grid on any change (toggle, length, clear, undo, load). The
// playhead is pulled each animation frame (transport position is mutated in
// place, off the subscribe path — see transport.js).

import { store } from './store.js';
import { rowToPitch } from './sequencer.js';

let grid, lengthSel, swingInput, clearBtn, duplicateBtn, autoParamSel, tabs, views;
let autoLane, autoFillEls = [];   // per-step automation lane (one param visible at a time)
let ruler, rulerCellEls = [];     // seq-ruler bar/beat cells (L5 lean step)
let cellEls = [];          // cellEls[row][col]
let drumCellEls = { kick: [], snare: [], hat: [], cowbell: [], clap: [] }; // drumCellEls[voice][col]
let renderedLength = -1;   // structural grid currently built for this step count
let lastPlayheadCol = -1;
let autoParam = 'cutoff';  // which automation lane the UI currently shows/edits

// Cowbell/clap added for the Roland TB-303/TR-808 patches slice — see
// docs/brainstorms/2026-07-06-roland-303-808-requirements.md.
const DRUM_VOICES = [['kick', 'Kick'], ['snare', 'Snare'], ['hat', 'Hat'], ['cowbell', 'Cowbell'], ['clap', 'Clap']];
const emptyDrums = () => ({
  kick: Array(16).fill(false), snare: Array(16).fill(false), hat: Array(16).fill(false),
  cowbell: Array(16).fill(false), clap: Array(16).fill(false),
});

const NATURAL = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

// Automatable params (F1 v2): each maps a 0..1 lane fraction to its real range,
// matching that param's own control range elsewhere in the UI. Cutoff spans
// three decades so it's log-mapped; resonance and volume are linear.
const AUTO_PARAMS = {
  cutoff: { label: 'Cutoff', min: 60, max: 18000, log: true },
  resonance: { label: 'Resonance', min: 0.5, max: 18, log: false },
  volume: { label: 'Volume', min: 0, max: 1, log: false },
};
const emptyAutomation = () => Object.fromEntries(
  Object.keys(AUTO_PARAMS).map(key => [key, Array(16).fill(null)])
);
function valueToFrac(param, value) {
  const { min, max, log } = AUTO_PARAMS[param];
  return log ? Math.log(value / min) / Math.log(max / min) : (value - min) / (max - min);
}
function fracToValue(param, frac) {
  const { min, max, log } = AUTO_PARAMS[param];
  const f = Math.max(0, Math.min(1, frac));
  const v = log ? min * (max / min) ** f : min + f * (max - min);
  return log ? Math.round(v) : Math.round(v * 100) / 100;
}

function patternPath(suffix) {
  return `tracks.${store.activeTrackIndex()}.pattern.${suffix}`;
}

// (Re)build the grid DOM for the pattern's current row/step counts.
function buildGrid() {
  const p = store.pattern();
  const rows = p.cells.length;
  const cols = p.length;
  grid.style.setProperty('--steps', cols);
  grid.innerHTML = '';
  cellEls = [];
  drumCellEls = { kick: [], snare: [], hat: [], cowbell: [], clap: [] };

  for (let row = 0; row < rows; row++) {
    const pitch = rowToPitch(row, rows, p.baseOctave);
    const isC = pitch.note === 'C';
    const rowEls = [];

    const label = document.createElement('span');
    label.className = 'seq-rowlabel' + (NATURAL.has(pitch.note) ? '' : ' accidental');
    label.textContent = isC ? `${pitch.note}${pitch.octave}` : pitch.note;
    grid.appendChild(label);

    for (let col = 0; col < cols; col++) {
      const cell = document.createElement('button');
      cell.className = 'seq-cell';
      if (col % 4 === 0) cell.classList.add('beat');     // bar/beat gridlines
      if (isC) cell.classList.add('row-c');
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute('aria-label', `${pitch.note}${pitch.octave} step ${col + 1}`);
      grid.appendChild(cell);
      rowEls.push(cell);
    }
    cellEls.push(rowEls);
  }

  // Drum lanes: three fixed voices appended after the pitch rows, same grid.
  for (const [voice, label] of DRUM_VOICES) {
    const lbl = document.createElement('span');
    lbl.className = 'seq-rowlabel seq-drumlabel';
    if (voice === 'kick') lbl.classList.add('drum-first');
    lbl.textContent = label;
    grid.appendChild(lbl);

    for (let col = 0; col < cols; col++) {
      const cell = document.createElement('button');
      cell.className = 'seq-cell seq-drumcell';
      if (voice === 'kick') cell.classList.add('drum-first');
      if (col % 4 === 0) cell.classList.add('beat');
      cell.dataset.drum = voice;
      cell.dataset.col = col;
      cell.setAttribute('aria-label', `${label} step ${col + 1}`);
      grid.appendChild(cell);
      drumCellEls[voice].push(cell);
    }
  }
  renderedLength = cols;
}

// Sync the .on state of every cell from the pattern.
function paintCells() {
  const pattern = store.pattern();
  const cells = pattern.cells;
  for (let row = 0; row < cellEls.length; row++) {
    for (let col = 0; col < cellEls[row].length; col++) {
      cellEls[row][col].classList.toggle('on', !!cells[row][col]);
    }
  }
  const drums = pattern.drums;
  for (const [voice] of DRUM_VOICES) {
    const arr = drums?.[voice] || [];
    drumCellEls[voice].forEach((el, col) => el.classList.toggle('on', !!arr[col]));
  }
}

// Make sure the active pattern has all automation lanes (older saved projects
// predate resonance/volume, or automation entirely). Normalization on load,
// not a user edit, so it skips undo history.
function ensureAutomation() {
  const p = store.pattern();
  if (!p.automation) p.automation = emptyAutomation();
  for (const key of Object.keys(AUTO_PARAMS)) {
    if (!Array.isArray(p.automation[key])) p.automation[key] = Array(16).fill(null);
  }
}

// Same normalization for older saved patterns that predate the drum lanes —
// and, per voice, patterns saved before cowbell/clap existed (they'll have a
// real `drums.kick` array but no `drums.cowbell`/`drums.clap` at all). Each
// missing voice is backfilled individually rather than resetting the whole
// `drums` object, so an old pattern's existing kick/snare/hat programming
// survives. Without this, the click handler's `store.pattern().drums[voice]
// [col]` would throw the first time a player clicked a cowbell/clap cell on
// a pattern saved before this voice existed. Runs at init AND on every
// render() (a track switch, clip load, or undo/redo can swap in a pattern
// that predates a lane just as easily as a fresh page load can).
function ensureDrums() {
  const p = store.pattern();
  if (!p.drums) p.drums = emptyDrums();
  for (const [voice] of DRUM_VOICES) {
    if (!Array.isArray(p.drums[voice])) p.drums[voice] = Array(16).fill(false);
  }
}

// (Re)build the bar/beat ruler (L5 lean step): a blank gutter cell + one cell
// per step, numbered on beat-start columns. Shared time reference the grid,
// drum lanes, and automation lane all align under.
function buildRuler() {
  const cols = store.pattern().length;
  ruler.style.setProperty('--steps', cols);
  ruler.innerHTML = '';
  rulerCellEls = [];

  const gutter = document.createElement('span');
  ruler.appendChild(gutter);

  for (let col = 0; col < cols; col++) {
    const cell = document.createElement('span');
    cell.className = 'seq-ruler-cell';
    if (col % 4 === 0) cell.textContent = String(col / 4 + 1);
    ruler.appendChild(cell);
    rulerCellEls.push(cell);
  }
}

// (Re)build the per-step cutoff lane: a label cell + one bar per step, aligned
// under the grid columns.
function buildAutoLane() {
  const cols = store.pattern().length;
  autoLane.style.setProperty('--steps', cols);
  autoLane.innerHTML = '';
  autoFillEls = [];

  const label = document.createElement('span');
  label.className = 'seq-auto-label';
  label.textContent = AUTO_PARAMS[autoParam].label;
  autoLane.appendChild(label);

  for (let col = 0; col < cols; col++) {
    const cell = document.createElement('div');
    cell.className = 'seq-auto-cell';
    if (col % 4 === 0) cell.classList.add('beat');
    cell.dataset.col = col;
    const fill = document.createElement('div');
    fill.className = 'seq-auto-fill';
    cell.appendChild(fill);
    autoLane.appendChild(cell);
    autoFillEls.push(fill);
  }
}

// Sync the lane bar heights from the pattern's automation (currently selected param).
function paintAuto() {
  const auto = store.pattern().automation?.[autoParam] || [];
  for (let col = 0; col < autoFillEls.length; col++) {
    const v = auto[col];
    const fill = autoFillEls[col];
    if (v == null) {
      fill.style.height = '0%';
      fill.parentElement.classList.add('empty');
    } else {
      fill.style.height = (valueToFrac(autoParam, v) * 100).toFixed(1) + '%';
      fill.parentElement.classList.remove('empty');
    }
  }
}

function render() {
  ensureDrums(); // a track switch/clip load/undo/redo can swap in a pattern that predates a drum lane
  const p = store.pattern();
  if (p.length !== renderedLength) { buildRuler(); buildGrid(); buildAutoLane(); }
  paintCells();
  paintAuto();
  if (lengthSel.value !== String(p.length)) lengthSel.value = String(p.length);
  if (document.activeElement !== swingInput) swingInput.value = p.swing;
}

// Highlight the column currently sounding. Derived from transport position so it
// tracks the audible step; cleared when stopped.
export function refreshSequencerPlayhead() {
  if (!grid) return;
  const t = store.get().transport;
  const p = store.pattern();
  let col = -1;
  if (t.playing) {
    const stepsPerBar = t.timeSig[0] * 4;
    const abs = t.position.bar * stepsPerBar + t.position.beat * 4 + t.position.sixteenth;
    col = ((abs % p.length) + p.length) % p.length;
  }
  if (col === lastPlayheadCol) return;
  setColumnClass(lastPlayheadCol, false);
  setColumnClass(col, true);
  lastPlayheadCol = col;
}

function setColumnClass(col, on) {
  if (col < 0) return;
  rulerCellEls[col]?.classList.toggle('playhead', on);
  for (let row = 0; row < cellEls.length; row++) {
    cellEls[row][col]?.classList.toggle('playhead', on);
  }
  for (const [voice] of DRUM_VOICES) {
    drumCellEls[voice][col]?.classList.toggle('playhead', on);
  }
}

function selectView(view) {
  for (const tab of tabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  for (const v of views) {
    const show = v.id === `view-${view}`;
    v.classList.toggle('active', show);
    v.hidden = !show;
  }
  // The sequencer needs real estate, so it takes over the lower area — the
  // keyboard hides while sequencing (it's an alternate play surface). CSS keys
  // off this attribute (see style.css body[data-stage="seq"]).
  document.body.dataset.stage = view;
}

// Set one step's value (for the currently selected automation param) from a
// pointer Y within its lane cell. Dragging to the floor (frac < 0.05) clears
// the point (null).
function applyAuto(cell, clientY) {
  const col = +cell.dataset.col;
  const r = cell.getBoundingClientRect();
  const frac = 1 - (clientY - r.top) / r.height;
  const value = frac < 0.05 ? null : fracToValue(autoParam, frac);
  store.setPath(patternPath(`automation.${autoParam}.${col}`), value);
}

// Copy the pattern's first half (pitch cells, drums, all automation lanes)
// into its second half — the step-grid's answer to "duplicate a region" (F6).
function duplicateFirstHalf() {
  const p = store.pattern();
  const half = Math.floor(p.length / 2);
  if (half < 1) return;

  const newCells = p.cells.map(row => {
    const copy = [...row];
    for (let i = 0; i < half; i++) copy[half + i] = row[i];
    return copy;
  });
  store.setPath(patternPath('cells'), newCells);

  const src = p.drums || emptyDrums();
  const newDrums = {};
  for (const [voice] of DRUM_VOICES) {
    const arr = [...(src[voice] || Array(16).fill(false))];
    for (let i = 0; i < half; i++) arr[half + i] = arr[i];
    newDrums[voice] = arr;
  }
  store.setPath(patternPath('drums'), newDrums);

  const srcAuto = p.automation || emptyAutomation();
  for (const key of Object.keys(AUTO_PARAMS)) {
    const arr = [...(srcAuto[key] || Array(16).fill(null))];
    for (let i = 0; i < half; i++) arr[half + i] = arr[i];
    store.setPath(patternPath(`automation.${key}`), arr);
  }
}

let painting = false;

export function initSequencerUI() {
  grid = document.getElementById('seq-grid');
  if (!grid) return;
  ruler = document.getElementById('seq-ruler');
  autoLane = document.getElementById('seq-auto');
  lengthSel = document.getElementById('seq-length');
  swingInput = document.getElementById('seq-swing');
  clearBtn = document.getElementById('seq-clear');
  duplicateBtn = document.getElementById('seq-duplicate');
  autoParamSel = document.getElementById('seq-auto-param');
  tabs = [...document.querySelectorAll('.lower-tab')];
  views = [...document.querySelectorAll('.lower-view')];

  ensureAutomation();
  ensureDrums();

  // Click a cell → toggle it (undoable). Drum cells carry a `drum` dataset key
  // instead of `row`, since they're a parallel voice, not a pitch.
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.seq-cell');
    if (!cell) return;
    const col = +cell.dataset.col;
    if (cell.dataset.drum) {
      const voice = cell.dataset.drum;
      const cur = store.pattern().drums[voice][col];
      store.setPath(patternPath(`drums.${voice}.${col}`), !cur);
      return;
    }
    const row = +cell.dataset.row;
    const cur = store.pattern().cells[row][col];
    store.setPath(patternPath(`cells.${row}.${col}`), !cur);
  });

  // Drag across the cutoff lane to paint per-step automation.
  autoLane.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.seq-auto-cell');
    if (!cell) return;
    painting = true;
    try { autoLane.setPointerCapture(e.pointerId); } catch { /* noop */ }
    applyAuto(cell, e.clientY);
  });
  autoLane.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.seq-auto-cell');
    if (cell && autoLane.contains(cell)) applyAuto(cell, e.clientY);
  });
  const stopPaint = () => { painting = false; };
  autoLane.addEventListener('pointerup', stopPaint);
  autoLane.addEventListener('pointercancel', stopPaint);

  lengthSel.addEventListener('change', () => {
    store.setPath(patternPath('length'), Number(lengthSel.value));
  });
  swingInput.addEventListener('input', () => {
    store.setPath(patternPath('swing'), Number(swingInput.value));
  });
  clearBtn.addEventListener('click', () => {
    const p = store.pattern();
    const cleared = p.cells.map(r => r.map(() => false));
    store.setPath(patternPath('cells'), cleared);
    store.setPath(patternPath('drums'), emptyDrums());
  });
  duplicateBtn.addEventListener('click', duplicateFirstHalf);
  autoParamSel.addEventListener('change', () => {
    autoParam = autoParamSel.value;
    buildAutoLane();
    paintAuto();
  });

  tabs.forEach(tab => tab.addEventListener('click', () => selectView(tab.dataset.view)));

  store.subscribe(render);
  render();
  document.body.dataset.stage = 'scope'; // default: visualizers + keyboard

}
