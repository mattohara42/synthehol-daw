// Shared chord-level bookkeeping across every note-input source (on-screen/
// computer keyboard, MIDI — E9). All voices share one filter and one LFO
// oscillator, so the filter envelope and LFO key-sync retrigger fire once
// when the FIRST held note from ANY source starts, and release once when
// the LAST one from ANY source lets go. engine.noteOn (the boss engine's
// isPlaying signal) mirrors "at least one note is held, from any source".
//
// This has to be a shared counter, not something each input module tracks
// independently — otherwise releasing a MIDI note while a keyboard note is
// still held would incorrectly flip engine.noteOn to false.

import { engine, applyFilterEnv, releaseFilterEnv, restartLfoOsc } from './audio.js';
import { S } from './state.js';

let totalHeld = 0;

/** Call when a note starts. Runs the chord-onset effects only if this is the first. */
export function noteOnsetIfFirst(time) {
  totalHeld++;
  if (totalHeld === 1) {
    applyFilterEnv(time);
    if (S.lfoRetrigger) restartLfoOsc(time);
    engine.noteOn = true;
  }
}

/** Call when a note ends. Runs the chord-release effects only if none remain. */
export function noteReleaseIfLast(time) {
  totalHeld = Math.max(0, totalHeld - 1);
  if (totalHeld === 0) {
    releaseFilterEnv(time);
    engine.noteOn = false;
    engine.currentNote = null;
  }
}

/** Test-only: reset the held-note counter. */
export function _resetForTest() {
  totalHeld = 0;
}
