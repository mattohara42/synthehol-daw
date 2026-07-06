// Synthesized drum voices (F5 lean step; cowbell/clap added for the Roland
// TB-303/TR-808 patches slice, see docs/brainstorms/
// 2026-07-06-roland-303-808-requirements.md) — no samples, cheap one-shots
// fed straight into the master bus so they're heard, exported, and scaled by
// the Vol slider like everything else. Triggered from the step grid's drum
// lanes via the sequencer consumer.

// Keyed per-context (not a single global) — an AudioBuffer belongs to the
// context that created it, so this must not be reused across two contexts
// (e.g. the live engine plus an OfflineAudioContext render).
const noiseBuffers = new WeakMap();
function noiseBuf(ctx) {
  if (!noiseBuffers.has(ctx)) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return noiseBuffers.get(ctx);
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

// Two square oscillators at a non-harmonic ratio (540 Hz / 800 Hz) through a
// bandpass filter — the real TR-808 cowbell circuit's own recipe, cheaply
// approximable since it never needed to be tonal in the first place.
export function playCowbell(ctx, dest, time) {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  bp.connect(g);
  g.connect(dest);

  for (const freq of [540, 800]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(bp);
    osc.start(time);
    osc.stop(time + 0.32);
  }
}

// Three fast noise bursts (a "flam") followed by a longer tail, all through
// one bandpass filter — the TR-808 clap's own structure, distinguishing it
// from the snare's single burst.
export function playClap(ctx, dest, time) {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200;
  bp.Q.value = 1;
  bp.connect(dest);

  const burstOffsets = [0, 0.012, 0.024];
  for (const offset of burstOffsets) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(ctx);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, time + offset);
    g.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.02);
    src.connect(g);
    g.connect(bp);
    src.start(time + offset);
    src.stop(time + offset + 0.03);
  }

  const tailStart = time + burstOffsets[burstOffsets.length - 1];
  const tailSrc = ctx.createBufferSource();
  tailSrc.buffer = noiseBuf(ctx);
  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(0.35, tailStart);
  tailGain.gain.exponentialRampToValueAtTime(0.001, tailStart + 0.15);
  tailSrc.connect(tailGain);
  tailGain.connect(bp);
  tailSrc.start(tailStart);
  tailSrc.stop(tailStart + 0.16);
}
