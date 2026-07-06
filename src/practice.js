// Practice gym (D6) — an ongoing ear-training mode: match a rotating bank of
// curated target patches by ear, scored with the same parameter-distance
// approach The Mimic capstone proved out (bossEngine.js's B15 origin), but
// with no HP/boss framing — just a live closeness meter and a "nailed it"
// moment, repeatable forever. Free-play, not a one-shot unlock: this module
// never touches progression or bossEngine.
//
// Only fields previewPatch() actually renders audible are scored (see
// audio.js: the one-off preview voice pool bypasses the shared filter
// entirely and carries no LFO routing) — grading on cutoff or LFO would be
// asking the player to guess something they have no way to hear.

const BASE = {
  waveform: 'sawtooth', octave: 4, detune: 0,
  noiseType: 'white', noiseMix: 0,
  osc2Waveform: 'sawtooth', osc2Octave: 0, osc2Detune: 0, osc2Mix: 0,
  filterType: 'lowpass', cutoff: 2000, resonance: 1,
  attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3,
  lfoDest: 'none', lfoRate: 2, lfoDepth: 0,
  lfoWaveform: 'sine', lfoRetrigger: false,
  eqLow: 0, eqMid: 0, eqHigh: 0,
  drive: 0, delayTime: 0.25, delayFeedback: 0.3, delayMix: 0, reverbMix: 0.15, chorusMix: 0,
  masterVol: 0.6,
};

// A curated bank, not procedural generation — each one is a deliberately
// distinct, recognizable character (a pluck, a pad, a blip...) so a round
// has a clear "does this sound right" target rather than arbitrary noise.
export const TARGETS = [
  { name: 'Plucky Bell', ...BASE, waveform: 'triangle', attack: 0.005, decay: 0.12, sustain: 0.05, release: 0.15, osc2Mix: 0.3, osc2Detune: 12 },
  { name: 'Fat Bass', ...BASE, waveform: 'sawtooth', attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.1, osc2Mix: 0.5, osc2Detune: 6 },
  { name: 'Airy Pad', ...BASE, waveform: 'sine', attack: 0.6, decay: 0.4, sustain: 0.8, release: 1.2, osc2Mix: 0.4, osc2Detune: 9, noiseMix: 0.05 },
  { name: 'Snappy Blip', ...BASE, waveform: 'square', attack: 0.002, decay: 0.06, sustain: 0, release: 0.05, noiseMix: 0.1 },
  { name: 'Breathy Lead', ...BASE, waveform: 'sawtooth', attack: 0.03, decay: 0.15, sustain: 0.5, release: 0.3, osc2Mix: 0.2, osc2Detune: 20, noiseMix: 0.15 },
  { name: 'Wide Unison', ...BASE, waveform: 'sawtooth', attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.4, osc2Mix: 0.6, osc2Detune: 25 },
];

// Dimensions scored, each matched against the live S at the same key. No
// tolerance = exact match required (categorical); otherwise 0..1 linear
// falloff over `tolerance` units, floored at 0 — same shape as stages.js's
// matchIntensity, reimplemented here rather than imported/shared since
// stages.js deliberately keeps it module-private (its one hardcoded spec is
// a one-off, this is a small independent reusable utility).
const MATCH_DIMS = [
  { key: 'waveform' },
  { key: 'detune', tolerance: 20 },
  { key: 'attack', tolerance: 0.3 },
  { key: 'decay', tolerance: 0.3 },
  { key: 'sustain', tolerance: 0.3 },
  { key: 'release', tolerance: 0.5 },
  { key: 'osc2Mix', tolerance: 0.3 },
  { key: 'osc2Detune', tolerance: 20 },
  { key: 'noiseMix', tolerance: 0.3 },
];

/** Pure: 0..1 closeness of live params `S` to `target` across MATCH_DIMS. */
export function matchIntensity(S, target) {
  let total = 0;
  for (const dim of MATCH_DIMS) {
    const v = S[dim.key];
    if (dim.tolerance == null) {
      total += v === target[dim.key] ? 1 : 0;
    } else {
      total += typeof v === 'number' ? Math.max(0, 1 - Math.abs(v - target[dim.key]) / dim.tolerance) : 0;
    }
  }
  return total / MATCH_DIMS.length;
}

/** Pure: pick a random target, avoiding an immediate repeat where possible. */
export function pickTarget(previous) {
  if (TARGETS.length <= 1) return TARGETS[0];
  let next;
  do { next = TARGETS[Math.floor(Math.random() * TARGETS.length)]; }
  while (next === previous);
  return next;
}

export const MATCH_THRESHOLD = 0.88; // how close counts as "matching"
export const HOLD_SECONDS = 0.8;     // how long it must sustain to count as "nailed" (B1's lesson: reward sustain, not a single tick)

/**
 * A practice round: current target, a live closeness meter, and a "nailed
 * it" moment on a sustained close match — auto-advances to a new target.
 * No persistence, no HP, no boss: this is a free-play loop, called once per
 * animation frame like every other rAF-driven consumer (E8).
 */
export function createPracticeSession() {
  let target = pickTarget(null);
  let holdTime = 0;
  let rounds = 0;

  function newTarget() {
    target = pickTarget(target);
    holdTime = 0;
    return target;
  }

  /** Per-frame update. Returns { intensity, nailed }. */
  function tick({ S, isPlaying, dt }) {
    const intensity = isPlaying ? matchIntensity(S, target) : 0;
    holdTime = intensity >= MATCH_THRESHOLD ? holdTime + dt : 0;
    if (holdTime >= HOLD_SECONDS) {
      rounds += 1;
      newTarget();
      return { intensity, nailed: true };
    }
    return { intensity, nailed: false };
  }

  return {
    get target() { return target; },
    get rounds() { return rounds; },
    newTarget,
    tick,
  };
}
