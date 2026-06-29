// Shared canvas drawing primitives used by both the per-module mini
// visualizers and the teaching panel's illustrations.

import { S } from './state.js';
import { engine } from './audio.js';

export const dpr = window.devicePixelRatio || 1;

export function setupCanvas(canvas) {
  const W = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 200;
  const H = canvas.offsetHeight || parseInt(canvas.style.height) || 52;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx2 = canvas.getContext('2d');
  ctx2.save();
  ctx2.scale(dpr, dpr);
  ctx2.clearRect(0, 0, W, H);
  return { ctx2, W, H };
}

export function waveformSample(type, t) {
  const p = t % (Math.PI * 2);
  switch (type) {
    case 'sine':     return Math.sin(t);
    case 'square':   return Math.sign(Math.sin(t));
    case 'sawtooth': return 1 - p / Math.PI;
    case 'triangle': return 2 * Math.abs(2 * (t/(Math.PI*2) - Math.floor(t/(Math.PI*2) + 0.5))) - 1;
    default: return 0;
  }
}

export function drawWaveOnCanvas(ctx2, W, H, type, color, lw, cycles, phaseOffset = 0) {
  ctx2.strokeStyle = color;
  ctx2.lineWidth = lw;
  ctx2.lineJoin = 'round';
  ctx2.beginPath();
  for (let x = 0; x <= W; x++) {
    const t = (x / W) * cycles * Math.PI * 2 + phaseOffset;
    const y = H/2 - waveformSample(type, t) * (H/2 - 4);
    x === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
  }
  ctx2.stroke();
}

export function drawFilterCurveOnCanvas(ctx2, W, H, color) {
  const nPts = Math.ceil(W);
  const freqArr = new Float32Array(nPts);
  const magArr = new Float32Array(nPts);
  const phaseArr = new Float32Array(nPts);

  for (let i = 0; i < nPts; i++) {
    freqArr[i] = 20 * Math.pow(1000, i / nPts); // 20Hz–20kHz log scale
  }

  if (engine.vcf) {
    engine.vcf.getFrequencyResponse(freqArr, magArr, phaseArr);
  } else {
    // Approximate before the audio graph exists
    for (let i = 0; i < nPts; i++) {
      const ratio = freqArr[i] / S.cutoff;
      let mag;
      if (S.filterType === 'lowpass')  mag = 1 / Math.sqrt(1 + Math.pow(ratio * S.resonance, 6));
      else if (S.filterType === 'highpass') mag = 1 / Math.sqrt(1 + Math.pow(S.resonance / ratio, 6));
      else mag = S.resonance / Math.sqrt(Math.pow(S.resonance, 2) + Math.pow(ratio - 1/ratio, 2) * S.resonance);
      magArr[i] = Math.min(4, Math.max(0, mag));
    }
  }

  ctx2.fillStyle = color + '22';
  ctx2.strokeStyle = color;
  ctx2.lineWidth = 1.5;

  const toY = (mag) => {
    const db = 20 * Math.log10(Math.max(0.001, mag));
    return H/2 - (db / 48) * (H - 6);
  };

  ctx2.beginPath();
  for (let i = 0; i < nPts; i++) {
    const x = (i / nPts) * W;
    const y = toY(magArr[i]);
    i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
  }
  ctx2.lineTo(W, H); ctx2.lineTo(0, H); ctx2.closePath();
  ctx2.fill();

  ctx2.beginPath();
  for (let i = 0; i < nPts; i++) {
    const x = (i / nPts) * W;
    const y = toY(magArr[i]);
    i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
  }
  ctx2.stroke();

  // Cutoff marker
  const cutoffX = Math.log10(S.cutoff / 20) / 3 * W;
  ctx2.strokeStyle = color + '55';
  ctx2.lineWidth = 1;
  ctx2.setLineDash([3, 3]);
  ctx2.beginPath();
  ctx2.moveTo(cutoffX, 0); ctx2.lineTo(cutoffX, H);
  ctx2.stroke();
  ctx2.setLineDash([]);
}

export function drawADSRShape(ctx2, W, H, color, pad) {
  const p = pad || 4;
  const drawW = W - p * 2;
  const bot = H - p, top = p;
  const totalT = Math.min(S.attack + S.decay + 0.4 + S.release, 5.5);
  const aW = (S.attack / totalT) * drawW;
  const dW = (S.decay  / totalT) * drawW;
  const sW = (0.4      / totalT) * drawW;
  const rW = (S.release/ totalT) * drawW;
  const susY = top + (1 - S.sustain) * (bot - top);

  const x0 = p, x1 = x0+aW, x2 = x1+dW, x3 = x2+sW, x4 = x3+rW;

  ctx2.fillStyle = color + '1a';
  ctx2.strokeStyle = color;
  ctx2.lineWidth = 1.5;
  ctx2.lineJoin = 'round';

  ctx2.beginPath();
  ctx2.moveTo(x0, bot); ctx2.lineTo(x1, top);
  ctx2.lineTo(x2, susY); ctx2.lineTo(x3, susY);
  ctx2.lineTo(x4, bot); ctx2.lineTo(x0, bot);
  ctx2.closePath(); ctx2.fill();

  ctx2.beginPath();
  ctx2.moveTo(x0, bot); ctx2.lineTo(x1, top);
  ctx2.lineTo(x2, susY); ctx2.lineTo(x3, susY);
  ctx2.lineTo(x4, bot);
  ctx2.stroke();

  return { x0, x1, x2, x3, x4, bot, top, susY };
}

// ── Per-module mini canvases ──

export function drawModCanvas(mod) {
  switch (mod) {
    case 'osc':    drawOscCanvas(); break;
    case 'filter': drawFilterCanvas(); break;
    case 'adsr':   drawADSRCanvas(); break;
    case 'lfo':    drawLFOCanvas(); break;
    case 'fx':     drawFXCanvas(); break;
  }
}

export function drawOscCanvas() {
  const canvas = document.getElementById('c-osc');
  const { ctx2, W, H } = setupCanvas(canvas);
  drawWaveOnCanvas(ctx2, W, H, S.waveform, '#f59e0b', 1.5, 2.5);
  ctx2.restore();
}

export function drawFilterCanvas() {
  const canvas = document.getElementById('c-filter');
  const { ctx2, W, H } = setupCanvas(canvas);
  drawFilterCurveOnCanvas(ctx2, W, H, '#22d3ee');
  ctx2.restore();
}

export function drawADSRCanvas() {
  const canvas = document.getElementById('c-adsr');
  const { ctx2, W, H } = setupCanvas(canvas);
  drawADSRShape(ctx2, W, H, '#a78bfa');
  ctx2.restore();
}

let lfoPhase = 0;

export function drawLFOCanvas() {
  const canvas = document.getElementById('c-lfo');
  const { ctx2, W, H } = setupCanvas(canvas);
  const active = S.lfoDest !== 'none';
  const color = active ? '#4ade80' : '#2a2a40';
  const cycles = Math.max(1, Math.min(5, S.lfoRate * 0.7));
  // Scroll the wave using lfoPhase so it animates
  drawWaveOnCanvas(ctx2, W, H, 'sine', color, 1.5, cycles, lfoPhase);
  ctx2.restore();
}

// Delay / reverb visualization: a dry impulse, decaying echo taps spaced by the
// delay time and scaled by feedback × mix, over a faint reverb-tail wash.
export function drawFXCanvas() {
  const canvas = document.getElementById('c-fx');
  if (!canvas) return;
  const { ctx2, W, H } = setupCanvas(canvas);
  const pink = '#f472b6';
  const base = H - 6, top = 6, span = base - top;

  // Reverb wash — exponential decay fill scaled by reverb mix.
  if (S.reverbMix > 0) {
    ctx2.beginPath();
    ctx2.moveTo(0, base);
    for (let x = 0; x <= W; x++) {
      const env = Math.exp(-(x / W) * 3.2) * S.reverbMix;
      ctx2.lineTo(x, base - env * span * 0.9);
    }
    ctx2.lineTo(W, base);
    ctx2.closePath();
    ctx2.fillStyle = 'rgba(244,114,182,0.10)';
    ctx2.fill();
  }

  // Delay taps — dry impulse plus echoes spaced by delay time, decaying by feedback.
  const gap = 14 + (S.delayTime / 0.8) * (W * 0.28);
  ctx2.lineCap = 'round';
  const tap = (x, h, dry) => {
    ctx2.globalAlpha = dry ? 1 : Math.max(0.12, h);
    ctx2.strokeStyle = pink;
    ctx2.lineWidth = dry ? 2.5 : 2;
    ctx2.beginPath();
    ctx2.moveTo(x, base);
    ctx2.lineTo(x, base - h * span);
    ctx2.stroke();
  };
  tap(10, 1, true);
  let x = 10 + gap, h = S.delayMix;
  while (x < W - 2 && h > 0.03) {
    tap(x, h, false);
    h *= S.delayFeedback;
    x += gap;
  }
  ctx2.globalAlpha = 1;
  ctx2.restore();
}

export function advanceLfoPhase() {
  lfoPhase += S.lfoRate * 0.015;
}
