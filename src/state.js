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
  filterEnvAmount: 0, // octaves of upward cutoff sweep at envelope peak (0 = off)
  // ADSR
  attack: 0.01,
  decay: 0.2,
  sustain: 0.7,
  release: 0.3,
  // LFO
  lfoDest: 'filter',
  lfoRate: 2,
  lfoDepth: 0.2, // 0–1 normalized
  // FX
  delayTime: 0.25,      // seconds
  delayFeedback: 0.3,   // 0–0.85
  delayMix: 0,          // 0–1 wet level (off by default)
  reverbMix: 0.15,      // 0–1 wet level (a gentle default so it sounds good)
  // Master
  masterVol: 0.6,
};
