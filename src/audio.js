// Web Audio engine: builds the signal chain and exposes note on/off.
//
// Signal chain: osc → ampEnv (VCA) → vcf (VCF) → master → scope → speakers
// Modulation:   lfoOsc → lfoMod (depth) → {vcf.frequency | osc.detune | ampEnv.gain}

import { S } from './state.js';
import { noteFreq } from './notes.js';
import { setStatus } from './ui.js';
import { createVoiceManager } from './voices.js';

export const engine = {
  ctx: null,
  osc: null,
  ampEnv: null,
  vcf: null,
  master: null,
  scope: null,
  lfoOsc: null,
  lfoMod: null,
  delay: null,
  delayFb: null,
  delayWet: null,
  reverb: null,
  reverbWet: null,
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

  const osc = ctx.createOscillator();
  const ampEnv = ctx.createGain();
  const vcf = ctx.createBiquadFilter();
  const master = ctx.createGain();
  const drive = ctx.createWaveShaper();
  drive.oversample = '4x';
  const scope = ctx.createAnalyser();
  const lfoOsc = ctx.createOscillator();
  const lfoMod = ctx.createGain();
  const delay = ctx.createDelay(1.0);
  const delayFb = ctx.createGain();
  const delayWet = ctx.createGain();
  const reverb = ctx.createConvolver();
  const reverbWet = ctx.createGain();

  // Noise source (VNO): a looped white-noise buffer, optionally shelved toward
  // pink, mixed into the amp envelope alongside the oscillator.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuf;
  noiseSource.loop = true;
  const pinkFilter = ctx.createBiquadFilter(); // lowshelf @1kHz: 0dB=white, -6dB≈pink
  pinkFilter.type = 'lowshelf';
  pinkFilter.frequency.value = 1000;
  const noiseMix = ctx.createGain();

  // Second oscillator (VCO2): detuned stacking, summed into the amp envelope.
  const osc2 = ctx.createOscillator();
  const osc2Mix = ctx.createGain();

  engine.osc = osc;
  engine.ampEnv = ampEnv;
  engine.vcf = vcf;
  engine.master = master;
  engine.drive = drive;
  engine.scope = scope;
  engine.lfoOsc = lfoOsc;
  engine.lfoMod = lfoMod;
  engine.delay = delay;
  engine.delayFb = delayFb;
  engine.delayWet = delayWet;
  engine.reverb = reverb;
  engine.reverbWet = reverbWet;
  engine.noiseSource = noiseSource;
  engine.pinkFilter = pinkFilter;
  engine.noiseMix = noiseMix;
  engine.osc2 = osc2;
  engine.osc2Mix = osc2Mix;

  // Config
  osc.type = S.waveform;
  osc.frequency.value = 440;
  osc.detune.value = S.detune;
  pinkFilter.gain.value = S.noiseType === 'pink' ? -6 : 0;
  noiseMix.gain.value = S.noiseMix;
  osc2.type = S.osc2Waveform;
  osc2.frequency.value = 440;
  osc2.detune.value = S.osc2Detune;
  osc2Mix.gain.value = S.osc2Mix;
  ampEnv.gain.value = 0;
  vcf.type = S.filterType;
  vcf.frequency.value = S.cutoff;
  vcf.Q.value = S.resonance;
  master.gain.value = S.masterVol;
  drive.curve = makeDriveCurve(S.drive);
  scope.fftSize = 2048;
  scope.smoothingTimeConstant = 0.8;
  lfoOsc.type = 'sine';
  lfoOsc.frequency.value = S.lfoRate;
  lfoMod.gain.value = lfoDepthScaled();

  delay.delayTime.value = S.delayTime;
  delayFb.gain.value = S.delayFeedback;
  delayWet.gain.value = S.delayMix;
  reverb.buffer = makeImpulse(ctx);
  reverbWet.gain.value = S.reverbMix;

  // Signal chain: master fans out to a dry path plus delay and reverb sends,
  // all summed back at the scope so the visualizers show the wet signal too.
  osc.connect(ampEnv);
  noiseSource.connect(pinkFilter);
  pinkFilter.connect(noiseMix);
  noiseMix.connect(ampEnv);
  osc2.connect(osc2Mix);
  osc2Mix.connect(ampEnv);
  ampEnv.connect(vcf);
  vcf.connect(drive);
  drive.connect(master);
  master.connect(scope);                 // dry

  master.connect(delay);                  // delay send
  delay.connect(delayFb);
  delayFb.connect(delay);                 // feedback loop
  delay.connect(delayWet);
  delayWet.connect(scope);

  master.connect(reverb);                 // reverb send
  reverb.connect(reverbWet);
  reverbWet.connect(scope);

  scope.connect(ctx.destination);

  // Recording tap: the same post-FX signal the speakers get, branched to a
  // MediaStream so the exporter can capture exactly what the user hears.
  const streamDest = ctx.createMediaStreamDestination();
  engine.streamDest = streamDest;
  scope.connect(streamDest);

  // LFO chain
  lfoOsc.connect(lfoMod);
  applyLFORouting();

  // Polyphonic voice pool (E3). Voices sum into the filter input, so they share
  // the same filter → master → FX → scope chain as the mono path. Silent until a
  // consumer (the scheduler / future Act III keyboard) drives it.
  engine.voices = createVoiceManager({
    ctx,
    output: vcf,
    getParams: () => S,
    maxVoices: 16,
  });

  osc.start();
  lfoOsc.start();
  noiseSource.start();
  osc2.start();

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

export function applyLFORouting() {
  const { ctx, lfoMod, vcf, osc, ampEnv } = engine;
  if (!ctx) return;
  try { lfoMod.disconnect(); } catch (e) {}
  if (S.lfoDest === 'filter') lfoMod.connect(vcf.frequency);
  else if (S.lfoDest === 'pitch') lfoMod.connect(osc.detune);
  else if (S.lfoDest === 'amp') lfoMod.connect(ampEnv.gain);
  // 'none' = stay disconnected
  lfoMod.gain.value = lfoDepthScaled();
}

// Note on/off at a specified audio-context time — the time-aware primitives the
// scheduler/sequencer (E2/L6) drive. `playNote`/`releaseNote` delegate to these
// with `time = ctx.currentTime`, so the live keyboard is unchanged.
export function noteOnAt(note, octave, time, velocity = 1) {
  startAudio();
  const { osc, ampEnv } = engine;
  const freq = noteFreq(note, octave);
  const v = Math.min(1, Math.max(0, velocity));

  osc.frequency.setValueAtTime(freq, time);
  osc.detune.setValueAtTime(S.detune, time);
  if (engine.osc2) {
    engine.osc2.frequency.setValueAtTime(freq * 2 ** S.osc2Octave, time);
    engine.osc2.detune.setValueAtTime(S.osc2Detune, time);
  }

  // Velocity scales the envelope's peak and sustain level, so softer presses
  // are quieter — a little dynamics goes a long way toward feeling alive.
  ampEnv.gain.cancelScheduledValues(time);
  ampEnv.gain.setValueAtTime(ampEnv.gain.value, time);
  ampEnv.gain.linearRampToValueAtTime(v, time + S.attack);
  ampEnv.gain.linearRampToValueAtTime(S.sustain * v, time + S.attack + S.decay);

  applyFilterEnv(time);

  engine.noteOn = true;
  engine.currentNote = note;
}

export function noteOffAt(time) {
  const { ctx, ampEnv, vcf } = engine;
  if (!ctx || !engine.noteOn) return;
  ampEnv.gain.cancelScheduledValues(time);
  ampEnv.gain.setValueAtTime(ampEnv.gain.value, time);
  ampEnv.gain.linearRampToValueAtTime(0, time + S.release);

  // Filter envelope release: ramp cutoff back to its base setting.
  if (S.filterEnvAmount > 0) {
    vcf.frequency.cancelScheduledValues(time);
    vcf.frequency.setValueAtTime(vcf.frequency.value, time);
    vcf.frequency.linearRampToValueAtTime(S.cutoff, time + S.release);
  }

  engine.noteOn = false;
  engine.currentNote = null;
}

export function playNote(note, octave, velocity = 1) {
  startAudio();
  noteOnAt(note, octave, engine.ctx.currentTime, velocity);
}

export function releaseNote() {
  if (!engine.ctx || !engine.noteOn) return;
  noteOffAt(engine.ctx.currentTime);
}

// ─── Polyphonic path (E3) ───
// Independent of the mono note on/off above: each call allocates its own voice,
// so simultaneous notes (chords, overlapping sequencer steps) coexist. The live
// keyboard stays mono until Act III; the scheduler/sequencer (L6) is the first
// driver of these.

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

// Sweeps the filter cutoff per note, reusing the amp ADSR's attack/decay times.
// Only active when filterEnvAmount > 0; otherwise the cutoff slider keeps sole
// control (preserving the original behavior). Known v1 limitation: dragging the
// cutoff slider mid-note while this schedule is live will fight the schedule.
function applyFilterEnv(now) {
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
