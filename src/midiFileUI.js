// MIDI file import/export UI (L16a) — wires the "Import .mid"/"Export .mid"
// buttons in the clips bar (shared by the Sequencer and Piano Roll tabs,
// same as clipsUI.js) to midiFile.js's pure codec. Import/export both target
// the piano roll lane specifically — see midiFile.js's header comment for
// why the diatonic step grid and drum lanes are out of scope for this step.

import { store } from './store.js';
import { encodePatternAsMidi, decodeMidiFile, notesToPatternRoll } from './midiFile.js';
import { rollRowToPitch, ROLL_ROWS } from './pianoroll.js';
import { pitchToMidiNote } from './midi.js';

function patternPath(suffix) {
  return `tracks.${store.activeTrackIndex()}.pattern.${suffix}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Briefly show a result message on a button (matches wavRender.js's
// disable-while-working pattern) rather than a modal — the project's
// anti-goals rule out dialogs for anything short of the progress-reset confirm.
function flashButton(btn, text, ms = 2500) {
  const label = btn.dataset.label ?? btn.textContent;
  btn.dataset.label = label;
  btn.textContent = text;
  setTimeout(() => { if (btn.textContent === text) btn.textContent = label; }, ms);
}

export function exportPatternAsMidi() {
  const pattern = store.pattern();
  const bpm = store.get().transport.bpm;
  const bytes = encodePatternAsMidi(pattern, bpm);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(new Blob([bytes], { type: 'audio/midi' }), `synthehol-${stamp}.mid`);
}

export async function importMidiFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { ppq, notes } = decodeMidiFile(bytes);
  const baseOctave = store.pattern().baseOctave;
  const lowPitch = rollRowToPitch(ROLL_ROWS - 1, baseOctave);
  const highPitch = rollRowToPitch(0, baseOctave);
  const low = pitchToMidiNote(lowPitch.note, lowPitch.octave);
  const high = pitchToMidiNote(highPitch.note, highPitch.octave);
  const { roll, imported, dropped } = notesToPatternRoll(notes, ppq, ROLL_ROWS, low, high, 16);
  store.setPath(patternPath('roll'), roll);
  store.setPath(patternPath('length'), 16);
  return { imported, dropped };
}

export function initMidiFileUI() {
  const exportBtn = document.getElementById('mid-export-btn');
  const importBtn = document.getElementById('mid-import-btn');
  const fileInput = document.getElementById('mid-file-input');
  if (!exportBtn || !importBtn || !fileInput) return;

  exportBtn.addEventListener('click', () => exportPatternAsMidi());

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allow re-importing the same file twice in a row
    if (!file) return;
    try {
      const { imported, dropped } = await importMidiFile(file);
      flashButton(importBtn, dropped > 0 ? `✓ ${imported} in, ${dropped} skipped` : `✓ ${imported} notes imported`);
    } catch {
      flashButton(importBtn, '⚠ Not a valid .mid file');
    }
  });
}
