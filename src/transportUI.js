// Transport bar UI (L2) — the visible face of the E2 transport clock. Wires the
// play/stop button, tempo field, metronome + loop toggles to `transport.js`, and
// reflects committed transport state via a store subscription. The live position
// readout is pulled each animation frame (position is mutated in place by the
// scheduler and intentionally does NOT fire store subscribers — see transport.js),
// so `refreshTransportPosition()` is called from main.js's animate loop.

import { store } from './store.js';
import { transport } from './transport.js';

// Format a {bar, beat, sixteenth} position (all 0-indexed internally) into the
// 1-indexed "bar . beat . sixteenth" string DAWs conventionally display.
export function formatPosition(pos) {
  return `${pos.bar + 1} . ${pos.beat + 1} . ${pos.sixteenth + 1}`;
}

let els = null;
let lastPosText = '';

function reflectPlaying(playing) {
  const { play } = els;
  play.classList.toggle('playing', playing);
  play.setAttribute('aria-pressed', String(playing));
  play.setAttribute('aria-label', playing ? 'Stop' : 'Play');
  play.querySelector('.tr-play-glyph').textContent = playing ? '■' : '▶';
  play.querySelector('.tr-play-text').textContent = playing ? 'Stop' : 'Play';
}

function reflectToggle(btn, on) {
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
}

// Mirror the store into the controls. Called on init and on every committed change.
function reflectAll() {
  const t = store.get().transport;
  reflectPlaying(t.playing);
  // Don't stomp the field while the user is typing in it.
  if (document.activeElement !== els.bpm) els.bpm.value = t.bpm;
  els.sig.textContent = `${t.timeSig[0]}/${t.timeSig[1]}`;
  reflectToggle(els.metro, t.metronome);
  reflectToggle(els.loop, t.loop.enabled);
  reflectToggle(els.countin, t.countIn);
}

export function refreshTransportPosition() {
  if (!els) return;
  const text = formatPosition(store.get().transport.position);
  if (text !== lastPosText) {
    els.pos.textContent = text;
    lastPosText = text;
  }
}

export function initTransportUI() {
  els = {
    play: document.getElementById('tr-play'),
    pos: document.getElementById('tr-pos'),
    bpm: document.getElementById('tr-bpm'),
    sig: document.getElementById('tr-sig'),
    metro: document.getElementById('tr-metro'),
    loop: document.getElementById('tr-loop'),
    countin: document.getElementById('tr-countin'),
    tap: document.getElementById('tr-tap'),
  };
  if (!els.play) return; // markup absent (e.g. a non-DAW build) — bail quietly.

  els.play.addEventListener('click', () => transport.toggle());
  els.metro.addEventListener('click', () => transport.toggleMetronome());
  els.loop.addEventListener('click', () => {
    const l = store.get().transport.loop;
    transport.setLoop(!l.enabled, l.startBar, l.endBar);
  });
  els.countin.addEventListener('click', () => transport.toggleCountIn());

  // Tap tempo: average the gaps between recent taps into a BPM. A gap over 2s
  // means the user started a fresh tempo, so the buffer resets.
  let tapTimes = [];
  els.tap.addEventListener('click', () => {
    const now = performance.now();
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes = [];
    tapTimes.push(now);
    if (tapTimes.length > 8) tapTimes.shift();
    if (tapTimes.length < 2) return;
    const gaps = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
    const avgMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    transport.setBpm(60000 / avgMs);
  });

  // Tempo: commit on change/Enter, clamp via transport.setBpm.
  const commitBpm = () => {
    const n = Number(els.bpm.value);
    if (Number.isFinite(n)) transport.setBpm(n);
    els.bpm.value = store.get().transport.bpm; // reflect the clamped value back
  };
  els.bpm.addEventListener('change', commitBpm);
  els.bpm.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.bpm.blur(); });

  store.subscribe(reflectAll);
  reflectAll();
}
