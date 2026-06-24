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
  cx.strokeStyle = 'rgba(224, 164, 23, 0.09)';
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
    cx.strokeStyle = '#8a6418';
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

  cx.strokeStyle = '#f5b423';
  cx.lineWidth = 1.5;
  cx.shadowColor = '#f5b423';
  cx.shadowBlur = 7;
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
