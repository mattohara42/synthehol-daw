import { describe, it, expect, beforeEach } from 'vitest';
import {
  valueToFrac, fracToValue, ensureAutomation, ensureDrums, ensureAccent, duplicateFirstHalf,
} from './sequencerUI.js';
import { store } from './store.js';

beforeEach(() => {
  store._resetForTest();
});

describe('sequencerUI – valueToFrac() / fracToValue() (automation lane 0..1 ↔ real-param mapping)', () => {
  it('round-trips linear params (resonance, volume)', () => {
    for (const [param, value] of [['resonance', 6], ['volume', 0.5]]) {
      const frac = valueToFrac(param, value);
      expect(fracToValue(param, frac)).toBeCloseTo(value, 2);
    }
  });

  it('round-trips the log-mapped cutoff param', () => {
    const frac = valueToFrac('cutoff', 2000);
    expect(fracToValue('cutoff', frac)).toBeCloseTo(2000, -1); // rounded to an integer Hz
  });

  it('maps frac 0/1 to the param\'s min/max', () => {
    expect(fracToValue('resonance', 0)).toBe(0.5);
    expect(fracToValue('resonance', 1)).toBe(18);
    expect(fracToValue('cutoff', 0)).toBe(60);
    expect(fracToValue('cutoff', 1)).toBe(18000);
  });

  it('clamps out-of-range fractions instead of extrapolating', () => {
    expect(fracToValue('volume', -0.5)).toBe(0);
    expect(fracToValue('volume', 1.5)).toBe(1);
  });

  it('rounds cutoff to a whole Hz and resonance/volume to 2 decimal places', () => {
    expect(Number.isInteger(fracToValue('cutoff', 0.37))).toBe(true);
    const v = fracToValue('resonance', 0.6183);
    expect(v).toBe(Math.round(v * 100) / 100);
  });
});

describe('sequencerUI – legacy-save backfill guards', () => {
  it('ensureAutomation() creates the whole automation object when entirely missing', () => {
    const p = store.pattern();
    delete p.automation;
    ensureAutomation();
    expect(p.automation.cutoff).toHaveLength(16);
    expect(p.automation.resonance).toHaveLength(16);
    expect(p.automation.volume).toHaveLength(16);
    expect(p.automation.cutoff.every(v => v === null)).toBe(true);
  });

  it('ensureAutomation() backfills only the missing lane, preserving the others', () => {
    const p = store.pattern();
    p.automation.cutoff[0] = 900; // real player data
    delete p.automation.resonance;
    ensureAutomation();
    expect(p.automation.cutoff[0]).toBe(900); // untouched
    expect(p.automation.resonance).toHaveLength(16);
    expect(p.automation.resonance.every(v => v === null)).toBe(true);
  });

  it('ensureDrums() creates the whole drums object when entirely missing', () => {
    const p = store.pattern();
    delete p.drums;
    ensureDrums();
    expect(p.drums.kick).toHaveLength(16);
    expect(p.drums.cowbell).toHaveLength(16);
  });

  it('ensureDrums() backfills only a missing voice (e.g. cowbell/clap on a pre-Roland-slice save), preserving programmed voices', () => {
    const p = store.pattern();
    const kickBefore = [...p.drums.kick]; // default pattern seeds real kick hits
    delete p.drums.cowbell;
    ensureDrums();
    expect(p.drums.kick).toEqual(kickBefore); // untouched
    expect(p.drums.cowbell).toEqual(Array(16).fill(false));
  });

  it('ensureAccent() creates the accent lane when missing', () => {
    const p = store.pattern();
    delete p.accent;
    ensureAccent();
    expect(p.accent).toEqual(Array(16).fill(false));
  });

  it('ensureAccent() leaves an existing accent lane untouched', () => {
    const p = store.pattern();
    p.accent[3] = true;
    ensureAccent();
    expect(p.accent[3]).toBe(true);
  });
});

describe('sequencerUI – duplicateFirstHalf() (F6)', () => {
  it('copies cells, drums, accent, and every automation lane from the first half into the second', () => {
    const p = store.pattern();
    p.accent[1] = true;
    p.automation.cutoff[2] = 1200;

    duplicateFirstHalf();

    const after = store.pattern();
    const half = after.length / 2;
    for (let row = 0; row < after.cells.length; row++) {
      expect(after.cells[row].slice(half)).toEqual(after.cells[row].slice(0, half));
    }
    for (const voice of ['kick', 'snare', 'hat', 'cowbell', 'clap']) {
      expect(after.drums[voice].slice(half)).toEqual(after.drums[voice].slice(0, half));
    }
    expect(after.accent.slice(half)).toEqual(after.accent.slice(0, half));
    expect(after.accent[half + 1]).toBe(true); // the point set above landed in the first half, mirrored
    for (const key of Object.keys(after.automation)) {
      expect(after.automation[key].slice(half)).toEqual(after.automation[key].slice(0, half));
    }
    expect(after.automation.cutoff[half + 2]).toBe(1200);
  });

  it('is a no-op for a pattern shorter than 2 steps (half < 1)', () => {
    store.setPath('tracks.0.pattern.length', 1);
    const before = JSON.stringify(store.pattern());
    duplicateFirstHalf();
    expect(JSON.stringify(store.pattern())).toBe(before);
  });

  it('is an undoable edit', () => {
    duplicateFirstHalf();
    expect(store.canUndo()).toBe(true);
  });
});
