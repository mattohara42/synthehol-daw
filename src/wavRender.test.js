import { describe, it, expect, beforeEach, vi } from 'vitest';

// renderPatternToBuffer() duplicates audio.js's graph-building inside a real
// OfflineAudioContext (browser-only). To test the pattern-walking logic on
// its own — which steps trigger which notes/drums, at which times, with
// what velocity/automation — without a browser, mock everything that isn't
// the walk itself: voices.js's manager (spy on noteOn/noteOff calls),
// drums.js's five synthesized voices (spy calls), and audio.js's pure
// helpers (irrelevant to timing, stubbed to trivial values).
const noteOnCalls = [];
const noteOffCalls = [];
let nextVoiceId = 0;

vi.mock('./voices.js', () => ({
  createVoiceManager: () => ({
    noteOn: (freq, time, vel) => {
      const id = nextVoiceId++;
      noteOnCalls.push({ id, freq, time, vel });
      return id;
    },
    noteOff: (id, time) => { noteOffCalls.push({ id, time }); },
    releaseAll: () => {},
    activeCount: () => 0,
    heldCount: () => 0,
  }),
}));

vi.mock('./drums.js', () => ({
  playKick: vi.fn(),
  playSnare: vi.fn(),
  playHat: vi.fn(),
  playCowbell: vi.fn(),
  playClap: vi.fn(),
}));

vi.mock('./audio.js', () => ({
  makeImpulse: vi.fn(() => ({})),
  makeDriveCurve: vi.fn(() => null),
  lfoDepthScaled: vi.fn(() => 0),
}));

const { audioBufferToWav, renderPatternToBuffer } = await import('./wavRender.js');
const { store } = await import('./store.js');
const { noteFreq } = await import('./notes.js');
const { playKick, playSnare, playHat, playCowbell, playClap } = await import('./drums.js');
const { stepDuration } = await import('./sequencer.js');

// A fake AudioParam rich enough for renderPatternToBuffer's own graph nodes
// (frequency/Q/gain/delayTime/offset — everything it sets .value on or
// schedules setTargetAtTime against).
function fakeParam(value = 0) {
  return {
    value,
    events: [],
    setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); return this; },
    setTargetAtTime(v, t, tc) { this.value = v; this.events.push(['target', v, t, tc]); return this; },
  };
}

function fakeNode(extra = {}) {
  return { connect() { return this; }, disconnect() {}, start() {}, stop() {}, ...extra };
}

// `biquads` collects every filter node created, in order — renderPatternToBuffer
// always builds its `vcf` first, so biquads[0] is the node automation targets.
function installFakeOfflineAudioContext() {
  const instances = [];
  const biquads = [];
  class FakeOfflineAudioContext {
    constructor(numChannels, length, sampleRate) {
      this.numChannels = numChannels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.destination = fakeNode();
      instances.push(this);
    }
    createBiquadFilter() {
      const node = fakeNode({ type: 'lowpass', frequency: fakeParam(), Q: fakeParam(), gain: fakeParam() });
      biquads.push(node);
      return node;
    }
    createGain() { return fakeNode({ gain: fakeParam(1) }); }
    createWaveShaper() { return fakeNode({ curve: null, oversample: 'none' }); }
    createOscillator() { return fakeNode({ type: 'sine', frequency: fakeParam() }); }
    createConstantSource() { return fakeNode({ offset: fakeParam(0) }); }
    createDelay() { return fakeNode({ delayTime: fakeParam(0) }); }
    createConvolver() { return fakeNode({ buffer: null }); }
    async startRendering() { return { rendered: true, numberOfChannels: this.numChannels, length: this.length, sampleRate: this.sampleRate }; }
  }
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext);
  return { instances, biquads };
}

describe('wavRender – renderPatternToBuffer (pattern-walking logic)', () => {
  let instances, biquads;

  beforeEach(() => {
    store._resetForTest();
    noteOnCalls.length = 0;
    noteOffCalls.length = 0;
    nextVoiceId = 0;
    vi.clearAllMocks();
    ({ instances, biquads } = installFakeOfflineAudioContext());
  });

  it('sizes the OfflineAudioContext for exactly one loop of the pattern plus the tail', async () => {
    await renderPatternToBuffer();
    expect(instances).toHaveLength(1);
    const { numChannels, length, sampleRate } = instances[0];
    expect(numChannels).toBe(2);
    expect(sampleRate).toBe(44100);
    // 16 steps @ 120bpm (stepDur=0.125s) = 2s of pattern + 2s tail = 4s
    expect(length).toBe(Math.ceil(4 * 44100));
  });

  it('fires the default pattern\'s step-grid notes at the right step times and pitches', async () => {
    await renderPatternToBuffer();
    const stepDur = stepDuration(120, 4);

    // Default pattern seeds cells at C4@0, E4@4, G4@8, C5@12 (store.js's defaultPattern).
    const cellNotes = [
      { note: 'C', octave: 4, step: 0 },
      { note: 'E', octave: 4, step: 4 },
      { note: 'G', octave: 4, step: 8 },
      { note: 'C', octave: 5, step: 12 },
    ];
    for (const { note, octave, step } of cellNotes) {
      const freq = noteFreq(note, octave);
      const match = noteOnCalls.find(c => Math.abs(c.freq - freq) < 1e-6 && Math.abs(c.time - step * stepDur) < 1e-9);
      expect(match, `expected a noteOn for ${note}${octave} at step ${step}`).toBeTruthy();
      expect(match.vel).toBe(0.85); // no accent on the default pattern
    }
  });

  it('also fires the default pattern\'s piano-roll runs at their leading edge, for their full length', async () => {
    await renderPatternToBuffer();
    const stepDur = stepDuration(120, 4);

    // Default pattern seeds roll runs: C4 (steps 0-3, len 4), E4 (4-5, len 2),
    // G4 (8-9, len 2), C5 (12-15, len 4) — see store.js's defaultPattern.
    const rollNotes = [
      { note: 'C', octave: 4, step: 0, lengthSteps: 4 },
      { note: 'E', octave: 4, step: 4, lengthSteps: 2 },
      { note: 'G', octave: 4, step: 8, lengthSteps: 2 },
      { note: 'C', octave: 5, step: 12, lengthSteps: 4 },
    ];
    for (const { note, octave, step, lengthSteps } of rollNotes) {
      const freq = noteFreq(note, octave);
      const at = step * stepDur;
      const expectedOff = at + Math.max(0.02, 0.95 * lengthSteps * stepDur);
      // Steps 0/4/8/12 also carry a step-grid cell at the same pitch/time/
      // velocity (see the previous test), so match on the noteOn+noteOff
      // *pair* rather than assuming a single noteOn is the roll's own.
      const onMatches = noteOnCalls.filter(c => Math.abs(c.freq - freq) < 1e-6 && Math.abs(c.time - at) < 1e-9 && c.vel === 0.85);
      const pairFound = onMatches.some(on =>
        noteOffCalls.some(off => off.id === on.id && Math.abs(off.time - expectedOff) < 1e-9));
      expect(pairFound, `expected a roll noteOn/noteOff pair for ${note}${octave} at step ${step}`).toBe(true);
    }
  });

  it('triggers the default pattern\'s drum lanes at the right steps and never triggers empty lanes', async () => {
    await renderPatternToBuffer();
    const stepDur = stepDuration(120, 4);
    const timesOf = (mockFn) => mockFn.mock.calls.map(c => c[2]);

    expect(timesOf(playKick)).toEqual([0, 4, 8, 12].map(s => s * stepDur));
    expect(timesOf(playSnare)).toEqual([4, 12].map(s => s * stepDur));
    expect(timesOf(playHat)).toEqual([0, 2, 4, 6, 8, 10, 12, 14].map(s => s * stepDur));
    expect(playCowbell).not.toHaveBeenCalled();
    expect(playClap).not.toHaveBeenCalled();
  });

  it('boosts step-grid velocity to 1.0 on an accented step, but leaves the piano-roll velocity alone', async () => {
    store.setPath('tracks.0.pattern.accent.0', true);
    await renderPatternToBuffer();
    const freq = noteFreq('C', 4);
    const atStep0 = noteOnCalls.filter(c => Math.abs(c.freq - freq) < 1e-6 && Math.abs(c.time) < 1e-9);
    // Two notes land at step 0/C4: the accented cell note (vel 1.0) and the
    // piano-roll run's leading edge (vel 0.85, unaffected by accent).
    expect(atStep0.map(c => c.vel).sort()).toEqual([0.85, 1]);
  });

  it('applies per-step automation to the filter cutoff at the automated step\'s exact time', async () => {
    store.setPath('tracks.0.pattern.automation.cutoff.4', 900);
    await renderPatternToBuffer();
    const stepDur = stepDuration(120, 4);
    const vcf = biquads[0]; // the filter is always the first biquad node built
    const event = vcf.frequency.events.find(e => e[0] === 'target' && e[1] === 900);
    expect(event).toBeTruthy();
    expect(event[2]).toBeCloseTo(4 * stepDur, 9);
  });
});

// A minimal AudioBuffer stand-in — duck-typed, no real Web Audio API needed.
function fakeAudioBuffer(channelsData, sampleRate = 44100) {
  return {
    numberOfChannels: channelsData.length,
    length: channelsData[0].length,
    sampleRate,
    getChannelData: (ch) => channelsData[ch],
  };
}

// Parse a .wav Blob back out for assertions (Node/vitest Blob supports arrayBuffer()).
async function parseWav(blob) {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const readStr = (offset, len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
    return s;
  };
  return {
    riff: readStr(0, 4),
    wave: readStr(8, 4),
    fmtId: readStr(12, 4),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataId: readStr(36, 4),
    dataSize: view.getUint32(40, true),
    samples: (count) => {
      const out = [];
      for (let i = 0; i < count; i++) out.push(view.getInt16(44 + i * 2, true));
      return out;
    },
  };
}

describe('wavRender – audioBufferToWav', () => {
  it('writes a valid RIFF/WAVE/PCM header matching the buffer', async () => {
    const buffer = fakeAudioBuffer([new Float32Array([0, 0.5, -0.5]), new Float32Array([0, 0.5, -0.5])], 48000);
    const wav = await parseWav(audioBufferToWav(buffer));
    expect(wav.riff).toBe('RIFF');
    expect(wav.wave).toBe('WAVE');
    expect(wav.fmtId).toBe('fmt ');
    expect(wav.audioFormat).toBe(1); // PCM
    expect(wav.numChannels).toBe(2);
    expect(wav.sampleRate).toBe(48000);
    expect(wav.bitsPerSample).toBe(16);
    expect(wav.dataId).toBe('data');
    expect(wav.dataSize).toBe(3 * 2 * 2); // 3 frames * 2 channels * 2 bytes
  });

  it('interleaves channels and converts float samples to 16-bit PCM', async () => {
    const left = new Float32Array([1, -1, 0]);
    const right = new Float32Array([0.5, -0.5, 0]);
    const buffer = fakeAudioBuffer([left, right]);
    const wav = await parseWav(audioBufferToWav(buffer));
    const samples = wav.samples(6); // 3 frames * 2 channels, interleaved L/R
    expect(samples[0]).toBe(0x7fff);   // left[0] = 1.0 → max positive int16
    expect(samples[1]).toBeCloseTo(0x4000, -1); // right[0] = 0.5
    expect(samples[2]).toBe(-0x8000);  // left[1] = -1.0 → max negative int16
    expect(samples[4]).toBe(0);        // left[2] = 0
    expect(samples[5]).toBe(0);        // right[2] = 0
  });

  it('clamps out-of-range samples instead of wrapping', async () => {
    const buffer = fakeAudioBuffer([new Float32Array([2.5, -3.0])]);
    const wav = await parseWav(audioBufferToWav(buffer));
    const samples = wav.samples(2);
    expect(samples[0]).toBe(0x7fff);
    expect(samples[1]).toBe(-0x8000);
  });

  it('handles mono buffers', async () => {
    const buffer = fakeAudioBuffer([new Float32Array([0, 0, 0, 0])]);
    const wav = await parseWav(audioBufferToWav(buffer));
    expect(wav.numChannels).toBe(1);
    expect(wav.dataSize).toBe(4 * 1 * 2);
  });
});
