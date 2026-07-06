// Act I–III stage and boss definitions, plus a capstone. Each stage has a
// target predicate: (S, isPlaying) => boolean | number. A boolean is a
// threshold check (met or not); a number 0..1 is a "how close" intensity for
// distance-based stages (see matchIntensity below) — bossEngine scales damage
// by it either way, so both kinds plug into the same engine unchanged (R12).

// Generic distance-based intensity for match-the-sound stages: each spec
// entry is either a categorical exact-match ({key, value}) or a continuous
// closeness score ({key, value, tolerance}). Equally weighted and averaged
// into a single 0..1 result.
function matchIntensity(S, spec) {
  let total = 0;
  for (const dim of spec) {
    if (dim.tolerance == null) {
      total += S[dim.key] === dim.value ? 1 : 0;
    } else {
      // A missing/non-numeric field is simply "far away" (0), not NaN.
      const v = S[dim.key];
      total += typeof v === 'number' ? Math.max(0, 1 - Math.abs(v - dim.value) / dim.tolerance) : 0;
    }
  }
  return total / spec.length;
}

// The capstone's reference patch — what the boss wants reproduced. Only the
// fields in MIMIC_MATCH_SPEC are scored; the rest just fill out a complete,
// playable params object so it can be auditioned with previewPatch().
const MIMIC_PATCH = {
  waveform: 'sawtooth', octave: 4, detune: 0,
  noiseType: 'white', noiseMix: 0,
  osc2Waveform: 'sawtooth', osc2Octave: 0, osc2Detune: 15, osc2Mix: 0.4,
  filterType: 'lowpass', cutoff: 1200, resonance: 2,
  attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.2,
  lfoDest: 'pitch', lfoRate: 5, lfoDepth: 0.15,
};

const MIMIC_MATCH_SPEC = [
  { key: 'waveform', value: MIMIC_PATCH.waveform },
  { key: 'cutoff', value: MIMIC_PATCH.cutoff, tolerance: 1500 },
  { key: 'attack', value: MIMIC_PATCH.attack, tolerance: 0.1 },
  { key: 'sustain', value: MIMIC_PATCH.sustain, tolerance: 0.4 },
  { key: 'lfoDest', value: MIMIC_PATCH.lfoDest },
  { key: 'lfoDepth', value: MIMIC_PATCH.lfoDepth, tolerance: 0.3 },
  { key: 'osc2Mix', value: MIMIC_PATCH.osc2Mix, tolerance: 0.4 },
];

const STAGES = [
  {
    id: 'osc',
    moduleId: 'mod-osc',
    era: 'moog',
    instrument: 'Moog 901 Oscillator Bank',
    pioneer: 'Bob Moog',
    historyYear: '1964',
    historyFact: 'Bob Moog debuted the first voltage-controlled synthesizer modules at the AES convention in October 1964, giving composers electronic control over pitch for the first time.',
    intro: 'The oscillator is the source of all sound. Change its shape to begin.',
    boss: {
      name: 'Vox Corruptus',
      corruptedOf: 'Moog 901 Oscillator Bank',
      taunt: 'You play only sine waves? How... predictable. Show me something with teeth.',
      maxHp: 100,
      dps: 40,
    },
    target: (S, isPlaying) => S.waveform !== 'sine' && isPlaying,
  },
  {
    id: 'filter',
    moduleId: 'mod-filter',
    era: 'moog',
    instrument: 'Moog Ladder Filter',
    pioneer: 'Bob Moog',
    historyYear: '1965',
    historyFact: "Moog's transistor ladder filter — introduced in his 1965 commercial modules — produced a warm resonance that became the defining sound of the synthesizer era.",
    intro: 'The filter shapes the brightness of sound. Open it up.',
    boss: {
      name: 'The Muffled',
      corruptedOf: 'Moog Ladder Filter',
      taunt: "So dark, so dull. Let some light in — if you dare.",
      maxHp: 100,
      dps: 40,
    },
    target: (S, isPlaying) => S.filterType === 'lowpass' && S.cutoff > 4000 && isPlaying,
  },
  {
    id: 'envelope',
    moduleId: 'mod-adsr',
    era: 'moog',
    instrument: 'Moog Contour Generator',
    pioneer: 'Wendy Carlos',
    historyYear: '1968',
    historyFact: "Wendy Carlos's 1968 album Switched-On Bach demonstrated that the Moog's contour generators could match the attack and decay of acoustic instruments with uncanny expressiveness.",
    intro: 'The envelope controls how a sound begins and ends. Make it punch.',
    boss: {
      name: 'Dronekeeper',
      corruptedOf: 'Moog Contour Generator',
      taunt: 'Every note blurs into the next. Give me a beginning and an end.',
      maxHp: 100,
      dps: 40,
    },
    target: (S, isPlaying) => S.attack < 0.05 && S.sustain < 0.3 && isPlaying,
  },
  {
    id: 'lfo',
    moduleId: 'mod-lfo',
    era: 'moog',
    instrument: 'Moog Low Frequency Oscillator',
    pioneer: 'Wendy Carlos',
    historyYear: '1970',
    historyFact: 'The Minimoog Model D (1970), which Carlos helped refine, collapsed the modular patch cables of earlier synthesizers into a single playable instrument with an integrated LFO.',
    intro: 'The LFO adds movement to sound. Route it somewhere and push the depth.',
    boss: {
      name: 'The Still',
      corruptedOf: 'Moog Low Frequency Oscillator',
      taunt: 'Static. Lifeless. Add some wobble to this world.',
      maxHp: 100,
      dps: 40,
    },
    target: (S, isPlaying) => S.lfoDest !== 'none' && S.lfoDepth > 0.3 && isPlaying,
  },
  {
    id: 'noise',
    moduleId: 'mod-noise',
    era: 'arp',
    instrument: 'ARP 2600 Noise Source',
    pioneer: 'Alan R. Pearlman',
    historyYear: '1971',
    historyFact: "Ben Burtt shaped R2-D2's voice by filtering and enveloping white noise from an ARP 2600 — the same spectral sculpting technique you're learning here.",
    intro: 'Noise is raw, unformed sound. Raise the Mix, bring the Cutoff down, and keep the Decay short — sculpt it into a hit.',
    boss: {
      name: 'The Static',
      corruptedOf: 'ARP 2600 Noise Source',
      taunt: 'Pure chaos, and proud of it. Raise the Mix, tighten the Filter, snap the Decay short — give it a shape.',
      maxHp: 100,
      dps: 40,
    },
    target: (S, isPlaying) => S.noiseMix > 0.2 && S.cutoff < 5000 && S.decay < 0.2 && isPlaying,
  },
  {
    id: 'osc2',
    moduleId: 'mod-osc2',
    era: 'oberheim',
    instrument: 'Oberheim Two-Voice',
    pioneer: 'Tom Oberheim',
    historyYear: '1975',
    historyFact: "Tom Oberheim hand-wired two SEM modules into a single case, creating the first commercial two-voice synthesizer. That pair of slightly drifting oscillators became the signature warmth behind OMD, Gary Numan, and Van Halen's synth leads.",
    intro: 'Two voices, same note. Raise the Mix and let the second oscillator drift — the sound comes alive in the beating.',
    boss: {
      name: 'The Dissonant',
      corruptedOf: 'Oberheim Two-Voice Oscillator Pair',
      taunt: 'Two voices locked in perfect unison. Perfectly sterile. Wake them up — detune them until you can feel the beating.',
      maxHp: 100,
      dps: 40,
    },
    target: (S, isPlaying) =>
      S.osc2Mix > 0.3 && Math.abs(S.osc2Detune) >= 5 && Math.abs(S.osc2Detune) <= 45 && isPlaying,
  },
  {
    id: 'mimic',
    moduleId: null, // spans every module learned so far — no single one to lock/highlight
    era: 'capstone',
    instrument: 'Sequential Circuits Prophet-5',
    pioneer: 'Dave Smith',
    historyYear: '1978',
    historyFact: "The Prophet-5 was the first practical polyphonic synth with patch memory — a microprocessor let a player dial in a sound once, save it, and recall that exact sound perfectly, any time. Before it, every patch lived only as long as the knobs stayed untouched.",
    intro: 'Everything you\'ve learned, all at once. Hear the target, then reproduce it — waveform, filter, envelope, vibrato, and the second voice all have to land together.',
    matchTarget: MIMIC_PATCH,
    boss: {
      name: 'The Mimic',
      corruptedOf: 'Sequential Circuits Prophet-5',
      taunt: "I remember every sound ever played into me — and I've forgotten how to be just one of them. Show me the one I'm missing.",
      maxHp: 150,
      dps: 40,
    },
    // Distance-based: damage scales with how close the live patch is to
    // MIMIC_PATCH across all seven dimensions, not a single pass/fail line.
    target: (S, isPlaying) => (isPlaying ? matchIntensity(S, MIMIC_MATCH_SPEC) : 0),
  },
];

// Post-graduation bonus challenges (D1). The main 7-stage progression above
// stops at graduation; this is a second, independent unlock track that only
// starts once it's cleared. Each entry gates a genuinely new feature behind
// a boss fight instead of just handing it over — "the DAW you earn" doesn't
// stop at the credits. `unlocks` is the progression.unlockedFeatures key the
// rest of the app checks (progressionUI.js reveals the gated control;
// bossEngine.js unlocks it on defeat instead of advancing currentStageIndex).
// Shape-compatible with STAGES so bossEngine/progressionUI can treat
// whichever encounter is active the same way.
const CHALLENGES = [
  {
    id: 'lfo-sh',
    moduleId: 'mod-lfo',
    era: 'buchla',
    instrument: 'Buchla 266 Source of Uncertainty',
    pioneer: 'Don Buchla',
    historyYear: '1966',
    historyFact: "Don Buchla's Source of Uncertainty module generated smooth and stepped random control voltages — the origin of sample-and-hold modulation, later immortalized as the stuttering, unpredictable arpeggios of early Tangerine Dream and the original Doctor Who theme.",
    intro: "One more shape waits in the LFO rack, and it isn't yours yet. Prove you've mastered the modulation you already have — push it to its most chaotic setting — and true randomness unlocks.",
    unlocks: 'lfoSampleHold',
    unlockLabel: 'the Sample & Hold LFO shape', // friendly name for the victory-screen recap (progressionUI.js)
    boss: {
      name: 'The Predictable',
      corruptedOf: 'Buchla 266 Source of Uncertainty',
      taunt: "Every voltage, foreseen. Every value, known in advance. There is no surprise left in me. Show me chaos on command — and perhaps I'll remember what uncertainty felt like.",
      maxHp: 120,
      dps: 40,
    },
    // A performance challenge using controls the player already has, not the
    // gated shape itself — you can't require S.lfoWaveform === 'sampleHold'
    // to unlock sampleHold. Pushing the LFO to its most extreme, mechanical
    // setting is the "prove mastery of what you have" gate.
    target: (S, isPlaying) =>
      S.lfoDest === 'pitch' && S.lfoWaveform === 'square' && S.lfoRate > 15 && S.lfoDepth > 0.7 && isPlaying,
  },
  {
    id: 'chorus',
    moduleId: 'mod-fx',
    era: 'roland',
    instrument: 'Roland CE-1 Chorus Ensemble',
    pioneer: 'Ikutaro Kakehashi',
    historyYear: '1976',
    historyFact: "Roland's CE-1, designed under Ikutaro Kakehashi, was the first standalone chorus effect — built to give any instrument the swirling, doubled-voice motion of a rotating Leslie speaker without the motor. It defined the lush, wide sound of the Jazz Chorus amp line that followed.",
    intro: "This one won't teach you anything you haven't already learned — it just makes it automatic. Prove you can build width and space by hand first: stack the second oscillator wide and let the delay carry it, and the shortcut unlocks.",
    unlocks: 'chorusFx',
    unlockLabel: 'the Chorus effect', // friendly name for the victory-screen recap (progressionUI.js)
    boss: {
      name: 'The Solitary',
      corruptedOf: 'Roland CE-1 Chorus Ensemble',
      taunt: "One voice. Only ever one voice, dry and alone. I remember sounding like a room full of me — show me you can fill a room without my help, and perhaps I'll remember how to double myself.",
      maxHp: 130,
      dps: 40,
    },
    // Another "prove it by hand first" gate: build width using controls the
    // player already has (osc2 detuned wide, delay carrying the space)
    // rather than the chorus effect itself, which is exactly what's locked.
    target: (S, isPlaying) =>
      S.osc2Mix > 0.5 && Math.abs(S.osc2Detune) > 20 && S.delayMix > 0.3 && S.delayFeedback > 0.3 && isPlaying,
  },
];

export { STAGES, CHALLENGES };
export default STAGES;

export function stageById(id) {
  return STAGES.find(s => s.id === id);
}
