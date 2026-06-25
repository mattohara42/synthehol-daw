// The "what does this control do" teaching panel: copy + a small
// illustrative canvas per topic.

import { S } from './state.js';
import { noteFreq } from './notes.js';
import { setupCanvas, drawWaveOnCanvas, drawFilterCurveOnCanvas, drawADSRShape } from './canvas.js';

const TEACHINGS = {
  'osc-wave': {
    title: '🌊 Waveform — Timbre',
    body: 'The waveform shape determines timbre — the "color" of sound. Sine: pure, smooth, flute-like (single frequency). Square: hollow, clarinet-like (odd harmonics only). Sawtooth: bright, buzzy, brass-like (all harmonics). Triangle: similar to sine but slightly brighter.',
    draw: (c) => drawTeachWave(c)
  },
  'osc-oct': {
    title: '🎵 Octave — Pitch Register',
    body: 'Every octave doubles the frequency: A3=220Hz, A4=440Hz, A5=880Hz. Shifting up an octave makes the sound twice as high-pitched. Most synth patches use octave 3 for bass, 4–5 for leads, 5+ for high melodic lines.',
    draw: (c) => drawTeachOctave(c)
  },
  'osc-detune': {
    title: '🎸 Detune — Pitch Nudge',
    body: 'Detune shifts pitch by cents (hundredths of a semitone). ±50 cents = half a semitone. Slight detuning (+5 to +15¢) adds a subtly "human" quality. Stacking two oscillators with slight detune creates the classic chorusing sound of vintage synths.',
    draw: (c) => drawTeachDetune(c)
  },
  'filter-type': {
    title: '🎚️ Filter Type',
    body: 'Low-pass: bass passes, highs are cut — warm, round sound. High-pass: treble passes, bass is cut — thin, airy sound. Band-pass: only a narrow band passes — nasal, telephone-like. The cutoff frequency determines where the cutting starts.',
    draw: (c) => drawTeachFilterCurve(c)
  },
  'filter-cutoff': {
    title: '✂️ Cutoff Frequency',
    body: 'The frequency where the filter starts cutting. For low-pass: sweeping cutoff from low to high "opens up" the sound, revealing brightness progressively. This sweep is one of the most iconic sounds in electronic music.',
    draw: (c) => drawTeachFilterCurve(c)
  },
  'filter-res': {
    title: '📡 Resonance',
    body: 'Resonance boosts frequencies right at the cutoff, creating a peak. Low Q: gentle slope, natural sound. High Q: sharp peak, "wah" or vowel-like quality. Very high Q can make the filter self-oscillate, producing a pure tone even with no input signal.',
    draw: (c) => drawTeachFilterCurve(c)
  },
  'filter-env': {
    title: '🧹 Filter Envelope',
    body: 'Routes the same ADSR envelope to the filter cutoff, so each note sweeps open and then settles — the single most iconic synth sound. Amount sets how far the cutoff jumps (in octaves) at the attack peak before decaying to the sustain level; at 0 the envelope is off and the cutoff stays put. Short decay + high amount = a snappy "pew"; longer decay = a slow filter swell.',
    draw: (c) => drawTeachFilterCurve(c)
  },
  'adsr-atk': {
    title: '⏩ Attack',
    body: 'How quickly sound reaches full volume after you press a key. Short attack (1ms): instant, percussive — like a drum or pluck. Long attack (1–2s): fades in slowly — like strings building up. Fast attack = sharp transient; slow attack = gradual swell.',
    draw: (c) => drawTeachADSR(c)
  },
  'adsr-dec': {
    title: '📉 Decay',
    body: 'After the peak, how long it takes to settle at the sustain level. Short decay + low sustain = punchy, bounces back quickly. Long decay = the initial brightness lingers. Piano has a natural decay — loud attack, then decaying even while the key is held.',
    draw: (c) => drawTeachADSR(c)
  },
  'adsr-sus': {
    title: '🎹 Sustain Level',
    body: 'The volume level held for as long as you keep the key pressed. Note: this is a level, not a time. 100% = full volume while held (organ-like). 0% = sound dies away even while held (piano-like). Most pads sit at 60–80%.',
    draw: (c) => drawTeachADSR(c)
  },
  'adsr-rel': {
    title: '🌅 Release',
    body: 'How long the sound fades after you release the key. Short release (50ms): sound cuts off quickly. Long release (2–5s): sound continues and fades after letting go — like a piano sustain pedal, or a reverb tail. Long attack + long release = "pad" sound.',
    draw: (c) => drawTeachADSR(c)
  },
  'lfo-dest': {
    title: '🎯 LFO Destination',
    body: 'Filter: wobbles the cutoff — classic "wah-wah" or auto-filter sweep. Pitch: vibrato — the subtle pitch wavering used by vocalists and string players naturally (~5–7Hz). Amp: tremolo — pulsing volume, like a vintage amp tremolo effect.',
    draw: (c) => drawTeachLFO(c)
  },
  'lfo-rate': {
    title: '⚡ LFO Rate',
    body: 'How fast the LFO cycles. Below 1Hz: very slow sweep (several seconds). 3–8Hz: vibrato/tremolo range — natural human vibrato is ~5–7Hz. Above 10Hz: approaches audio rate, creating ring-modulator-like metallic effects.',
    draw: (c) => drawTeachLFO(c)
  },
  'lfo-depth': {
    title: '📏 LFO Depth',
    body: 'How much the LFO affects its target. For filter: small = subtle wobble, large = dramatic sweep. For pitch: small (<50¢) = realistic vibrato, large = sci-fi warble. Think of it as the amplitude of the modulation wave.',
    draw: (c) => drawTeachLFO(c)
  },

  // Lore entries — historical context for each module
  'lore-osc': {
    title: 'Bob Moog · Oscillator · 1964',
    body: 'Bob Moog debuted the first voltage-controlled synthesizer modules at the AES convention in October 1964, giving composers electronic control over pitch for the first time.',
    draw: (c) => { setupCanvas(c); }
  },
  'lore-filter': {
    title: 'Bob Moog · Filter · 1965',
    body: "Moog's transistor ladder filter — introduced in his 1965 commercial modules — produced a warm resonance that became the defining sound of the synthesizer era.",
    draw: (c) => { setupCanvas(c); }
  },
  'lore-envelope': {
    title: 'Wendy Carlos · Envelope · 1968',
    body: "Wendy Carlos's 1968 album Switched-On Bach demonstrated that the Moog's contour generators could match the attack and decay of acoustic instruments with uncanny expressiveness.",
    draw: (c) => { setupCanvas(c); }
  },
  'lore-lfo': {
    title: 'Wendy Carlos · LFO · 1970',
    body: 'The Minimoog Model D (1970), which Carlos helped refine, collapsed the modular patch cables of earlier synthesizers into a single playable instrument with an integrated LFO.',
    draw: (c) => { setupCanvas(c); }
  },
};

export function teach(key) {
  const t = TEACHINGS[key];
  if (!t) return;
  document.getElementById('teach-title').textContent = t.title;
  document.getElementById('teach-body').textContent = t.body;
  t.draw(document.getElementById('teach-canvas'));
}

function drawTeachWave(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const types = ['sine', 'square', 'sawtooth', 'triangle'];
  const segW = W / 4;
  types.forEach((t, i) => {
    const isActive = t === S.waveform;
    ctx2.save();
    ctx2.translate(i * segW, 0);
    ctx2.beginPath();
    ctx2.rect(0, 0, segW - 2, H);
    ctx2.clip();
    drawWaveOnCanvas(ctx2, segW - 2, H, t, isActive ? '#f59e0b' : '#2a2a44', isActive ? 2 : 1, 1.5);
    ctx2.restore();
  });
  ctx2.restore();
}

function drawTeachOctave(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const baseFreq = noteFreq('A', S.octave);
  ctx2.fillStyle = '#f59e0b22';
  ctx2.fillRect(0, 0, W, H);
  ctx2.fillStyle = '#f59e0b';
  ctx2.font = '11px -apple-system, sans-serif';
  ctx2.fillText(`A${S.octave} = ${Math.round(baseFreq)} Hz`, 8, H/2 + 4);
  const barW = (S.octave - 1) / 6 * (W - 16);
  ctx2.fillStyle = '#f59e0b44';
  ctx2.fillRect(8, H - 12, barW, 6);
  ctx2.fillStyle = '#f59e0b';
  ctx2.fillRect(8, H - 12, barW, 6);
  ctx2.restore();
}

function drawTeachDetune(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const offset = (S.detune / 50) * 0.25;
  // Second wave slightly offset in frequency
  ctx2.globalAlpha = 0.4;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#f59e0b', 1, 2 * (1 + offset * 0.1));
  ctx2.globalAlpha = 1;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#f59e0b', 1.5, 2);
  ctx2.restore();
}

function drawTeachFilterCurve(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  drawFilterCurveOnCanvas(ctx2, W, H, '#22d3ee');
  ctx2.restore();
}

function drawTeachADSR(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const pts = drawADSRShape(ctx2, W, H, '#a78bfa', 6);
  // Labels
  ctx2.fillStyle = '#a78bfa99';
  ctx2.font = '9px monospace';
  ctx2.fillText('A', pts.x0 + (pts.x1-pts.x0)*0.3, pts.bot - 4);
  ctx2.fillText('D', pts.x1 + (pts.x2-pts.x1)*0.2, pts.susY - 4);
  ctx2.fillText('S', pts.x2 + (pts.x3-pts.x2)*0.2, pts.susY - 4);
  ctx2.fillText('R', pts.x3 + (pts.x4-pts.x3)*0.1, pts.bot - 4);
  ctx2.restore();
}

function drawTeachLFO(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  if (S.lfoDest === 'none') {
    ctx2.strokeStyle = '#2a2a44';
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(0, H/2); ctx2.lineTo(W, H/2);
    ctx2.stroke();
    ctx2.fillStyle = '#4a4a70';
    ctx2.font = '10px -apple-system, sans-serif';
    ctx2.fillText('LFO off — select a target above', 8, H/2 + 4);
  } else {
    const cycles = Math.max(1, Math.min(5, S.lfoRate));
    // Show depth visually by scaling amplitude
    const scaleY = 0.3 + S.lfoDepth * 0.7;
    ctx2.save();
    ctx2.translate(0, H/2 * (1 - scaleY));
    ctx2.scale(1, scaleY);
    drawWaveOnCanvas(ctx2, W, H, 'sine', '#4ade80', 2, cycles);
    ctx2.restore();
  }
  ctx2.restore();
}
