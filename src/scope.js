// Live oscilloscope fed by the master AnalyserNode.

import { engine } from './audio.js';
import { dpr } from './canvas.js';

export function drawScope() {
  requestAnimationFrame(drawScope);

  const canvas = document.getElementById('scope-canvas');
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  if (!W || !H) return;

  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  const cx = canvas.getContext('2d');
  cx.save();
  cx.scale(dpr, dpr);
  cx.clearRect(0, 0, W, H);

  // Grid
  cx.strokeStyle = 'rgba(0, 180, 80, 0.08)';
  cx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    cx.beginPath();
    cx.moveTo(0, i*H/4); cx.lineTo(W, i*H/4);
    cx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    cx.beginPath();
    cx.moveTo(i*W/8, 0); cx.lineTo(i*W/8, H);
    cx.stroke();
  }

  const scope = engine.scope;
  if (!scope) {
    // Flat line
    cx.strokeStyle = '#00aa60';
    cx.lineWidth = 1.5;
    cx.beginPath();
    cx.moveTo(0, H/2); cx.lineTo(W, H/2);
    cx.stroke();
    cx.restore();
    return;
  }

  const bufLen = scope.frequencyBinCount;
  const data = new Uint8Array(bufLen);
  scope.getByteTimeDomainData(data);

  // Find zero crossing for stable display
  let start = 0;
  for (let i = 1; i < bufLen - 1; i++) {
    if (data[i-1] < 128 && data[i] >= 128) { start = i; break; }
  }

  cx.strokeStyle = '#00ee88';
  cx.lineWidth = 1.5;
  cx.shadowColor = '#00ee88';
  cx.shadowBlur = 6;
  cx.beginPath();

  const displayLen = Math.min(bufLen - start, bufLen / 2);
  for (let i = 0; i < displayLen; i++) {
    const x = (i / displayLen) * W;
    const v = data[start + i] / 128;
    const y = v * H / 2;
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  }
  cx.stroke();
  cx.shadowBlur = 0;
  cx.restore();
}

// Live frequency spectrum from the same AnalyserNode. Renders the lower quarter
// of bins (~0–5.5 kHz at 44.1 kHz) as bars on a linear scale, so harmonics show
// up as an evenly-spaced comb — the visual companion to the teaching copy about
// which harmonics each waveform contains.
export function drawSpectrum() {
  requestAnimationFrame(drawSpectrum);

  const canvas = document.getElementById('spectrum-canvas');
  if (!canvas) return;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  if (!W || !H) return;

  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  const cx = canvas.getContext('2d');
  cx.save();
  cx.scale(dpr, dpr);
  cx.clearRect(0, 0, W, H);

  // Baseline
  cx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
  cx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    cx.beginPath();
    cx.moveTo(0, i * H / 4); cx.lineTo(W, i * H / 4);
    cx.stroke();
  }

  const scope = engine.scope;
  if (!scope) { cx.restore(); return; }

  const bins = scope.frequencyBinCount;
  const data = new Uint8Array(bins);
  scope.getByteFrequencyData(data);

  const shown = Math.max(1, Math.floor(bins * 0.25));
  const barW = W / shown;
  for (let i = 0; i < shown; i++) {
    const mag = data[i] / 255;          // 0..1
    const barH = mag * (H - 2);
    cx.fillStyle = `rgba(245, 158, 11, ${0.3 + mag * 0.7})`;
    cx.fillRect(i * barW, H - barH, Math.max(1, barW - 0.5), barH);
  }
  cx.restore();
}
