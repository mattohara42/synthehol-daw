import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from './audio.js';
import { noteOnsetIfFirst, noteReleaseIfLast, _resetForTest } from './chordState.js';

// engine.vcf is null without a real AudioContext, so applyFilterEnv/
// releaseFilterEnv/restartLfoOsc all no-op gracefully — only engine.noteOn
// is directly observable here, which is exactly the cross-module contract
// this module exists to get right.

beforeEach(() => {
  _resetForTest();
  engine.noteOn = false;
  engine.currentNote = null;
});

describe('chordState – shared across input sources', () => {
  it('sets engine.noteOn on the first onset, not on subsequent ones', () => {
    noteOnsetIfFirst(0);
    expect(engine.noteOn).toBe(true);
    noteOnsetIfFirst(0); // a second note in the same chord
    expect(engine.noteOn).toBe(true); // unchanged, still true
  });

  it('only clears engine.noteOn once every held note has released', () => {
    noteOnsetIfFirst(0);
    noteOnsetIfFirst(0); // two notes held (e.g. one keyboard, one MIDI)
    noteReleaseIfLast(0);
    expect(engine.noteOn).toBe(true); // one still held
    noteReleaseIfLast(0);
    expect(engine.noteOn).toBe(false); // none left
  });

  it('does not go negative if released more times than pressed', () => {
    noteReleaseIfLast(0);
    noteReleaseIfLast(0);
    expect(engine.noteOn).toBe(false);
    noteOnsetIfFirst(0);
    expect(engine.noteOn).toBe(true);
  });
});
