import { describe, it, expect } from 'vitest';
import { analyzeSpectrum, detectClipping, diagnose } from './diagnostics.js';

// 512 bins over a 44100Hz context → nyquist 22050Hz, ~43Hz/bin.
const SAMPLE_RATE = 44100;
const BINS = 512;

function flatSpectrum(value = 0) {
  return new Uint8Array(BINS).fill(value);
}

// Set every bin analyzeSpectrum would assign to [loHz, hiHz) to `value` —
// mirrors its own floor/ceil bin-range math exactly, so the test isn't
// fighting a boundary-rounding mismatch with the code under test.
function withBand(data, loHz, hiHz, value) {
  const binHz = (SAMPLE_RATE / 2) / data.length;
  const startBin = Math.floor(loHz / binHz);
  const endBin = Math.min(data.length, Math.ceil(hiHz / binHz));
  const out = new Uint8Array(data);
  for (let i = startBin; i < endBin; i++) out[i] = value;
  return out;
}

describe('diagnostics – analyzeSpectrum', () => {
  it('reports near-zero energy for a silent spectrum', () => {
    const bands = analyzeSpectrum(flatSpectrum(0), SAMPLE_RATE);
    for (const v of Object.values(bands)) expect(v).toBe(0);
  });

  it('isolates energy to the band it was placed in', () => {
    const data = withBand(flatSpectrum(0), 250, 500, 255); // low-mid, full scale
    const bands = analyzeSpectrum(data, SAMPLE_RATE);
    expect(bands.lowMid).toBeCloseTo(1, 1);
    expect(bands.sub).toBe(0);
    expect(bands.high).toBe(0);
  });
});

describe('diagnostics – detectClipping', () => {
  it('is false for a clean sine-like signal (no rail-pinned samples)', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < data.length; i++) {
      data[i] = 128 + Math.round(100 * Math.sin((i / data.length) * Math.PI * 4));
    }
    expect(detectClipping(data)).toBe(false);
  });

  it('is true when a meaningful fraction of samples are pinned at the rails', () => {
    const data = new Uint8Array(256).fill(128);
    for (let i = 0; i < 20; i++) data[i] = 255; // ~8% pinned high
    expect(detectClipping(data)).toBe(true);
  });

  it('ignores a single stray rail sample (noise, not real clipping)', () => {
    const data = new Uint8Array(256).fill(128);
    data[0] = 255;
    expect(detectClipping(data)).toBe(false);
  });
});

describe('diagnostics – diagnose', () => {
  it('returns null for near-silence — nothing to say yet', () => {
    expect(diagnose({ sub: 0, low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 }, false)).toBeNull();
  });

  it('clipping always wins, regardless of the spectrum', () => {
    const bands = { sub: 0.2, low: 0.2, lowMid: 0.2, mid: 0.2, highMid: 0.2, high: 0.2 };
    const result = diagnose(bands, true);
    expect(result.kind).toBe('warn');
    expect(result.text).toMatch(/clipping/i);
  });

  it('flags muddiness when low-mid dominates', () => {
    const bands = { sub: 0.1, low: 0.1, lowMid: 0.5, mid: 0.1, highMid: 0.1, high: 0.1 };
    const result = diagnose(bands, false);
    expect(result.kind).toBe('warn');
    expect(result.text).toMatch(/mudd|250.*500/i);
  });

  it('flags harshness when high dominates', () => {
    const bands = { sub: 0.1, low: 0.1, lowMid: 0.1, mid: 0.1, highMid: 0.1, high: 0.5 };
    const result = diagnose(bands, false);
    expect(result.text).toMatch(/harsh|5 kHz/i);
  });

  it('flags thinness when there is meaningful signal but no low end', () => {
    const bands = { sub: 0, low: 0, lowMid: 0.1, mid: 0.2, highMid: 0.1, high: 0.05 };
    const result = diagnose(bands, false);
    expect(result.text).toMatch(/thin|low end/i);
  });

  it('reports balanced for a genuinely even spectrum', () => {
    const bands = { sub: 0.2, low: 0.2, lowMid: 0.2, mid: 0.2, highMid: 0.2, high: 0.2 };
    const result = diagnose(bands, false);
    expect(result.kind).toBe('ok');
  });
});
