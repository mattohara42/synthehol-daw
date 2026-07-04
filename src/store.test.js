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

describe('store – tracks (E4 step 1)', () => {
  it('starts with exactly one track', () => {
    expect(store.tracks()).toHaveLength(1);
    expect(store.tracks()[0].id).toBe('t1');
  });

  it('addTrack clones the active track\'s instrument and pattern by value', () => {
    store.set('cutoff', 3333);
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.cells.0.0`, true);
    const id = store.addTrack();
    expect(store.tracks()).toHaveLength(2);
    const added = store.tracks().find(t => t.id === id);
    expect(added.instrument.params.cutoff).toBe(3333);
    expect(added.pattern.cells[0][0]).toBe(true);

    // Independent copies, not shared references.
    added.instrument.params.cutoff = 1;
    expect(S.cutoff).toBe(3333);
  });

  it('addTrack does not change the active track (S stays bound to it)', () => {
    const ref = store.params();
    store.addTrack();
    expect(store.params()).toBe(ref);
    expect(S).toBe(ref);
    expect(store.get().activeTrackId).toBe('t1');
  });

  it('addTrack defaults the name to "<source> copy" or accepts an explicit one', () => {
    const id1 = store.addTrack();
    expect(store.tracks().find(t => t.id === id1).name).toBe('Synth copy');
    const id2 = store.addTrack('Bass');
    expect(store.tracks().find(t => t.id === id2).name).toBe('Bass');
  });

  it('addTrack starts the new track with its own empty clip library', () => {
    store.saveClip('A');
    const id = store.addTrack();
    expect(store.tracks().find(t => t.id === id).clips).toEqual([]);
  });

  it('addTrack refuses past the MAX_TRACKS ceiling', () => {
    store.addTrack();
    store.addTrack();
    store.addTrack();
    expect(store.tracks()).toHaveLength(4);
    expect(store.addTrack()).toBeNull();
    expect(store.tracks()).toHaveLength(4);
  });

  it('addTrack is undoable', () => {
    store.addTrack();
    expect(store.tracks()).toHaveLength(2);
    store.undo();
    expect(store.tracks()).toHaveLength(1);
    store.redo();
    expect(store.tracks()).toHaveLength(2);
  });

  it('removeTrack removes a non-active track', () => {
    const id = store.addTrack();
    expect(store.removeTrack(id)).toBe(true);
    expect(store.tracks()).toHaveLength(1);
  });

  it('removeTrack is undoable', () => {
    const id = store.addTrack();
    store.removeTrack(id);
    expect(store.tracks()).toHaveLength(1);
    store.undo();
    expect(store.tracks().map(t => t.id)).toContain(id);
    expect(store.tracks()).toHaveLength(2);
  });

  it('removeTrack refuses to remove the last remaining track', () => {
    expect(store.removeTrack('t1')).toBe(false);
    expect(store.tracks()).toHaveLength(1);
  });

  it('removeTrack refuses to remove the currently-active track', () => {
    store.addTrack();
    expect(store.removeTrack('t1')).toBe(false); // t1 is still active
    expect(store.tracks()).toHaveLength(2);
  });

  it('removeTrack returns false for an unknown id', () => {
    expect(store.removeTrack('nonexistent')).toBe(false);
  });

  it('serialize/load round-trips a multi-track project, preserving the S reference', () => {
    const ref = store.params();
    store.addTrack('Bass');
    const json = store.serialize();
    store.reset();
    expect(store.tracks()).toHaveLength(1);
    expect(store.load(json)).toBe(true);
    expect(store.tracks()).toHaveLength(2);
    expect(store.tracks().map(t => t.name)).toEqual(['Synth', 'Bass']);
    expect(store.params()).toBe(ref); // S still points at the (still-active) first track
  });

  it('undo/redo across a track-count change resizes the live tracks array both ways', () => {
    store.addTrack();
    store.addTrack();
    expect(store.tracks()).toHaveLength(3);
    store.undo();
    expect(store.tracks()).toHaveLength(2);
    store.undo();
    expect(store.tracks()).toHaveLength(1);
    store.redo();
    expect(store.tracks()).toHaveLength(2);
    store.redo();
    expect(store.tracks()).toHaveLength(3);
  });
});

describe('store – setActiveTrack (E4 step 2)', () => {
  it('switches which track params()/S reflect, without changing S\'s identity', () => {
    const ref = store.params();
    store.set('cutoff', 1111);
    const id2 = store.addTrack('Bass'); // clones track 1 as it is right now: cutoff 1111
    store.set('cutoff', 2222); // still editing track 1 — addTrack didn't switch

    expect(store.setActiveTrack(id2)).toBe(true);
    expect(store.get().activeTrackId).toBe(id2);
    expect(store.params()).toBe(ref);      // S never changes identity
    expect(S).toBe(ref);
    expect(S.cutoff).toBe(1111);           // ...but now holds track 2's cloned value, not t1's later edit
  });

  it('each track keeps its own edited values independently across switches', () => {
    store.set('cutoff', 1000);
    const id2 = store.addTrack('Bass');
    store.setActiveTrack(id2);
    store.set('cutoff', 2000);
    const id3 = store.addTrack('Lead');
    store.setActiveTrack(id3);
    store.set('cutoff', 3000);

    store.setActiveTrack('t1');
    expect(S.cutoff).toBe(1000);
    store.setActiveTrack(id2);
    expect(S.cutoff).toBe(2000);
    store.setActiveTrack(id3);
    expect(S.cutoff).toBe(3000);
  });

  it('returns false and no-ops for an unknown id or the already-active id', () => {
    expect(store.setActiveTrack('nonexistent')).toBe(false);
    expect(store.setActiveTrack('t1')).toBe(false); // already active
    expect(store.get().activeTrackId).toBe('t1');
  });

  it('is not itself undo-tracked (a pure edit does not undo the switch)', () => {
    const id2 = store.addTrack('Bass');
    store.setActiveTrack(id2);
    store.set('cutoff', 4242);
    expect(store.get().activeTrackId).toBe(id2);
    store.undo(); // undoes the cutoff edit only
    expect(store.get().activeTrackId).toBe(id2); // switch itself wasn't a history step
    expect(S.cutoff).not.toBe(4242);
  });

  it('switching also switches which pattern store.pattern() returns', () => {
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.swing`, 0.4);
    const id2 = store.addTrack('Bass');
    expect(store.pattern().swing).toBe(0.4); // addTrack cloned it
    store.setActiveTrack(id2);
    store.setPath(`tracks.${store.activeTrackIndex()}.pattern.swing`, 0.1);
    expect(store.pattern().swing).toBe(0.1);
    store.setActiveTrack('t1');
    expect(store.pattern().swing).toBe(0.4);
  });

  it('undo/redo crossing a track-switch boundary restores both the value AND which track holds S', () => {
    const ref = store.params();
    store.set('cutoff', 111);              // edit #1, on t1 (pushes history)
    const id2 = store.addTrack('Bass');
    store.setActiveTrack(id2);              // not a history step
    store.set('cutoff', 222);              // edit #2, on t2 (pushes history)

    store.undo();                           // undoes edit #2 -> back to t2's pre-edit value
    expect(store.get().activeTrackId).toBe(id2);
    expect(S.cutoff).not.toBe(222);

    store.undo();                           // crosses the switch boundary back to t1
    expect(store.get().activeTrackId).toBe('t1');
    expect(store.params()).toBe(ref);       // S must still be the same physical object...
    expect(S).toBe(ref);
    expect(S.cutoff).toBe(111);             // ...now correctly holding t1's edit #1 value

    store.redo();                           // retrace forward across the switch boundary: t1 -> t2, pre-edit value
    expect(store.get().activeTrackId).toBe(id2);
    expect(S.cutoff).not.toBe(222);

    store.redo();                           // retrace the cutoff edit itself: back to 222
    expect(store.get().activeTrackId).toBe(id2);
    expect(S.cutoff).toBe(222);
  });

  it('serialize/load round-trips activeTrackId along with which track S ends up in', () => {
    const id2 = store.addTrack('Bass');
    store.setActiveTrack(id2);
    store.set('cutoff', 555);
    const json = store.serialize();
    store.reset();
    expect(store.get().activeTrackId).toBe('t1');

    expect(store.load(json)).toBe(true);
    expect(store.get().activeTrackId).toBe(id2);
    expect(store.params()).toBe(S); // still the one true S, now homed in track 2's slot
    expect(S.cutoff).toBe(555);
  });

  it('reset() re-homes S into the single surviving default track', () => {
    const ref = store.params();
    const id2 = store.addTrack('Bass');
    store.setActiveTrack(id2);
    store.set('cutoff', 999);

    store.reset();
    expect(store.tracks()).toHaveLength(1);
    expect(store.get().activeTrackId).toBe('t1');
    expect(store.params()).toBe(ref); // S's identity survives even though its old holder track got truncated away
    expect(S.cutoff).toBe(2000);      // back to the default
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
