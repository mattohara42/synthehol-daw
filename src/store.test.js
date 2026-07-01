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

  it('canUndo/canRedo reflect history state, for UI enabled/disabled buttons', () => {
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
    store.set('cutoff', 3000);
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
    store.undo();
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
  });

  it('undoes drum and automation edits, not just cells/length/swing', () => {
    const path = (suffix) => `tracks.${store.activeTrackIndex()}.pattern.${suffix}`;
    store.setPath(path('drums.kick.2'), true);
    store.setPath(path('automation.cutoff.2'), 4000);
    expect(store.pattern().drums.kick[2]).toBe(true);
    expect(store.pattern().automation.cutoff[2]).toBe(4000);
    store.undo();
    expect(store.pattern().automation.cutoff[2]).toBe(null);
    store.undo();
    expect(store.pattern().drums.kick[2]).toBe(false);
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

describe('store – pattern clips (L8)', () => {
  it('starts with no saved clips', () => {
    expect(store.clips()).toEqual([]);
  });

  it('saveClip snapshots the live pattern by value, not by reference', () => {
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.cells.0.0`, true);
    store.saveClip('My Pattern');
    expect(store.clips()).toHaveLength(1);
    expect(store.clips()[0].name).toBe('My Pattern');

    // Further edits to the live pattern must not leak into the saved clip.
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.cells.0.1`, true);
    expect(store.clips()[0].pattern.cells[0][1]).toBe(false);
  });

  it('saveClip with an existing name overwrites that clip, not a duplicate', () => {
    store.saveClip('A');
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.swing`, 0.5);
    store.saveClip('A');
    expect(store.clips()).toHaveLength(1);
    expect(store.clips()[0].pattern.swing).toBe(0.5);
  });

  it('loadClip replaces the live pattern with a copy of the clip', () => {
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.swing`, 0.3);
    store.saveClip('Swung');
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.swing`, 0);

    const id = store.clips()[0].id;
    expect(store.loadClip(id)).toBe(true);
    expect(store.pattern().swing).toBe(0.3);
  });

  it('loadClip returns false for an unknown id and leaves the pattern alone', () => {
    const before = store.pattern().swing;
    expect(store.loadClip('nonexistent')).toBe(false);
    expect(store.pattern().swing).toBe(before);
  });

  it('duplicateClip copies a clip under a new name, independent of the original', () => {
    store.saveClip('Original');
    const id = store.clips()[0].id;
    expect(store.duplicateClip(id, 'Original copy')).toBe(true);
    expect(store.clips()).toHaveLength(2);
    expect(store.clips().map(c => c.name)).toEqual(['Original', 'Original copy']);
  });

  it('deleteClip removes only the named clip', () => {
    store.saveClip('Keep');
    store.saveClip('Drop');
    const dropId = store.clips().find(c => c.name === 'Drop').id;
    store.deleteClip(dropId);
    expect(store.clips().map(c => c.name)).toEqual(['Keep']);
  });

  it('clip operations are undoable', () => {
    store.saveClip('A');
    expect(store.clips()).toHaveLength(1);
    store.undo();
    expect(store.clips()).toHaveLength(0);
    store.redo();
    expect(store.clips()).toHaveLength(1);
  });
});
