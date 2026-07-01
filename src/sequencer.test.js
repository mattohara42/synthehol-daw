import { describe, it, expect } from 'vitest';
import {
  rowToPitch, stepToColumn, activeNotesAt, stepDuration, swingOffset,
  createSequencerConsumer,
} from './sequencer.js';

// An 8-row (one diatonic octave) empty grid with `cols` columns.
function emptyGrid(rows = 8, cols = 16) {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

describe('sequencer – pitch + grid mapping', () => {
  it('maps rows to a diatonic C-major scale, bottom = base C, top = octave up', () => {
    expect(rowToPitch(7, 8, 4)).toEqual({ note: 'C', octave: 4 });   // bottom degree 0
    expect(rowToPitch(0, 8, 4)).toEqual({ note: 'C', octave: 5 });   // top degree 7 (+12)
    expect(rowToPitch(5, 8, 4)).toEqual({ note: 'E', octave: 4 });   // degree 2
    expect(rowToPitch(3, 8, 4)).toEqual({ note: 'G', octave: 4 });   // degree 4
    expect(rowToPitch(6, 8, 4)).toEqual({ note: 'D', octave: 4 });   // degree 1
  });

  it('wraps the absolute step counter into a column', () => {
    expect(stepToColumn(0, 16)).toBe(0);
    expect(stepToColumn(16, 16)).toBe(0);
    expect(stepToColumn(19, 16)).toBe(3);
    expect(stepToColumn(5, 8)).toBe(5);
  });

  it('reads all active pitches in a column (a chord)', () => {
    const cells = emptyGrid();
    cells[7][2] = true; // C4
    cells[5][2] = true; // E4
    cells[3][2] = true; // G4
    cells[0][5] = true; // C5 (different column)
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells };
    expect(activeNotesAt(pattern, 2)).toEqual([
      { note: 'G', octave: 4 }, // row 3 first (top-down)
      { note: 'E', octave: 4 }, // row 5
      { note: 'C', octave: 4 }, // row 7
    ]);
    expect(activeNotesAt(pattern, 5)).toEqual([{ note: 'C', octave: 5 }]);
    expect(activeNotesAt(pattern, 3)).toEqual([]);
  });
});

describe('sequencer – timing', () => {
  it('computes 16th-note step duration from bpm', () => {
    expect(stepDuration(120, 4)).toBeCloseTo(0.125, 6); // 120bpm → 0.125s/16th
    expect(stepDuration(60, 4)).toBeCloseTo(0.25, 6);
  });

  it('delays only off-beat columns when swing > 0', () => {
    const dur = 0.125;
    expect(swingOffset(0, 0.5, dur)).toBe(0);          // downbeat: never
    expect(swingOffset(2, 0.5, dur)).toBe(0);          // even col: never
    expect(swingOffset(1, 0.5, dur)).toBeCloseTo(0.03125, 6); // 0.5 * 0.125/2
    expect(swingOffset(1, 0, dur)).toBe(0);            // no swing
  });
});

describe('sequencer – consumer', () => {
  function harness({ pattern, bpm = 120, gate = 0.9 }) {
    const ons = [];
    const offs = [];
    const cuts = [];
    const drumHits = [];
    let nextId = 1;
    const consumer = createSequencerConsumer({
      getPattern: () => pattern,
      getBpm: () => bpm,
      noteOn: (note, octave, time, velocity) => {
        const id = nextId++;
        ons.push({ id, note, octave, time, velocity });
        return id;
      },
      noteOff: (id, time) => offs.push({ id, time }),
      setCutoff: (value, time) => cuts.push({ value, time }),
      playKick: (time) => drumHits.push({ voice: 'kick', time }),
      playSnare: (time) => drumHits.push({ voice: 'snare', time }),
      playHat: (time) => drumHits.push({ voice: 'hat', time }),
      gate,
    });
    return { consumer, ons, offs, cuts, drumHits };
  }

  it('fires a voice per active note in the column and gates it off', () => {
    const cells = emptyGrid();
    cells[7][0] = true; // C4
    cells[5][0] = true; // E4
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells };
    const { consumer, ons, offs } = harness({ pattern });

    consumer(0, 10.0); // step 0 → column 0, at time 10.0
    expect(ons.map(o => `${o.note}${o.octave}`)).toEqual(['E4', 'C4']);
    expect(ons.every(o => o.time === 10.0)).toBe(true);
    // gated off after 0.9 * 0.125s
    expect(offs).toHaveLength(2);
    expect(offs[0].time).toBeCloseTo(10.0 + 0.9 * 0.125, 6);
  });

  it('does nothing on an empty column', () => {
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells: emptyGrid() };
    const { consumer, ons } = harness({ pattern });
    consumer(3, 5.0);
    expect(ons).toHaveLength(0);
  });

  it('applies a cutoff-automation value at step time', () => {
    const cutoff = Array(16).fill(null);
    cutoff[0] = 800;
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells: emptyGrid(), automation: { cutoff } };
    const { consumer, cuts } = harness({ pattern });
    consumer(0, 4.0);
    expect(cuts).toEqual([{ value: 800, time: 4.0 }]);
  });

  it('applies cutoff automation even on an empty column (sweep across rests)', () => {
    const cutoff = Array(16).fill(null);
    cutoff[3] = 1200;
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells: emptyGrid(), automation: { cutoff } };
    const { consumer, ons, cuts } = harness({ pattern });
    consumer(3, 1.0);
    expect(ons).toHaveLength(0);
    expect(cuts).toEqual([{ value: 1200, time: 1.0 }]);
  });

  it('skips cutoff automation where the value is null', () => {
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells: emptyGrid(), automation: { cutoff: Array(16).fill(null) } };
    const { consumer, cuts } = harness({ pattern });
    consumer(5, 1.0);
    expect(cuts).toHaveLength(0);
  });

  it('fires drum voices at step time, even on a column with no notes', () => {
    const drums = {
      kick: Array(16).fill(false),
      snare: Array(16).fill(false),
      hat: Array(16).fill(false),
    };
    drums.kick[0] = true;
    drums.hat[0] = true;
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells: emptyGrid(), drums };
    const { consumer, ons, drumHits } = harness({ pattern });
    consumer(0, 3.0);
    expect(ons).toHaveLength(0); // no pitch notes in this column
    expect(drumHits).toEqual([
      { voice: 'kick', time: 3.0 },
      { voice: 'hat', time: 3.0 },
    ]);
  });

  it('skips drum voices when the pattern has no drums lane (older saves)', () => {
    const pattern = { length: 16, swing: 0, baseOctave: 4, cells: emptyGrid() };
    const { consumer, drumHits } = harness({ pattern });
    consumer(0, 1.0);
    expect(drumHits).toHaveLength(0);
  });

  it('wraps past the pattern length and applies swing to off-beats', () => {
    const cells = emptyGrid();
    cells[7][1] = true; // C4 on column 1 (an off-beat)
    const pattern = { length: 16, swing: 1, baseOctave: 4, cells };
    const { consumer, ons } = harness({ pattern });
    consumer(17, 2.0); // step 17 → column 1; swing delays it half a step
    expect(ons).toHaveLength(1);
    expect(ons[0].time).toBeCloseTo(2.0 + 0.0625, 6); // 1.0 * 0.125/2
  });
});
