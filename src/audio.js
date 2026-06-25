// Web Audio engine: builds the signal chain and exposes note on/off.
//
// Signal chain: osc → ampEnv (VCA) → vcf (VCF) → master → scope → speakers
// Modulation:   lfoOsc → lfoMod (depth) → {vcf.frequency | osc.detune | ampEnv.gain}

import { S } from './state.js';
import { noteFreq } from './notes.js';
import { setStatus } from './ui.js';

export const engine = {
  ctx: null,
  osc: null,
  ampEnv: null,
  vcf: null,
  master: null,
  scope: null,
  lfoOsc: null,
  lfoMod: null,
  noteOn: false,
  currentNote: null,
};

export function startAudio() {
  if (engine.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  engine.ctx = ctx;

  const osc = ctx.createOscillator();
  const ampEnv = ctx.createGain();
  const vcf = ctx.createBiquadFilter();
  const master = ctx.createGain();
  const scope = ctx.createAnalyser();
  const lfoOsc = ctx.createOscillator();
  const lfoMod = ctx.createGain();

  engine.osc = osc;
  engine.ampEnv = ampEnv;
  engine.vcf = vcf;
  engine.master = master;
  engine.scope = scope;
  engine.lfoOsc = lfoOsc;
  engine.lfoMod = lfoMod;

  // Config
  osc.type = S.waveform;
  osc.frequency.value = 440;
  osc.detune.value = S.detune;
  ampEnv.gain.value = 0;
  vcf.type = S.filterType;
  vcf.frequency.value = S.cutoff;
  vcf.Q.value = S.resonance;
  master.gain.value = S.masterVol;
  scope.fftSize = 2048;
  scope.smoothingTimeConstant = 0.8;
  lfoOsc.type = 'sine';
  lfoOsc.frequency.value = S.lfoRate;
  lfoMod.gain.value = lfoDepthScaled();

  // Signal chain
  osc.connect(ampEnv);
  ampEnv.connect(vcf);
  vcf.connect(master);
  master.connect(scope);
  scope.connect(ctx.destination);

  // LFO chain
  lfoOsc.connect(lfoMod);
  applyLFORouting();

  osc.start();
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

export function playNote(note, octave) {
  startAudio();
  const { ctx, osc, ampEnv } = engine;
  const freq = noteFreq(note, octave);
  const now = ctx.currentTime;

  osc.frequency.setValueAtTime(freq, now);
  osc.detune.setValueAtTime(S.detune, now);

  ampEnv.gain.cancelScheduledValues(now);
  ampEnv.gain.setValueAtTime(ampEnv.gain.value, now);
  ampEnv.gain.linearRampToValueAtTime(1, now + S.attack);
  ampEnv.gain.linearRampToValueAtTime(S.sustain, now + S.attack + S.decay);

  applyFilterEnv(now);

  engine.noteOn = true;
  engine.currentNote = note;
}

export function releaseNote() {
  const { ctx, ampEnv, vcf } = engine;
  if (!ctx || !engine.noteOn) return;
  const now = ctx.currentTime;
  ampEnv.gain.cancelScheduledValues(now);
  ampEnv.gain.setValueAtTime(ampEnv.gain.value, now);
  ampEnv.gain.linearRampToValueAtTime(0, now + S.release);

  // Filter envelope release: ramp cutoff back to its base setting.
  if (S.filterEnvAmount > 0) {
    vcf.frequency.cancelScheduledValues(now);
    vcf.frequency.setValueAtTime(vcf.frequency.value, now);
    vcf.frequency.linearRampToValueAtTime(S.cutoff, now + S.release);
  }

  engine.noteOn = false;
  engine.currentNote = null;
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
