// Metronome — the transport's first audible consumer. Plays a short click on
// each beat (accented on the bar's downbeat), gated by transport.metronome.
// Routed through its own gain straight to the destination, like bossAudio.

import { store } from './store.js';
import { engine } from './audio.js';

let bus = null;

// Exported so the transport can fire count-in clicks directly (outside the
// scheduler's normal step-driven path).
export function metronomeClick(time, accent) {
  click(time, accent);
}

function click(time, accent) {
  const { ctx } = engine;
  if (!ctx) return;
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 0.4;
    bus.connect(ctx.destination);
  }
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1760 : 1200, time);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.6, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0005, time + 0.05);
  osc.connect(g);
  g.connect(bus);
  osc.start(time);
  osc.stop(time + 0.06);
}

// Scheduler consumer: (step, time, position) — click on each beat boundary.
export function metronomeConsumer(step, time, pos) {
  if (!store.get().transport.metronome) return;
  if (pos.sixteenth === 0) click(time, pos.beat === 0);
}
