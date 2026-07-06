import { describe, it, expect } from 'vitest';
import { midiNoteToPitch, pitchToMidiNote, parseMidiMessage } from './midi.js';

describe('midi – midiNoteToPitch', () => {
  it('maps MIDI note 60 to C4 (the standard convention)', () => {
    expect(midiNoteToPitch(60)).toEqual({ note: 'C', octave: 4 });
  });

  it('maps MIDI note 69 to A4 (concert pitch, A440)', () => {
    expect(midiNoteToPitch(69)).toEqual({ note: 'A', octave: 4 });
  });

  it('covers a full octave span correctly', () => {
    expect(midiNoteToPitch(60)).toEqual({ note: 'C', octave: 4 });
    expect(midiNoteToPitch(61)).toEqual({ note: 'C#', octave: 4 });
    expect(midiNoteToPitch(71)).toEqual({ note: 'B', octave: 4 });
    expect(midiNoteToPitch(72)).toEqual({ note: 'C', octave: 5 });
  });

  it('handles the low and high ends of the MIDI range', () => {
    expect(midiNoteToPitch(0)).toEqual({ note: 'C', octave: -1 });
    expect(midiNoteToPitch(127)).toEqual({ note: 'G', octave: 9 });
  });
});

describe('midi – pitchToMidiNote', () => {
  it('is the exact inverse of midiNoteToPitch across the full MIDI range', () => {
    for (let n = 0; n <= 127; n++) {
      const { note, octave } = midiNoteToPitch(n);
      expect(pitchToMidiNote(note, octave)).toBe(n);
    }
  });

  it('matches the documented C4=60 / A4=69 convention', () => {
    expect(pitchToMidiNote('C', 4)).toBe(60);
    expect(pitchToMidiNote('A', 4)).toBe(69);
  });
});

describe('midi – parseMidiMessage', () => {
  it('parses a note-on message', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: 'on', note: 60, velocity: 100 / 127 });
  });

  it('parses a note-off message', () => {
    expect(parseMidiMessage([0x80, 60, 0])).toEqual({ type: 'off', note: 60 });
  });

  it('treats a note-on with velocity 0 as note-off (running-status convention)', () => {
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({ type: 'off', note: 60 });
  });

  it('respects the channel nibble (note-on/off on any of the 16 channels)', () => {
    expect(parseMidiMessage([0x91, 64, 80])).toEqual({ type: 'on', note: 64, velocity: 80 / 127 });
    expect(parseMidiMessage([0x8f, 64, 0])).toEqual({ type: 'off', note: 64 });
  });

  it('ignores other message types (CC, pitch bend, etc.)', () => {
    expect(parseMidiMessage([0xb0, 7, 100])).toBeNull(); // control change
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull();  // pitch bend
  });
});
