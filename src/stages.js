// Act I stage and boss definitions — four corrupted Moog-era instruments.
// Each stage has a target predicate: (S, isPlaying) => boolean
// that checks whether the player has satisfied the stage goal.

const STAGES = [
  {
    id: 'osc',
    moduleId: 'mod-osc',
    era: 'moog',
    instrument: 'Moog 901 Oscillator Bank',
    pioneer: 'Bob Moog',
    intro: 'The oscillator is the source of all sound. Change its shape to begin.',
    boss: {
      name: 'Vox Corruptus',
      corruptedOf: 'Moog 901 Oscillator Bank',
      taunt: 'You play only sine waves? How... predictable. Show me something with teeth.',
      maxHp: 100,
      damagePerHit: 10,
    },
    target: (S, isPlaying) => S.waveform !== 'sine' && isPlaying,
  },
  {
    id: 'filter',
    moduleId: 'mod-filter',
    era: 'moog',
    instrument: 'Moog Ladder Filter',
    pioneer: 'Bob Moog',
    intro: 'The filter shapes the brightness of sound. Open it up.',
    boss: {
      name: 'The Muffled',
      corruptedOf: 'Moog Ladder Filter',
      taunt: "So dark, so dull. Let some light in — if you dare.",
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
    intro: 'The envelope controls how a sound begins and ends. Make it punch.',
    boss: {
      name: 'Dronekeeper',
      corruptedOf: 'Moog Contour Generator',
      taunt: 'Every note blurs into the next. Give me a beginning and an end.',
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
    intro: 'The LFO adds movement to sound. Route it somewhere and push the depth.',
    boss: {
      name: 'The Still',
      corruptedOf: 'Moog Low Frequency Oscillator',
      taunt: 'Static. Lifeless. Add some wobble to this world.',
      maxHp: 100,
      damagePerHit: 10,
    },
    target: (S, isPlaying) => S.lfoDest !== 'none' && S.lfoDepth > 0.3 && isPlaying,
  },
];

export { STAGES };
export default STAGES;

export function stageById(id) {
  return STAGES.find(s => s.id === id);
}
