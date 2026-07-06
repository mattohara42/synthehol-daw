import { describe, it, expect, beforeEach, vi } from 'vitest';
import { progression } from './progression.js';
import { STAGES, CHALLENGES } from './stages.js';
import { bossEngine } from './bossEngine.js';

// --- localStorage mock ---

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

// Default S: does NOT trigger any stage target.
const defaultS = {
  waveform: 'sine', octave: 4, detune: 0,
  filterType: 'lowpass', cutoff: 2000, resonance: 1.0,
  attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.3,
  lfoDest: 'none', lfoRate: 2, lfoDepth: 0.1,
  masterVol: 0.6,
};

// S that satisfies the osc stage target (waveform !== 'sine').
const oscS = { ...defaultS, waveform: 'square' };

// S that satisfies the filter stage target (lowpass, cutoff > 4000).
const filterS = { ...defaultS, filterType: 'lowpass', cutoff: 5000 };

// S that satisfies the envelope stage target (attack < 0.05, sustain < 0.3).
const envelopeS = { ...defaultS, attack: 0.01, sustain: 0.1 };

// S that satisfies the lfo stage target (lfoDest !== 'none', lfoDepth > 0.3).
const lfoS = { ...defaultS, lfoDest: 'pitch', lfoDepth: 0.5 };

// S that satisfies the noise stage target (noiseMix > 0.2, cutoff < 5000, decay < 0.2).
const noiseS = { ...defaultS, noiseMix: 0.5, cutoff: 2000, decay: 0.1 };

// S that satisfies the osc2 stage target (osc2Mix > 0.3, |osc2Detune| in 5..45).
const osc2S = { ...defaultS, osc2Mix: 0.5, osc2Detune: 10 };

// S that exactly matches the mimic (capstone) stage's reference patch —
// scores intensity 1.0, so it drains like a fully-met boolean target.
const mimicS = STAGES.find(s => s.id === 'mimic').matchTarget;

beforeEach(() => {
  const mock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', mock);

  // Reset progression and bossEngine state before each test. Listener arrays are
  // module-level singletons that persist across tests; clear them so spies from
  // earlier tests don't accumulate. XP accumulator must be reset too.
  bossEngine._clearListeners();
  progression.load();
  bossEngine.graduated = false;
  bossEngine._xpAccum = 0;
  bossEngine._flushTimer = 0;
  bossEngine.activateStage();
});

// Tick once with a dt large enough to drain the current boss from full HP to 0.
function drain(S) {
  bossEngine.tick({ S, isPlaying: true, dt: 10 });
}

// --- Tests ---

describe('bossEngine – activateStage', () => {
  it('sets currentHp to the first stage maxHp (100) on load', () => {
    expect(bossEngine.currentHp).toBe(100);
  });
});

describe('bossEngine – tick: no damage cases', () => {
  it('does not reduce HP when isPlaying is false', () => {
    bossEngine.tick({ S: oscS, isPlaying: false, dt: 1 });
    expect(bossEngine.currentHp).toBe(100);
  });

  it('does not reduce HP when target is not met', () => {
    bossEngine.tick({ S: defaultS, isPlaying: true, dt: 1 });
    expect(bossEngine.currentHp).toBe(100);
  });

  it('is a no-op when dt is 0', () => {
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 0 });
    expect(bossEngine.currentHp).toBe(100);
  });
});

describe('bossEngine – tick: damage over time', () => {
  it('drains HP by dps * dt on a qualifying tick', () => {
    // osc boss dps is 40 → 0.5s of holding the target removes 20 HP.
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 0.5 });
    expect(bossEngine.currentHp).toBeCloseTo(80, 5);
  });

  it('accumulates damage across multiple ticks', () => {
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 0.5 });
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 0.5 });
    expect(bossEngine.currentHp).toBeCloseTo(60, 5);
  });

  it('fires onDamage callback with the live hp', () => {
    const spy = vi.fn();
    bossEngine.onDamage(spy);
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 0.5 });
    expect(spy).toHaveBeenCalledOnce();
    const payload = spy.mock.calls[0][0];
    expect(payload.hp).toBeCloseTo(80, 5);
    expect(payload.maxHp).toBe(100);
  });

  it('clamps overkill at 0 (never negative) and defeats the boss', () => {
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 100 });
    // HP is clamped to 0, the boss is defeated, and the next stage activates.
    expect(bossEngine.currentHp).toBeGreaterThanOrEqual(0);
    expect(progression.defeated).toContain('osc');
    expect(progression.currentStageIndex).toBe(1);
  });
});

describe('bossEngine – intensity-scaled damage (B15 distance-based stages)', () => {
  beforeEach(() => {
    progression.currentStageIndex = 6; // the mimic (capstone) stage
    bossEngine.activateStage();
  });

  it('drains at full dps for an exact match (intensity 1)', () => {
    // mimic boss dps is 40, maxHp 150 → 0.5s at intensity 1 removes 20 HP.
    bossEngine.tick({ S: mimicS, isPlaying: true, dt: 0.5 });
    expect(bossEngine.currentHp).toBeCloseTo(130, 5);
  });

  it('drains proportionally slower for a partial match', () => {
    // 6 of 7 dims exact, waveform wrong → intensity ~0.857 (6/7).
    const partial = { ...mimicS, waveform: 'sine' };
    bossEngine.tick({ S: partial, isPlaying: true, dt: 0.5 });
    expect(bossEngine.currentHp).toBeCloseTo(150 - 40 * 0.5 * (6 / 7), 3);
  });

  it('does not drain at all for a total mismatch (intensity 0)', () => {
    const opposite = {
      waveform: 'sine', cutoff: 18000, attack: 2, sustain: 1,
      lfoDest: 'none', lfoDepth: 1, osc2Mix: 0,
    };
    bossEngine.tick({ S: opposite, isPlaying: true, dt: 1 });
    expect(bossEngine.currentHp).toBe(150);
  });
});

describe('bossEngine – tick: recovery', () => {
  it('heals back toward maxHp when the target is not held', () => {
    bossEngine.tick({ S: oscS, isPlaying: true, dt: 1 }); // drain 40 → HP 60
    bossEngine.tick({ S: defaultS, isPlaying: true, dt: 1 }); // heal 15 → HP 75
    expect(bossEngine.currentHp).toBeCloseTo(75, 5);
  });

  it('does not heal past maxHp', () => {
    bossEngine.tick({ S: defaultS, isPlaying: false, dt: 100 });
    expect(bossEngine.currentHp).toBe(100);
  });
});

describe('bossEngine – restore', () => {
  it('marks stage as defeated after HP reaches 0', () => {
    drain(oscS);
    expect(progression.defeated).toContain('osc');
  });

  it('advances progression to next stage after restore', () => {
    drain(oscS);
    expect(progression.currentStageIndex).toBe(1);
  });

  it('fires onRestore callback exactly once with correct payload', () => {
    const spy = vi.fn();
    bossEngine.onRestore(spy);
    drain(oscS);
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect(call.instrument).toBe('Moog 901 Oscillator Bank');
    expect(call.pioneer).toBe('Bob Moog');
    expect(call.stage.id).toBe('osc');
  });

  it('awards XP for the HP drained plus a maxHp defeat bonus', () => {
    // 100 HP drained + 100 maxHp bonus = 200.
    drain(oscS);
    expect(progression.xp).toBe(200);
  });

  it('resets currentHp to next stage maxHp after restore', () => {
    drain(oscS);
    expect(bossEngine.currentHp).toBe(100);
  });
});

describe('bossEngine – graduation', () => {
  it('graduated becomes true after all 7 stages are restored', () => {
    drain(oscS);
    expect(progression.currentStageIndex).toBe(1);
    drain(filterS);
    expect(progression.currentStageIndex).toBe(2);
    drain(envelopeS);
    expect(progression.currentStageIndex).toBe(3);
    drain(lfoS);
    expect(progression.currentStageIndex).toBe(4);
    drain(noiseS);
    expect(progression.currentStageIndex).toBe(5);
    drain(osc2S);
    expect(progression.currentStageIndex).toBe(6);
    drain(mimicS);
    expect(bossEngine.graduated).toBe(true);
  });

  it('sets currentHp to the first bonus challenge maxHp after graduation, not 0', () => {
    drain(oscS);
    drain(filterS);
    drain(envelopeS);
    drain(lfoS);
    drain(noiseS);
    drain(osc2S);
    drain(mimicS);
    expect(bossEngine.currentHp).toBe(CHALLENGES[0].boss.maxHp);
  });
});

describe('bossEngine – post-graduation bonus challenges (D1)', () => {
  function graduate() {
    drain(oscS);
    drain(filterS);
    drain(envelopeS);
    drain(lfoS);
    drain(noiseS);
    drain(osc2S);
    drain(mimicS);
  }

  // S that satisfies the lfo-sh challenge target (extreme LFO settings).
  const shS = { ...defaultS, lfoDest: 'pitch', lfoWaveform: 'square', lfoRate: 20, lfoDepth: 0.9 };

  it('activeEncounter() returns the challenge once graduated', () => {
    graduate();
    expect(bossEngine.activeEncounter().id).toBe('lfo-sh');
  });

  it('tick is NOT a no-op once graduated — the bonus challenge still drains', () => {
    graduate();
    bossEngine.tick({ S: shS, isPlaying: true, dt: 0.5 });
    expect(bossEngine.currentHp).toBeCloseTo(CHALLENGES[0].boss.maxHp - 20, 5);
  });

  it('does not drain the challenge boss on a mismatched S', () => {
    graduate();
    bossEngine.tick({ S: defaultS, isPlaying: true, dt: 1 });
    expect(bossEngine.currentHp).toBe(CHALLENGES[0].boss.maxHp);
  });

  it('unlocks the feature (not a stage) on defeat, and does not touch currentStageIndex', () => {
    graduate();
    const stageIndexBefore = progression.currentStageIndex;
    drain(shS);
    expect(progression.hasFeature('lfoSampleHold')).toBe(true);
    expect(progression.currentStageIndex).toBe(stageIndexBefore);
    expect(progression.defeated).not.toContain('lfo-sh');
  });

  it('fires onRestore with challenge: true', () => {
    graduate();
    const spy = vi.fn();
    bossEngine.onRestore(spy);
    drain(shS);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].challenge).toBe(true);
  });

  // S that satisfies the chorus challenge target (manually-built width).
  const chorusS = { ...defaultS, osc2Mix: 0.6, osc2Detune: 25, delayMix: 0.4, delayFeedback: 0.4 };

  it('moves to the second challenge after the first is cleared', () => {
    graduate();
    drain(shS);
    expect(bossEngine.activeEncounter().id).toBe('chorus');
    expect(bossEngine.currentHp).toBe(CHALLENGES[1].boss.maxHp);
  });

  it('activeEncounter() returns null once every challenge is cleared', () => {
    graduate();
    drain(shS);
    drain(chorusS);
    expect(progression.hasFeature('chorusFx')).toBe(true);
    expect(bossEngine.activeEncounter()).toBeNull();
    expect(bossEngine.currentHp).toBe(0);
  });

  it('does not memoize "nothing left" past a reset — activateStage() invalidates the cache', () => {
    // Clear both challenges to prime the "nothing left" memoization (the
    // efficiency fix that avoids rescanning CHALLENGES every frame forever).
    graduate();
    drain(shS);
    drain(chorusS);
    expect(bossEngine.activeEncounter()).toBeNull();

    // Simulate a progress reset (progression.reset() + bossEngine.graduated
    // = false + activateStage(), mirroring progressionUI.js's reset handler).
    progression.reset();
    bossEngine.graduated = false;
    bossEngine.activateStage();

    // A stale cache would incorrectly keep returning null here.
    expect(bossEngine.activeEncounter()).not.toBeNull();
    expect(bossEngine.activeEncounter().id).toBe('osc');
  });

  it('tick is a true no-op once every stage AND every challenge is cleared', () => {
    graduate();
    drain(shS);
    drain(chorusS);
    bossEngine.tick({ S: chorusS, isPlaying: true, dt: 1 });
    expect(bossEngine.currentHp).toBe(0);
  });
});
