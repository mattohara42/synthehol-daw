import { describe, it, expect } from 'vitest';
import { TARGETS, matchIntensity, pickTarget, createPracticeSession, MATCH_THRESHOLD, HOLD_SECONDS } from './practice.js';

describe('TARGETS bank', () => {
  it('has more than one entry with distinct names', () => {
    expect(TARGETS.length).toBeGreaterThan(1);
    expect(new Set(TARGETS.map(t => t.name)).size).toBe(TARGETS.length);
  });

  it('every target is a complete, playable params object (has the fields voices.js reads)', () => {
    const REQUIRED = ['waveform', 'detune', 'attack', 'decay', 'sustain', 'release', 'osc2Waveform', 'osc2Octave', 'osc2Detune', 'osc2Mix', 'noiseType', 'noiseMix'];
    for (const t of TARGETS) {
      for (const key of REQUIRED) {
        expect(t, `target '${t.name}' missing '${key}'`).toHaveProperty(key);
      }
    }
  });
});

describe('matchIntensity()', () => {
  const target = TARGETS[0];

  it('returns 1 for an exact match', () => {
    expect(matchIntensity(target, target)).toBeCloseTo(1, 5);
  });

  it('returns a partial score for a near match', () => {
    const near = { ...target, detune: target.detune + 5 };
    const score = matchIntensity(near, target);
    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThan(1);
  });

  it('drops to 0 on a totally different waveform and far-off continuous dims', () => {
    const far = {
      waveform: target.waveform === 'sine' ? 'square' : 'sine',
      detune: target.detune + 200, attack: target.attack + 10, decay: target.decay + 10,
      sustain: target.sustain > 0.5 ? 0 : 1, release: target.release + 10,
      osc2Mix: target.osc2Mix > 0.5 ? 0 : 1, osc2Detune: target.osc2Detune + 200,
      noiseMix: target.noiseMix > 0.5 ? 0 : 1,
    };
    expect(matchIntensity(far, target)).toBeCloseTo(0, 5);
  });

  it('treats a non-numeric value on a tolerance dimension as maximally far (0), not NaN', () => {
    const broken = { ...target, attack: undefined };
    expect(Number.isNaN(matchIntensity(broken, target))).toBe(false);
    expect(matchIntensity(broken, target)).toBeLessThan(1);
  });
});

describe('pickTarget()', () => {
  it('always returns an entry from TARGETS', () => {
    for (let i = 0; i < 20; i++) {
      expect(TARGETS).toContain(pickTarget(null));
    }
  });

  it('avoids repeating the previous target across many draws', () => {
    let prev = TARGETS[0];
    for (let i = 0; i < 50; i++) {
      const next = pickTarget(prev);
      expect(next).not.toBe(prev);
      prev = next;
    }
  });
});

describe('createPracticeSession()', () => {
  // No Math.random mocking here — every test below reads session.target
  // dynamically rather than assuming which entry it is, so real randomness
  // is fine (and avoids a pathological infinite loop in pickTarget()'s
  // avoid-repeat guard if random() were pinned to the current target's slot).

  it('starts with a target from the bank and zero rounds', () => {
    const session = createPracticeSession();
    expect(TARGETS).toContain(session.target);
    expect(session.rounds).toBe(0);
  });

  it('tick() with a mismatched S does not accumulate hold time or nail', () => {
    const session = createPracticeSession();
    const t = session.target;
    // Flip two dimensions — one wrong dim alone (8/9 ≈ 0.89) can still clear
    // MATCH_THRESHOLD (0.88); a real mismatch needs to miss on more than one.
    const off = { ...t, waveform: t.waveform === 'square' ? 'sine' : 'square', detune: t.detune + 40 };
    const result = session.tick({ S: off, isPlaying: true, dt: 5 });
    expect(result.nailed).toBe(false);
  });

  it('tick() while not playing scores 0 intensity even with a matching S', () => {
    const session = createPracticeSession();
    const result = session.tick({ S: session.target, isPlaying: false, dt: 1 });
    expect(result.intensity).toBe(0);
    expect(result.nailed).toBe(false);
  });

  it('a sustained exact match nails it after HOLD_SECONDS and advances the target', () => {
    const session = createPracticeSession();
    const startingTarget = session.target;
    // Tick in small increments below HOLD_SECONDS first — should not nail yet.
    let result = session.tick({ S: startingTarget, isPlaying: true, dt: HOLD_SECONDS - 0.1 });
    expect(result.nailed).toBe(false);
    expect(result.intensity).toBeCloseTo(1, 5);
    // One more tick crosses the threshold.
    result = session.tick({ S: startingTarget, isPlaying: true, dt: 0.2 });
    expect(result.nailed).toBe(true);
    expect(session.rounds).toBe(1);
  });

  it('dropping below MATCH_THRESHOLD mid-hold resets progress (no partial credit)', () => {
    const session = createPracticeSession();
    const target = session.target;
    session.tick({ S: target, isPlaying: true, dt: HOLD_SECONDS - 0.1 }); // almost there
    // Two dims off — one alone (8/9 ≈ 0.89) can still clear MATCH_THRESHOLD (0.88).
    const missed = {
      ...target,
      sustain: target.sustain > 0.5 ? 0 : 1,
      osc2Mix: target.osc2Mix > 0.5 ? 0 : 1,
    };
    session.tick({ S: missed, isPlaying: true, dt: 0.01 });
    // Even resuming an exact match needs the full HOLD_SECONDS again.
    const result = session.tick({ S: target, isPlaying: true, dt: HOLD_SECONDS - 0.1 });
    expect(result.nailed).toBe(false);
  });

  it('newTarget() resets hold progress and can change the target', () => {
    const session = createPracticeSession();
    const before = session.target;
    session.tick({ S: before, isPlaying: true, dt: HOLD_SECONDS - 0.1 });
    session.newTarget();
    // A tick that would have nailed under the old hold time should not
    // immediately nail — hold time was reset.
    const result = session.tick({ S: session.target, isPlaying: true, dt: 0.1 });
    expect(result.nailed).toBe(false);
  });

  it('MATCH_THRESHOLD and HOLD_SECONDS are sane bounds', () => {
    expect(MATCH_THRESHOLD).toBeGreaterThan(0);
    expect(MATCH_THRESHOLD).toBeLessThanOrEqual(1);
    expect(HOLD_SECONDS).toBeGreaterThan(0);
  });
});
