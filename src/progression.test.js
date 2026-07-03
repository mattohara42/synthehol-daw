import { describe, it, expect, beforeEach, vi } from 'vitest';
import { progression, STAGE_IDS } from './progression.js';

// --- localStorage mock ---
// The implementation uses localStorage directly (browser API). In the Node
// test environment it doesn't exist, so we stub it with a simple in-memory
// store before each test.

function makeLocalStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store,
  };
}

beforeEach(() => {
  const mock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', mock);
});

// Helper: reset the progression object to initial state before each test so
// tests don't bleed into each other via the module-singleton.
function freshLoad() {
  return progression.load();
}

// --- Tests ---

describe('progression – fresh state', () => {
  it('load() with no stored data yields initial state', () => {
    freshLoad();
    expect(progression.currentStageIndex).toBe(0);
    expect(progression.unlockedCount).toBe(1);
    expect(progression.xp).toBe(0);
    expect(progression.defeated).toEqual([]);
    expect(progression.unlockedFeatures).toEqual([]);
  });
});

describe('progression – persistence round-trip', () => {
  it('save() then load() restores state', () => {
    freshLoad();

    // Advance two stages and add XP
    progression.unlockNext(); // index 1
    progression.unlockNext(); // index 2
    progression.addXp(150);
    progression.markDefeated('osc');

    const snapshot = {
      currentStageIndex: progression.currentStageIndex,
      unlockedCount: progression.unlockedCount,
      xp: progression.xp,
      defeated: [...progression.defeated],
    };

    // Simulate a page reload by re-running load()
    progression.load();

    expect(progression.currentStageIndex).toBe(snapshot.currentStageIndex);
    expect(progression.unlockedCount).toBe(snapshot.unlockedCount);
    expect(progression.xp).toBe(snapshot.xp);
    expect(progression.defeated).toEqual(snapshot.defeated);
  });
});

describe('progression – reset', () => {
  it('reset() returns to initial state and persists it', () => {
    freshLoad();
    progression.unlockNext();
    progression.addXp(50);

    progression.reset();

    expect(progression.currentStageIndex).toBe(0);
    expect(progression.unlockedCount).toBe(1);
    expect(progression.xp).toBe(0);
    expect(progression.defeated).toEqual([]);

    // Verify the persisted value is also the initial state
    progression.load();
    expect(progression.currentStageIndex).toBe(0);
    expect(progression.unlockedCount).toBe(1);
    expect(progression.xp).toBe(0);
  });
});

describe('progression – malformed store', () => {
  it('falls back to initial state when stored value is not valid JSON', () => {
    localStorage.setItem('synthehol_progress', 'not-json');
    freshLoad();
    expect(progression.currentStageIndex).toBe(0);
    expect(progression.xp).toBe(0);
  });

  it('falls back to initial state when stored value is null string', () => {
    // null stored value: getItem returns null → treated as missing
    // Simulate by storing nothing (mock returns null by default)
    freshLoad();
    expect(progression.currentStageIndex).toBe(0);
  });

  it('falls back to initial state when stored value is a garbage object', () => {
    localStorage.setItem('synthehol_progress', JSON.stringify({ garbage: true }));
    freshLoad();
    expect(progression.currentStageIndex).toBe(0);
    expect(progression.unlockedCount).toBe(1);
  });

  it('does not throw for any malformed input', () => {
    const bad = ['not-json', '""', 'null', '42', '[]', JSON.stringify({ garbage: true })];
    for (const val of bad) {
      localStorage.setItem('synthehol_progress', val);
      expect(() => progression.load()).not.toThrow();
    }
  });

  it('clamps an out-of-range currentStageIndex to a valid stage', () => {
    localStorage.setItem('synthehol_progress', JSON.stringify({
      currentStageIndex: 99, unlockedCount: 99, xp: 50, defeated: ['osc'],
    }));
    freshLoad();
    expect(progression.currentStageIndex).toBe(STAGE_IDS.length - 1);
    expect(progression.unlockedCount).toBe(STAGE_IDS.length);
  });

  it('drops unknown ids and negative xp from a structurally-valid store', () => {
    localStorage.setItem('synthehol_progress', JSON.stringify({
      currentStageIndex: -5, unlockedCount: 0, xp: -10,
      defeated: ['osc', 'bogus', 'osc'],
    }));
    freshLoad();
    expect(progression.currentStageIndex).toBe(0);
    expect(progression.unlockedCount).toBe(1);
    expect(progression.xp).toBe(0);
    expect(progression.defeated).toEqual(['osc']);
  });
});

describe('progression – unlockNext()', () => {
  it('advances currentStageIndex and unlockedCount by 1', () => {
    freshLoad();
    expect(progression.currentStageIndex).toBe(0);
    expect(progression.unlockedCount).toBe(1);

    progression.unlockNext();

    expect(progression.currentStageIndex).toBe(1);
    expect(progression.unlockedCount).toBe(2);
  });

  it('is idempotent at the last stage (index 3)', () => {
    freshLoad();
    const lastIndex = STAGE_IDS.length - 1; // 3

    // Advance to the last stage
    for (let i = 0; i < lastIndex; i++) progression.unlockNext();
    expect(progression.currentStageIndex).toBe(lastIndex);

    // Calling again should not advance past the end
    progression.unlockNext();
    progression.unlockNext();

    expect(progression.currentStageIndex).toBe(lastIndex);
    expect(progression.unlockedCount).toBe(lastIndex + 1);
  });
});

describe('progression – derived unlockedCount', () => {
  it('always equals currentStageIndex + 1', () => {
    freshLoad();
    expect(progression.unlockedCount).toBe(1);
    progression.unlockNext();
    expect(progression.unlockedCount).toBe(progression.currentStageIndex + 1);
    progression.unlockNext();
    expect(progression.unlockedCount).toBe(progression.currentStageIndex + 1);
  });

  it('is not persisted as a stored field', () => {
    freshLoad();
    progression.unlockNext();
    const stored = JSON.parse(localStorage.getItem('synthehol_progress'));
    expect(stored).not.toHaveProperty('unlockedCount');
    expect(stored.currentStageIndex).toBe(1);
  });

  it('loads correctly from a legacy store that still has unlockedCount', () => {
    localStorage.setItem('synthehol_progress', JSON.stringify({
      currentStageIndex: 2, unlockedCount: 999, xp: 30, defeated: ['osc', 'filter'],
    }));
    freshLoad();
    expect(progression.unlockedCount).toBe(3); // derived, ignoring the stale 999
  });
});

describe('progression – markDefeated()', () => {
  it('adds the id to defeated', () => {
    freshLoad();
    progression.markDefeated('osc');
    expect(progression.defeated).toContain('osc');
  });

  it('does not duplicate when called twice with the same id', () => {
    freshLoad();
    progression.markDefeated('filter');
    progression.markDefeated('filter');
    expect(progression.defeated.filter((id) => id === 'filter')).toHaveLength(1);
  });
});

describe('progression – unlockFeature() / hasFeature() (D1 bonus challenges)', () => {
  it('hasFeature() is false until unlocked', () => {
    freshLoad();
    expect(progression.hasFeature('lfoSampleHold')).toBe(false);
  });

  it('unlockFeature() adds the id and hasFeature() reflects it', () => {
    freshLoad();
    progression.unlockFeature('lfoSampleHold');
    expect(progression.hasFeature('lfoSampleHold')).toBe(true);
  });

  it('does not duplicate when called twice with the same id', () => {
    freshLoad();
    progression.unlockFeature('lfoSampleHold');
    progression.unlockFeature('lfoSampleHold');
    expect(progression.unlockedFeatures.filter((id) => id === 'lfoSampleHold')).toHaveLength(1);
  });

  it('persists across save/load', () => {
    freshLoad();
    progression.unlockFeature('lfoSampleHold');
    progression.load();
    expect(progression.hasFeature('lfoSampleHold')).toBe(true);
  });

  it('defaults to empty when loading a legacy store that predates the field', () => {
    localStorage.setItem('synthehol_progress', JSON.stringify({
      currentStageIndex: 6, xp: 500, defeated: ['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2', 'mimic'],
    }));
    freshLoad();
    expect(progression.unlockedFeatures).toEqual([]);
    expect(progression.hasFeature('lfoSampleHold')).toBe(false);
  });

  it('drops unknown feature ids from a structurally-valid store', () => {
    localStorage.setItem('synthehol_progress', JSON.stringify({
      currentStageIndex: 0, xp: 0, defeated: [], unlockedFeatures: ['lfoSampleHold', 'bogus'],
    }));
    freshLoad();
    expect(progression.unlockedFeatures).toEqual(['lfoSampleHold']);
  });
});
