import { describe, it, expect, beforeEach } from 'vitest';
import { store } from './store.js';
import { S } from './state.js';
import STAGES from './stages.js';

beforeEach(() => {
  store._resetForTest();
});

describe('store – defaults & S identity', () => {
  it('S is the active instrument params object', () => {
    expect(store.params()).toBe(S);
  });

  it('exposes the synth defaults', () => {
    expect(S.waveform).toBe('sine');
    expect(S.cutoff).toBe(2000);
    expect(S.reverbMix).toBe(0.15);
    expect(store.get().transport.bpm).toBe(120);
    expect(store.get().tracks).toHaveLength(1);
  });
});

describe('store – set & subscribe', () => {
  it('set updates the param and the live S', () => {
    store.set('cutoff', 1500);
    expect(S.cutoff).toBe(1500);
    expect(store.params().cutoff).toBe(1500);
  });

  it('notifies subscribers with { path, value }', () => {
    const calls = [];
    const unsub = store.subscribe(c => calls.push(c));
    store.set('cutoff', 1500);
    expect(calls).toEqual([{ path: 'cutoff', value: 1500 }]);
    unsub();
    store.set('cutoff', 1600);
    expect(calls).toHaveLength(1);
  });

  it('is a no-op when the value is unchanged', () => {
    const calls = [];
    store.subscribe(c => calls.push(c));
    store.set('cutoff', S.cutoff);
    expect(calls).toHaveLength(0);
  });

  it('setPath writes nested tree values (e.g. transport.bpm)', () => {
    store.setPath('transport.bpm', 140);
    expect(store.get().transport.bpm).toBe(140);
  });
});

describe('store – undo / redo', () => {
  it('round-trips a single edit', () => {
    store.set('cutoff', 3000);
    expect(store.undo()).toBe(true);
    expect(S.cutoff).toBe(2000);
    expect(store.redo()).toBe(true);
    expect(S.cutoff).toBe(3000);
  });

  it('coalesces a run of same-key writes into one undo step (a drag)', () => {
    store.set('cutoff', 3000);
    store.set('cutoff', 4000);
    store.set('cutoff', 5000);
    expect(S.cutoff).toBe(5000);
    store.undo();
    expect(S.cutoff).toBe(2000); // back to pre-drag, not 4000
  });

  it('keeps separate undo steps for different keys', () => {
    store.set('cutoff', 3000);
    store.set('resonance', 8);
    store.undo();
    expect(S.resonance).toBe(1.0);
    expect(S.cutoff).toBe(3000);
    store.undo();
    expect(S.cutoff).toBe(2000);
  });

  it('returns false when there is nothing to undo/redo', () => {
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
  });
});

describe('store – serialize / load', () => {
  it('round-trips the project', () => {
    store.set('cutoff', 1234);
    store.set('waveform', 'square');
    const json = store.serialize();
    store.reset();
    expect(S.cutoff).toBe(2000);
    expect(store.load(json)).toBe(true);
    expect(S.cutoff).toBe(1234);
    expect(S.waveform).toBe('square');
  });

  it('applies load IN PLACE — the S reference is preserved', () => {
    const ref = store.params();
    store.set('cutoff', 999);
    const json = store.serialize();
    store.reset();
    store.load(json);
    expect(store.params()).toBe(ref);
    expect(ref.cutoff).toBe(999);
    expect(S).toBe(ref);
  });

  it('rejects malformed input without throwing', () => {
    expect(store.load('not json')).toBe(false);
    expect(store.load(JSON.stringify({ nope: true }))).toBe(false);
    expect(S.cutoff).toBe(2000);
  });
});

describe('store – boss predicates read the post-load S', () => {
  it('the filter stage target sees loaded params', () => {
    const filterTarget = STAGES.find(s => s.id === 'filter').target;
    store.set('cutoff', 5000); // lowpass by default
    const json = store.serialize();
    store.reset();
    expect(filterTarget(S, true)).toBe(false); // back to 2000
    store.load(json);
    expect(filterTarget(S, true)).toBe(true);  // cutoff 5000 > 4000
  });
});
