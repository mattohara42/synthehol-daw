import { describe, it, expect, beforeEach } from 'vitest';
import STAGES, { STAGES as STAGES_NAMED, stageById } from './stages.js';

const REQUIRED_STAGE_FIELDS = ['id', 'moduleId', 'era', 'instrument', 'pioneer', 'historyYear', 'historyFact', 'intro', 'boss', 'target'];
const REQUIRED_BOSS_FIELDS  = ['name', 'corruptedOf', 'taunt', 'maxHp', 'damagePerHit'];
const VALID_MODULE_IDS      = ['mod-osc', 'mod-filter', 'mod-adsr', 'mod-lfo', 'mod-noise', 'mod-osc2'];

describe('STAGES array', () => {
  it('has exactly 6 stages', () => {
    expect(STAGES).toHaveLength(6);
  });

  it('exports the same array under both the default and named export', () => {
    expect(STAGES).toBe(STAGES_NAMED);
  });

  it('has stages in order: osc → filter → envelope → lfo → noise → osc2', () => {
    expect(STAGES.map(s => s.id)).toEqual(['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2']);
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

  it('every stage has a valid era string', () => {
    const validEras = ['moog', 'arp', 'oberheim'];
    for (const stage of STAGES) {
      expect(validEras, `stage '${stage.id}' has unexpected era '${stage.era}'`).toContain(stage.era);
    }
  });

  it('Act I stages have era moog, Act II stage has era arp, Act III stage has era oberheim', () => {
    expect(STAGES.filter(s => s.era === 'moog').map(s => s.id)).toEqual(['osc', 'filter', 'envelope', 'lfo']);
    expect(STAGES.filter(s => s.era === 'arp').map(s => s.id)).toEqual(['noise']);
    expect(STAGES.filter(s => s.era === 'oberheim').map(s => s.id)).toEqual(['osc2']);
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
  const oscStage = STAGES.find(s => s.id === 'osc');
  const { target, onActivate } = oscStage;

  beforeEach(() => onActivate());

  it('returns true the first time each waveform is played', () => {
    expect(target({ waveform: 'sine' },     true)).toBe(true);
    expect(target({ waveform: 'square' },   true)).toBe(true);
    expect(target({ waveform: 'sawtooth' }, true)).toBe(true);
    expect(target({ waveform: 'triangle' }, true)).toBe(true);
  });

  it('returns false when the same waveform is played again', () => {
    target({ waveform: 'square' }, true); // first use
    expect(target({ waveform: 'square' }, true)).toBe(false);
  });

  it('returns false when not playing', () => {
    expect(target({ waveform: 'square' }, false)).toBe(false);
  });

  it('onActivate resets so waveforms deal damage again on a new battle', () => {
    target({ waveform: 'square' }, true); // consume it
    onActivate();                          // reset
    expect(target({ waveform: 'square' }, true)).toBe(true);
  });

  it('maxHp is 40 — exactly one damage event per waveform kills the boss', () => {
    expect(oscStage.boss.maxHp).toBe(40);
    expect(oscStage.boss.damagePerHit).toBe(10);
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

describe('noise stage target predicate', () => {
  const { target } = STAGES.find(s => s.id === 'noise');
  const passing = { noiseMix: 0.3, cutoff: 4000, decay: 0.1 };

  it('returns true when noiseMix > 0.2, cutoff < 5000, decay < 0.2, isPlaying', () => {
    expect(target(passing, true)).toBe(true);
  });

  it('returns false when noiseMix is at or below 0.2', () => {
    expect(target({ ...passing, noiseMix: 0.2 }, true)).toBe(false);
    expect(target({ ...passing, noiseMix: 0.0 }, true)).toBe(false);
  });

  it('returns false when cutoff is at or above 5000', () => {
    expect(target({ ...passing, cutoff: 5000 }, true)).toBe(false);
    expect(target({ ...passing, cutoff: 8000 }, true)).toBe(false);
  });

  it('returns false when decay is at or above 0.2', () => {
    expect(target({ ...passing, decay: 0.2 }, true)).toBe(false);
    expect(target({ ...passing, decay: 0.5 }, true)).toBe(false);
  });

  it('returns false when not playing', () => {
    expect(target(passing, false)).toBe(false);
  });
});

describe('osc2 stage target predicate', () => {
  const { target } = STAGES.find(s => s.id === 'osc2');
  const passing = { osc2Mix: 0.5, osc2Detune: 15 };

  it('returns true when osc2Mix > 0.3, detune in 5–45 range, isPlaying', () => {
    expect(target(passing, true)).toBe(true);
    expect(target({ osc2Mix: 0.31, osc2Detune: 5 }, true)).toBe(true);
    expect(target({ osc2Mix: 1.0, osc2Detune: 45 }, true)).toBe(true);
  });

  it('returns true for negative detune within range', () => {
    expect(target({ osc2Mix: 0.5, osc2Detune: -15 }, true)).toBe(true);
    expect(target({ osc2Mix: 0.5, osc2Detune: -5 }, true)).toBe(true);
    expect(target({ osc2Mix: 0.5, osc2Detune: -45 }, true)).toBe(true);
  });

  it('returns false when osc2Mix is at or below 0.3', () => {
    expect(target({ ...passing, osc2Mix: 0.3 }, true)).toBe(false);
    expect(target({ ...passing, osc2Mix: 0.0 }, true)).toBe(false);
  });

  it('returns false when detune is below 5 (too close to unison)', () => {
    expect(target({ ...passing, osc2Detune: 4 }, true)).toBe(false);
    expect(target({ ...passing, osc2Detune: 0 }, true)).toBe(false);
    expect(target({ ...passing, osc2Detune: -4 }, true)).toBe(false);
  });

  it('returns false when detune exceeds 45 (too extreme)', () => {
    expect(target({ ...passing, osc2Detune: 46 }, true)).toBe(false);
    expect(target({ ...passing, osc2Detune: -46 }, true)).toBe(false);
  });

  it('returns false when not playing', () => {
    expect(target(passing, false)).toBe(false);
  });
});

describe('boss tauntPhases', () => {
  it('every boss has a tauntPhases array with exactly 3 entries', () => {
    for (const stage of STAGES) {
      expect(Array.isArray(stage.boss.tauntPhases), `${stage.id} missing tauntPhases`).toBe(true);
      expect(stage.boss.tauntPhases).toHaveLength(3);
    }
  });

  it('each taunt phase has a numeric threshold and non-empty text', () => {
    for (const stage of STAGES) {
      for (const phase of stage.boss.tauntPhases) {
        expect(typeof phase.threshold).toBe('number');
        expect(typeof phase.text).toBe('string');
        expect(phase.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('taunt phase thresholds are 75, 40, 10 for every boss', () => {
    for (const stage of STAGES) {
      const thresholds = stage.boss.tauntPhases.map(p => p.threshold).sort((a, b) => b - a);
      expect(thresholds).toEqual([75, 40, 10]);
    }
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
