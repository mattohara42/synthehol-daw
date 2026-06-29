// Coarse clock — posts a 'tick' on a fixed interval from a worker thread, so
// background-tab / mobile throttling of main-thread timers can't disturb the
// scheduler's timing. The main thread does the precise audio-clock scheduling
// on each tick (see scheduler.js / transport.js).

let timer = null;
let interval = 25; // ms

self.onmessage = (e) => {
  const { cmd, value } = e.data || {};
  if (cmd === 'start') {
    if (timer == null) timer = setInterval(() => self.postMessage('tick'), interval);
  } else if (cmd === 'stop') {
    if (timer != null) { clearInterval(timer); timer = null; }
  } else if (cmd === 'interval' && typeof value === 'number') {
    interval = value;
    if (timer != null) {
      clearInterval(timer);
      timer = setInterval(() => self.postMessage('tick'), interval);
    }
  }
};
