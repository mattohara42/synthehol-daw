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

  engine.noteOn = true;
  engine.currentNote = note;
}

export function releaseNote() {
  const { ctx, ampEnv } = engine;
  if (!ctx || !engine.noteOn) return;
  const now = ctx.currentTime;
  ampEnv.gain.cancelScheduledValues(now);
  ampEnv.gain.setValueAtTime(ampEnv.gain.value, now);
  ampEnv.gain.linearRampToValueAtTime(0, now + S.release);
  engine.noteOn = false;
  engine.currentNote = null;
}
