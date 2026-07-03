// Era workspaces (D5) — switchable visual themes, each a period-correct
// preset bank plus lore, gated on graduation (like D6's practice gym — free
// play once every module is taught, not a per-boss unlock), per
// docs/brainstorms/2026-07-03-era-workspaces-requirements.md. All four
// planned workspaces are here now (Moog/ARP/Oberheim/Sequential Circuits —
// matching the main progression's roster; the two D1 bonus-challenge eras,
// Buchla and Roland, are deliberately out of scope per the brainstorm doc).
//
// A workspace here is just the two --era-accent CSS custom properties
// style.css already reads (moog's [data-era="moog"] block is the original
// precedent) plus a couple of curated presets — not a full reskin. Pure
// data + a lookup helper, no DOM; see eraWorkspacesUI.js for wiring.
//
// Curated presets deliberately never touch a D1-gated field (chorusMix > 0,
// lfoWaveform: 'sampleHold') — eraWorkspacesUI's applyPreset() call has no
// progression check of its own (that gate lives in main.js, only exercised
// for the persistence/shared-link restore paths), so a gated value here
// would be a real bypass, not just an inert unused field.

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
  {
    id: 'oberheim',
    name: 'Oberheim',
    pioneer: 'Tom Oberheim',
    tagline: 'Two voices, slightly out of tune with each other — on purpose.',
    presets: [
      {
        name: 'Unison Drift',
        ...BASE,
        osc2Mix: 0.6, osc2Detune: 20,
        attack: 0.6, decay: 0.3, sustain: 0.8, release: 1.2,
      },
      {
        name: 'Numan Pulse',
        ...BASE,
        waveform: 'square', osc2Waveform: 'square', osc2Mix: 0.5, osc2Detune: 9,
        filterType: 'lowpass', cutoff: 2600, resonance: 5,
        attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.12,
      },
    ],
  },
  {
    id: 'sequential',
    name: 'Sequential',
    pioneer: 'Dave Smith',
    tagline: 'The first patch memory — dial it in once, recall it forever.',
    presets: [
      {
        // A close callback to stages.js's MIMIC_PATCH — the sound the Mimic
        // capstone boss asked you to reproduce by ear now loads in one click,
        // fitting for the instrument whose whole pitch was "recall a sound
        // perfectly, any time" instead of re-dialing it from scratch.
        name: 'Prophet Memory',
        ...BASE,
        osc2Detune: 15, osc2Mix: 0.4,
        filterType: 'lowpass', cutoff: 1200, resonance: 2,
        attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.2,
        lfoDest: 'pitch', lfoRate: 5, lfoDepth: 0.15,
      },
      {
        name: 'Analog Poly',
        ...BASE,
        waveform: 'triangle', osc2Mix: 0.3, osc2Detune: 8,
        filterType: 'lowpass', cutoff: 2200, resonance: 1.5,
        attack: 0.5, decay: 0.4, sustain: 0.75, release: 1.0,
        lfoDest: 'filter', lfoRate: 0.6, lfoDepth: 0.15,
      },
    ],
  },
];

export function workspaceById(id) {
  return ERA_WORKSPACES.find(w => w.id === id);
}
