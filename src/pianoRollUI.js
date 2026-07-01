// Piano-roll UI (L7 lean step). Renders the chromatic grid (pianoroll.js's
// ROLL_ROWS × pattern.length), wires click-to-add / drag-to-lengthen /
// click-to-remove note editing, and animates a playhead synced to the
// transport. Lives in the "Piano Roll" tab alongside the Sequencer.
//
// Reuses the exact same .seq-cell/.seq-ruler/.seq-rowlabel styling as the
// step sequencer (sequencerUI.js) — it's a sibling lane in the same tab
// strip, not a different visual language.

import { store } from './store.js';
import { ROLL_ROWS, rollRowToPitch } from './pianoroll.js';

let ruler, grid;
let rulerCellEls = [];
let cellEls = [];        // cellEls[row][col]
let renderedLength = -1;
let lastPlayheadCol = -1;
let painting = null;     // { row, startCol, cap, original } while dragging a new note

const NATURAL = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

function patternPath(suffix) {
  return `tracks.${store.activeTrackIndex()}.pattern.${suffix}`;
}

// Make sure the active pattern has a roll lane (older saved patterns predate
// it). Normalization on load, not a user edit, so it skips undo history.
function ensureRoll() {
  const p = store.pattern();
  if (!Array.isArray(p.roll) || p.roll.length !== ROLL_ROWS) {
    p.roll = Array.from({ length: ROLL_ROWS }, () => Array(16).fill(false));
  }
}

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

function buildGrid() {
  const p = store.pattern();
  const cols = p.length;
  grid.style.setProperty('--steps', cols);
  grid.innerHTML = '';
  cellEls = [];

  for (let row = 0; row < ROLL_ROWS; row++) {
    const pitch = rollRowToPitch(row, p.baseOctave);
    const isC = pitch.note === 'C';
    const rowEls = [];

    const label = document.createElement('span');
    label.className = 'seq-rowlabel' + (NATURAL.has(pitch.note) ? '' : ' accidental');
    label.textContent = isC ? `${pitch.note}${pitch.octave}` : pitch.note;
    grid.appendChild(label);

    for (let col = 0; col < cols; col++) {
      const cell = document.createElement('button');
      cell.className = 'seq-cell';
      if (col % 4 === 0) cell.classList.add('beat');
      if (isC) cell.classList.add('row-c');
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute('aria-label', `${pitch.note}${pitch.octave} step ${col + 1}`);
      grid.appendChild(cell);
      rowEls.push(cell);
    }
    cellEls.push(rowEls);
  }
  renderedLength = cols;
}

function paintCells() {
  const roll = store.pattern().roll;
  for (let row = 0; row < cellEls.length; row++) {
    for (let col = 0; col < cellEls[row].length; col++) {
      cellEls[row][col].classList.toggle('on', !!roll[row]?.[col]);
    }
  }
}

function render() {
  const p = store.pattern();
  if (p.length !== renderedLength) { buildRuler(); buildGrid(); }
  paintCells();
}

// Highlight the column currently sounding, same derivation as the step
// sequencer's playhead.
export function refreshPianoRollPlayhead() {
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
}

// Erase the whole note (run of consecutive true cells) containing `col`.
function eraseRunAt(row, col) {
  const original = store.pattern().roll[row];
  const newRow = [...original];
  let i = col;
  while (i >= 0 && newRow[i]) { newRow[i] = false; i--; }
  i = col + 1;
  while (i < newRow.length && newRow[i]) { newRow[i] = false; i++; }
  store.setPath(patternPath(`roll.${row}`), newRow);
}

// Start painting a new note at (row, col). Caps the drag so it can't swallow
// a neighboring note further right in the same row.
function startPaint(row, col) {
  const pattern = store.pattern();
  const original = pattern.roll[row];
  if (original[col]) { eraseRunAt(row, col); return; }

  let cap = pattern.length - 1;
  for (let i = col + 1; i < pattern.length; i++) {
    if (original[i]) { cap = i - 1; break; }
  }
  painting = { row, startCol: col, cap, original: [...original] };
  extendPaint(col);
}

function extendPaint(col) {
  if (!painting) return;
  const { row, startCol, cap, original } = painting;
  const end = Math.max(startCol, Math.min(cap, col));
  const newRow = [...original];
  for (let i = startCol; i <= end; i++) newRow[i] = true;
  store.setPath(patternPath(`roll.${row}`), newRow);
}

export function initPianoRollUI() {
  grid = document.getElementById('roll-grid');
  if (!grid) return;
  ruler = document.getElementById('roll-ruler');
  const clearBtn = document.getElementById('roll-clear');

  ensureRoll();

  grid.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.seq-cell');
    if (!cell) return;
    startPaint(+cell.dataset.row, +cell.dataset.col);
    try { grid.setPointerCapture(e.pointerId); } catch { /* noop */ }
  });
  grid.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.seq-cell');
    if (cell && +cell.dataset.row === painting.row) extendPaint(+cell.dataset.col);
  });
  const stopPaint = () => { painting = null; };
  grid.addEventListener('pointerup', stopPaint);
  grid.addEventListener('pointercancel', stopPaint);

  clearBtn?.addEventListener('click', () => {
    const p = store.pattern();
    const cleared = p.roll.map(row => row.map(() => false));
    store.setPath(patternPath('roll'), cleared);
  });

  store.subscribe(render);
  render();
}
