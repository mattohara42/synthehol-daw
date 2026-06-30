// Polyphonic voice manager (E3). A pool of independent voices, each its own
// oscillator + amp-envelope gain, summed into a shared output node (the engine's
// filter input). Voices are allocated on note-on and self-destruct after their
// release tail; when the pool is full the oldest voice is stolen.
//
// This module is deliberately decoupled from the rest of the engine — it takes a
// ctx, an output node, and a getParams() accessor — so it's unit-testable with a
// fake AudioContext and reusable per-track once E4 (multi-track) lands.
//
// Scope (see docs/plans/.../polyphony-voice-manager-plan.md): the live keyboard
// stays monophonic until Act III; this manager's first driver is the scheduler.

const RELEASE_FLOOR = 0.0005; // exp ramps can't reach 0; aim just below audible
const STEAL_RELEASE = 0.02;   // fast fade when stealing a voice, to avoid clicks

export function createVoiceManager({ ctx, output, getParams, maxVoices = 16 }) {
  const voices = []; // active voices, oldest first: { id, freq, osc, osc2, noiseSrc, amp, startedAt }
  let nextId = 1;

  // One shared white-noise buffer; each voice gets its own (single-use) source.
  let noiseBuffer = null;
  function noiseBuf() {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function buildVoice(freq, time, velocity) {
    const S = getParams();
    const v = Math.min(1, Math.max(0, velocity));
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = S.waveform;
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime(S.detune, time);

    // Amp ADSR: 0 → peak (attack) → sustain (decay), velocity-scaled. The
    // release segment is scheduled later in noteOff.
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v, time + S.attack);
    amp.gain.linearRampToValueAtTime(S.sustain * v, time + S.attack + S.decay);

    // VCO2: second oscillator, octave-shifted + detuned, summed into this voice.
    const osc2 = ctx.createOscillator();
    const osc2Mix = ctx.createGain();
    osc2.type = S.osc2Waveform;
    osc2.frequency.setValueAtTime(freq * 2 ** S.osc2Octave, time);
    osc2.detune.setValueAtTime(S.osc2Detune, time);
    osc2Mix.gain.setValueAtTime(S.osc2Mix, time);
    osc2.connect(osc2Mix);
    osc2Mix.connect(amp);

    // Noise: looped white-noise source, shelved toward pink, summed into amp.
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf();
    noiseSrc.loop = true;
    const pink = ctx.createBiquadFilter();
    pink.type = 'lowshelf';
    pink.frequency.setValueAtTime(1000, time);
    pink.gain.setValueAtTime(S.noiseType === 'pink' ? -6 : 0, time);
    const noiseMix = ctx.createGain();
    noiseMix.gain.setValueAtTime(S.noiseMix, time);
    noiseSrc.connect(pink);
    pink.connect(noiseMix);
    noiseMix.connect(amp);

    osc.connect(amp);
    amp.connect(output);
    osc.start(time);
    osc2.start(time);
    noiseSrc.start(time);

    return { id: nextId++, freq, osc, osc2, noiseSrc, amp, startedAt: time };
  }

  // Release a voice and tear it down once its tail finishes. `releaseTime` is how
  // long the fade takes; the oscillator is stopped just after.
  function endVoice(voice, time, releaseTime) {
    const { osc, amp } = voice;
    const t = time;
    amp.gain.cancelScheduledValues(t);
    // Hold whatever the envelope value is AT `t`, then ramp down — so releases
    // scheduled ahead of time (the sequencer's gated note-offs) start from the
    // sustain level reached at `t`, not from the gain's value right now.
    if (typeof amp.gain.cancelAndHoldAtTime === 'function') {
      amp.gain.cancelAndHoldAtTime(t);
    } else {
      const current = typeof amp.gain.value === 'number' ? amp.gain.value : 0;
      amp.gain.setValueAtTime(current, t);
    }
    amp.gain.linearRampToValueAtTime(RELEASE_FLOOR, t + releaseTime);

    const stopAt = t + releaseTime + 0.01;
    try { osc.stop(stopAt); } catch { /* already stopped */ }
    try { voice.osc2?.stop(stopAt); } catch { /* already stopped */ }
    try { voice.noiseSrc?.stop(stopAt); } catch { /* already stopped */ }

    const remove = () => {
      const i = voices.indexOf(voice);
      if (i !== -1) voices.splice(i, 1);
      try { amp.disconnect(); } catch { /* noop */ }
    };
    // Self-clean when the oscillator ends; fall back to immediate removal if the
    // environment doesn't fire onended (e.g. a fake ctx in tests).
    if ('onended' in osc) osc.onended = remove; else remove();
    voice._ending = true;
  }

  return {
    /** Allocate (or steal) a voice for `freq` at `time`. Returns a voice id. */
    noteOn(freq, time, velocity = 1) {
      if (voices.length >= maxVoices) {
        // Steal the oldest voice that isn't already releasing; fall back to the
        // very oldest. Fast-release it so its slot frees up.
        const victim = voices.find(v => !v._ending) || voices[0];
        if (victim) endVoice(victim, time, STEAL_RELEASE);
      }
      const voice = buildVoice(freq, time, velocity);
      voices.push(voice);
      return voice.id;
    },

    /** Release the voice with `id` at `time` (ramps over the current S.release). */
    noteOff(id, time) {
      const voice = voices.find(v => v.id === id && !v._ending);
      if (!voice) return;
      endVoice(voice, time, getParams().release);
    },

    /** Release every active voice (transport stop / panic). */
    releaseAll(time) {
      const release = getParams().release;
      for (const voice of [...voices]) {
        if (!voice._ending) endVoice(voice, time, release);
      }
    },

    /** Number of voices currently allocated (including those in their release tail). */
    activeCount() { return voices.length; },

    /** Number of voices not yet releasing — i.e. actively held. */
    heldCount() { return voices.filter(v => !v._ending).length; },
  };
}
