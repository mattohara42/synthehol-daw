import { describe, it, expect } from 'vitest';
import { makeImpulse } from './audio.js';

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
