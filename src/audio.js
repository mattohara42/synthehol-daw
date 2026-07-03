// Web Audio engine: builds the signal chain and exposes note on/off.
//
// Signal chain: voices (E3, per-note osc/amp) → vcf (VCF) → drive → eq →
//   master → scope → speakers
// Modulation:   lfoOsc → lfoMod (depth) → {vcf.frequency shared |
//   each voice's own osc.detune/amp.gain, connected in voices.js}

import { S } from './state.js';
import { noteFreq } from './notes.js';
import { setStatus } from './ui.js';
import { createVoiceManager } from './voices.js';

export const engine = {
  ctx: null,
  vcf: null,
  master: null,
  scope: null,
  lfoOsc: null,
  lfoMod: null,
  lfoShSource: null,  // ConstantSourceNode driving the Sample & Hold LFO shape
  lfoShNextStep: 0,   // ctx.currentTime of the next S&H random step
  delay: null,
  delayFb: null,
  delayWet: null,
  reverb: null,
  reverbWet: null,
  chorusDelay: null,  // D1 bonus challenge unlock — see the chorus block in startAudio()
  chorusWet: null,
  voices: null,    // polyphonic voice manager (E3); set in startAudio
  noteOn: false,
  currentNote: null,
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

export function startAudio() {
  if (engine.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  engine.ctx = ctx;

  const vcf = ctx.createBiquadFilter();
  const master = ctx.createGain();
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
  const scope = ctx.createAnalyser();
  const lfoOsc = ctx.createOscillator();
  const lfoMod = ctx.createGain();
  // Sample & Hold's source (D1 bonus challenge unlock): a ConstantSourceNode
  // whose .offset gets stepped by scheduled setValueAtTime calls in
  // tickSampleHold(), rather than a continuously running waveform — there's
  // no native OscillatorType for stepped random values. Always exists; only
  // fed into lfoMod when it's the active shape (see applyLFOWaveform()).
  const lfoShSource = ctx.createConstantSource();
  const delay = ctx.createDelay(1.0);
  const delayFb = ctx.createGain();
  const delayWet = ctx.createGain();
  const reverb = ctx.createConvolver();
  const reverbWet = ctx.createGain();
  // Chorus (D1 bonus challenge unlock): a short delay whose time is swept by
  // its own dedicated, fixed-rate LFO — deliberately not the player's
  // S.lfoRate/Depth LFO, which is already spoken for by filter/pitch/amp.
  // Single-knob like Reverb Mix (rate/depth aren't exposed) — the effect is
  // the reward, not another thing to tune.
  const chorusLfo = ctx.createOscillator();
  const chorusLfoGain = ctx.createGain();
  const chorusDelay = ctx.createDelay(0.05);
  const chorusWet = ctx.createGain();

  engine.vcf = vcf;
  engine.master = master;
  engine.drive = drive;
  engine.eqLow = eqLow;
  engine.eqMid = eqMid;
  engine.eqHigh = eqHigh;
  engine.scope = scope;
  engine.lfoOsc = lfoOsc;
  engine.lfoMod = lfoMod;
  engine.lfoShSource = lfoShSource;
  engine.delay = delay;
  engine.delayFb = delayFb;
  engine.delayWet = delayWet;
  engine.reverb = reverb;
  engine.reverbWet = reverbWet;
  engine.chorusDelay = chorusDelay;
  engine.chorusWet = chorusWet;

  // Config
  vcf.type = S.filterType;
  vcf.frequency.value = S.cutoff;
  vcf.Q.value = S.resonance;
  master.gain.value = S.masterVol;
  drive.curve = makeDriveCurve(S.drive);
  eqLow.gain.value = S.eqLow;
  eqMid.gain.value = S.eqMid;
  eqHigh.gain.value = S.eqHigh;
  scope.fftSize = 2048;
  scope.smoothingTimeConstant = 0.8;
  // lfoOsc.type is set below by applyLFOWaveform() (guarded — S.lfoWaveform
  // may be 'sampleHold', which isn't a valid OscillatorType).
  lfoOsc.frequency.value = S.lfoRate;
  lfoMod.gain.value = lfoDepthScaled();

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

  // Signal-flow taps (D3): small analysers at three points along the chain so
  // the rack modules can glow as audio passes through them (signalFlow.js).
  // tapSource needs a real bus node (voices sum into it, it feeds the filter);
  // the other two are parallel taps, no graph change.
  const voiceBus = ctx.createGain();
  const tapSource = ctx.createAnalyser();
  const tapFilter = ctx.createAnalyser();
  const tapEq = ctx.createAnalyser();
  for (const t of [tapSource, tapFilter, tapEq]) t.fftSize = 256;
  voiceBus.connect(tapSource);
  engine.voiceBus = voiceBus;
  engine.tapSource = tapSource;
  engine.tapFilter = tapFilter;
  engine.tapEq = tapEq;

  // Signal chain: polyphonic voices (E3, below) feed the filter input; master
  // fans out to a dry path plus delay and reverb sends, all summed back at
  // the scope so the visualizers show the wet signal too.
  voiceBus.connect(vcf);
  vcf.connect(tapFilter);                // parallel tap
  vcf.connect(drive);
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

  // LFO chain
  lfoShSource.offset.value = 0;
  lfoShSource.start();
  applyLFOWaveform();  // connects whichever source (oscillator or S&H) matches S.lfoWaveform
  applyLFORouting();

  // Polyphonic voice pool (E3) — every note (live keyboard, scheduler,
  // drums) goes through here, summed into the filter input. lfoMod lets
  // LFO→Pitch/Amp reach each voice's own oscillator/gain (see voices.js).
  engine.voices = createVoiceManager({
    ctx,
    output: voiceBus,
    getParams: () => S,
    maxVoices: 16,
    lfoMod,
  });

  lfoOsc.start();

  setStatus('Active', true);
}

export function lfoDepthScaled() {
  const d = S.lfoDepth; // 0–1
  switch (S.lfoDest) {
    case 'filter': return d * 8000;   // ±8kHz sweep
    case 'pitch':  return d * 1200;   // ±12 semitones in cents
    case 'amp':    return d * 0.8;    // ±0.8 amplitude
    default: return 0;
  }
}

// Key-sync retrigger: recreate the LFO oscillator so its phase resets to 0 at
// note-on. OscillatorNode has no in-place phase reset (start/stop each fire
// once), so a fresh node is swapped into engine.lfoOsc. For Sample & Hold
// (no phase to reset), "retrigger" instead means sampling a fresh random
// value right now and restarting its step clock from `time`.
export function restartLfoOsc(time) {
  const { ctx, lfoOsc, lfoMod, lfoShSource } = engine;
  if (!ctx) return;
  if (S.lfoWaveform === 'sampleHold') {
    if (!lfoShSource) return;
    lfoShSource.offset.setValueAtTime(Math.random() * 2 - 1, time);
    engine.lfoShNextStep = time + 1 / Math.max(0.1, S.lfoRate);
    return;
  }
  if (!lfoOsc) return;
  try { lfoOsc.stop(time); } catch (e) {}
  const fresh = ctx.createOscillator();
  fresh.type = S.lfoWaveform;
  fresh.frequency.setValueAtTime(S.lfoRate, time);
  fresh.connect(lfoMod);
  fresh.start(time);
  engine.lfoOsc = fresh;
}

// Swap which source feeds lfoMod: the continuous oscillator for the four
// native waveforms, or the Sample & Hold ConstantSourceNode (D1 bonus
// challenge unlock) — mutually exclusive, so exactly one is connected at a
// time. Call whenever S.lfoWaveform changes (see controls.js) as well as at
// startup. Resets the S&H step clock so switching in fires a fresh sample
// immediately rather than waiting out whatever period was already in progress.
export function applyLFOWaveform() {
  const { ctx, lfoOsc, lfoShSource, lfoMod } = engine;
  if (!ctx) return;
  try { lfoOsc.disconnect(lfoMod); } catch (e) {}
  try { lfoShSource.disconnect(lfoMod); } catch (e) {}
  if (S.lfoWaveform === 'sampleHold') {
    lfoShSource.connect(lfoMod);
    engine.lfoShNextStep = 0;
  } else {
    lfoOsc.type = S.lfoWaveform;
    lfoOsc.connect(lfoMod);
  }
}

// Per-frame driver for the Sample & Hold LFO shape: steps engine.lfoShSource
// to a fresh random value once per LFO cycle. Called from main.js's single
// rAF dispatcher (E8) — a no-op unless S&H is the active shape, so it costs
// nothing for every other player. Not part of the transport scheduler: this
// is LFO-rate (Hz) timing, independent of tempo.
export function tickSampleHold() {
  const { ctx, lfoShSource } = engine;
  if (!ctx || !lfoShSource || S.lfoWaveform !== 'sampleHold') return;
  const now = ctx.currentTime;
  if (now < engine.lfoShNextStep) return;
  lfoShSource.offset.setValueAtTime(Math.random() * 2 - 1, now);
  engine.lfoShNextStep = now + 1 / Math.max(0.1, S.lfoRate);
}

// Only the filter destination lives here — LFO→Pitch/Amp connects straight to
// each polyphonic voice's own oscillator/gain at build time (see voices.js),
// since there's no single mono osc/ampEnv to route to anymore. Disconnecting
// only the filter target (not a blanket disconnect()) means switching
// lfoDest never severs another voice's live pitch/amp connection.
export function applyLFORouting() {
  const { ctx, lfoMod, vcf } = engine;
  if (!ctx) return;
  try { lfoMod.disconnect(vcf.frequency); } catch (e) {}
  if (S.lfoDest === 'filter') lfoMod.connect(vcf.frequency);
  lfoMod.gain.value = lfoDepthScaled();
}

// ─── Polyphonic path (E3) ───
// Every note — live keyboard, scheduler/sequencer (L6), drums — goes through
// here now. Each call allocates its own voice, so simultaneous notes (chords,
// overlapping sequencer steps) coexist.

/** Start a polyphonic voice for `note`/`octave` at `time`. Returns a voice id. */
export function voiceNoteOn(note, octave, time, velocity = 1) {
  startAudio();
  return engine.voices.noteOn(noteFreq(note, octave), time, velocity);
}

/** Release the polyphonic voice with `id` at `time`. */
export function voiceNoteOff(id, time) {
  engine.voices?.noteOff(id, time);
}

/** Release every polyphonic voice (transport stop / panic). */
export function releaseAllVoices(time) {
  engine.voices?.releaseAll(time ?? (engine.ctx ? engine.ctx.currentTime : 0));
}

// ─── Reference-patch preview (B15) ───
// A one-off voice pool, entirely separate from the live keyboard/S, so a boss
// can play a short demo of a target patch (e.g. the match-the-sound capstone)
// without touching anything the player has dialed in. Bypasses the shared vcf
// (that's the player's own filter) and goes straight to the master bus.
let previewVoices = null;

/** Play a short demo note using `patch`'s params instead of the live S. */
export function previewPatch(patch, note = 'C', octave = 4, duration = 0.8) {
  startAudio();
  if (!previewVoices) {
    previewVoices = createVoiceManager({
      ctx: engine.ctx,
      output: engine.master,
      getParams: () => patch,
      maxVoices: 1,
    });
  }
  const now = engine.ctx.currentTime;
  const id = previewVoices.noteOn(noteFreq(note, octave), now, 0.9);
  previewVoices.noteOff(id, now + duration);
}

// Sweeps the filter cutoff per note, reusing the amp ADSR's attack/decay times.
// Only active when filterEnvAmount > 0; otherwise the cutoff slider keeps sole
// control (preserving the original behavior). Known v1 limitation: dragging the
// cutoff slider mid-note while this schedule is live will fight the schedule.
// Exported so the polyphonic keyboard path (which shares this one filter across
// every voice) can trigger it once per chord onset — see keyboard.js.
export function applyFilterEnv(now) {
  const { vcf } = engine;
  if (!vcf || S.filterEnvAmount <= 0) return;
  const NYQUIST = 20000;
  const peak    = Math.min(NYQUIST, S.cutoff * 2 ** S.filterEnvAmount);
  const sustain = Math.min(NYQUIST, S.cutoff * 2 ** (S.filterEnvAmount * S.sustain));

  vcf.frequency.cancelScheduledValues(now);
  vcf.frequency.setValueAtTime(S.cutoff, now);
  vcf.frequency.linearRampToValueAtTime(peak, now + S.attack);
  vcf.frequency.linearRampToValueAtTime(sustain, now + S.attack + S.decay);
}

// The release half of the filter envelope: ramp the shared cutoff back to its
// base setting. Split out of noteOffAt so the polyphonic keyboard path can
// call it once per chord release too (see keyboard.js).
export function releaseFilterEnv(time) {
  const { vcf } = engine;
  if (!vcf || S.filterEnvAmount <= 0) return;
  vcf.frequency.cancelScheduledValues(time);
  vcf.frequency.setValueAtTime(vcf.frequency.value, time);
  vcf.frequency.linearRampToValueAtTime(S.cutoff, time + S.release);
}
