// Note name → frequency conversion.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTE_SEMIS = { 'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11 };

export function noteFreq(note, octave) {
  if (note === 'C5') {
    // Top key is always one octave above the current base octave
    return 440 * Math.pow(2, (octave + 1 - 4) + (0 - 9) / 12);
  }
  return 440 * Math.pow(2, (octave - 4) + (NOTE_SEMIS[note] - 9) / 12);
}
