import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from './state.js';
import { store } from './store.js';

// ui.js touches the DOM (setStatus/fillSlider); voices.js needs a much
// richer fake AudioContext (noise buffers, osc2, …) than reconcileTrackEngines
// itself cares about. Mock both so startAudio() can run against a lean fake
// AudioContext without a browser — this only affects the
// reconcileTrackEngines describe block below; the other describe blocks in
// this file don't touch either module.
vi.mock('./ui.js', () => ({ setStatus: vi.fn(), fillSlider: vi.fn() }));
vi.mock('./voices.js', () => ({
  createVoiceManager: () => ({
    noteOn: () => 0,
    noteOff: () => {},
    releaseAll: vi.fn(),
    activeCount: () => 0,
    heldCount: () => 0,
  }),
}));

const { makeImpulse, makeDriveCurve, lfoDepthScaled, trackMixGain, engine, startAudio } = await import('./audio.js');

// Minimal fake AudioContext: just enough for makeImpulse.
function fakeCtx(rate = 8000) {
  return {
    sampleRate: rate,
    createBuffer(channels, len) {
      const chans = Array.from({ length: channels }, () => new Float32Array(len));
      return {
        length: len,
        numberOfChannels: channels,
        getChannelData: (c) => chans[c],
      };
    },
  };
}

describe('audio – makeImpulse (reverb impulse response)', () => {
  it('produces a stereo buffer of sampleRate * seconds samples', () => {
    const buf = makeImpulse(fakeCtx(8000), 0.5);
    expect(buf.numberOfChannels).toBe(2);
    expect(buf.length).toBe(4000);
  });

  it('decays over time (early energy exceeds late energy)', () => {
    const buf = makeImpulse(fakeCtx(8000), 1, 2.5);
    const d = buf.getChannelData(0);
    const energy = (from, to) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += Math.abs(d[i]);
      return sum / (to - from);
    };
    const early = energy(0, 800);
    const late = energy(d.length - 800, d.length);
    expect(early).toBeGreaterThan(late);
  });

  it('stays within the [-1, 1] range', () => {
    const buf = makeImpulse(fakeCtx(4000), 0.3);
    const d = buf.getChannelData(1);
    for (let i = 0; i < d.length; i++) {
      expect(d[i]).toBeGreaterThanOrEqual(-1);
      expect(d[i]).toBeLessThanOrEqual(1);
    }
  });

  it('never returns an empty buffer even for tiny durations', () => {
    const buf = makeImpulse(fakeCtx(1000), 0);
    expect(buf.length).toBeGreaterThanOrEqual(1);
  });
});

describe('audio – makeDriveCurve (WaveShaper saturation curve)', () => {
  it('returns null at zero or negative amount (drive bypassed)', () => {
    expect(makeDriveCurve(0)).toBeNull();
    expect(makeDriveCurve(-1)).toBeNull();
  });

  it('returns a 1024-sample curve for a positive amount', () => {
    const curve = makeDriveCurve(0.5);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(1024);
  });

  it('stays within [-1, 1] and is normalized to reach exactly ±1 at the extremes', () => {
    const curve = makeDriveCurve(1);
    for (let i = 0; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(-1.000001);
      expect(curve[i]).toBeLessThanOrEqual(1.000001);
    }
    expect(curve[curve.length - 1]).toBeCloseTo(1, 5);
    expect(curve[0]).toBeCloseTo(-1, 5);
  });

  it('is approximately odd-symmetric (curve(-x) ≈ -curve(x))', () => {
    // The sample grid itself is slightly asymmetric (x runs from exactly -1
    // up to just short of +1), so mirrored samples don't line up on exactly
    // opposite x values — allow a tolerance well above that discretization
    // error rather than asserting exact equality.
    const curve = makeDriveCurve(0.7);
    const mid = curve.length / 2;
    for (let i = 0; i < mid; i++) {
      expect(curve[i]).toBeCloseTo(-curve[curve.length - 1 - i], 1);
    }
  });

  it('higher drive amounts saturate faster away from center (more gain, earlier clipping)', () => {
    const low = makeDriveCurve(0.1);
    const high = makeDriveCurve(1);
    const i = Math.round((0.3 + 1) / 2 * 1024); // x ≈ 0.3
    expect(Math.abs(high[i])).toBeGreaterThan(Math.abs(low[i]));
  });
});

describe('audio – lfoDepthScaled (per-destination LFO depth scaling)', () => {
  it('scales to ±8kHz for filter destination', () => {
    S.lfoDest = 'filter';
    S.lfoDepth = 0.5;
    expect(lfoDepthScaled()).toBeCloseTo(4000, 6);
  });

  it('scales to ±1200 cents for pitch destination', () => {
    S.lfoDest = 'pitch';
    S.lfoDepth = 1;
    expect(lfoDepthScaled()).toBeCloseTo(1200, 6);
  });

  it('scales to ±0.8 amplitude for amp destination', () => {
    S.lfoDest = 'amp';
    S.lfoDepth = 0.25;
    expect(lfoDepthScaled()).toBeCloseTo(0.2, 6);
  });

  it('is zero for "none" regardless of depth', () => {
    S.lfoDest = 'none';
    S.lfoDepth = 1;
    expect(lfoDepthScaled()).toBe(0);
  });

  it('is zero at zero depth for any destination', () => {
    S.lfoDest = 'filter';
    S.lfoDepth = 0;
    expect(lfoDepthScaled()).toBe(0);
  });
});

describe('audio – trackMixGain (mixer mute/solo convention, L10)', () => {
  beforeEach(() => {
    store._resetForTest();
  });

  it('returns 1 (unmuted, full gain) for a plain track with no mute/solo', () => {
    const t1 = store.tracks()[0].id;
    expect(trackMixGain(t1)).toBe(1);
  });

  it('reflects a non-default gain value', () => {
    const t1 = store.tracks()[0].id;
    store.setPath('tracks.0.mixer.gain', 0.4);
    expect(trackMixGain(t1)).toBe(0.4);
  });

  it('mute silences the track', () => {
    const t1 = store.tracks()[0].id;
    store.setPath('tracks.0.mixer.mute', true);
    expect(trackMixGain(t1)).toBe(0);
  });

  it('with no solo active, every unmuted track is audible', () => {
    const t1 = store.tracks()[0].id;
    const t2 = store.addTrack();
    expect(trackMixGain(t1)).toBe(1);
    expect(trackMixGain(t2)).toBe(1);
  });

  it('soloing one track silences the others, even if unmuted', () => {
    const t1 = store.tracks()[0].id;
    const t2 = store.addTrack();
    store.setPath('tracks.1.mixer.solo', true);
    expect(trackMixGain(t1)).toBe(0);
    expect(trackMixGain(t2)).toBe(1);
  });

  it('mute always wins over solo, even on the soloed track itself', () => {
    const t1 = store.tracks()[0].id;
    store.setPath('tracks.0.mixer.solo', true);
    store.setPath('tracks.0.mixer.mute', true);
    expect(trackMixGain(t1)).toBe(0);
  });

  it('multiple soloed tracks are all audible; everything else is silent', () => {
    const t1 = store.tracks()[0].id;
    const t2 = store.addTrack();
    const t3 = store.addTrack();
    store.setPath('tracks.0.mixer.solo', true);
    store.setPath('tracks.1.mixer.solo', true);
    expect(trackMixGain(t1)).toBe(1);
    expect(trackMixGain(t2)).toBe(1);
    expect(trackMixGain(t3)).toBe(0);
  });

  it('returns 1 for an id that does not match any track', () => {
    expect(trackMixGain('not-a-real-track')).toBe(1);
  });
});

describe('audio – reconcileTrackEngines (keeping engine.tracks in sync with the store)', () => {
  // A fake AudioParam rich enough for every node startAudio()/buildTrackEngine()
  // touches (frequency/Q/gain/pan/delayTime/offset — everything set via
  // .value or scheduled with setTargetAtTime).
  function fakeParam(value = 0) {
    return {
      value,
      setValueAtTime(v) { this.value = v; return this; },
      setTargetAtTime(v) { this.value = v; return this; },
    };
  }

  function fakeNode(extra = {}) {
    return { connect() { return this; }, disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra };
  }

  class FakeAudioContext {
    constructor() {
      this.sampleRate = 44100;
      this.currentTime = 0;
      this.destination = fakeNode();
    }
    createGain() { return fakeNode({ gain: fakeParam(1) }); }
    createWaveShaper() { return fakeNode({ curve: null, oversample: 'none' }); }
    createBiquadFilter() { return fakeNode({ type: 'lowpass', frequency: fakeParam(350), Q: fakeParam(1), gain: fakeParam(0) }); }
    createAnalyser() { return fakeNode({ fftSize: 2048 }); }
    createDelay() { return fakeNode({ delayTime: fakeParam(0) }); }
    createConvolver() { return fakeNode({ buffer: null }); }
    createOscillator() { return fakeNode({ type: 'sine', frequency: fakeParam(440) }); }
    createConstantSource() { return fakeNode({ offset: fakeParam(0) }); }
    createStereoPanner() { return fakeNode({ pan: fakeParam(0) }); }
    createMediaStreamDestination() { return fakeNode({ stream: {} }); }
    createBuffer(channels, len) {
      const chans = Array.from({ length: channels }, () => new Float32Array(len));
      return { length: len, numberOfChannels: channels, getChannelData: (c) => chans[c] };
    }
  }

  beforeEach(() => {
    store._resetForTest();
    // engine is a module-level singleton that persists across every test in
    // this file — startAudio() no-ops once engine.ctx is set, so each test
    // needs a fully fresh engine, not just a fresh AudioContext.
    engine.ctx = null;
    engine.tracks = new Map();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
  });

  it('builds one track engine per existing track on startAudio()', () => {
    startAudio();
    expect(engine.tracks.size).toBe(1);
    expect(engine.tracks.has(store.tracks()[0].id)).toBe(true);
  });

  it('builds a new track engine when a track is added after startup', () => {
    startAudio();
    const newId = store.addTrack();
    expect(engine.tracks.has(newId)).toBe(true);
    expect(engine.tracks.size).toBe(2);
  });

  it('tears down a track engine (stops its LFO, releases its voices, disconnects its nodes) when the track is removed', () => {
    startAudio();
    const newId = store.addTrack();
    const te = engine.tracks.get(newId);

    store.removeTrack(newId);

    expect(engine.tracks.has(newId)).toBe(false);
    expect(te.voices.releaseAll).toHaveBeenCalled();
    expect(te.lfoOsc.stop).toHaveBeenCalled();
    expect(te.vcf.disconnect).toHaveBeenCalled();
    expect(te.trackGain.disconnect).toHaveBeenCalled();
  });

  it('rebuilds a fresh track engine when track removal is undone', () => {
    startAudio();
    const newId = store.addTrack();
    store.removeTrack(newId);
    expect(engine.tracks.has(newId)).toBe(false);

    store.undo();

    expect(engine.tracks.has(newId)).toBe(true);
    expect(engine.tracks.size).toBe(2);
  });

  it('refreshes trackGain/pan from mixer.gain/mute/solo/pan on every store change', () => {
    startAudio();
    const t1 = store.tracks()[0].id;
    const te = engine.tracks.get(t1);

    store.setPath('tracks.0.mixer.pan', -0.5);
    expect(te.pan.pan.value).toBe(-0.5);

    store.setPath('tracks.0.mixer.mute', true);
    expect(te.trackGain.gain.value).toBe(0); // muted → silent
  });

  it('a second track soloed silences the first track\'s gain node', () => {
    startAudio();
    const t1 = store.tracks()[0].id;
    const te1 = engine.tracks.get(t1);

    const t2 = store.addTrack();
    const te2 = engine.tracks.get(t2);
    store.setPath('tracks.1.mixer.solo', true);

    expect(te1.trackGain.gain.value).toBe(0);
    expect(te2.trackGain.gain.value).toBe(1);
  });
});
