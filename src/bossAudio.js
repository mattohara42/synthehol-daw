// Combat audio — the boss fight's sound effects. An ears-first game shouldn't be
// silent during its climaxes: this plays a throttled "damage" blip while you
// drain a boss (pitch rising as its HP falls), a resolving major arpeggio when a
// boss is restored, and a fuller fanfare on graduation.
//
// Routed through its own gain straight to the destination so SFX bypass the
// player's master volume and synth filter — they're feedback, not instrument.

import { engine } from './audio.js';
import { bossEngine } from './bossEngine.js';

// A blip's pitch climbs as the boss nears defeat, raising tension. hpFrac is the
// boss's remaining-HP fraction (1 = full, 0 = beaten). Pure + testable.
export function damageBlipFreq(hpFrac) {
  const f = Math.min(1, Math.max(0, hpFrac));
  return 220 + (1 - f) * 440; // 220 Hz at full HP → 660 Hz at the kill
}

// Resolving C-major arpeggio (Hz) — the "instrument restored" sound.
export const RESTORE_ARP = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
// Graduation fanfare extends the arpeggio another octave.
export const GRADUATION_ARP = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0];

const BLIP_MIN_INTERVAL = 0.13; // seconds between damage blips (anti-buzz throttle)
let bus = null;
let lastBlip = -1;

function ensureBus() {
  const { ctx } = engine;
  if (!ctx) return null; // audio hasn't started — but damage only fires mid-play
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 0.22;
    bus.connect(ctx.destination);
  }
  return bus;
}

// Schedule a single enveloped tone on the SFX bus.
function tone(freq, startAt, dur, { type = 'triangle', peak = 0.9 } = {}) {
  const { ctx } = engine;
  const out = ensureBus();
  if (!out) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peak, startAt + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0005, startAt + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

function playArp(freqs, { step = 0.09, dur = 0.22, type = 'triangle' } = {}) {
  const { ctx } = engine;
  if (!ctx) return;
  const t0 = ctx.currentTime;
  freqs.forEach((f, i) => tone(f, t0 + i * step, dur, { type, peak: 0.8 }));
}

function damageBlip(hpFrac) {
  const { ctx } = engine;
  if (!ctx) return;
  const now = ctx.currentTime;
  if (lastBlip >= 0 && now - lastBlip < BLIP_MIN_INTERVAL) return; // throttle
  lastBlip = now;
  tone(damageBlipFreq(hpFrac), now, 0.06, { type: 'square', peak: 0.5 });
}

/** Subscribe SFX to boss events. Safe to call once at startup. */
export function initBossAudio() {
  bossEngine.onDamage(({ hp, maxHp, damage }) => {
    if (damage > 0) damageBlip(hp / maxHp);
  });
  bossEngine.onRestore(() => {
    if (bossEngine.graduated) playArp(GRADUATION_ARP, { step: 0.11, dur: 0.3 });
    else playArp(RESTORE_ARP);
  });
}
