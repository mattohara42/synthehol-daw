import { describe, it, expect } from 'vitest';
import {
  PPQ, encodeVLQ, decodeVLQ, encodePatternAsMidi, decodeMidiFile, notesToPatternRoll,
} from './midiFile.js';
import { rollRowToPitch, ROLL_ROWS } from './pianoroll.js';
import { pitchToMidiNote } from './midi.js';

function emptyRoll(rows = ROLL_ROWS, cols = 16) {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

// MIDI pitch numbers for the piano roll's low/high rows at baseOctave=4 —
// mirrors what midiFileUI.js computes at runtime.
function rollWindow(baseOctave = 4) {
  const low = rollRowToPitch(ROLL_ROWS - 1, baseOctave);
  const high = rollRowToPitch(0, baseOctave);
  return { low: pitchToMidiNote(low.note, low.octave), high: pitchToMidiNote(high.note, high.octave) };
}

describe('midiFile – VLQ', () => {
  it('round-trips single-byte values', () => {
    for (const v of [0, 1, 64, 127]) {
      const { value, next } = decodeVLQ(encodeVLQ(v), 0);
      expect(value).toBe(v);
      expect(next).toBe(1);
    }
  });

  it('round-trips multi-byte values at the boundary (128) and beyond', () => {
    for (const v of [128, 129, 16383, 16384, 2097151, 60000000]) {
      const bytes = encodeVLQ(v);
      const { value } = decodeVLQ(bytes, 0);
      expect(value).toBe(v);
    }
  });

  it('reads a VLQ embedded mid-array, stopping at the right offset', () => {
    const bytes = [0xff, 0xff, ...encodeVLQ(300), 0x99];
    const { value, next } = decodeVLQ(bytes, 2);
    expect(value).toBe(300);
    expect(bytes[next]).toBe(0x99);
  });
});

describe('midiFile – encodePatternAsMidi', () => {
  it('writes a well-formed Format 0 SMF header', () => {
    const pattern = { roll: emptyRoll(), length: 16, baseOctave: 4 };
    const bytes = encodePatternAsMidi(pattern, 120);
    const str = (o, n) => String.fromCharCode(...bytes.slice(o, o + n));
    expect(str(0, 4)).toBe('MThd');
    expect(bytes[8]).toBe(0); expect(bytes[9]).toBe(0); // format 0
    expect(bytes[10]).toBe(0); expect(bytes[11]).toBe(1); // 1 track
    expect((bytes[12] << 8) | bytes[13]).toBe(PPQ);
    expect(str(14, 4)).toBe('MTrk');
  });

  it('produces a file decodeMidiFile can parse back with the same ppq', () => {
    const pattern = { roll: emptyRoll(), length: 16, baseOctave: 4 };
    const { ppq } = decodeMidiFile(encodePatternAsMidi(pattern, 100));
    expect(ppq).toBe(PPQ);
  });
});

describe('midiFile – decodeMidiFile', () => {
  it('rejects bytes without an MThd header', () => {
    expect(() => decodeMidiFile(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });

  it('parses running-status note-on/off pairs, including note-on-velocity-0-as-off', () => {
    // Hand-built minimal SMF: header (PPQ=96), one track with:
    //   dt=0  90 3C 64  (note-on C4=60 vel 100)
    //   dt=48    40 64  (running status note-on E4=64 vel 100 — no repeated 0x90)
    //   dt=48    3C 00  (running status "note-on" C4 vel 0 == note-off)
    //   dt=0  80 40 00  (explicit note-off E4)
    //   dt=0  FF 2F 00  (end of track)
    const track = [
      0x00, 0x90, 0x3c, 0x64,
      48, 0x40, 0x64,
      48, 0x3c, 0x00,
      0x00, 0x80, 0x40, 0x00,
      0x00, 0xff, 0x2f, 0x00,
    ];
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, track.length,
      ...track,
    ]);
    const { ppq, notes } = decodeMidiFile(bytes);
    expect(ppq).toBe(96);
    expect(notes).toEqual([
      { pitch: 60, startTick: 0, durationTicks: 96 },   // ends at tick 96 (vel-0 note-off)
      { pitch: 64, startTick: 48, durationTicks: 48 },  // ends at tick 96 (explicit note-off)
    ]);
  });
});

describe('midiFile – encode/decode/quantize round trip', () => {
  it('reproduces a piano-roll pattern exactly through export then import', () => {
    const roll = emptyRoll();
    // A few runs at different rows/cols/lengths, all inside the 2-octave window.
    roll[23][0] = roll[23][1] = roll[23][2] = true; // C4, steps 0-2
    roll[19][4] = roll[19][5] = true;                // E4, steps 4-5
    roll[11][12] = true;                             // C5, step 12
    const pattern = { roll, length: 16, baseOctave: 4 };

    const bytes = encodePatternAsMidi(pattern, 120);
    const { ppq, notes } = decodeMidiFile(bytes);
    const { low, high } = rollWindow(4);
    const { roll: result, imported, dropped } = notesToPatternRoll(notes, ppq, ROLL_ROWS, low, high, 16);

    expect(imported).toBe(3);
    expect(dropped).toBe(0);
    expect(result).toEqual(roll);
  });
});

describe('midiFile – notesToPatternRoll', () => {
  const { low, high } = rollWindow(4);

  it('imports notes already inside the window at their exact step/row', () => {
    const notes = [{ pitch: 60, startTick: 0, durationTicks: 96 }]; // C4, step 0, 1 step long
    const { roll, imported, dropped } = notesToPatternRoll(notes, PPQ, ROLL_ROWS, low, high, 16);
    expect(imported).toBe(1);
    expect(dropped).toBe(0);
    expect(roll[ROLL_ROWS - 1][0]).toBe(true); // row 23 = C4
  });

  it('transposes a whole file by octaves to fit a narrow range into the window', () => {
    // Two octaves below the window (C4=60 -> C2=36); average pitch 36 should
    // shift by +24 to land back at 60.
    const notes = [{ pitch: 36, startTick: 0, durationTicks: 96 }];
    const { roll, imported, dropped } = notesToPatternRoll(notes, PPQ, ROLL_ROWS, low, high, 16);
    expect(imported).toBe(1);
    expect(dropped).toBe(0);
    expect(roll[ROLL_ROWS - 1][0]).toBe(true);
  });

  it('drops notes that still fall outside the window after centering', () => {
    // A span wider than the 2-octave window — centering can't fit both ends.
    const notes = [
      { pitch: 60, startTick: 0, durationTicks: 96 },
      { pitch: 60 + 36, startTick: 0, durationTicks: 96 }, // 3 octaves above
    ];
    const { imported, dropped } = notesToPatternRoll(notes, PPQ, ROLL_ROWS, low, high, 16);
    expect(imported + dropped).toBe(2);
    expect(dropped).toBeGreaterThan(0);
  });

  it('drops notes starting beyond the requested step window (first bar only)', () => {
    const notes = [{ pitch: 60, startTick: 20 * (PPQ / 4), durationTicks: 96 }]; // step 20, past a 16-step bar
    const { imported, dropped } = notesToPatternRoll(notes, PPQ, ROLL_ROWS, low, high, 16);
    expect(imported).toBe(0);
    expect(dropped).toBe(1);
  });

  it('caps a note run at the end of the pattern instead of overflowing it', () => {
    const notes = [{ pitch: 60, startTick: 14 * (PPQ / 4), durationTicks: 8 * (PPQ / 4) }]; // starts step 14, would run to step 22
    const { roll, imported } = notesToPatternRoll(notes, PPQ, ROLL_ROWS, low, high, 16);
    expect(imported).toBe(1);
    const row = roll[ROLL_ROWS - 1];
    expect(row.slice(14, 16)).toEqual([true, true]);
    expect(row.length).toBe(16);
  });

  it('returns an empty, correctly-shaped roll for an empty note list', () => {
    const { roll, imported, dropped } = notesToPatternRoll([], PPQ, ROLL_ROWS, low, high, 16);
    expect(roll.length).toBe(ROLL_ROWS);
    expect(roll.every(row => row.length === 16 && row.every(c => c === false))).toBe(true);
    expect(imported).toBe(0);
    expect(dropped).toBe(0);
  });
});
