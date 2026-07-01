import { describe, it, expect } from 'vitest';
import STAGES, { STAGES as STAGES_NAMED, stageById } from './stages.js';

const REQUIRED_STAGE_FIELDS = ['id', 'moduleId', 'era', 'instrument', 'pioneer', 'historyYear', 'historyFact', 'intro', 'boss', 'target'];
const REQUIRED_BOSS_FIELDS  = ['name', 'corruptedOf', 'taunt', 'maxHp', 'dps'];
const VALID_MODULE_IDS      = ['mod-osc', 'mod-filter', 'mod-adsr', 'mod-lfo', 'mod-noise', 'mod-osc2'];

describe('STAGES array', () => {
  it('has exactly 7 stages', () => {
    expect(STAGES).toHaveLength(7);
  });

  it('exports the same array under both the default and named export', () => {
    expect(STAGES).toBe(STAGES_NAMED);
  });

  it('has stages in order: osc → filter → envelope → lfo → noise → osc2 → mimic', () => {
    expect(STAGES.map(s => s.id)).toEqual(['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2', 'mimic']);
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

  it('every moduleId is a known DOM id, or null for a capstone spanning every module', () => {
    for (const stage of STAGES) {
      expect(stage.moduleId === null || VALID_MODULE_IDS.includes(stage.moduleId)).toBe(true);
    }
  });

  it('every stage has a known era', () => {
    const KNOWN_ERAS = ['moog', 'arp', 'oberheim', 'capstone'];
    for (const stage of STAGES) {
      expect(KNOWN_ERAS).toContain(stage.era);
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

describe('mimic (capstone) stage target predicate — distance-based, not boolean', () => {
  const { target, matchTarget } = STAGES.find(s => s.id === 'mimic');

  it('exposes the reference patch it scores against', () => {
    expect(matchTarget).toBeDefined();
    expect(matchTarget.waveform).toBe('sawtooth');
  });

  it('returns 1 for an exact match while playing', () => {
    expect(target(matchTarget, true)).toBeCloseTo(1, 5);
  });

  it('returns 0 when not playing, regardless of how close S is', () => {
    expect(target(matchTarget, false)).toBe(0);
  });

  it('returns a partial (0 < intensity < 1) score for a partial match', () => {
    const halfway = { ...matchTarget, waveform: 'sine' }; // 1 of 7 dims now wrong
    const score = target(halfway, true);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 for a total mismatch', () => {
    const opposite = {
      waveform: 'sine', cutoff: 18000, attack: 2, sustain: 1,
      lfoDest: 'none', lfoDepth: 1, osc2Mix: 0,
    };
    expect(target(opposite, true)).toBeCloseTo(0, 1);
  });
});

describe('stage history fields', () => {
  it('every stage has a historyYear matching a 4-digit year string', () => {
    for (const stage of STAGES) {
      expect(stage.historyYear).toMatch(/^\d{4}$/);
    }
  });

  it('every stage has a non-empty historyFact string (at least 20 chars)', () => {
    for (const stage of STAGES) {
      expect(typeof stage.historyFact).toBe('string');
      expect(stage.historyFact.length).toBeGreaterThan(20);
    }
  });

  it('pioneer field is present and non-empty on every stage', () => {
    for (const stage of STAGES) {
      expect(typeof stage.pioneer).toBe('string');
      expect(stage.pioneer.length).toBeGreaterThan(0);
    }
  });
});
