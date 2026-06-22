// Central synth parameter state. Every module reads/writes this object
// rather than passing values around individually.

export const S = {
  // Osc
  waveform: 'sine',
  octave: 4,
  detune: 0,
  // Filter
  filterType: 'lowpass',
  cutoff: 2000,
  resonance: 1.0,
  // ADSR
  attack: 0.01,
  decay: 0.2,
  sustain: 0.7,
  release: 0.3,
  // LFO
  lfoDest: 'filter',
  lfoRate: 2,
  lfoDepth: 0.2, // 0–1 normalized
  // Noise (VNO)
  noiseType: 'white',
  noiseMix: 0,
  // Master
  masterVol: 0.6,
};
