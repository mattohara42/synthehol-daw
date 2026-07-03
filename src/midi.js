// Live MIDI input (E9) — feature-detected, never gates. If Web MIDI isn't
// available (Safari, iOS, Firefox without a flag) or the user denies
// permission, this silently does nothing; every other input path (on-screen
// keyboard, computer keyboard, mouse/touch) is unaffected.
//
// MIDI notes share the exact same polyphonic voice pool and chord-level
// bookkeeping (chordState.js) as the keyboard, so a MIDI chord and a
// keyboard chord interleave correctly — releasing one doesn't prematurely
// end the other's filter-envelope/LFO-retrigger state.

import { engine, startAudio, voiceNoteOn, voiceNoteOff } from './audio.js';
import { noteOnsetIfFirst, noteReleaseIfLast } from './chordState.js';
import { NOTE_NAMES } from './notes.js';

// Keyed by MIDI note number (0-127) — unique across the whole range, unlike
// keyboard.js's note-name keys (which assume one octave at a time via S.octave).
const heldNotes = new Map();

// Exported: pure, so it's testable without a real Web MIDI environment.
export function midiNoteToPitch(midiNote) {
  const octave = Math.floor(midiNote / 12) - 1; // MIDI 60 = C4
  const note = NOTE_NAMES[midiNote % 12];
  return { note, octave };
}

// Inverse of midiNoteToPitch — used by midiFile.js to encode piano-roll notes
// as .mid note numbers.
export function pitchToMidiNote(note, octave) {
  return (octave + 1) * 12 + NOTE_NAMES.indexOf(note);
}

// Parse a raw MIDI message's bytes into a note event, or null for anything
// else (CC, pitch bend, etc. — not handled in this lean step). Pure.
export function parseMidiMessage(data) {
  const [status, note, velocity] = data;
  const command = status & 0xf0;
  if (command === 0x90 && velocity > 0) return { type: 'on', note, velocity: velocity / 127 };
  // 0x80 = note-off; a note-on with velocity 0 is a common MIDI convention
  // for note-off too (running status optimization).
  if (command === 0x80 || (command === 0x90 && velocity === 0)) return { type: 'off', note };
  return null;
}

function handleNoteOn(midiNote, velocity) {
  if (heldNotes.has(midiNote)) return;
  startAudio(); // ensure engine.ctx exists before reading currentTime below
  const { note, octave } = midiNoteToPitch(midiNote);
  const id = voiceNoteOn(note, octave, engine.ctx.currentTime, velocity);
  heldNotes.set(midiNote, id);
  noteOnsetIfFirst(engine.ctx.currentTime);
}

function handleNoteOff(midiNote) {
  const id = heldNotes.get(midiNote);
  if (id == null) return;
  heldNotes.delete(midiNote);
  voiceNoteOff(id, engine.ctx.currentTime);
  noteReleaseIfLast(engine.ctx.currentTime);
}

function handleMessage(e) {
  const event = parseMidiMessage(e.data);
  if (!event) return;
  if (event.type === 'on') handleNoteOn(event.note, event.velocity);
  else handleNoteOff(event.note);
}

function attachInput(input) {
  input.onmidimessage = handleMessage;
}

/** Wire up any connected MIDI input devices. Does nothing where Web MIDI is unavailable. */
export function initMidi() {
  if (!navigator.requestMIDIAccess) return;
  navigator.requestMIDIAccess()
    .then((access) => {
      for (const input of access.inputs.values()) attachInput(input);
      // Devices plugged in after the page loads.
      access.onstatechange = (e) => {
        if (e.port.type === 'input' && e.port.state === 'connected') attachInput(e.port);
      };
    })
    .catch(() => { /* permission denied or unavailable — silently do nothing */ });
}
