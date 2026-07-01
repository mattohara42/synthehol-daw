// Transport — play/stop/tempo/loop over the project store's transport block,
// wiring the Web Worker clock to the lookahead scheduler. Position is written
// transiently (never into undo history); bpm is an undoable edit.

import { store } from './store.js';
import { engine, startAudio, releaseAllVoices } from './audio.js';
import { createScheduler, positionFor } from './scheduler.js';
import { stepDuration } from './sequencer.js';
import { metronomeClick } from './metronome.js';

let worker = null;
let scheduler = null;
const consumers = new Set(); // fn(step, time, position)

function buildWorker() {
  try {
    const w = new Worker(new URL('./clock.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = () => scheduler.tick();
    return w;
  } catch {
    // Fallback: drive tick() from a main-thread interval if Worker is unavailable.
    return {
      _id: null,
      postMessage(msg) {
        if (msg.cmd === 'start') { this._id ??= setInterval(() => scheduler.tick(), 25); }
        else if (msg.cmd === 'stop') { clearInterval(this._id); this._id = null; }
      },
    };
  }
}

export const transport = {
  init() {
    if (scheduler) return;
    scheduler = createScheduler({
      now: () => (engine.ctx ? engine.ctx.currentTime : 0),
      getBpm: () => store.get().transport.bpm,
      schedule: (step, time) => {
        const pos = positionFor(step, store.get().transport);
        Object.assign(store.get().transport.position, pos); // in place, no history
        for (const fn of consumers) fn(step, time, pos);
      },
    });
    worker = buildWorker();
  },

  play() {
    startAudio();
    this.init();
    const t = store.get().transport;
    let startAt = engine.ctx.currentTime + 0.05;
    if (t.countIn) {
      const beatDur = stepDuration(t.bpm, 1);
      const beats = t.timeSig[0];
      for (let i = 0; i < beats; i++) metronomeClick(startAt + i * beatDur, i === 0);
      startAt += beats * beatDur;
    }
    scheduler.start(startAt);
    store.setTransient('transport.playing', true);
    worker.postMessage({ cmd: 'start' });
  },

  stop() {
    worker?.postMessage({ cmd: 'stop' });
    scheduler?.stop();
    releaseAllVoices(); // silence any sounding polyphonic voices
    store.setTransient('transport.playing', false);
    Object.assign(store.get().transport.position, { bar: 0, beat: 0, sixteenth: 0 });
  },

  toggle() { store.get().transport.playing ? this.stop() : this.play(); },

  setBpm(n) { store.setPath('transport.bpm', Math.min(300, Math.max(20, Math.round(n)))); },

  toggleMetronome() {
    store.setTransient('transport.metronome', !store.get().transport.metronome);
  },

  toggleCountIn() {
    store.setTransient('transport.countIn', !store.get().transport.countIn);
  },

  setLoop(enabled, startBar, endBar) {
    store.setPath('transport.loop', { enabled, startBar, endBar });
  },

  /** Register a scheduler consumer: fn(step, time, position). Returns unsubscribe. */
  registerConsumer(fn) { consumers.add(fn); return () => consumers.delete(fn); },
};
