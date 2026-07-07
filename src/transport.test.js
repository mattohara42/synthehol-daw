import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stepDuration } from './sequencer.js';

// transport.js talks to the real AudioContext through audio.js's `engine`
// singleton and fires metronome clicks through metronome.js. Neither needs
// a real audio graph to verify transport's own scheduling/state logic, so
// both are mocked: `engine.ctx.currentTime` becomes a plain number we can
// move by hand, and metronomeClick becomes a spy.
vi.mock('./audio.js', () => ({
  engine: { ctx: { currentTime: 0 } },
  startAudio: vi.fn(),
  releaseAllVoices: vi.fn(),
}));
vi.mock('./metronome.js', () => ({
  metronomeClick: vi.fn(),
}));

const { transport } = await import('./transport.js');
const { store } = await import('./store.js');
const { engine, startAudio, releaseAllVoices } = await import('./audio.js');
const { metronomeClick } = await import('./metronome.js');

// `Worker` doesn't exist in the Node test environment, so buildWorker()'s
// try/catch always lands on the main-thread setInterval fallback here —
// which means these tests exercise exactly the fallback path that has no
// coverage in a real browser test run either.

beforeEach(() => {
  store._resetForTest();
  engine.ctx.currentTime = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  transport.stop(); // always clear the fallback interval so it can't leak into the next test
});

describe('transport – setBpm()', () => {
  it('clamps to the 20–300 range', () => {
    transport.setBpm(500);
    expect(store.get().transport.bpm).toBe(300);
    transport.setBpm(5);
    expect(store.get().transport.bpm).toBe(20);
  });

  it('rounds to the nearest integer', () => {
    transport.setBpm(140.6);
    expect(store.get().transport.bpm).toBe(141);
  });

  it('is an undoable edit', () => {
    const before = store.get().transport.bpm;
    transport.setBpm(160);
    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.get().transport.bpm).toBe(before);
  });
});

describe('transport – toggleMetronome() / toggleCountIn()', () => {
  it('toggleMetronome flips transport.metronome without creating undo history', () => {
    const before = store.get().transport.metronome;
    transport.toggleMetronome();
    expect(store.get().transport.metronome).toBe(!before);
    expect(store.canUndo()).toBe(false);
  });

  it('toggleCountIn flips transport.countIn without creating undo history', () => {
    const before = store.get().transport.countIn;
    transport.toggleCountIn();
    expect(store.get().transport.countIn).toBe(!before);
    expect(store.canUndo()).toBe(false);
  });
});

describe('transport – setLoop()', () => {
  it('writes the loop config as an undoable edit', () => {
    transport.setLoop(true, 1, 5);
    expect(store.get().transport.loop).toEqual({ enabled: true, startBar: 1, endBar: 5 });
    expect(store.canUndo()).toBe(true);
  });
});

describe('transport – play() / stop() / toggle()', () => {
  it('play() starts audio and marks the transport playing', () => {
    transport.play();
    expect(startAudio).toHaveBeenCalled();
    expect(store.get().transport.playing).toBe(true);
  });

  it('stop() releases voices, marks not-playing, and resets position to zero', () => {
    transport.play();
    Object.assign(store.get().transport.position, { bar: 3, beat: 2, sixteenth: 1 });
    transport.stop();
    expect(releaseAllVoices).toHaveBeenCalled();
    expect(store.get().transport.playing).toBe(false);
    expect(store.get().transport.position).toEqual({ bar: 0, beat: 0, sixteenth: 0 });
  });

  it('toggle() plays when stopped and stops when already playing', () => {
    expect(store.get().transport.playing).toBe(false);
    transport.toggle();
    expect(store.get().transport.playing).toBe(true);
    transport.toggle();
    expect(store.get().transport.playing).toBe(false);
  });

  it('play()/stop() never touch undo history (playback state, not content)', () => {
    transport.play();
    transport.stop();
    expect(store.canUndo()).toBe(false);
  });
});

describe('transport – count-in scheduling', () => {
  it('schedules no clicks when count-in is off (the default)', () => {
    transport.play();
    expect(metronomeClick).not.toHaveBeenCalled();
  });

  it('schedules exactly timeSig[0] clicks, one beat apart, only the first accented', () => {
    store.setPath('transport.timeSig', [3, 4]); // 3/4 time → 3 count-in clicks
    transport.toggleCountIn();
    engine.ctx.currentTime = 10;

    transport.play();

    expect(metronomeClick).toHaveBeenCalledTimes(3);
    const calls = metronomeClick.mock.calls;
    const beatDur = stepDuration(store.get().transport.bpm, 1);
    const startAt = 10.05; // engine.ctx.currentTime + the scheduler's fixed 0.05s lead-in

    expect(calls[0]).toEqual([startAt, true]);
    expect(calls[1][0]).toBeCloseTo(startAt + beatDur, 6);
    expect(calls[1][1]).toBe(false);
    expect(calls[2][0]).toBeCloseTo(startAt + 2 * beatDur, 6);
    expect(calls[2][1]).toBe(false);
  });
});

describe('transport – registerConsumer() over the worker-fallback clock', () => {
  it('delivers scheduled steps as the audio clock advances, and stops after unsubscribe', () => {
    vi.useFakeTimers();
    const calls = [];
    const unsub = transport.registerConsumer((step, time) => calls.push({ step, time }));

    engine.ctx.currentTime = 100;
    transport.play(); // scheduler.start(100.05)

    vi.advanceTimersByTime(30); // one 25ms fallback tick
    expect(calls).toEqual([{ step: 0, time: 100.05 }]);

    engine.ctx.currentTime = 100.2; // audio clock moves forward; step 1 now falls in the lookahead window
    vi.advanceTimersByTime(30);
    expect(calls).toEqual([
      { step: 0, time: 100.05 },
      { step: 1, time: 100.175 },
    ]);

    unsub();
    engine.ctx.currentTime = 101; // plenty more steps now due
    vi.advanceTimersByTime(200);
    expect(calls).toHaveLength(2); // unsubscribed consumer received nothing further

    vi.useRealTimers();
  });
});
