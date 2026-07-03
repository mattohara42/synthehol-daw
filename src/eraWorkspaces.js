// Era workspaces (D5) — switchable visual themes, each a period-correct
// preset bank plus lore, gated on graduation (like D6's practice gym — free
// play once every module is taught, not a per-boss unlock). v1 prototype:
// one workspace (ARP) alongside the existing Moog default, per
// docs/brainstorms/2026-07-03-era-workspaces-requirements.md.
//
// A workspace here is just the two --era-accent CSS custom properties
// style.css already reads (moog's [data-era="moog"] block is the existing
// precedent) plus a couple of curated presets — not a full reskin. Pure
// data + a lookup helper, no DOM; see eraWorkspacesUI.js for wiring.

const BASE = {
  waveform: 'sawtooth', octave: 4, detune: 0,
  noiseType: 'white', noiseMix: 0,
  osc2Waveform: 'sawtooth', osc2Octave: 0, osc2Detune: 0, osc2Mix: 0,
  filterType: 'lowpass', cutoff: 2000, resonance: 1, filterEnvAmount: 0,
  attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3,
  lfoDest: 'none', lfoRate: 2, lfoDepth: 0,
  lfoWaveform: 'sine', lfoRetrigger: false,
  eqLow: 0, eqMid: 0, eqHigh: 0,
  drive: 0, delayTime: 0.25, delayFeedback: 0.3, delayMix: 0, reverbMix: 0.15, chorusMix: 0,
  masterVol: 0.6,
};

export const ERA_WORKSPACES = [
  {
    id: 'moog',
    name: 'Moog',
    pioneer: 'Bob Moog',
    tagline: 'Warm ladder-filter amber — where the whole rack started.',
    presets: [], // the default look already IS the moog palette; nothing to curate for v1
  },
  {
    id: 'arp',
    name: 'ARP',
    pioneer: 'Alan R. Pearlman',
    tagline: "R2-D2's voice, sculpted from raw noise.",
    presets: [
      {
        name: 'Static Voice',
        ...BASE,
        noiseType: 'white', noiseMix: 0.6,
        filterType: 'bandpass', cutoff: 1800, resonance: 4,
        attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.1,
      },
      {
        name: 'Odyssey Lead',
        ...BASE,
        waveform: 'sawtooth', detune: 4,
        filterType: 'lowpass', cutoff: 3200, resonance: 7,
        attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.15,
        lfoDest: 'pitch', lfoRate: 5.5, lfoDepth: 0.04,
      },
    ],
  },
];

export function workspaceById(id) {
  return ERA_WORKSPACES.find(w => w.id === id);
}
