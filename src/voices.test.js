import { describe, it, expect, beforeEach } from 'vitest';
import { createVoiceManager } from './voices.js';

// A fake AudioParam that records the events scheduled on it.
function fakeParam(value = 0) {
  return {
    value,
    events: [],
    setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); return this; },
    linearRampToValueAtTime(v, t) { this.value = v; this.events.push(['lin', v, t]); return this; },
    cancelScheduledValues(t) { this.events.push(['cancel', t]); return this; },
  };
}

// A fake AudioContext just rich enough for the voice manager. Tracks created
// oscillators/gains and connections so tests can assert on the graph.
function fakeCtx() {
  const ctx = {
    oscillators: [],
    gains: [],
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: fakeParam(0),
        detune: fakeParam(0),
        started: null,
        stopped: null,
        onended: null,
        connect() {},
        start(t) { this.started = t; },
        stop(t) { this.stopped = t; },
      };
      ctx.oscillators.push(osc);
      return osc;
    },
    createGain() {
      const g = { gain: fakeParam(0), connections: [], connect(n) { this.connections.push(n); }, disconnect() {} };
      ctx.gains.push(g);
      return g;
    },
    sampleRate: 44100,
    createBuffer(_ch, len) { return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource() {
      const s = { buffer: null, loop: false, started: null, stopped: null, onended: null,
        connect() {}, start(t) { this.started = t; }, stop(t) { this.stopped = t; } };
      ctx.bufferSources = ctx.bufferSources || [];
      ctx.bufferSources.push(s);
      return s;
    },
    createBiquadFilter() {
      return { type: 'lowshelf', frequency: fakeParam(0), gain: fakeParam(0), connect() {} };
    },
  };
  return ctx;
}

const PARAMS = {
  waveform: 'sawtooth', detune: 5, attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3,
  noiseType: 'white', noiseMix: 0,
  osc2Waveform: 'sawtooth', osc2Octave: 0, osc2Detune: 7, osc2Mix: 0,
};

function setup(maxVoices = 16, params = PARAMS) {
  const ctx = fakeCtx();
  const output = { tag: 'vcf' };
  const vm = createVoiceManager({ ctx, output, getParams: () => params, maxVoices });
  return { ctx, output, vm };
}

// A fake GainNode standing in for the shared LFO modulation signal, tracking
// which AudioParams it's connected to (per-voice pitch/amp targets).
function fakeLfoMod() {
  return {
    connections: [],
    connect(target) { this.connections.push(target); },
    disconnect(target) { this.connections = this.connections.filter(c => c !== target); },
  };
}

describe('voices – voice manager', () => {
  let ctx, output, vm;
  beforeEach(() => { ({ ctx, output, vm } = setup()); });

  it('creates a voice on noteOn, wired to output and started at time', () => {
    const id = vm.noteOn(440, 1.0, 0.8);
    expect(typeof id).toBe('number');
    expect(vm.activeCount()).toBe(1);
    expect(ctx.oscillators).toHaveLength(2);      // primary osc + VCO2
    const osc = ctx.oscillators[0];               // primary oscillator
    expect(osc.type).toBe('sawtooth');           // reads S.waveform
    expect(osc.detune.value).toBe(5);            // reads S.detune
    expect(osc.frequency.events[0]).toEqual(['set', 440, 1.0]);
    expect(osc.started).toBe(1.0);
    // amp connects to the provided output node
    const amp = ctx.gains[0];
    expect(amp.connections).toContain(output);
  });

  it('schedules a velocity-scaled ADSR attack/decay on the amp gain', () => {
    vm.noteOn(220, 0, 0.5);
    const amp = ctx.gains[0];
    // 0 at t0, peak=velocity at attack, sustain*velocity at attack+decay
    expect(amp.gain.events).toEqual([
      ['set', 0, 0],
      ['lin', 0.5, 0.01],
      ['lin', 0.7 * 0.5, 0.01 + 0.2],
    ]);
  });

  it('clamps velocity into [0,1]', () => {
    vm.noteOn(220, 0, 5);
    const amp = ctx.gains[0];
    expect(amp.gain.events[1]).toEqual(['lin', 1, 0.01]); // peak clamped to 1
  });

  it('releases a voice on noteOff: ramp to ~0 and osc.stop scheduled', () => {
    const id = vm.noteOn(440, 0, 1);
    const osc = ctx.oscillators[0];
    const amp = ctx.gains[0];
    vm.noteOff(id, 2.0);
    const last = amp.gain.events[amp.gain.events.length - 1];
    expect(last[0]).toBe('lin');
    expect(last[1]).toBeLessThan(0.001);          // ramps toward (just below) zero
    expect(last[2]).toBeCloseTo(2.0 + 0.3, 5);    // over S.release
    expect(osc.stopped).toBeGreaterThan(2.0 + 0.3);
  });

  it('self-cleans the voice when the oscillator ends', () => {
    const id = vm.noteOn(440, 0, 1);
    expect(vm.activeCount()).toBe(1);
    vm.noteOff(id, 1.0);
    // onended fires in the real engine; invoke it to simulate the tail finishing
    ctx.oscillators[0].onended();
    expect(vm.activeCount()).toBe(0);
  });

  it('plays multiple simultaneous voices (true polyphony)', () => {
    vm.noteOn(261.63, 0, 1); // C
    vm.noteOn(329.63, 0, 1); // E
    vm.noteOn(392.0, 0, 1);  // G
    expect(vm.activeCount()).toBe(3);
    expect(vm.heldCount()).toBe(3);
    expect(ctx.oscillators).toHaveLength(6);   // 3 voices × (primary osc + VCO2)
  });

  it('steals the oldest voice when the pool is full', () => {
    ({ ctx, output, vm } = setup(2));
    const a = vm.noteOn(100, 0, 1);
    vm.noteOn(200, 0, 1);
    expect(vm.heldCount()).toBe(2);
    // third note exceeds maxVoices → steal the oldest (voice a)
    vm.noteOn(300, 1, 1);
    // the stolen voice was fast-released; its osc.stop was scheduled
    expect(ctx.oscillators[0].stopped).not.toBeNull();
    // never exceed the cap in held voices
    expect(vm.heldCount()).toBeLessThanOrEqual(2);
    expect(a).toBeTypeOf('number');
  });

  it('releaseAll releases every held voice', () => {
    vm.noteOn(100, 0, 1);
    vm.noteOn(200, 0, 1);
    vm.noteOn(300, 0, 1);
    vm.releaseAll(5.0);
    expect(vm.heldCount()).toBe(0);
    // every oscillator got a stop scheduled
    for (const osc of ctx.oscillators) expect(osc.stopped).not.toBeNull();
  });
});

describe('voices – per-voice LFO routing (keyboard chords)', () => {
  it('connects the shared lfoMod to this voice\'s own osc + osc2 detune for LFO→Pitch', () => {
    const ctx = fakeCtx();
    const lfoMod = fakeLfoMod();
    const params = { ...PARAMS, lfoDest: 'pitch' };
    const vm = createVoiceManager({ ctx, output: {}, getParams: () => params, lfoMod });
    vm.noteOn(440, 0, 1);
    const [osc, osc2] = ctx.oscillators;
    expect(lfoMod.connections).toEqual([osc.detune, osc2.detune]);
  });

  it('connects the shared lfoMod to this voice\'s own amp gain for LFO→Amp', () => {
    const ctx = fakeCtx();
    const lfoMod = fakeLfoMod();
    const params = { ...PARAMS, lfoDest: 'amp' };
    const vm = createVoiceManager({ ctx, output: {}, getParams: () => params, lfoMod });
    vm.noteOn(440, 0, 1);
    expect(lfoMod.connections).toEqual([ctx.gains[0].gain]);
  });

  it('does not touch lfoMod for LFO→Filter (all voices already share one filter)', () => {
    const ctx = fakeCtx();
    const lfoMod = fakeLfoMod();
    const params = { ...PARAMS, lfoDest: 'filter' };
    const vm = createVoiceManager({ ctx, output: {}, getParams: () => params, lfoMod });
    vm.noteOn(440, 0, 1);
    expect(lfoMod.connections).toEqual([]);
  });

  it('disconnects this voice\'s lfoMod targets once it finishes releasing', () => {
    const ctx = fakeCtx();
    const lfoMod = fakeLfoMod();
    const params = { ...PARAMS, lfoDest: 'pitch' };
    const vm = createVoiceManager({ ctx, output: {}, getParams: () => params, lfoMod });
    const id = vm.noteOn(440, 0, 1);
    expect(lfoMod.connections).toHaveLength(2);
    vm.noteOff(id, 1.0);
    ctx.oscillators[0].onended(); // simulate the release tail finishing
    expect(lfoMod.connections).toEqual([]);
  });
});
