// Synthesized drum voices (F5 lean step) — no samples, three cheap one-shots
// fed straight into the master bus so they're heard, exported, and scaled by
// the Vol slider like everything else. Triggered from the step grid's drum
// lanes via the sequencer consumer.

let noiseBuffer = null;
function noiseBuf(ctx) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Pitch-dropping sine thump.
export function playKick(ctx, dest, time) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
  g.gain.setValueAtTime(0.9, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + 0.22);
}

// Bandpassed noise burst.
export function playSnare(ctx, dest, time) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + 0.16);
}

// Highpassed noise tick.
export function playHat(ctx, dest, time) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + 0.06);
}
