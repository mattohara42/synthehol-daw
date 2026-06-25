// Web Audio engine: builds the signal chain and exposes note on/off.
//
// Signal chain: (osc + noise + osc2) → ampEnv (VCA) → vcf (VCF) → master
//               → fxBus → [dryGain → scope → destination,
//                           delayWetSend → delayNode ↻ delayFeedbackGain → delayReturn → scope,
//                           reverbWetSend → convolver → reverbReturn → scope]
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
  noiseBuffer: null,
  noiseSource: null,
  pinkFilter: null,
  noiseMixGain: null,
  osc2: null,
  osc2MixGain: null,
  // FX bus
  fxBus: null,
  dryGain: null,
  delayWetSend: null,
  delayNode: null,
  delayFeedbackGain: null,
  delayReturn: null,
  reverbWetSend: null,
  convolver: null,
  reverbReturn: null,
  noteOn: false,
  currentNote: null,
};

function generateReverbIR(ctx, decaySeconds) {
  const length = ctx.sampleRate * decaySeconds;
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / length);
  }
  return buf;
}

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

  // White noise buffer — 2s mono, looped
  const bufLen = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const bufData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) bufData[i] = Math.random() * 2 - 1;

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  // Pink approximation: lowshelf at 1kHz — gain 0 = white, gain -6 = pink
  const pinkFilter = ctx.createBiquadFilter();
  pinkFilter.type = 'lowshelf';
  pinkFilter.frequency.value = 1000;
  pinkFilter.gain.value = 0;

  const noiseMixGain = ctx.createGain();
  noiseMixGain.gain.value = S.noiseMix;

  const osc2 = ctx.createOscillator();
  const osc2MixGain = ctx.createGain();
  osc2.type = S.osc2Waveform;
  osc2.frequency.value = 440;
  osc2.detune.value = S.osc2Detune;
  osc2MixGain.gain.value = S.osc2Mix;

  // FX bus nodes
  const fxBus = ctx.createGain();
  const dryGain = ctx.createGain();
  const delayWetSend = ctx.createGain();
  const delayNode = ctx.createDelay(2.0);
  const delayFeedbackGain = ctx.createGain();
  const delayReturn = ctx.createGain();
  const reverbWetSend = ctx.createGain();
  const convolver = ctx.createConvolver();
  const reverbReturn = ctx.createGain();

  engine.osc = osc;
  engine.ampEnv = ampEnv;
  engine.vcf = vcf;
  engine.master = master;
  engine.scope = scope;
  engine.lfoOsc = lfoOsc;
  engine.lfoMod = lfoMod;
  engine.noiseBuffer = noiseBuffer;
  engine.noiseSource = noiseSource;
  engine.pinkFilter = pinkFilter;
  engine.noiseMixGain = noiseMixGain;
  engine.osc2 = osc2;
  engine.osc2MixGain = osc2MixGain;
  engine.fxBus = fxBus;
  engine.dryGain = dryGain;
  engine.delayWetSend = delayWetSend;
  engine.delayNode = delayNode;
  engine.delayFeedbackGain = delayFeedbackGain;
  engine.delayReturn = delayReturn;
  engine.reverbWetSend = reverbWetSend;
  engine.convolver = convolver;
  engine.reverbReturn = reverbReturn;

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

  // FX node config
  dryGain.gain.value = Math.max(0, 1 - S.delayMix - S.reverbMix);
  delayWetSend.gain.value = S.delayMix;
  delayNode.delayTime.value = S.delayTime;
  delayFeedbackGain.gain.value = S.delayFeedback;
  reverbWetSend.gain.value = S.reverbMix;
  convolver.buffer = generateReverbIR(ctx, S.reverbDecay);

  // Signal chain: (osc + noise + osc2) → ampEnv → vcf → master → fxBus
  osc.connect(ampEnv);
  noiseSource.connect(pinkFilter);
  pinkFilter.connect(noiseMixGain);
  noiseMixGain.connect(ampEnv);
  osc2.connect(osc2MixGain);
  osc2MixGain.connect(ampEnv);
  ampEnv.connect(vcf);
  vcf.connect(master);
  master.connect(fxBus);

  // Dry path: fxBus → dryGain → scope → destination
  fxBus.connect(dryGain);
  dryGain.connect(scope);
  scope.connect(ctx.destination);

  // Delay wet path: fxBus → delayWetSend → delayNode → delayReturn → scope
  //                                              ↑─── delayFeedbackGain ───┘
  fxBus.connect(delayWetSend);
  delayWetSend.connect(delayNode);
  delayNode.connect(delayReturn);
  delayReturn.connect(scope);
  delayNode.connect(delayFeedbackGain);
  delayFeedbackGain.connect(delayNode);

  // Reverb wet path: fxBus → reverbWetSend → convolver → reverbReturn → scope
  fxBus.connect(reverbWetSend);
  reverbWetSend.connect(convolver);
  convolver.connect(reverbReturn);
  reverbReturn.connect(scope);

  // LFO chain
  lfoOsc.connect(lfoMod);
  applyLFORouting();

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

export function applyNoiseType() {
  const { ctx, pinkFilter } = engine;
  if (!ctx || !pinkFilter) return;
  const gain = S.noiseType === 'pink' ? -6 : 0;
  pinkFilter.gain.setTargetAtTime(gain, ctx.currentTime, 0.01);
}

export function setNoiseMix(v) {
  const { ctx, noiseMixGain } = engine;
  if (!ctx || !noiseMixGain) return;
  noiseMixGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01);
}

export function setOsc2Mix(v) {
  const { ctx, osc2MixGain } = engine;
  if (!ctx || !osc2MixGain) return;
  osc2MixGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01);
}

export function applyOsc2Octave() {
  const { ctx, osc2 } = engine;
  if (!ctx || !osc2 || !engine.currentNote) return;
  const freq = noteFreq(engine.currentNote, S.octave + S.osc2Octave);
  osc2.frequency.setTargetAtTime(freq, ctx.currentTime, 0.01);
}

export function setDelayTime(v) {
  if (!engine.ctx) return;
  engine.delayNode.delayTime.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
}

export function setDelayFeedback(v) {
  if (!engine.ctx) return;
  engine.delayFeedbackGain.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
}

export function setDelayMix(v) {
  if (!engine.ctx) return;
  engine.delayWetSend.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
  const dry = Math.max(0, 1 - S.delayMix - S.reverbMix);
  engine.dryGain.gain.setTargetAtTime(dry, engine.ctx.currentTime, 0.01);
}

export function setReverbMix(v) {
  if (!engine.ctx) return;
  engine.reverbWetSend.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
  const dry = Math.max(0, 1 - S.delayMix - S.reverbMix);
  engine.dryGain.gain.setTargetAtTime(dry, engine.ctx.currentTime, 0.01);
}

export function setReverbDecay(v) {
  if (!engine.ctx) return;
  v = Math.max(0.1, Math.min(4.0, v));
  engine.convolver.buffer = generateReverbIR(engine.ctx, v);
}

export function playNote(note, octave) {
  startAudio();
  const { ctx, osc, osc2, ampEnv } = engine;
  const freq = noteFreq(note, octave);
  const now = ctx.currentTime;

  osc.frequency.setValueAtTime(freq, now);
  osc.detune.setValueAtTime(S.detune, now);

  const freq2 = noteFreq(note, octave + S.osc2Octave);
  osc2.frequency.setValueAtTime(freq2, now);
  osc2.detune.setValueAtTime(S.osc2Detune, now);

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
