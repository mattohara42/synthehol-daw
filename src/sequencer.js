// Step sequencer (L6) — turns a track's pattern grid into scheduled polyphonic
// notes. A pure pitch/grid layer (testable, no audio) plus a scheduler consumer
// that fires voices through the E3 voice manager on each step.
//
// The pattern grid is `cells[row][col]`: rows are pitches (top row = highest),
// cols are steps. Active cells in the same column play together — that's where
// the polyphony from E3 earns its keep (a column can be a chord).

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// The grid's pitch rows are diatonic — a C-major scale across one octave
// (C D E F G A B C). No accidentals keeps the first sequencer approachable
// ("fun first"), and 8 rows fit the panel. Index 0 = base C, last = octave up.
export const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];

// Map a grid row to a pitch. The top row is the highest degree, the bottom row
// base C: row r → scale degree (rows-1 - r).
export function rowToPitch(row, rows, baseOctave = 4) {
  const degree = (rows - 1) - row;          // 0 at the bottom row, rows-1 at top
  const semitone = SCALE[((degree % SCALE.length) + SCALE.length) % SCALE.length]
    + 12 * Math.floor(degree / SCALE.length);
  const octave = baseOctave + Math.floor(semitone / 12);
  const name = NOTE_NAMES[((semitone % 12) + 12) % 12];
  return { note: name, octave };
}

// Wrap an absolute step counter into a column index for a pattern of `length`.
export function stepToColumn(step, length) {
  return ((step % length) + length) % length;
}

// The pitches active in a given column — one per active row. Pure; used by both
// the consumer and tests.
export function activeNotesAt(pattern, col) {
  const { cells, baseOctave = 4 } = pattern;
  const rows = cells.length;
  const out = [];
  for (let row = 0; row < rows; row++) {
    if (cells[row][col]) out.push(rowToPitch(row, rows, baseOctave));
  }
  return out;
}

// Seconds per step (one 16th note at `stepsPerBeat = 4`).
export function stepDuration(bpm, stepsPerBeat = 4) {
  return (60 / bpm) / stepsPerBeat;
}

// Swing offset for a column: delay the off-beats (odd columns) by up to half a
// step as `swing` goes 0→1.
export function swingOffset(col, swing, stepDur) {
  if (!swing || col % 2 === 0) return 0;
  return swing * stepDur * 0.5;
}

/**
 * Build a scheduler consumer: fn(step, time) that plays the active notes for the
 * step's column. Notes are gated — each voice is released after `gate` of a step
 * so steps don't blur together (unless gate ≥ 1, i.e. legato).
 *
 * Dependencies are injected so this is testable without the real audio engine:
 *   - getPattern() → the live pattern object
 *   - getBpm()     → current tempo
 *   - noteOn(note, octave, time, velocity) → voiceId
 *   - noteOff(voiceId, time)
 */
export function createSequencerConsumer({
  getPattern, getBpm, noteOn, noteOff, setCutoff,
  playKick, playSnare, playHat,
  stepsPerBeat = 4, gate = 0.9, velocity = 0.85,
}) {
  return function sequencerConsumer(step, time) {
    const pattern = getPattern();
    if (!pattern) return;
    const col = stepToColumn(step, pattern.length);
    const stepDur = stepDuration(getBpm(), stepsPerBeat);
    const at = time + swingOffset(col, pattern.swing, stepDur);

    // Filter-cutoff automation: apply this column's value (if set) at step time,
    // even when the column has no notes — so the sweep keeps moving across rests.
    const autoCutoff = pattern.automation?.cutoff?.[col];
    if (autoCutoff != null && typeof setCutoff === 'function') setCutoff(autoCutoff, at);

    // Drum lanes: independent of the pitch grid, fire regardless of rests.
    const drums = pattern.drums;
    if (drums?.kick?.[col] && playKick) playKick(at);
    if (drums?.snare?.[col] && playSnare) playSnare(at);
    if (drums?.hat?.[col] && playHat) playHat(at);

    const notes = activeNotesAt(pattern, col);
    if (notes.length === 0) return;

    const off = at + Math.max(0.02, gate * stepDur);
    for (const { note, octave } of notes) {
      const id = noteOn(note, octave, at, velocity);
      if (id != null) noteOff(id, off);
    }
  };
}
