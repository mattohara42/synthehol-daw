// Era workspaces (D5) — switchable visual themes, each a period-correct
// preset bank plus lore, gated on graduation (like D6's practice gym — free
// play once every module is taught, not a per-boss unlock), per
// docs/brainstorms/2026-07-03-era-workspaces-requirements.md. The four
// originally-planned workspaces (Moog/ARP/Oberheim/Sequential Circuits —
// matching the main progression's roster) are here, plus a fifth added
// later per docs/brainstorms/2026-07-06-roland-303-808-requirements.md:
// Acid (TB-303/TR-808-style patches) — that doc's own "reconsider once the
// four main ones land" clause from the original D5 doc. The Buchla
// (D1 bonus-challenge) era remains deliberately out of scope.
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
  {
    // Named "Acid" rather than "Roland" on purpose — stages.js's D1 bonus
    // challenge "The Solitary" already tags its own era 'roland' for the
    // 1976 CE-1 Chorus. A second workspace bearing the bare brand name
    // would read as the same thing to a player who's cleared that
    // challenge; naming this one after the genre/instrument it evokes
    // avoids the collision. See docs/brainstorms/
    // 2026-07-06-roland-303-808-requirements.md for the full scoping.
    id: 'acid',
    name: 'Acid',
    pioneer: 'Ikutaro Kakehashi',
    tagline: 'A resonant filter chasing its own envelope — the squelch that built a genre.',
    presets: [
      {
        // The core acid recipe this engine can actually reproduce: a bass-
        // register sawtooth into a highly resonant lowpass, with the filter
        // envelope doing the sweeping instead of a hand-turned knob. What
        // it can't reproduce — the diode ladder's specific resonance curve,
        // and real slide/accent — is a deliberate, documented gap; see the
        // scoping doc's "honest answer" section.
        name: 'Acid Bassline',
        ...BASE,
        waveform: 'sawtooth', octave: 2,
        filterType: 'lowpass', cutoff: 400, resonance: 14, filterEnvAmount: 3.2,
        attack: 0.001, decay: 0.25, sustain: 0, release: 0.08,
        drive: 0.15,
      },
      {
        name: 'Square Squelch',
        ...BASE,
        waveform: 'square', octave: 2,
        filterType: 'lowpass', cutoff: 300, resonance: 16, filterEnvAmount: 3.5,
        attack: 0.001, decay: 0.18, sustain: 0, release: 0.06,
        drive: 0.25,
      },
    ],
  },
];

export function workspaceById(id) {
  return ERA_WORKSPACES.find(w => w.id === id);
}
