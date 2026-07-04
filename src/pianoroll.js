// Piano-roll (L7 lean step) — a chromatic pitch × time grid, sharing the step
// sequencer's timing machinery (stepDuration/swingOffset/stepToColumn) but
// with full chromatic pitch and a note LENGTH instead of one-step blips.
//
// Reuses the pattern's boolean-grid shape (pattern.roll[row][col]) rather than
// inventing a new note-object schema: a note is a run of consecutive true
// cells in one row. The consumer only fires a noteOn at a run's leading edge,
// held for the run's length — not retriggered on every cell like the step
// grid's `cells`.

import { NOTE_NAMES } from './notes.js';
import { stepToColumn, stepDuration, swingOffset } from './sequencer.js';

export const ROLL_ROWS = 24; // 2 chromatic octaves

// Map a roll row to a pitch. Row 0 is the highest semitone (top of the
// grid), descending chromatically to the bottom row — every semitone is a
// row, unlike the step grid's diatonic-only `cells`.
export function rollRowToPitch(row, baseOctave = 4) {
  const semitone = (ROLL_ROWS - 1) - row;
  const octave = baseOctave + Math.floor(semitone / 12);
  const name = NOTE_NAMES[semitone % 12];
  return { note: name, octave };
}

// Note runs that START at `col` — one per row where a run begins (the cell
// is true, and either col is 0 or the previous column's cell is false).
// Runs don't wrap past the pattern's last column. Pure; used by both the
// consumer and the UI/tests.
export function noteRunsStartingAt(pattern, col) {
  const roll = pattern.roll;
  if (!roll) return [];
  const cols = pattern.length;
  const out = [];
  for (let row = 0; row < roll.length; row++) {
    const cells = roll[row];
    if (!cells[col]) continue;
    if (col > 0 && cells[col - 1]) continue; // mid-run, not its start
    let len = 1;
    while (col + len < cols && cells[col + len]) len++;
    out.push({ ...rollRowToPitch(row, pattern.baseOctave), lengthSteps: len });
  }
  return out;
}

/**
 * Build a scheduler consumer: fn(step, time) that starts each note run at its
 * leading edge and releases it after its full length (not per-step, unlike
 * the step grid) — for EVERY track (E4), each through its own engine.
 * Dependencies mirror sequencer.js's consumer for the same testability
 * without the real audio engine. `getTracks()` returns [{ id, pattern }, ...].
 */
export function createPianoRollConsumer({
  getTracks, getBpm, noteOn, noteOff, stepsPerBeat = 4, gate = 0.95, velocity = 0.85,
}) {
  return function pianoRollConsumer(step, time) {
    for (const track of getTracks()) {
      const pattern = track.pattern;
      if (!pattern?.roll) continue;
      const col = stepToColumn(step, pattern.length);
      const stepDur = stepDuration(getBpm(), stepsPerBeat);
      const at = time + swingOffset(col, pattern.swing, stepDur);

      const runs = noteRunsStartingAt(pattern, col);
      for (const { note, octave, lengthSteps } of runs) {
        const id = noteOn(note, octave, at, velocity, track.id);
        if (id != null) noteOff(id, at + Math.max(0.02, gate * lengthSteps * stepDur), track.id);
      }
    }
  };
}
