import { describe, it, expect } from 'vitest';
import {
  createScheduler, stepToPosition, positionFor, stepsPerBar, STEPS_PER_BEAT,
} from './scheduler.js';

// Drive the scheduler with a controllable clock and capture scheduled events.
function harness({ bpm = 120, lookahead = 0.1 } = {}) {
  let t = 0;
  let _bpm = bpm;
  const scheduled = [];
  const s = createScheduler({
    now: () => t,
    getBpm: () => _bpm,
    schedule: (step, time) => scheduled.push({ step, time }),
    lookahead,
  });
  return { s, scheduled, setNow: (x) => { t = x; }, setBpm: (b) => { _bpm = b; } };
}

describe('scheduler – lookahead core', () => {
  it('does nothing before start()', () => {
    const { s, scheduled } = harness();
    s.tick();
    expect(scheduled).toHaveLength(0);
  });

  it('schedules only steps inside [now, now+lookahead)', () => {
    const { s, scheduled, setNow } = harness({ bpm: 120, lookahead: 0.3 });
    s.start(0);
    s.tick(); // 120bpm/16ths → 0.125s/step; window [0,0.3): steps 0,1,2
    expect(scheduled.map(e => e.step)).toEqual([0, 1, 2]);
    expect(scheduled.map(e => +e.time.toFixed(3))).toEqual([0, 0.125, 0.25]);
    scheduled.length = 0;
    setNow(0.3);
    s.tick(); // window [0.3,0.6): steps 3,4 (0.375, 0.5)
    expect(scheduled.map(e => e.step)).toEqual([3, 4]);
  });

  it('spaces steps by 60/bpm/4 seconds (120bpm → 0.125s)', () => {
    const { s, scheduled, setNow } = harness({ bpm: 120, lookahead: 0.05 });
    s.start(0);
    s.tick();              // only step 0 (next at 0.125 is outside 0.05 window)
    setNow(0.125);
    s.tick();              // step 1
    expect(scheduled.map(e => e.step)).toEqual([0, 1]);
    expect(+(scheduled[1].time - scheduled[0].time).toFixed(3)).toBe(0.125);
  });

  it('applies a tempo change within the next window', () => {
    const { s, scheduled, setNow, setBpm } = harness({ bpm: 120, lookahead: 0.05 });
    s.start(0);
    s.tick();              // step 0 @ 0, next @ 0.125
    setBpm(240);           // now 0.0625s/step
    setNow(0.125);
    s.tick();              // step 1 @ 0.125, next @ 0.1875
    setNow(0.1875);
    s.tick();              // step 2 @ 0.1875
    expect(+(scheduled[2].time - scheduled[1].time).toFixed(4)).toBe(0.0625);
  });

  it('stops scheduling after stop()', () => {
    const { s, scheduled, setNow } = harness();
    s.start(0);
    s.tick();
    const n = scheduled.length;
    s.stop();
    setNow(10);
    s.tick();
    expect(scheduled).toHaveLength(n);
  });
});

describe('scheduler – musical position', () => {
  it('stepsPerBar follows the time signature', () => {
    expect(stepsPerBar([4, 4])).toBe(16);
    expect(stepsPerBar([3, 4])).toBe(12);
    expect(STEPS_PER_BEAT).toBe(4);
  });

  it('maps steps to bar/beat/sixteenth (4/4)', () => {
    expect(stepToPosition(0, [4, 4])).toEqual({ bar: 0, beat: 0, sixteenth: 0 });
    expect(stepToPosition(4, [4, 4])).toEqual({ bar: 0, beat: 1, sixteenth: 0 });
    expect(stepToPosition(17, [4, 4])).toEqual({ bar: 1, beat: 0, sixteenth: 1 });
  });

  it('wraps position within an enabled loop', () => {
    const transport = { timeSig: [4, 4], loop: { enabled: true, startBar: 0, endBar: 2 } };
    expect(positionFor(31, transport)).toEqual({ bar: 1, beat: 3, sixteenth: 3 });
    expect(positionFor(32, transport)).toEqual({ bar: 0, beat: 0, sixteenth: 0 }); // wrapped
    expect(positionFor(33, transport)).toEqual({ bar: 0, beat: 0, sixteenth: 1 });
  });

  it('does not wrap when loop is disabled', () => {
    const transport = { timeSig: [4, 4], loop: { enabled: false, startBar: 0, endBar: 2 } };
    expect(positionFor(32, transport)).toEqual({ bar: 2, beat: 0, sixteenth: 0 });
  });
});
