import { describe, it, expect } from 'vitest';
import { makeImpulse, makeDriveCurve, lfoDepthScaled } from './audio.js';
import { S } from './state.js';

// Minimal fake AudioContext: just enough for makeImpulse.
function fakeCtx(rate = 8000) {
  return {
    sampleRate: rate,
    createBuffer(channels, len) {
      const chans = Array.from({ length: channels }, () => new Float32Array(len));
      return {
        length: len,
        numberOfChannels: channels,
        getChannelData: (c) => chans[c],
      };
    },
  };
}

describe('audio – makeImpulse (reverb impulse response)', () => {
  it('produces a stereo buffer of sampleRate * seconds samples', () => {
    const buf = makeImpulse(fakeCtx(8000), 0.5);
    expect(buf.numberOfChannels).toBe(2);
    expect(buf.length).toBe(4000);
  });

  it('decays over time (early energy exceeds late energy)', () => {
    const buf = makeImpulse(fakeCtx(8000), 1, 2.5);
    const d = buf.getChannelData(0);
    const energy = (from, to) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += Math.abs(d[i]);
      return sum / (to - from);
    };
    const early = energy(0, 800);
    const late = energy(d.length - 800, d.length);
    expect(early).toBeGreaterThan(late);
  });

  it('stays within the [-1, 1] range', () => {
    const buf = makeImpulse(fakeCtx(4000), 0.3);
    const d = buf.getChannelData(1);
    for (let i = 0; i < d.length; i++) {
      expect(d[i]).toBeGreaterThanOrEqual(-1);
      expect(d[i]).toBeLessThanOrEqual(1);
    }
  });

  it('never returns an empty buffer even for tiny durations', () => {
    const buf = makeImpulse(fakeCtx(1000), 0);
    expect(buf.length).toBeGreaterThanOrEqual(1);
  });
});

describe('audio – makeDriveCurve (WaveShaper saturation curve)', () => {
  it('returns null at zero or negative amount (drive bypassed)', () => {
    expect(makeDriveCurve(0)).toBeNull();
    expect(makeDriveCurve(-1)).toBeNull();
  });

  it('returns a 1024-sample curve for a positive amount', () => {
    const curve = makeDriveCurve(0.5);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(1024);
  });

  it('stays within [-1, 1] and is normalized to reach exactly ±1 at the extremes', () => {
    const curve = makeDriveCurve(1);
    for (let i = 0; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(-1.000001);
      expect(curve[i]).toBeLessThanOrEqual(1.000001);
    }
    expect(curve[curve.length - 1]).toBeCloseTo(1, 5);
    expect(curve[0]).toBeCloseTo(-1, 5);
  });

  it('is approximately odd-symmetric (curve(-x) ≈ -curve(x))', () => {
    // The sample grid itself is slightly asymmetric (x runs from exactly -1
    // up to just short of +1), so mirrored samples don't line up on exactly
    // opposite x values — allow a tolerance well above that discretization
    // error rather than asserting exact equality.
    const curve = makeDriveCurve(0.7);
    const mid = curve.length / 2;
    for (let i = 0; i < mid; i++) {
      expect(curve[i]).toBeCloseTo(-curve[curve.length - 1 - i], 1);
    }
  });

  it('higher drive amounts saturate faster away from center (more gain, earlier clipping)', () => {
    const low = makeDriveCurve(0.1);
    const high = makeDriveCurve(1);
    const i = Math.round((0.3 + 1) / 2 * 1024); // x ≈ 0.3
    expect(Math.abs(high[i])).toBeGreaterThan(Math.abs(low[i]));
  });
});

describe('audio – lfoDepthScaled (per-destination LFO depth scaling)', () => {
  it('scales to ±8kHz for filter destination', () => {
    S.lfoDest = 'filter';
    S.lfoDepth = 0.5;
    expect(lfoDepthScaled()).toBeCloseTo(4000, 6);
  });

  it('scales to ±1200 cents for pitch destination', () => {
    S.lfoDest = 'pitch';
    S.lfoDepth = 1;
    expect(lfoDepthScaled()).toBeCloseTo(1200, 6);
  });

  it('scales to ±0.8 amplitude for amp destination', () => {
    S.lfoDest = 'amp';
    S.lfoDepth = 0.25;
    expect(lfoDepthScaled()).toBeCloseTo(0.2, 6);
  });

  it('is zero for "none" regardless of depth', () => {
    S.lfoDest = 'none';
    S.lfoDepth = 1;
    expect(lfoDepthScaled()).toBe(0);
  });

  it('is zero at zero depth for any destination', () => {
    S.lfoDest = 'filter';
    S.lfoDepth = 0;
    expect(lfoDepthScaled()).toBe(0);
  });
});
