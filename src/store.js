// Project-state store — the serializable source of truth (Architecture E1).
//
// The store owns a project tree. The active instrument's `params` object IS the
// object the rest of the app knows as `S` (re-exported from state.js), so reads
// like `S.cutoff` are unchanged. Writes route through `set()`/`setPath()`, which
// record history (undo/redo), notify subscribers, and keep the tree
// serializable. `load()`/`reset()`/undo all apply state IN PLACE — they mutate
// the existing leaf objects rather than replacing them — so the `S` reference
// every module holds stays valid.
//
// This module imports nothing from the synth layer (no import cycles).

const COALESCE_MS = 350; // a run of same-key writes (a slider drag) = one undo step
const MAX_HISTORY = 100;

// The synth's parameter defaults. These live here now (they used to live in
// state.js); `S` is `project.tracks[<active>].instrument.params`.
function defaultParams() {
  return {
    // Osc
    waveform: 'sine', octave: 4, detune: 0,
    // Noise (VNO) — white/pink texture mixed in alongside the oscillator
    noiseType: 'white', noiseMix: 0,
    // Osc2 (VCO2) — second oscillator for detuned stacking / unison
    osc2Waveform: 'sawtooth', osc2Octave: 0, osc2Detune: 7, osc2Mix: 0,
    // Filter
    filterType: 'lowpass', cutoff: 2000, resonance: 1.0, filterEnvAmount: 0,
    // ADSR
    attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3,
    // LFO
    lfoDest: 'filter', lfoRate: 2, lfoDepth: 0.2,
    lfoWaveform: 'sine', lfoRetrigger: false,
    // EQ (3-band, gain in dB, 0 = flat)
    eqLow: 0, eqMid: 0, eqHigh: 0,
    // FX
    drive: 0, delayTime: 0.25, delayFeedback: 0.3, delayMix: 0, reverbMix: 0.15,
    // Master
    masterVol: 0.6,
  };
}

// Step-sequencer pattern: a grid of pitch rows × steps. Rows span one octave
// (13 rows, C..C); the top row is the highest pitch. `length` is the number of
// active steps; `swing` (0–1) delays the off-beats. Defaults seed a gentle
// ascending arpeggio so hitting Play makes music immediately.
const PATTERN_ROWS = 8;   // one diatonic octave (C D E F G A B C); see sequencer.js SCALE
const PATTERN_STEPS = 16;
function defaultPattern() {
  const cells = Array.from({ length: PATTERN_ROWS }, () => Array(PATTERN_STEPS).fill(false));
  // row = (ROWS-1) - scale-degree; bottom row 7 = base C, top row 0 = +octave.
  cells[7][0] = true;   // C4
  cells[5][4] = true;   // E4
  cells[3][8] = true;   // G4
  cells[0][12] = true;  // C5
  // Per-step automation lanes. `<param>[col]` is a value to apply to that
  // param when the step plays, or null for "no automation point". The UI
  // shows one lane at a time (see sequencerUI.js AUTO_PARAMS).
  const automation = {
    cutoff: Array(PATTERN_STEPS).fill(null),
    resonance: Array(PATTERN_STEPS).fill(null),
    volume: Array(PATTERN_STEPS).fill(null),
  };
  // Drum lanes (F5 lean step): three fixed synthesized voices, independent of
  // the pitch grid. A four-on-the-floor starter beat so hitting the Sequencer
  // tab makes a groove immediately.
  const drums = {
    kick: Array(PATTERN_STEPS).fill(false),
    snare: Array(PATTERN_STEPS).fill(false),
    hat: Array(PATTERN_STEPS).fill(false),
  };
  [0, 4, 8, 12].forEach(i => { drums.kick[i] = true; });
  [4, 12].forEach(i => { drums.snare[i] = true; });
  for (let i = 0; i < PATTERN_STEPS; i += 2) drums.hat[i] = true;
  return { length: 16, swing: 0, baseOctave: 4, cells, automation, drums };
}

function createProject() {
  return {
    version: 1,
    transport: {
      bpm: 120,
      timeSig: [4, 4],
      playing: false,
      metronome: true,
      countIn: false,
      loop: { enabled: false, startBar: 0, endBar: 4 },
      position: { bar: 0, beat: 0, sixteenth: 0 },
    },
    tracks: [
      {
        id: 't1',
        name: 'Synth',
        instrument: { type: 'synth', params: defaultParams() },
        fx: [],
        clips: [],
        pattern: defaultPattern(),
        mixer: { gain: 1, pan: 0, mute: false, solo: false },
      },
    ],
    activeTrackId: 't1',
  };
}

const _project = createProject();
const _subs = new Set();
let _history = [];
let _future = [];
let _lastKey = null;
let _lastTs = 0;

function activeTrack() {
  return _project.tracks.find(t => t.id === _project.activeTrackId) || _project.tracks[0];
}

function snapshot() {
  return JSON.parse(JSON.stringify(_project));
}

// Apply a plain snapshot onto the live tree IN PLACE, preserving object identity
// of the leaves other modules hold (notably each track's instrument.params / S).
function applyState(state) {
  const t = _project.transport;
  Object.assign(t, {
    bpm: state.transport.bpm,
    timeSig: [...state.transport.timeSig],
    playing: state.transport.playing,
    metronome: state.transport.metronome ?? t.metronome,
    countIn: state.transport.countIn ?? t.countIn,
  });
  Object.assign(t.loop, state.transport.loop);
  Object.assign(t.position, state.transport.position);
  _project.activeTrackId = state.activeTrackId;
  _project.version = state.version;

  state.tracks.forEach((ts, i) => {
    const track = _project.tracks[i];
    if (!track) return;            // multi-track reconciliation is later (E4)
    track.name = ts.name;
    track.instrument.type = ts.instrument.type;
    Object.assign(track.instrument.params, ts.instrument.params); // preserves S ref
    Object.assign(track.mixer, ts.mixer);
    track.fx = ts.fx;
    track.clips = ts.clips;
    if (ts.pattern && track.pattern) {       // mutate in place; guard older saves
      track.pattern.length = ts.pattern.length;
      track.pattern.swing = ts.pattern.swing;
      track.pattern.baseOctave = ts.pattern.baseOctave ?? track.pattern.baseOctave;
      track.pattern.cells = ts.pattern.cells.map(row => [...row]);
      track.pattern.drums = ts.pattern.drums
        ? { kick: [...ts.pattern.drums.kick], snare: [...ts.pattern.drums.snare], hat: [...ts.pattern.drums.hat] }
        : track.pattern.drums;
      track.pattern.automation = ts.pattern.automation
        ? Object.fromEntries(Object.entries(ts.pattern.automation).map(([k, arr]) => [k, [...arr]]))
        : track.pattern.automation;
    }
  });
}

function notify(change) {
  for (const fn of _subs) fn(change);
}

function pushHistory() {
  _history.push(snapshot());
  if (_history.length > MAX_HISTORY) _history.shift();
}

function getByPath(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), _project);
}
function setByPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], _project);
  target[last] = value;
}

// Record history for an edit, coalescing a run of writes to the same key.
function recordEdit(key) {
  const now = Date.now();
  const coalesce = key === _lastKey && (now - _lastTs) < COALESCE_MS;
  if (!coalesce) pushHistory();
  _lastKey = key;
  _lastTs = now;
  _future = []; // a fresh edit invalidates the redo stack
}

export const store = {
  /** The live project tree (read-only by convention). */
  get() { return _project; },

  /** The active instrument's params object — identical to `S`. */
  params() { return activeTrack().instrument.params; },

  /** The active track's step-sequencer pattern. */
  pattern() { return activeTrack().pattern; },

  /** Index of the active track in the tracks array (for building setPath paths). */
  activeTrackIndex() { return _project.tracks.indexOf(activeTrack()); },

  /** Write an active-instrument param (records history + notifies). No-op if unchanged. */
  set(key, value) {
    const params = this.params();
    if (params[key] === value) return;
    recordEdit('param:' + key);
    params[key] = value;
    notify({ path: key, value });
  },

  /** Write any path in the tree, e.g. 'transport.bpm' or 'tracks.0.mixer.gain'. */
  setPath(path, value) {
    if (getByPath(path) === value) return;
    recordEdit(path);
    setByPath(path, value);
    notify({ path, value });
  },

  /**
   * Write a path WITHOUT recording history — for transient playback state
   * (transport.playing, position) that should never be undoable.
   */
  setTransient(path, value) {
    if (getByPath(path) === value) return;
    setByPath(path, value);
    notify({ path, value });
  },

  /** Subscribe to committed changes: fn({ path, value }). Returns an unsubscribe fn. */
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },

  /** Whether undo()/redo() would currently do anything — for UI enabled state. */
  canUndo() { return _history.length > 0; },
  canRedo() { return _future.length > 0; },

  /** Serialize the whole project to JSON. */
  serialize() { return JSON.stringify(_project); },

  /** Parse + apply a serialized project IN PLACE. Returns true on success. */
  load(json) {
    let parsed;
    try { parsed = typeof json === 'string' ? JSON.parse(json) : json; }
    catch { return false; }
    if (!parsed || !parsed.transport || !Array.isArray(parsed.tracks) ||
        !parsed.tracks[0]?.instrument?.params) return false;
    pushHistory();
    applyState(parsed);
    _lastKey = null;
    _future = [];
    notify({ path: '*', value: undefined });
    return true;
  },

  /** Restore the previous committed state. Returns true if something was undone. */
  undo() {
    if (!_history.length) return false;
    _future.push(snapshot());
    applyState(_history.pop());
    _lastKey = null;
    notify({ path: '*', value: undefined });
    return true;
  },

  /** Re-apply an undone state. Returns true if something was redone. */
  redo() {
    if (!_future.length) return false;
    _history.push(snapshot());
    applyState(_future.pop());
    _lastKey = null;
    notify({ path: '*', value: undefined });
    return true;
  },

  /** Reset to defaults (in place) and clear history. */
  reset() {
    pushHistory();
    applyState(createProject());
    _lastKey = null;
    _future = [];
    notify({ path: '*', value: undefined });
  },

  /** Test-only: clear history/subscribers and restore defaults. */
  _resetForTest() {
    applyState(createProject());
    _history = []; _future = []; _subs.clear();
    _lastKey = null; _lastTs = 0;
  },
};
