import { describe, it, expect } from 'vitest';
import { peakLevel } from './signalFlow.js';

describe('signalFlow – peakLevel', () => {
  it('returns 0 for a silent buffer (all samples at the 128 midline)', () => {
    expect(peakLevel(new Uint8Array(64).fill(128))).toBe(0);
  });

  it('returns 1 for a full-scale sample in either direction', () => {
    const up = new Uint8Array(64).fill(128);
    up[10] = 255; // 127/128 ≈ 0.99…
    expect(peakLevel(up)).toBeCloseTo(127 / 128, 6);

    const down = new Uint8Array(64).fill(128);
    down[10] = 0;
    expect(peakLevel(down)).toBe(1);
  });

  it('tracks the loudest sample, not an average', () => {
    const data = new Uint8Array(64).fill(128);
    data[3] = 160; // 32/128 = 0.25
    data[4] = 144; // quieter
    expect(peakLevel(data)).toBe(0.25);
  });
});
