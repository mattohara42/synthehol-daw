// Standard MIDI File (.mid) encode/decode (L16a) — the "works everywhere"
// universal MIDI deliverable, distinct from live Web MIDI input (midi.js,
// E9) which is unavailable on Safari/iOS. Pure byte-level codec, no DOM/
// audio deps, so it's fully unit-testable; see midiFileUI.js for wiring to
// the Import/Export buttons shared by the Sequencer and Piano Roll tabs.
//
// Scope for this lean step, matching the piano roll's own constraints
// (pianoroll.js's ROLL_ROWS/2-octave window): a single track, one bar
// (PATTERN_STEPS=16 sixteenth-note steps) of the piano roll's chromatic
// grid — not the diatonic step-sequencer `cells` (lossy to round-trip
// through arbitrary chromatic MIDI) or the drum lanes (no pitch to map).
// Export writes Format 0 (single track); import accepts Format 0 or 1,
// flattening every track's note events into one list — multi-instrument
// files collapse to one instrument, which is a real loss but keeps the
// piano roll's single-lane model intact rather than inventing a track
// picker for a lean first step.

import { pitchToMidiNote } from './midi.js';
import { noteRunsStartingAt } from './pianoroll.js';

export const PPQ = 96; // ticks per quarter note; 16th-note step = PPQ/4 ticks
const TICKS_PER_STEP = PPQ / 4;

// ---- Variable-length quantity (MIDI's delta-time/meta-length encoding) ----

// Exported for direct testing — the bit-packing is the trickiest part of the
// codec and worth isolating from the full encode/decode round trip.
export function encodeVLQ(value) {
  const bytes = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

// Reads one VLQ starting at `offset`; returns { value, next } where `next`
// is the offset just past the VLQ.
export function decodeVLQ(bytes, offset) {
  let value = 0;
  let b;
  do {
    b = bytes[offset++];
    value = (value << 7) | (b & 0x7f);
  } while (b & 0x80);
  return { value, next: offset };
}

// ---- Encode: a piano-roll pattern -> a .mid Uint8Array ----

/**
 * Encode the piano-roll lane of `pattern` ({ roll, length }) as a Format 0
 * Standard MIDI File, one bar (`pattern.length` steps) long, at `bpm`.
 */
export function encodePatternAsMidi(pattern, bpm) {
  const events = []; // { tick, type: 'on'|'off', pitch, velocity }
  for (let col = 0; col < pattern.length; col++) {
    for (const run of noteRunsStartingAt(pattern, col)) {
      const pitch = pitchToMidiNote(run.note, run.octave);
      const startTick = col * TICKS_PER_STEP;
      events.push({ tick: startTick, type: 'on', pitch, velocity: 100 });
      events.push({ tick: startTick + run.lengthSteps * TICKS_PER_STEP, type: 'off', pitch });
    }
  }
  // Simultaneous offs before ons at the same tick, so a note ending exactly
  // when another begins doesn't leave both pitches sounding for an instant.
  events.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1));

  const trackBytes = [];
  // Tempo meta event, tick 0.
  const usPerQuarter = Math.round(60000000 / bpm);
  trackBytes.push(...encodeVLQ(0), 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);

  let lastTick = 0;
  for (const ev of events) {
    trackBytes.push(...encodeVLQ(ev.tick - lastTick));
    lastTick = ev.tick;
    if (ev.type === 'on') trackBytes.push(0x90, ev.pitch, ev.velocity);
    else trackBytes.push(0x80, ev.pitch, 0);
  }
  trackBytes.push(...encodeVLQ(0), 0xff, 0x2f, 0x00); // end of track

  const header = [
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // 'MThd', length 6
    0x00, 0x00, // format 0
    0x00, 0x01, // 1 track
    (PPQ >> 8) & 0xff, PPQ & 0xff,
  ];
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
    (trackBytes.length >> 24) & 0xff, (trackBytes.length >> 16) & 0xff,
    (trackBytes.length >> 8) & 0xff, trackBytes.length & 0xff,
  ];
  return new Uint8Array([...header, ...trackHeader, ...trackBytes]);
}

// ---- Decode: a .mid Uint8Array -> a flat note list ----

function readStr(bytes, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[offset + i]);
  return s;
}

/**
 * Parse a Standard MIDI File. Returns { ppq, notes }, where `notes` is every
 * note-on/note-off pair from every track flattened into one list —
 * `[{ pitch, startTick, durationTicks }]` — sorted by start time. Throws on
 * anything that isn't a recognizable SMF header.
 */
export function decodeMidiFile(bytes) {
  if (readStr(bytes, 0, 4) !== 'MThd') throw new Error('Not a Standard MIDI File (missing MThd header)');
  const headerLen = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
  const ntrks = (bytes[10] << 8) | bytes[11];
  const division = (bytes[12] << 8) | bytes[13];
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  const ppq = division;

  const notes = [];
  let offset = 8 + headerLen;
  for (let t = 0; t < ntrks && offset < bytes.length; t++) {
    if (readStr(bytes, offset, 4) !== 'MTrk') break;
    const trackLen = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
    const trackEnd = offset + 8 + trackLen;
    let pos = offset + 8;
    let tick = 0;
    let runningStatus = null;
    const pending = new Map(); // pitch -> startTick, for open note-ons

    while (pos < trackEnd) {
      const vlq = decodeVLQ(bytes, pos);
      tick += vlq.value;
      pos = vlq.next;

      let status = bytes[pos];
      if (status < 0x80) {
        // Running status: reuse the previous status byte, this byte is data.
        status = runningStatus;
      } else {
        pos++;
        runningStatus = status;
      }

      const command = status & 0xf0;
      if (status === 0xff) { // meta event
        const type = bytes[pos++];
        const len = decodeVLQ(bytes, pos);
        pos = len.next + len.value;
        if (type === 0x2f) break; // end of track
      } else if (status === 0xf0 || status === 0xf7) { // sysex
        const len = decodeVLQ(bytes, pos);
        pos = len.next + len.value;
      } else if (command === 0x90 || command === 0x80) {
        const pitch = bytes[pos++];
        const velocity = bytes[pos++];
        if (command === 0x90 && velocity > 0) {
          pending.set(pitch, tick);
        } else if (pending.has(pitch)) {
          const startTick = pending.get(pitch);
          pending.delete(pitch);
          notes.push({ pitch, startTick, durationTicks: Math.max(1, tick - startTick) });
        }
      } else if (command === 0xc0 || command === 0xd0) {
        pos += 1; // program change / channel pressure: one data byte
      } else if (command >= 0x80 && command <= 0xe0) {
        pos += 2; // note-off already handled above; the rest take two data bytes
      } else {
        break; // unrecognized status byte — bail rather than loop forever
      }
    }
    offset = trackEnd;
  }

  notes.sort((a, b) => a.startTick - b.startTick);
  return { ppq, notes };
}

// ---- Notes (from decodeMidiFile) -> a piano-roll grid ----

/**
 * Quantize a flat note list onto the piano roll's step/pitch grid. If the
 * file's average pitch falls outside the grid's pitch window, the whole file
 * is transposed by whole octaves until it doesn't (so a bassline or lead
 * recorded an octave or three off-center still imports) — notes already
 * averaging inside the window are left untouched. Any note that still
 * doesn't fit, or that starts beyond the first bar, is dropped. Returns
 * { roll, imported, dropped }. `rollLow`/`rollHigh` are MIDI note numbers
 * matching pianoroll.js's rollRowToPitch(0, baseOctave) /
 * rollRowToPitch(rollRows-1, baseOctave).
 */
export function notesToPatternRoll(notes, ppq, rollRows, rollLow, rollHigh, steps = 16) {
  const roll = Array.from({ length: rollRows }, () => Array(steps).fill(false));
  if (notes.length === 0) return { roll, imported: 0, dropped: 0 };

  const ticksPerStep = ppq / 4;
  const avgPitch = notes.reduce((sum, n) => sum + n.pitch, 0) / notes.length;
  let octaveShift = 0;
  while (avgPitch + octaveShift < rollLow) octaveShift += 12;
  while (avgPitch + octaveShift > rollHigh) octaveShift -= 12;

  let imported = 0;
  let dropped = 0;
  for (const n of notes) {
    const pitch = n.pitch + octaveShift;
    if (pitch < rollLow || pitch > rollHigh) { dropped++; continue; }
    const startStep = Math.round(n.startTick / ticksPerStep);
    if (startStep >= steps) { dropped++; continue; }
    const lengthSteps = Math.max(1, Math.round(n.durationTicks / ticksPerStep));
    const endStep = Math.min(steps, startStep + lengthSteps);
    const row = (rollRows - 1) - (pitch - rollLow);
    for (let col = startStep; col < endStep; col++) roll[row][col] = true;
    imported++;
  }
  return { roll, imported, dropped };
}
