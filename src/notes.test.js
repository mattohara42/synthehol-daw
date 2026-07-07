import { describe, it, expect } from 'vitest';
import { noteFreq, NOTE_NAMES } from './notes.js';

describe('notes – noteFreq()', () => {
  it('A4 is exactly 440 Hz at octave 4', () => {
    expect(noteFreq('A', 4)).toBeCloseTo(440, 6);
  });

  it('doubles frequency one octave up for the same note', () => {
    const c4 = noteFreq('C', 4);
    const c5 = noteFreq('C', 5);
    expect(c5).toBeCloseTo(c4 * 2, 6);
  });

  it('halves frequency one octave down for the same note', () => {
    const a4 = noteFreq('A', 4);
    const a3 = noteFreq('A', 3);
    expect(a3).toBeCloseTo(a4 / 2, 6);
  });

  it('each semitone step up multiplies frequency by the 12th root of 2', () => {
    const ratio = Math.pow(2, 1 / 12);
    for (let i = 0; i < NOTE_NAMES.length - 1; i++) {
      const lower = noteFreq(NOTE_NAMES[i], 4);
      const upper = noteFreq(NOTE_NAMES[i + 1], 4);
      expect(upper / lower).toBeCloseTo(ratio, 6);
    }
  });

  it('matches known equal-temperament reference frequencies', () => {
    expect(noteFreq('C', 4)).toBeCloseTo(261.6256, 3);
    expect(noteFreq('E', 4)).toBeCloseTo(329.6276, 3);
    expect(noteFreq('G', 4)).toBeCloseTo(391.9954, 3);
  });

  describe('the "C5" special case (top key of the on-screen keyboard)', () => {
    it('is always exactly one octave above the given base octave, not chromatic C', () => {
      expect(noteFreq('C5', 4)).toBeCloseTo(noteFreq('C', 5), 6);
      expect(noteFreq('C5', 3)).toBeCloseTo(noteFreq('C', 4), 6);
    });

    it('tracks octave shifts (Z/X keys) rather than staying pinned to octave 5', () => {
      const low = noteFreq('C5', 2);
      const high = noteFreq('C5', 6);
      expect(high / low).toBeCloseTo(16, 6); // 4 octaves apart
    });
  });
});
