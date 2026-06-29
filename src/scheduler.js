// Lookahead scheduler ("A Tale of Two Clocks") + musical-position helpers.
//
// A coarse timer (the Web Worker in clock.worker.js) calls tick() frequently;
// tick() looks ahead a small window and schedules every step whose time falls
// inside it against the audio clock. The core is pure and injectable (now /
// schedule / getBpm) so it unit-tests without a worker or an AudioContext.

export const STEPS_PER_BEAT = 4; // 16th-note grid

export function stepsPerBar(timeSig) {
  return timeSig[0] * STEPS_PER_BEAT;
}

export function stepToPosition(step, timeSig) {
  const spb = stepsPerBar(timeSig);
  const bar = Math.floor(step / spb);
  const within = step % spb;
  return { bar, beat: Math.floor(within / STEPS_PER_BEAT), sixteenth: within % STEPS_PER_BEAT };
}

// Wrap a monotonic step into the loop region (musical time loops; real time
// keeps advancing).
export function loopStep(step, transport) {
  const loop = transport.loop;
  if (!loop || !loop.enabled) return step;
  const spb = stepsPerBar(transport.timeSig);
  const start = loop.startBar * spb;
  const len = (loop.endBar - loop.startBar) * spb;
  if (len <= 0) return step;
  return start + ((((step - start) % len) + len) % len);
}

export function positionFor(step, transport) {
  return stepToPosition(loopStep(step, transport), transport.timeSig);
}

export function createScheduler({ now, schedule, getBpm,
                                  stepsPerBeat = STEPS_PER_BEAT, lookahead = 0.1 }) {
  let running = false;
  let nextStepTime = 0;
  let step = 0;
  const stepDur = () => (60 / getBpm()) / stepsPerBeat;

  return {
    start(at) { running = true; nextStepTime = at; step = 0; },
    stop() { running = false; },
    isRunning: () => running,
    currentStep: () => step,
    nextTime: () => nextStepTime,
    // Schedule every step due within [now, now + lookahead). Reads bpm per call
    // so tempo changes take effect within one window.
    tick() {
      if (!running) return;
      while (nextStepTime < now() + lookahead) {
        schedule(step, nextStepTime);
        nextStepTime += stepDur();
        step += 1;
      }
    },
  };
}
