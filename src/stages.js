// Act I stage and boss definitions — four corrupted Moog-era instruments.
// Each stage has a target predicate: (S, isPlaying) => boolean
// that checks whether the player has satisfied the stage goal.

// Osc stage tracks which waveforms the player has tried this battle.
// Damage fires once per newly-discovered waveform; reset on each activation.
const _oscUsed = new Set();

const STAGES = [
  {
    id: 'osc',
    moduleId: 'mod-osc',
    era: 'moog',
    instrument: 'Moog 901 Oscillator Bank',
    pioneer: 'Bob Moog',
    historyYear: '1964',
    historyFact: 'Bob Moog debuted the first voltage-controlled synthesizer modules at the AES convention in October 1964, giving composers electronic control over pitch for the first time.',
    intro: 'The oscillator is the source of all sound. Try every waveform to break the curse.',
    boss: {
      name: 'Vox Corruptus',
      corruptedOf: 'Moog 901 Oscillator Bank',
      taunt: 'You play only sine waves? How... predictable. Show me something with teeth.',
      tauntPhases: [
        { threshold: 75, text: "A different waveform — I can feel the harmonics biting. Don't stop." },
        { threshold: 40, text: 'It\'s cutting right through me. The timbre is changing.' },
        { threshold: 10, text: 'No more... smooth edges... the waveform is too much...' },
      ],
      maxHp: 40,
      damagePerHit: 10,
    },
    onActivate() { _oscUsed.clear(); },
    target(S, isPlaying) {
      if (!isPlaying) return false;
      if (_oscUsed.has(S.waveform)) return false;
      _oscUsed.add(S.waveform);
      return true;
    },
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
      tauntPhases: [
        { threshold: 75, text: 'The cutoff rising... I feel the brightness creeping back.' },
        { threshold: 40, text: 'Harmonics streaming through. The filter is losing its grip.' },
        { threshold: 10, text: 'So bright... I can\'t muffle it anymore...' },
      ],
      maxHp: 100,
      damagePerHit: 10,
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
      tauntPhases: [
        { threshold: 75, text: 'Shorter attack — I felt that beginning. Decisive.' },
        { threshold: 40, text: 'The notes have edges now. You\'re sculpting the contour.' },
        { threshold: 10, text: 'The shape... it\'s all attack and decay... I\'m defined...' },
      ],
      maxHp: 100,
      damagePerHit: 10,
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
      tauntPhases: [
        { threshold: 75, text: 'A tremor. Just a tremor. But I felt it.' },
        { threshold: 40, text: 'The modulation is taking hold. Something is moving.' },
        { threshold: 10, text: 'I cannot maintain stasis... the oscillation is too deep...' },
      ],
      maxHp: 100,
      damagePerHit: 10,
    },
    target: (S, isPlaying) => S.lfoDest !== 'none' && S.lfoDepth > 0.3 && isPlaying,
  },
  {
    id: 'noise',
    moduleId: 'mod-noise',
    era: 'arp',
    instrument: 'ARP 2600',
    pioneer: 'Alan R. Pearlman',
    historyYear: '1971',
    historyFact: "Ben Burtt shaped R2-D2's voice by filtering and enveloping white noise from an ARP 2600 — the same spectral sculpting technique you're learning here.",
    intro: 'Noise is raw, unformed sound. Raise the Mix, bring the Cutoff down, and keep the Decay short — sculpt it into a hit.',
    boss: {
      name: 'The Static',
      corruptedOf: 'ARP 2600 Noise Source',
      taunt: 'Pure chaos. Raise the Mix, tighten the Filter, snap the Decay short — give it a shape.',
      tauntPhases: [
        { threshold: 75, text: 'The Mix is up — I can hear it. Now close the filter, shorten that decay.' },
        { threshold: 40, text: 'The filter is biting. Keep the decay snappy and I\'m finished.' },
        { threshold: 10, text: 'The static is resolving... I\'m becoming... real...' },
      ],
      maxHp: 100,
      damagePerHit: 10,
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
    intro: 'Two voices. Same note. Let them drift — and the sound comes alive.',
    boss: {
      name: 'The Dissonant',
      corruptedOf: 'Oberheim Two-Voice Oscillator Pair',
      taunt: "Two voices locked in perfect unison. Perfectly sterile. Wake them up — detune them until you can feel the beating.",
      tauntPhases: [
        { threshold: 75, text: 'The second voice is shifting. I feel the interference pattern beginning.' },
        { threshold: 40, text: 'The beating is overwhelming my unity. Two voices diverging...' },
        { threshold: 10, text: "I can't hold the unison... the discord is consuming me..." },
      ],
      maxHp: 100,
      damagePerHit: 10,
    },
    target: (S, isPlaying) =>
      S.osc2Mix > 0.3 &&
      Math.abs(S.osc2Detune) >= 5 &&
      Math.abs(S.osc2Detune) <= 45 &&
      isPlaying,
  },
];

export { STAGES };
export default STAGES;

export function stageById(id) {
  return STAGES.find(s => s.id === id);
}
