import { describe, it, expect, beforeEach, vi } from 'vitest';
import { progression } from './progression.js';
import { STAGES } from './stages.js';
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
  noiseType: 'white', noiseMix: 0,
  osc2Waveform: 'sawtooth', osc2Octave: 0, osc2Detune: 0, osc2Mix: 0,
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
const noiseS = { ...defaultS, noiseMix: 0.5, cutoff: 3000, decay: 0.1 };

// S that satisfies the osc2 stage target (osc2Mix > 0.3, |osc2Detune| in 5–45).
const osc2S = { ...defaultS, osc2Mix: 0.5, osc2Detune: 15 };

beforeEach(() => {
  const mock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', mock);

  // Reset progression and bossEngine state before each test.
  // Clear listener arrays — they are module-level singletons that persist
  // across tests; without this, spies from earlier tests accumulate and fire
  // in later tests.
  bossEngine._clearListeners();
  progression.load();
  bossEngine.graduated = false;
  bossEngine.activateStage();
});

// Helper: drain the osc boss HP to 0 by cycling all 4 waveforms (1 damage each).
function drainOsc() {
  for (const wave of ['sine', 'square', 'sawtooth', 'triangle']) {
    bossEngine.notify({ S: { ...defaultS, waveform: wave }, isPlaying: true });
  }
}

// Helper: drain any boss at the current stage using the given S snapshot.
function drainStage(S, hits) {
  const maxHp = STAGES[progression.currentStageIndex].boss.maxHp;
  const dph = STAGES[progression.currentStageIndex].boss.damagePerHit;
  const needed = hits ?? (maxHp / dph);
  for (let i = 0; i < needed; i++) {
    bossEngine.notify({ S, isPlaying: true });
  }
}

// --- Tests ---

describe('bossEngine – activateStage', () => {
  it('sets currentHp to the first stage maxHp (40) on load', () => {
    expect(bossEngine.currentHp).toBe(40);
  });
});

describe('bossEngine – notify: no damage cases', () => {
  it('returns no-damage result when isPlaying is false', () => {
    const result = bossEngine.notify({ S: oscS, isPlaying: false });
    expect(result).toEqual({ damaged: false, damage: 0, restored: false });
  });

  it('does not reduce HP when isPlaying is false', () => {
    bossEngine.notify({ S: oscS, isPlaying: false });
    expect(bossEngine.currentHp).toBe(40);
  });

  it('returns no-damage result when waveform already used this battle', () => {
    bossEngine.notify({ S: oscS, isPlaying: true }); // first use of 'square'
    const result = bossEngine.notify({ S: oscS, isPlaying: true }); // repeat
    expect(result).toEqual({ damaged: false, damage: 0, restored: false });
  });

  it('does not reduce HP when waveform already used', () => {
    bossEngine.notify({ S: oscS, isPlaying: true }); // 10 damage
    bossEngine.notify({ S: oscS, isPlaying: true }); // no damage (repeat)
    expect(bossEngine.currentHp).toBe(30);
  });
});

describe('bossEngine – notify: damage', () => {
  it('returns damaged:true with correct damage value on a qualifying hit', () => {
    const result = bossEngine.notify({ S: oscS, isPlaying: true });
    expect(result).toEqual({ damaged: true, damage: 10, restored: false });
  });

  it('reduces HP by damagePerHit on a qualifying hit', () => {
    bossEngine.notify({ S: oscS, isPlaying: true });
    expect(bossEngine.currentHp).toBe(30);
  });

  it('awards XP equal to damagePerHit on a qualifying hit', () => {
    const xpBefore = progression.xp;
    bossEngine.notify({ S: oscS, isPlaying: true });
    expect(progression.xp).toBe(xpBefore + 10);
  });

  it('fires onDamage callback with correct payload', () => {
    const spy = vi.fn();
    bossEngine.onDamage(spy);
    bossEngine.notify({ S: oscS, isPlaying: true });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith({ hp: 30, maxHp: 40, damage: 10 });
  });
});

describe('bossEngine – restore', () => {
  it('returns restored:true when HP reaches 0', () => {
    // Use 3 waveforms first, then the 4th kills the boss.
    for (const w of ['sine', 'square', 'sawtooth']) {
      bossEngine.notify({ S: { ...defaultS, waveform: w }, isPlaying: true });
    }
    const result = bossEngine.notify({ S: { ...defaultS, waveform: 'triangle' }, isPlaying: true });
    expect(result.restored).toBe(true);
    expect(result.damaged).toBe(true);
    expect(result.damage).toBe(10);
  });

  it('marks stage as defeated after HP reaches 0', () => {
    drainOsc();
    expect(progression.defeated).toContain('osc');
  });

  it('advances progression to next stage after restore', () => {
    drainOsc();
    expect(progression.currentStageIndex).toBe(1);
  });

  it('fires onRestore callback with correct payload', () => {
    const spy = vi.fn();
    bossEngine.onRestore(spy);
    drainOsc();
    expect(spy).toHaveBeenCalledOnce();
    const call = spy.mock.calls[0][0];
    expect(call.instrument).toBe('Moog 901 Oscillator Bank');
    expect(call.pioneer).toBe('Bob Moog');
    expect(call.stage.id).toBe('osc');
  });

  it('fires onRestore callback exactly once per restore', () => {
    const spy = vi.fn();
    bossEngine.onRestore(spy);
    drainOsc();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('awards bonus XP equal to maxHp on restore', () => {
    // damagePerHit * 4 hits + bonus maxHp = 10*4 + 40 = 80
    drainOsc();
    expect(progression.xp).toBe(80);
  });

  it('resets currentHp to next stage maxHp after restore', () => {
    drainOsc();
    // Filter stage also has maxHp 100
    expect(bossEngine.currentHp).toBe(100);
  });
});

describe('bossEngine – graduation', () => {
  it('graduated becomes true after all 6 stages are restored', () => {
    // Stage 0: osc — needs all 4 waveforms used
    drainOsc();
    expect(progression.currentStageIndex).toBe(1);

    // Stage 1: filter — needs lowpass + cutoff > 4000
    drainStage(filterS);
    expect(progression.currentStageIndex).toBe(2);

    // Stage 2: envelope — needs attack < 0.05 && sustain < 0.3
    drainStage(envelopeS);
    expect(progression.currentStageIndex).toBe(3);

    // Stage 3: lfo — needs lfoDest !== 'none' && lfoDepth > 0.3
    drainStage(lfoS);
    expect(progression.currentStageIndex).toBe(4);

    // Stage 4: noise — needs noiseMix > 0.2 && cutoff < 5000 && decay < 0.2
    drainStage(noiseS);
    expect(progression.currentStageIndex).toBe(5);

    // Stage 5: osc2 — needs osc2Mix > 0.3 && |osc2Detune| in 5–45
    drainStage(osc2S);

    expect(bossEngine.graduated).toBe(true);
  });

  it('sets currentHp to 0 after graduation', () => {
    drainOsc();
    drainStage(filterS);
    drainStage(envelopeS);
    drainStage(lfoS);
    drainStage(noiseS);
    drainStage(osc2S);
    expect(bossEngine.currentHp).toBe(0);
  });

  it('activateStage is a no-op (keeps HP 0) when graduated', () => {
    drainOsc();
    drainStage(filterS);
    drainStage(envelopeS);
    drainStage(lfoS);
    drainStage(noiseS);
    drainStage(osc2S);
    bossEngine.activateStage();
    expect(bossEngine.currentHp).toBe(0);
  });
});
