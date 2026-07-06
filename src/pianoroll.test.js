import { describe, it, expect } from 'vitest';
import { ROLL_ROWS, rollRowToPitch, noteRunsStartingAt, createPianoRollConsumer } from './pianoroll.js';

function emptyRoll(rows = ROLL_ROWS, cols = 16) {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

describe('pianoroll – chromatic pitch mapping', () => {
  it('maps the bottom row to base C and the top row two octaves up', () => {
    expect(rollRowToPitch(ROLL_ROWS - 1, 4)).toEqual({ note: 'C', octave: 4 });
    expect(rollRowToPitch(0, 4)).toEqual({ note: 'B', octave: 5 }); // 23 semitones up
  });

  it('covers every semitone, not just a diatonic scale', () => {
    // One semitone up from bottom (C4) should be C#4, not the next scale degree.
    expect(rollRowToPitch(ROLL_ROWS - 2, 4)).toEqual({ note: 'C#', octave: 4 });
  });
});

describe('pianoroll – noteRunsStartingAt', () => {
  it('finds a run only at its leading edge, with the correct length', () => {
    const roll = emptyRoll();
    roll[10][2] = true;
    roll[10][3] = true;
    roll[10][4] = true;
    const pattern = { length: 16, swing: 0, baseOctave: 4, roll };

    expect(noteRunsStartingAt(pattern, 2)).toEqual([
      { ...rollRowToPitch(10, 4), lengthSteps: 3 },
    ]);
    // Mid-run and after-run columns report no new onset.
    expect(noteRunsStartingAt(pattern, 3)).toEqual([]);
    expect(noteRunsStartingAt(pattern, 4)).toEqual([]);
  });

  it('reports simultaneous runs across rows as a chord', () => {
    const roll = emptyRoll();
    roll[5][0] = true;
    roll[9][0] = true;
    const pattern = { length: 16, swing: 0, baseOctave: 4, roll };
    const runs = noteRunsStartingAt(pattern, 0);
    expect(runs).toHaveLength(2);
    expect(runs.map(r => r.lengthSteps)).toEqual([1, 1]);
  });

  it('does not let a run wrap past the pattern length', () => {
    const roll = emptyRoll();
    roll[0][15] = true; // last column of a 16-step pattern, no continuation
    const pattern = { length: 16, swing: 0, baseOctave: 4, roll };
    expect(noteRunsStartingAt(pattern, 15)).toEqual([
      { ...rollRowToPitch(0, 4), lengthSteps: 1 },
    ]);
  });

  it('returns nothing when the pattern has no roll lane (older saves)', () => {
    const pattern = { length: 16, swing: 0, baseOctave: 4 };
    expect(noteRunsStartingAt(pattern, 0)).toEqual([]);
  });
});

describe('pianoroll – consumer', () => {
  function harness({ pattern, bpm = 120, gate = 0.95, trackId = 't1' }) {
    const ons = [];
    const offs = [];
    let nextId = 1;
    const consumer = createPianoRollConsumer({
      getTracks: () => [{ id: trackId, pattern }],
      getBpm: () => bpm,
      noteOn: (note, octave, time, velocity, tid) => {
        const id = nextId++;
        ons.push({ id, note, octave, time, velocity, trackId: tid });
        return id;
      },
      noteOff: (id, time, tid) => offs.push({ id, time, trackId: tid }),
      gate,
    });
    return { consumer, ons, offs };
  }

  it('fires one held note per run, released after its full length', () => {
    const roll = emptyRoll();
    roll[10][0] = true;
    roll[10][1] = true; // 2-step note
    const pattern = { length: 16, swing: 0, baseOctave: 4, roll };
    const { consumer, ons, offs } = harness({ pattern });

    consumer(0, 10.0);
    expect(ons).toHaveLength(1);
    expect(ons[0].time).toBe(10.0);
    // 2 steps at 120bpm = 2 * 0.125s = 0.25s, gated at 0.95
    expect(offs[0].time).toBeCloseTo(10.0 + 0.95 * 0.25, 6);
  });

  it('does not retrigger on the run\'s interior steps', () => {
    const roll = emptyRoll();
    roll[10][0] = true;
    roll[10][1] = true;
    roll[10][2] = true;
    const pattern = { length: 16, swing: 0, baseOctave: 4, roll };
    const { consumer, ons } = harness({ pattern });

    consumer(0, 0);
    consumer(1, 0.125);
    consumer(2, 0.25);
    expect(ons).toHaveLength(1); // only the onset at step 0
  });

  it('does nothing on a pattern with no roll lane', () => {
    const pattern = { length: 16, swing: 0, baseOctave: 4 };
    const { consumer, ons } = harness({ pattern });
    consumer(0, 0);
    expect(ons).toHaveLength(0);
  });

  it('plays every track\'s roll each step, tagging notes with the right trackId (E4)', () => {
    const rollA = emptyRoll();
    rollA[10][0] = true;
    const patternA = { length: 16, swing: 0, baseOctave: 4, roll: rollA };

    const rollB = emptyRoll();
    rollB[5][0] = true;
    const patternB = { length: 16, swing: 0, baseOctave: 4, roll: rollB };

    const ons = [];
    let nextId = 1;
    const consumer = createPianoRollConsumer({
      getTracks: () => [{ id: 'tA', pattern: patternA }, { id: 'tB', pattern: patternB }],
      getBpm: () => 120,
      noteOn: (note, octave, time, velocity, tid) => { ons.push({ note, octave, trackId: tid }); return nextId++; },
      noteOff: () => {},
    });

    consumer(0, 0);
    expect(ons).toHaveLength(2);
    expect(ons.map(o => o.trackId)).toEqual(['tA', 'tB']);
  });
});
