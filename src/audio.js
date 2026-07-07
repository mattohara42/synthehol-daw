// Web Audio engine: builds the signal chain and exposes note on/off.
//
// Signal chain (fully polyphonic, multi-track — E4 steps 3–5): each track
// gets its own instrument chain — voices → vcf → trackGain (mixer.gain ×
// mute/solo) → pan (mixer.pan, L10) — summed at a shared mixBus, then
// drive → eq → master → scope → speakers. Modulation: each track's own
// lfoOsc → lfoMod (depth) → {that track's vcf.frequency | each voice's own
// osc.detune/amp.gain, connected in voices.js}.
//
// engine.active() resolves whichever track is currently active (store.get().
// activeTrackId) — every existing call site that used to read engine.vcf/
// voices/lfoMod/etc. directly now goes through engine.active().vcf/etc.,
// so turning a knob always affects whichever track the rack is showing,
// exactly as before. It's a live lookup, not a cached alias, so there's
// nothing to "re-home" when the active track changes (unlike state.js's S,
// which is a fixed object reference — see store.js's rehomeSParamsRef()
// comment for why that one needs special handling and this doesn't).
//
// Filter envelope and LFO key-sync retrigger remain exclusively live-input
// (keyboard.js/midi.js via chordState.js) concerns, always targeting the
// active track — the scheduler consumers (sequencer/piano-roll) never
// triggered them even before multi-track existed, so no per-track chord
// state is needed for scheduled playback.

import { S } from './state.js';
import { store } from './store.js';
import { noteFreq } from './notes.js';
import { setStatus } from './ui.js';
import { createVoiceManager } from './voices.js';

export const engine = {
  ctx: null,
  // Shared downstream chain: every track's output sums at mixBus, then
  // drive/EQ/FX/master are one instance shared by the whole mix (see the
  // multitrack-mixer-requirements doc's scope boundary — full per-track FX
  // inserts are a later step, not this one).
  mixBus: null,
  drive: null,
  eqLow: null, eqMid: null, eqHigh: null,
  master: null,
  scope: null,
  delay: null, delayFb: null, delayWet: null,
  reverb: null, reverbWet: null,
  chorusDelay: null, chorusWet: null,
  streamDest: null,
  tapEq: null,       // post-EQ, pre-master — shared, downstream of every track
  noteOn: false,
  currentNote: null,

  // Per-track engines, keyed by track id: { vcf, voiceBus, tapSource,
  // tapFilter, voices, lfoOsc, lfoMod, lfoShSource, lfoShNextStep,
  // trackGain, pan, tapOut }. `tapOut` sits after trackGain/pan (post-
  // fader) so a muted/soloed-out track's meter correctly reads silent —
  // see mixerUI.js (L10). Built/torn down by reconcileTrackEngines() as
  // store.tracks() changes (add/remove/undo/redo/load all flow through
  // the one store.subscribe() below).
  tracks: new Map(),

  /** The active track's engine, or null before audio has started. */
  active() {
    return engine.tracks.get(store.get().activeTrackId) ?? null;
  },
};

// Build a synthetic impulse response for the convolver reverb: exponentially
// decaying stereo white noise. Generated in code so no external asset is needed
// (the page's CSP forbids loading one). Exported for testing.
export function makeImpulse(ctx, seconds = 2, decay = 2.5) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// WaveShaper transfer curve for the Drive (saturation) stage. `amount` 0..1.
// At 0 we return null — a null curve is true bypass (clean). Above 0, a tanh
// soft-clip, normalized so the peak stays near unity (drive adds harmonics and
// loudness, not runaway gain).
export function makeDriveCurve(amount) {
  if (amount <= 0) return null;
  const k = 1 + amount * 12;          // 1..13 of drive
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * k) / norm;
  }
  return curve;
}

function trackParams(trackId) {
  return store.tracks().find(t => t.id === trackId)?.instrument.params;
}

function trackMixer(trackId) {
  return store.tracks().find(t => t.id === trackId)?.mixer;
}

function lfoDepthScaledFor(params) {
  const d = params.lfoDepth; // 0–1
  switch (params.lfoDest) {
    case 'filter': return d * 8000;   // ±8kHz sweep
    case 'pitch':  return d * 1200;   // ±12 semitones in cents
    case 'amp':    return d * 0.8;    // ±0.8 amplitude
    default: return 0;
  }
}

/** Depth scaling for the ACTIVE track's LFO — used by controls.js's depth slider. */
export function lfoDepthScaled() {
  return lfoDepthScaledFor(S);
}

// Connect whichever LFO source matches `params.lfoWaveform` into `te.lfoMod`:
// the continuous oscillator for the four native waveforms, or the Sample &
// Hold ConstantSourceNode (D1 bonus challenge unlock) — mutually exclusive.
function connectLFOSource(te, params) {
  try { te.lfoOsc.disconnect(te.lfoMod); } catch (e) {}
  try { te.lfoShSource.disconnect(te.lfoMod); } catch (e) {}
  if (params.lfoWaveform === 'sampleHold') {
    te.lfoShSource.connect(te.lfoMod);
    te.lfoShNextStep = 0;
  } else {
    te.lfoOsc.type = params.lfoWaveform;
    te.lfoOsc.connect(te.lfoMod);
  }
}

// Only the filter destination needs a connection here — LFO→Pitch/Amp
// connects straight to each polyphonic voice's own oscillator/gain at build
// time (see voices.js), since there's no single mono osc/ampEnv to route to.
function connectLFORouting(te, params) {
  try { te.lfoMod.disconnect(te.vcf.frequency); } catch (e) {}
  if (params.lfoDest === 'filter') te.lfoMod.connect(te.vcf.frequency);
  te.lfoMod.gain.value = lfoDepthScaledFor(params);
}

// Build one track's instrument chain: its own voice pool, filter, and LFO,
// landing on a per-track gain node (mixer.gain × mute) that feeds the
// shared mixBus. Returns the new track engine, or null if the track
// vanished before this ran (a race with removal — reconcileTrackEngines
// cleans up either way).
function buildTrackEngine(trackId) {
  const ctx = engine.ctx;
  const params = trackParams(trackId);
  if (!params) return null;

  const vcf = ctx.createBiquadFilter();
  vcf.type = params.filterType;
  vcf.frequency.value = params.cutoff;
  vcf.Q.value = params.resonance;

  const voiceBus = ctx.createGain();
  const tapSource = ctx.createAnalyser();
  const tapFilter = ctx.createAnalyser();
  tapSource.fftSize = 256;
  tapFilter.fftSize = 256;

  const lfoOsc = ctx.createOscillator();
  const lfoMod = ctx.createGain();
  const lfoShSource = ctx.createConstantSource();
  lfoShSource.offset.value = 0;
  lfoShSource.start();
  lfoOsc.frequency.value = params.lfoRate;

  const trackGain = ctx.createGain();
  trackGain.gain.value = trackMixGain(trackId);

  // Post-fader pan (L10) and a post-fader meter tap — positioned after
  // trackGain so a muted/soloed-out track correctly reads silent on the
  // meter, rather than showing the pre-mute signal.
  const pan = ctx.createStereoPanner();
  pan.pan.value = trackMixer(trackId)?.pan ?? 0;
  const tapOut = ctx.createAnalyser();
  tapOut.fftSize = 256;

  voiceBus.connect(tapSource);
  voiceBus.connect(vcf);
  vcf.connect(tapFilter);
  vcf.connect(trackGain);
  trackGain.connect(pan);
  pan.connect(tapOut);
  pan.connect(engine.mixBus);

  const te = { vcf, voiceBus, tapSource, tapFilter, lfoOsc, lfoMod, lfoShSource, lfoShNextStep: 0, trackGain, pan, tapOut, voices: null };
  engine.tracks.set(trackId, te);

  te.voices = createVoiceManager({
    ctx, output: voiceBus, getParams: () => trackParams(trackId) ?? params, maxVoices: 16, lfoMod,
  });

  connectLFOSource(te, params);
  connectLFORouting(te, params);
  lfoOsc.start();

  return te;
}

function destroyTrackEngine(trackId) {
  const te = engine.tracks.get(trackId);
  if (!te) return;
  te.voices.releaseAll(engine.ctx.currentTime);
  try { te.lfoOsc.stop(); } catch (e) {}
  try { te.lfoShSource.stop(); } catch (e) {}
  te.vcf.disconnect();
  te.voiceBus.disconnect();
  te.tapSource.disconnect();
  te.tapFilter.disconnect();
  te.trackGain.disconnect();
  te.lfoMod.disconnect();
  te.pan.disconnect();
  te.tapOut.disconnect();
  engine.tracks.delete(trackId);
}

// mixer.mute always wins; otherwise if ANY track is soloed, only soloed
// tracks are audible (standard mixer convention) — L10's channel strips
// are the first reachable UI for solo, so it's finally worth reading here.
export function trackMixGain(trackId) {
  const tracks = store.tracks();
  const track = tracks.find(t => t.id === trackId);
  if (!track) return 1;
  if (track.mixer.mute) return 0;
  const anySoloed = tracks.some(t => t.mixer.solo);
  if (anySoloed && !track.mixer.solo) return 0;
  return track.mixer.gain;
}

// Keep engine.tracks in sync with store.tracks() — runs on every store
// change (add/remove/undo/redo/load all flow through here alike) so no
// caller needs to remember to reconcile manually. Also refreshes every
// track's mix gain and pan in case mixer.gain/mute/solo/pan changed.
function reconcileTrackEngines() {
  if (!engine.ctx) return;
  const liveTracks = store.tracks();
  const liveIds = new Set(liveTracks.map(t => t.id));
  for (const id of [...engine.tracks.keys()]) {
    if (!liveIds.has(id)) destroyTrackEngine(id);
  }
  for (const track of liveTracks) {
    const te = engine.tracks.has(track.id) ? engine.tracks.get(track.id) : buildTrackEngine(track.id);
    if (!te) continue;
    te.trackGain.gain.setTargetAtTime(trackMixGain(track.id), engine.ctx.currentTime, 0.01);
    te.pan.pan.setTargetAtTime(track.mixer.pan, engine.ctx.currentTime, 0.01);
  }
}

export function startAudio() {
  if (engine.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  engine.ctx = ctx;

  const mixBus = ctx.createGain();
  const drive = ctx.createWaveShaper();
  drive.oversample = '4x';
  // 3-band EQ: low shelf, mid peak, high shelf — chained after drive.
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 250;
  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1200;
  eqMid.Q.value = 1;
  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 4500;
  const master = ctx.createGain();
  const scope = ctx.createAnalyser();
  const delay = ctx.createDelay(1.0);
  const delayFb = ctx.createGain();
  const delayWet = ctx.createGain();
  const reverb = ctx.createConvolver();
  const reverbWet = ctx.createGain();
  // Chorus (D1 bonus challenge unlock): a short delay whose time is swept by
  // its own dedicated, fixed-rate LFO — deliberately not any track's own
  // lfoRate/Depth LFO, which is already spoken for by filter/pitch/amp.
  // Single-knob like Reverb Mix (rate/depth aren't exposed) — the effect is
  // the reward, not another thing to tune. Shared, not per-track, like the
  // rest of the FX rack (see the scope boundary in the E4 doc).
  const chorusLfo = ctx.createOscillator();
  const chorusLfoGain = ctx.createGain();
  const chorusDelay = ctx.createDelay(0.05);
  const chorusWet = ctx.createGain();

  engine.mixBus = mixBus;
  engine.drive = drive;
  engine.eqLow = eqLow;
  engine.eqMid = eqMid;
  engine.eqHigh = eqHigh;
  engine.master = master;
  engine.scope = scope;
  engine.delay = delay;
  engine.delayFb = delayFb;
  engine.delayWet = delayWet;
  engine.reverb = reverb;
  engine.reverbWet = reverbWet;
  engine.chorusDelay = chorusDelay;
  engine.chorusWet = chorusWet;

  // Config
  master.gain.value = S.masterVol;
  drive.curve = makeDriveCurve(S.drive);
  eqLow.gain.value = S.eqLow;
  eqMid.gain.value = S.eqMid;
  eqHigh.gain.value = S.eqHigh;
  scope.fftSize = 2048;
  scope.smoothingTimeConstant = 0.8;

  delay.delayTime.value = S.delayTime;
  delayFb.gain.value = S.delayFeedback;
  delayWet.gain.value = S.delayMix;
  reverb.buffer = makeImpulse(ctx);
  reverbWet.gain.value = S.reverbMix;

  chorusLfo.type = 'sine';
  chorusLfo.frequency.value = 0.8;      // Hz — classic slow chorus sweep
  chorusLfoGain.gain.value = 0.0025;    // seconds of delay-time swing (±2.5ms)
  chorusDelay.delayTime.value = 0.015;  // base 15ms delay, swept by the LFO above
  chorusWet.gain.value = S.chorusMix;

  const tapEq = ctx.createAnalyser();
  tapEq.fftSize = 256;
  engine.tapEq = tapEq;

  // Shared downstream chain: every track's trackGain sums here.
  mixBus.connect(drive);
  drive.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(tapEq);                 // parallel tap
  eqHigh.connect(master);
  master.connect(scope);                 // dry

  master.connect(delay);                  // delay send
  delay.connect(delayFb);
  delayFb.connect(delay);                 // feedback loop
  delay.connect(delayWet);
  delayWet.connect(scope);

  master.connect(reverb);                 // reverb send
  reverb.connect(reverbWet);
  reverbWet.connect(scope);

  master.connect(chorusDelay);            // chorus send
  chorusLfo.connect(chorusLfoGain);
  chorusLfoGain.connect(chorusDelay.delayTime); // modulates delay time around its base value
  chorusDelay.connect(chorusWet);
  chorusWet.connect(scope);
  chorusLfo.start();

  scope.connect(ctx.destination);

  // Recording tap: the same post-FX signal the speakers get, branched to a
  // MediaStream so the exporter can capture exactly what the user hears.
  const streamDest = ctx.createMediaStreamDestination();
  engine.streamDest = streamDest;
  scope.connect(streamDest);

  // Build a track engine for every track that already exists (e.g. restored
  // from persistence before the first user gesture), then keep them in sync
  // with the store from here on.
  for (const track of store.tracks()) buildTrackEngine(track.id);
  store.subscribe(reconcileTrackEngines);

  setStatus('Active', true);
}

// Key-sync retrigger: recreate the LFO oscillator so its phase resets to 0 at
// note-on. OscillatorNode has no in-place phase reset (start/stop each fire
// once), so a fresh node is swapped into the active track's engine. For
// Sample & Hold (no phase to reset), "retrigger" instead means sampling a
// fresh random value right now and restarting its step clock from `time`.
// Always the active track — this is a live-keyboard/MIDI concern (see
// chordState.js), which only ever plays the active track.
export function restartLfoOsc(time) {
  const active = engine.active();
  if (!active) return;
  if (S.lfoWaveform === 'sampleHold') {
    active.lfoShSource.offset.setValueAtTime(Math.random() * 2 - 1, time);
    active.lfoShNextStep = time + 1 / Math.max(0.1, S.lfoRate);
    return;
  }
  try { active.lfoOsc.stop(time); } catch (e) {}
  const fresh = engine.ctx.createOscillator();
  fresh.type = S.lfoWaveform;
  fresh.frequency.setValueAtTime(S.lfoRate, time);
  fresh.connect(active.lfoMod);
  fresh.start(time);
  active.lfoOsc = fresh;
}

// Called whenever S.lfoWaveform changes (see controls.js) as well as at
// track-build time — always the active track for this exported form.
export function applyLFOWaveform() {
  const active = engine.active();
  if (active) connectLFOSource(active, S);
}

// Per-frame driver for the Sample & Hold LFO shape (main.js's rAF loop,
// E8). Ticks EVERY track with an active S&H LFO, not just the active one —
// a background track playing via the scheduler still needs its own
// stepped-random source advancing regardless of which track the rack shows.
export function tickSampleHold() {
  if (!engine.ctx) return;
  const now = engine.ctx.currentTime;
  for (const track of store.tracks()) {
    const te = engine.tracks.get(track.id);
    if (!te) continue;
    const params = track.instrument.params;
    if (params.lfoWaveform !== 'sampleHold') continue;
    if (now < te.lfoShNextStep) continue;
    te.lfoShSource.offset.setValueAtTime(Math.random() * 2 - 1, now);
    te.lfoShNextStep = now + 1 / Math.max(0.1, params.lfoRate);
  }
}

// Called whenever S.lfoDest changes (see controls.js) — always the active
// track for this exported form.
export function applyLFORouting() {
  const active = engine.active();
  if (active) connectLFORouting(active, S);
}

// ─── Polyphonic path (E3, multi-track since E4 step 3) ───
// Every note — live keyboard, scheduler/sequencer (L6), drums — goes through
// here. `trackId` defaults to whichever track is active (the live keyboard
// and MIDI always play the active track); the scheduler consumers pass an
// explicit trackId per track so each one plays through its own engine.

/** Start a polyphonic voice for `note`/`octave` at `time` on `trackId` (default: active). Returns a voice id. */
export function voiceNoteOn(note, octave, time, velocity = 1, trackId) {
  startAudio();
  const te = trackId ? engine.tracks.get(trackId) : engine.active();
  return te ? te.voices.noteOn(noteFreq(note, octave), time, velocity) : null;
}

/** Release the polyphonic voice with `id` at `time` on `trackId` (default: active). */
export function voiceNoteOff(id, time, trackId) {
  const te = trackId ? engine.tracks.get(trackId) : engine.active();
  te?.voices.noteOff(id, time);
}

/** Release every polyphonic voice on every track (transport stop / panic), or just `trackId` if given. */
export function releaseAllVoices(time, trackId) {
  const now = time ?? (engine.ctx ? engine.ctx.currentTime : 0);
  if (trackId) { engine.tracks.get(trackId)?.voices.releaseAll(now); return; }
  for (const te of engine.tracks.values()) te.voices.releaseAll(now);
}

// ─── Reference-patch preview (B15) ───
// A one-off voice pool, entirely separate from the live keyboard/S, so a boss
// can play a short demo of a target patch (e.g. the match-the-sound capstone)
// without touching anything the player has dialed in. Bypasses every track's
// own filter (that's the player's own sound) and goes straight to the master
// bus, shared across all tracks.
let previewVoices = null;
// The manager is built once and reused (cheap optimization), but its
// getParams() closure must read this mutable ref rather than closing over
// whichever `patch` happened to be passed on the very first call — otherwise
// every later previewPatch() call with a different patch (e.g. the Practice
// tab's "Hear Target" across rounds) would keep playing the first one.
let currentPreviewPatch = null;

/** Play a short demo note using `patch`'s params instead of the live S. */
export function previewPatch(patch, note = 'C', octave = 4, duration = 0.8) {
  startAudio();
  currentPreviewPatch = patch;
  if (!previewVoices) {
    previewVoices = createVoiceManager({
      ctx: engine.ctx,
      output: engine.master,
      getParams: () => currentPreviewPatch,
      maxVoices: 1,
    });
  }
  const now = engine.ctx.currentTime;
  const id = previewVoices.noteOn(noteFreq(note, octave), now, 0.9);
  previewVoices.noteOff(id, now + duration);
}

// Sweeps the active track's filter cutoff per note, reusing the amp ADSR's
// attack/decay times. Only active when filterEnvAmount > 0; otherwise the
// cutoff slider keeps sole control (preserving the original behavior). Known
// v1 limitation: dragging the cutoff slider mid-note while this schedule is
// live will fight the schedule. Exported so the polyphonic keyboard path
// (which shares one filter per track across every voice) can trigger it once
// per chord onset — see keyboard.js. Always the active track (see
// restartLfoOsc's comment — this is a live-input concern).
export function applyFilterEnv(now) {
  const active = engine.active();
  if (!active || S.filterEnvAmount <= 0) return;
  const { vcf } = active;
  const NYQUIST = 20000;
  const peak    = Math.min(NYQUIST, S.cutoff * 2 ** S.filterEnvAmount);
  const sustain = Math.min(NYQUIST, S.cutoff * 2 ** (S.filterEnvAmount * S.sustain));

  vcf.frequency.cancelScheduledValues(now);
  vcf.frequency.setValueAtTime(S.cutoff, now);
  vcf.frequency.linearRampToValueAtTime(peak, now + S.attack);
  vcf.frequency.linearRampToValueAtTime(sustain, now + S.attack + S.decay);
}

// The release half of the filter envelope: ramp the active track's cutoff
// back to its base setting. Split out of noteOffAt so the polyphonic
// keyboard path can call it once per chord release too (see keyboard.js).
export function releaseFilterEnv(time) {
  const active = engine.active();
  if (!active || S.filterEnvAmount <= 0) return;
  const { vcf } = active;
  vcf.frequency.cancelScheduledValues(time);
  vcf.frequency.setValueAtTime(vcf.frequency.value, time);
  vcf.frequency.linearRampToValueAtTime(S.cutoff, time + S.release);
}
