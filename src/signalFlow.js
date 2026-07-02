// Visible signal flow (D3): each audio-path module carries a small LED that
// glows with the signal level at its stage of the chain, so you can watch a
// sound travel VCO → VCF → EQ → FX across the rack. Driven once per frame
// from main.js's single rAF dispatcher.
//
// Three taps (created in audio.js): tapSource (summed voices — what the
// sources + envelope produce), tapFilter (post-VCF), tapEq (post-EQ, before
// the drums join at the master bus). The FX module reads the existing scope
// analyser (final post-FX mix). The LFO module has no LED — it's modulation,
// not audio path.

import { engine } from './audio.js';

// module id → engine analyser key. Source-side modules (both oscillators,
// noise, the amp envelope) all light from the summed voice output — their
// individual contributions aren't separable without per-source buses, and
// "your sources are producing signal" is the teaching point anyway.
const LED_TAPS = {
  'mod-osc': 'tapSource',
  'mod-osc2': 'tapSource',
  'mod-noise': 'tapSource',
  'mod-adsr': 'tapSource',
  'mod-filter': 'tapFilter',
  'mod-eq': 'tapEq',
  'mod-fx': 'scope',
};

// Peak deviation from the 128 midline of byte time-domain data, normalized
// to 0..1. Pure; exported for testing.
export function peakLevel(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const d = Math.abs(data[i] - 128);
    if (d > peak) peak = d;
  }
  return peak / 128;
}

let leds = null;   // [{ el, tapKey, buf }]
let lastLevels = new Map();

export function initSignalFlow() {
  leds = Object.entries(LED_TAPS).flatMap(([moduleId, tapKey]) => {
    const header = document.querySelector(`#${moduleId} .module-header`);
    if (!header) return [];
    const el = document.createElement('span');
    el.className = 'signal-led';
    el.title = 'Signal at this stage';
    header.appendChild(el);
    return [{ el, tapKey, buf: null }];
  });
}

// Per-frame update, called from main.js's animate loop.
export function refreshSignalFlow() {
  if (!leds || !engine.ctx) return;
  for (const led of leds) {
    const tap = engine[led.tapKey];
    if (!tap) continue;
    if (!led.buf) led.buf = new Uint8Array(tap.frequencyBinCount);
    tap.getByteTimeDomainData(led.buf);
    // Soft knee: even quiet signals visibly glow; full scale saturates.
    const level = Math.min(1, peakLevel(led.buf) * 2.5);
    // Skip sub-perceptual style writes.
    const prev = lastLevels.get(led) ?? -1;
    if (Math.abs(level - prev) < 0.02) continue;
    lastLevels.set(led, level);
    led.el.style.opacity = String(0.15 + level * 0.85);
    led.el.style.boxShadow = level > 0.05 ? `0 0 ${Math.round(2 + level * 6)}px var(--era-accent)` : 'none';
  }
}
