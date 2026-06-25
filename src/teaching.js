// The "what does this control do" teaching panel: copy + a small
// illustrative canvas per topic.

import { S } from './state.js';
import { noteFreq } from './notes.js';
import { setupCanvas, drawWaveOnCanvas, drawFilterCurveOnCanvas, drawADSRShape, waveformSample } from './canvas.js';

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

  // VCO2 module entries
  'osc2-wave': {
    title: 'VCO2 Waveform',
    body: 'Layering different waveforms creates new timbres neither oscillator has alone. Sine under sawtooth adds a fundamental without harshness. Square under triangle softens the hollow edge. Experiment — there are no wrong combinations.',
    draw: (c) => drawTeachOsc2Wave(c),
  },
  'osc2-oct': {
    title: 'Octave Offset',
    body: 'Shifting VCO2 one octave down adds sub-bass weight — the second voice reinforces the fundamental from below. One octave up adds shimmer — a high sparkle above the main tone. At 0 the voices are in unison; detune them to hear the difference.',
    draw: (c) => drawTeachOsc2Oct(c),
  },
  'osc2-detune': {
    title: 'Detune — The Sweet Spot',
    body: '0¢ is perfectly in tune — and perfectly sterile. At 5–20¢ you hear slow beating, a warm chorus-like shimmer. At 30–50¢ the beating speeds up into a dramatic waver. Above 50¢ it starts to sound out-of-tune rather than rich. The sweet spot is where the two voices feel like one thick voice.',
    draw: (c) => drawTeachOsc2Detune(c),
  },
  'osc2-mix': {
    title: 'VCO2 Mix',
    body: 'Low mix (0.1–0.3) adds subtle thickness — VCO1 still dominates, VCO2 just fattens it. High mix (0.7–1.0) gives both voices equal weight, creating a true dual-voice sound. Blend to taste — there is no correct ratio.',
    draw: (c) => drawTeachOsc2Mix(c),
  },

  // Noise module entries
  'noise-type': {
    title: 'White vs Pink Noise',
    body: 'White noise has equal energy at every frequency — bright, harsh, like TV static. Pink noise rolls off at −3dB per octave — warmer, more natural, like rain on a roof. Neither is required by the boss; both are valid textures to sculpt.',
    draw: (c) => drawTeachNoiseType(c),
  },
  'noise-mix': {
    title: 'Noise Mix',
    body: 'Low mix (0.1–0.2) adds subtle breathiness or grit to a pitched tone. High mix (0.7–1.0) makes noise the dominant voice. The blend point teaches that noise and pitch coexist — they don\'t compete.',
    draw: (c) => drawTeachNoiseMix(c),
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
  'lore-noise': {
    title: 'Alan R. Pearlman · ARP 2600 · 1971',
    body: "Ben Burtt shaped R2-D2's voice by filtering and enveloping white noise from an ARP 2600 — the same spectral sculpting technique you're learning here.",
    draw: (c) => { setupCanvas(c); }
  },
  'lore-osc2': {
    title: 'Tom Oberheim · Oberheim Two-Voice · 1975',
    body: "Tom Oberheim hand-wired two SEM modules into a single case, creating the first commercial two-voice synthesizer. That pair of slightly drifting oscillators became the signature warmth behind OMD, Gary Numan, and Van Halen's synth leads.",
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

function drawTeachNoiseType(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const isWhite = (S.noiseType || 'white') === 'white';
  const halfW = Math.floor(W / 2) - 2;

  // Left half: white noise (many equal-amplitude harmonics → dense, busy texture)
  ctx2.save();
  ctx2.beginPath(); ctx2.rect(0, 0, halfW, H); ctx2.clip();
  const wDim = isWhite ? 0.22 : 0.07;
  const wColor = isWhite ? '#e07020' : '#4a2a10';
  for (const f of [3, 7, 11, 17, 23]) {
    ctx2.globalAlpha = wDim;
    drawWaveOnCanvas(ctx2, halfW, H, 'sine', wColor, 1, f);
  }
  ctx2.globalAlpha = 1;
  ctx2.fillStyle = wColor;
  ctx2.font = '8px monospace';
  ctx2.fillText('WHITE', 3, H - 3);
  ctx2.restore();

  // Right half: pink noise (few harmonics, low-freq weighted → smoother texture)
  ctx2.save();
  ctx2.translate(halfW + 4, 0);
  ctx2.beginPath(); ctx2.rect(0, 0, halfW, H); ctx2.clip();
  const pColor = !isWhite ? '#e07020' : '#4a2a10';
  for (const [f, a] of [[2, 0.35], [4, 0.22], [6, 0.12]]) {
    ctx2.globalAlpha = !isWhite ? a : a * 0.3;
    drawWaveOnCanvas(ctx2, halfW, H, 'sine', pColor, 1, f);
  }
  ctx2.globalAlpha = 1;
  ctx2.fillStyle = pColor;
  ctx2.font = '8px monospace';
  ctx2.fillText('PINK', 3, H - 3);
  ctx2.restore();

  ctx2.restore();
}

function drawTeachNoiseMix(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const mix = S.noiseMix ?? 0;

  // Pitched oscillator fades out as noise fades in
  ctx2.globalAlpha = Math.max(0.08, 1 - mix * 0.85);
  drawWaveOnCanvas(ctx2, W, H, S.waveform || 'sine', '#e0a010', 1.5, 2.5);

  // Noise texture fades in (simulate with overlapping sines)
  for (const f of [5, 11, 17, 23]) {
    ctx2.globalAlpha = mix * 0.18;
    drawWaveOnCanvas(ctx2, W, H, 'sine', '#e07020', 1, f);
  }

  // Mix bar at bottom: amber = tone, orange = noise
  ctx2.globalAlpha = 1;
  ctx2.fillStyle = '#0a0a14';
  ctx2.fillRect(0, H - 5, W, 5);
  ctx2.fillStyle = '#e0a010';
  ctx2.fillRect(0, H - 5, W * (1 - mix), 5);
  ctx2.fillStyle = '#e07020';
  ctx2.fillRect(W * (1 - mix), H - 5, W * mix, 5);

  ctx2.restore();
}

function drawTeachOsc2Wave(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const vco1Wave = S.waveform || 'sine';
  const vco2Wave = S.osc2Waveform || 'sawtooth';

  // VCO1 in amber
  ctx2.globalAlpha = 0.75;
  drawWaveOnCanvas(ctx2, W, H, vco1Wave, '#e0a010', 2, 2.5);

  // VCO2 in steel blue, drawn slightly thinner so both read
  ctx2.globalAlpha = 0.65;
  drawWaveOnCanvas(ctx2, W, H, vco2Wave, '#4a90d0', 1.5, 2.5);

  ctx2.globalAlpha = 1;
  ctx2.fillStyle = '#e0a010cc';
  ctx2.font = '7px monospace';
  ctx2.fillText('VCO1', 3, 10);
  ctx2.fillStyle = '#4a90d0cc';
  ctx2.fillText('VCO2', 3, H - 3);

  ctx2.restore();
}

function drawTeachOsc2Oct(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const octOffset = S.osc2Octave ?? 0;
  const cycles1 = 2;
  const cycles2 = Math.max(0.5, Math.min(8, cycles1 * Math.pow(2, octOffset)));

  // VCO1 in amber
  ctx2.globalAlpha = 0.8;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#e0a010', 1.5, cycles1);

  // VCO2 in steel blue at the offset frequency
  ctx2.globalAlpha = 0.7;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#4a90d0', 1.5, cycles2);

  ctx2.globalAlpha = 1;
  const label = octOffset === 0 ? 'unison' : (octOffset > 0 ? `VCO2 +${octOffset} oct` : `VCO2 ${octOffset} oct`);
  ctx2.fillStyle = '#4a90d0cc';
  ctx2.font = '8px monospace';
  ctx2.fillText(label, W - label.length * 5 - 2, 10);

  ctx2.restore();
}

function drawTeachOsc2Detune(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const detune = S.osc2Detune ?? 7;
  const ratio = Math.pow(2, Math.abs(detune) / 1200);
  const cycles = 8; // more cycles = more visible beating

  // VCO1 and VCO2 as dim background traces
  ctx2.globalAlpha = 0.3;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#e0a010', 1, cycles);
  ctx2.globalAlpha = 0.25;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#4a90d0', 1, cycles * ratio);

  // Combined sum: the beating envelope shown as the bright merged signal
  ctx2.globalAlpha = 1;
  ctx2.strokeStyle = '#ffffff99';
  ctx2.lineWidth = 1.5;
  ctx2.lineJoin = 'round';
  ctx2.beginPath();
  for (let x = 0; x <= W; x++) {
    const t = (x / W) * cycles * Math.PI * 2;
    const combined = (waveformSample('sine', t) + waveformSample('sine', t * ratio)) / 2;
    const y = H / 2 - combined * (H / 2 - 4);
    x === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
  }
  ctx2.stroke();

  // Detune label
  ctx2.fillStyle = '#ffffff66';
  ctx2.font = '8px monospace';
  ctx2.fillText(Math.abs(detune) + '¢', 3, 10);

  ctx2.restore();
}

function drawTeachOsc2Mix(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const mix = S.osc2Mix ?? 0;

  // VCO1 at full amplitude (amber)
  ctx2.globalAlpha = 1;
  drawWaveOnCanvas(ctx2, W, H, S.waveform || 'sine', '#e0a010', 2, 2.5);

  // VCO2 fades in with mix (steel blue)
  ctx2.globalAlpha = Math.max(0.03, mix);
  drawWaveOnCanvas(ctx2, W, H, S.osc2Waveform || 'sawtooth', '#4a90d0', 1.5, 2.5);

  // Mix bar at bottom: amber = VCO1 weight, blue = VCO2 weight
  ctx2.globalAlpha = 1;
  ctx2.fillStyle = '#0a0a14';
  ctx2.fillRect(0, H - 5, W, 5);
  ctx2.fillStyle = '#e0a010';
  ctx2.fillRect(0, H - 5, W * (1 - mix), 5);
  ctx2.fillStyle = '#4a90d0';
  ctx2.fillRect(W * (1 - mix), H - 5, W * mix, 5);

  ctx2.restore();
}
