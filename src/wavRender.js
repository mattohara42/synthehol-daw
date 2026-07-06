// Offline .wav render (E6 continuation). Rebuilds the signal chain in an
// OfflineAudioContext and replays the active pattern (step grid + drums +
// piano roll + automation) once through, faster than real time, then encodes
// the result to a 16-bit PCM .wav file for download.
//
// This deliberately duplicates audio.js's graph-building rather than sharing
// a factory with it: this module is additive-only and never touches the live
// engine, so a mistake here can't destabilize real-time playback. An
// OfflineAudioContext also needs no user-gesture unlock, so rendering works
// even before the user has pressed a key.
//
// Known gap since E4 (multi-track): this renders only the ACTIVE track's
// pattern through a single instrument chain, same as before multi-track
// existed — a project with more than one track will silently export just
// the one currently selected. Multi-track offline export is an open
// question in docs/brainstorms/2026-07-03-multitrack-mixer-requirements.md,
// deliberately deferred rather than solved here.

import { store } from './store.js';
import { S } from './state.js';
import { noteFreq } from './notes.js';
import { makeImpulse, makeDriveCurve, lfoDepthScaled } from './audio.js';
import { createVoiceManager } from './voices.js';
import { stepDuration, swingOffset, activeNotesAt } from './sequencer.js';
import { noteRunsStartingAt } from './pianoroll.js';
import { playKick, playSnare, playHat, playCowbell, playClap } from './drums.js';

const SAMPLE_RATE = 44100;
const TAIL_SECONDS = 2; // let release/delay/reverb tails ring out past the last step

// Render exactly one loop of the active pattern to an AudioBuffer.
async function renderPatternToBuffer() {
  const pattern = store.pattern();
  const bpm = store.get().transport.bpm;
  const stepDur = stepDuration(bpm, 4);
  const totalSteps = pattern.length;
  const durationSeconds = totalSteps * stepDur + TAIL_SECONDS;
  const ctx = new OfflineAudioContext(2, Math.ceil(durationSeconds * SAMPLE_RATE), SAMPLE_RATE);

  // Signal chain — mirrors audio.js's startAudio(), built fresh in `ctx`.
  const vcf = ctx.createBiquadFilter();
  const master = ctx.createGain();
  const drive = ctx.createWaveShaper();
  drive.oversample = '4x';
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
  const sum = ctx.createGain(); // stands in for the live graph's `scope` summing bus
  const lfoOsc = ctx.createOscillator();
  const lfoShSource = ctx.createConstantSource(); // Sample & Hold's source (D1 bonus unlock)
  const lfoMod = ctx.createGain();
  const delay = ctx.createDelay(1.0);
  const delayFb = ctx.createGain();
  const delayWet = ctx.createGain();
  const reverb = ctx.createConvolver();
  const reverbWet = ctx.createGain();
  const chorusLfo = ctx.createOscillator();       // D1 bonus unlock — mirrors audio.js
  const chorusLfoGain = ctx.createGain();
  const chorusDelay = ctx.createDelay(0.05);
  const chorusWet = ctx.createGain();

  vcf.type = S.filterType;
  vcf.frequency.value = S.cutoff;
  vcf.Q.value = S.resonance;
  master.gain.value = S.masterVol;
  drive.curve = makeDriveCurve(S.drive);
  eqLow.gain.value = S.eqLow;
  eqMid.gain.value = S.eqMid;
  eqHigh.gain.value = S.eqHigh;
  lfoMod.gain.value = lfoDepthScaled();
  delay.delayTime.value = S.delayTime;
  delayFb.gain.value = S.delayFeedback;
  delayWet.gain.value = S.delayMix;
  reverb.buffer = makeImpulse(ctx);
  reverbWet.gain.value = S.reverbMix;
  chorusLfo.type = 'sine';
  chorusLfo.frequency.value = 0.8;
  chorusLfoGain.gain.value = 0.0025;
  chorusDelay.delayTime.value = 0.015;
  chorusWet.gain.value = S.chorusMix;

  vcf.connect(drive);
  drive.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(master);
  master.connect(sum);

  master.connect(delay);
  delay.connect(delayFb);
  delayFb.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(sum);

  master.connect(reverb);
  reverb.connect(reverbWet);
  reverbWet.connect(sum);

  master.connect(chorusDelay);
  chorusLfo.connect(chorusLfoGain);
  chorusLfoGain.connect(chorusDelay.delayTime);
  chorusDelay.connect(chorusWet);
  chorusWet.connect(sum);
  chorusLfo.start(0);

  sum.connect(ctx.destination);

  // Sample & Hold has no native OscillatorType — precompute its whole step
  // schedule up front (the offline render doesn't have a live rAF loop to
  // drive tickSampleHold() from) and feed the ConstantSourceNode instead.
  if (S.lfoWaveform === 'sampleHold') {
    const period = 1 / Math.max(0.1, S.lfoRate);
    for (let t = 0; t < durationSeconds; t += period) {
      lfoShSource.offset.setValueAtTime(Math.random() * 2 - 1, t);
    }
    lfoShSource.connect(lfoMod);
    lfoShSource.start(0);
  } else {
    lfoOsc.type = S.lfoWaveform;
    lfoOsc.frequency.value = S.lfoRate;
    lfoOsc.connect(lfoMod);
    lfoOsc.start(0);
  }
  if (S.lfoDest === 'filter') lfoMod.connect(vcf.frequency);

  const voices = createVoiceManager({ ctx, output: vcf, getParams: () => S, maxVoices: 32, lfoMod });

  // Walk the pattern once, computing each step's time directly — the same
  // math the live consumers use, just without a real-time scheduler driving it.
  for (let step = 0; step < totalSteps; step++) {
    const at = step * stepDur + swingOffset(step, pattern.swing, stepDur);

    const autoCutoff = pattern.automation?.cutoff?.[step];
    if (autoCutoff != null) vcf.frequency.setTargetAtTime(autoCutoff, at, 0.02);
    const autoRes = pattern.automation?.resonance?.[step];
    if (autoRes != null) vcf.Q.setTargetAtTime(autoRes, at, 0.02);
    const autoVol = pattern.automation?.volume?.[step];
    if (autoVol != null) master.gain.setTargetAtTime(autoVol, at, 0.02);

    if (pattern.drums?.kick?.[step]) playKick(ctx, master, at);
    if (pattern.drums?.snare?.[step]) playSnare(ctx, master, at);
    if (pattern.drums?.hat?.[step]) playHat(ctx, master, at);
    if (pattern.drums?.cowbell?.[step]) playCowbell(ctx, master, at);
    if (pattern.drums?.clap?.[step]) playClap(ctx, master, at);

    const off = at + Math.max(0.02, 0.9 * stepDur);
    for (const { note, octave } of activeNotesAt(pattern, step)) {
      const id = voices.noteOn(noteFreq(note, octave), at, 0.85);
      if (id != null) voices.noteOff(id, off);
    }

    for (const { note, octave, lengthSteps } of noteRunsStartingAt(pattern, step)) {
      const id = voices.noteOn(noteFreq(note, octave), at, 0.85);
      if (id != null) voices.noteOff(id, at + Math.max(0.02, 0.95 * lengthSteps * stepDur));
    }
  }

  return ctx.startRendering();
}

// Encode an AudioBuffer as a 16-bit PCM .wav Blob. Exported for testing —
// takes anything duck-typed like an AudioBuffer (numberOfChannels, length,
// sampleRate, getChannelData), no real Web Audio API needed.
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const numFrames = buffer.length;
  const blockAlign = numChannels * 2;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const clamped = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render the active pattern and download it as a .wav file. */
export async function renderAndDownloadWav() {
  const buffer = await renderPatternToBuffer();
  const blob = audioBufferToWav(buffer);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(blob, `synthehol-${stamp}.wav`);
}

export function initWavRender() {
  const btn = document.getElementById('render-wav-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Rendering…';
    try {
      await renderAndDownloadWav();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}
