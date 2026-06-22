import { describe, it, expect } from 'vitest';
import STAGES, { STAGES as STAGES_NAMED, stageById } from './stages.js';

const REQUIRED_STAGE_FIELDS = ['id', 'moduleId', 'era', 'instrument', 'pioneer', 'intro', 'boss', 'target'];
const REQUIRED_BOSS_FIELDS  = ['name', 'corruptedOf', 'taunt', 'maxHp', 'damagePerHit'];
const VALID_MODULE_IDS      = ['mod-osc', 'mod-filter', 'mod-adsr', 'mod-lfo'];

describe('STAGES array', () => {
  it('has exactly 4 stages', () => {
    expect(STAGES).toHaveLength(4);
  });

  it('exports the same array under both the default and named export', () => {
    expect(STAGES).toBe(STAGES_NAMED);
  });

  it('has stages in order: osc → filter → envelope → lfo', () => {
    expect(STAGES.map(s => s.id)).toEqual(['osc', 'filter', 'envelope', 'lfo']);
  });

  it('every stage has all required top-level fields', () => {
    for (const stage of STAGES) {
      for (const field of REQUIRED_STAGE_FIELDS) {
        expect(stage, `stage '${stage.id}' missing field '${field}'`).toHaveProperty(field);
      }
    }
  });

  it('every stage boss has all required fields', () => {
    for (const stage of STAGES) {
      for (const field of REQUIRED_BOSS_FIELDS) {
        expect(stage.boss, `boss in stage '${stage.id}' missing field '${field}'`).toHaveProperty(field);
      }
    }
  });

  it('every moduleId is a known DOM id', () => {
    for (const stage of STAGES) {
      expect(VALID_MODULE_IDS).toContain(stage.moduleId);
    }
  });

  it("every stage has era === 'moog'", () => {
    for (const stage of STAGES) {
      expect(stage.era).toBe('moog');
    }
  });

  it('target is a function on every stage', () => {
    for (const stage of STAGES) {
      expect(typeof stage.target).toBe('function');
    }
  });
});

describe('stageById()', () => {
  it("returns the filter stage for id 'filter'", () => {
    const stage = stageById('filter');
    expect(stage).toBeDefined();
    expect(stage.id).toBe('filter');
  });

  it("returns undefined for a nonexistent id", () => {
    expect(stageById('nonexistent')).toBeUndefined();
  });
});

describe('oscillator stage target predicate', () => {
  const { target } = STAGES.find(s => s.id === 'osc');

  it('returns true when waveform is not sine and isPlaying is true', () => {
    expect(target({ waveform: 'square' }, true)).toBe(true);
    expect(target({ waveform: 'sawtooth' }, true)).toBe(true);
    expect(target({ waveform: 'triangle' }, true)).toBe(true);
  });

  it('returns false when waveform is sine even while playing', () => {
    expect(target({ waveform: 'sine' }, true)).toBe(false);
  });

  it('returns false when not playing, even with a non-sine waveform', () => {
    expect(target({ waveform: 'square' }, false)).toBe(false);
  });
});

describe('filter stage target predicate', () => {
  const { target } = STAGES.find(s => s.id === 'filter');

  it('returns true for lowpass with cutoff > 4000 while playing', () => {
    expect(target({ filterType: 'lowpass', cutoff: 5000 }, true)).toBe(true);
    expect(target({ filterType: 'lowpass', cutoff: 4001 }, true)).toBe(true);
  });

  it('returns false when cutoff is at or below 4000', () => {
    expect(target({ filterType: 'lowpass', cutoff: 4000 }, true)).toBe(false);
    expect(target({ filterType: 'lowpass', cutoff: 1000 }, true)).toBe(false);
  });

  it('returns false when not playing', () => {
    expect(target({ filterType: 'lowpass', cutoff: 5000 }, false)).toBe(false);
  });
});

describe('envelope stage target predicate', () => {
  const { target } = STAGES.find(s => s.id === 'envelope');

  it('returns true for short attack and low sustain while playing', () => {
    expect(target({ attack: 0.01, sustain: 0.1 }, true)).toBe(true);
    expect(target({ attack: 0.04, sustain: 0.29 }, true)).toBe(true);
  });

  it('returns false when attack is too long', () => {
    expect(target({ attack: 0.2, sustain: 0.1 }, true)).toBe(false);
  });

  it('returns false when sustain is too high', () => {
    expect(target({ attack: 0.01, sustain: 0.7 }, true)).toBe(false);
  });

  it('returns false for both bad values', () => {
    expect(target({ attack: 0.2, sustain: 0.7 }, true)).toBe(false);
  });

  it('returns false when not playing', () => {
    expect(target({ attack: 0.01, sustain: 0.1 }, false)).toBe(false);
  });
});

describe('LFO stage target predicate', () => {
  const { target } = STAGES.find(s => s.id === 'lfo');

  it('returns true when lfoDest is set and lfoDepth > 0.3 while playing', () => {
    expect(target({ lfoDest: 'filter', lfoDepth: 0.5 }, true)).toBe(true);
    expect(target({ lfoDest: 'pitch',  lfoDepth: 0.31 }, true)).toBe(true);
    expect(target({ lfoDest: 'amp',    lfoDepth: 1.0 }, true)).toBe(true);
  });

  it("returns false when lfoDest is 'none'", () => {
    expect(target({ lfoDest: 'none', lfoDepth: 0.5 }, true)).toBe(false);
  });

  it('returns false when lfoDepth is at or below 0.3', () => {
    expect(target({ lfoDest: 'filter', lfoDepth: 0.3 }, true)).toBe(false);
    expect(target({ lfoDest: 'filter', lfoDepth: 0.0 }, true)).toBe(false);
  });

  it('returns false when not playing', () => {
    expect(target({ lfoDest: 'filter', lfoDepth: 0.5 }, false)).toBe(false);
  });
});
