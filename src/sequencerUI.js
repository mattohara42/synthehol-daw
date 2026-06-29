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

let grid, lengthSel, swingInput, clearBtn, tabs, views;
let cellEls = [];          // cellEls[row][col]
let renderedLength = -1;   // structural grid currently built for this step count
let lastPlayheadCol = -1;

const NATURAL = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

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
  renderedLength = cols;
}

// Sync the .on state of every cell from the pattern.
function paintCells() {
  const cells = store.pattern().cells;
  for (let row = 0; row < cellEls.length; row++) {
    for (let col = 0; col < cellEls[row].length; col++) {
      cellEls[row][col].classList.toggle('on', !!cells[row][col]);
    }
  }
}

function render() {
  const p = store.pattern();
  if (p.length !== renderedLength) buildGrid();
  paintCells();
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
  for (let row = 0; row < cellEls.length; row++) {
    cellEls[row][col]?.classList.toggle('playhead', on);
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

export function initSequencerUI() {
  grid = document.getElementById('seq-grid');
  if (!grid) return;
  lengthSel = document.getElementById('seq-length');
  swingInput = document.getElementById('seq-swing');
  clearBtn = document.getElementById('seq-clear');
  tabs = [...document.querySelectorAll('.lower-tab')];
  views = [...document.querySelectorAll('.lower-view')];

  // Click a cell → toggle it (undoable).
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.seq-cell');
    if (!cell) return;
    const row = +cell.dataset.row;
    const col = +cell.dataset.col;
    const cur = store.pattern().cells[row][col];
    store.setPath(patternPath(`cells.${row}.${col}`), !cur);
  });

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
  });

  tabs.forEach(tab => tab.addEventListener('click', () => selectView(tab.dataset.view)));

  store.subscribe(render);
  render();
  document.body.dataset.stage = 'scope'; // default: visualizers + keyboard

}
