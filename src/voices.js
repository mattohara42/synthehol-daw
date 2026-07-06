// Polyphonic voice manager (E3). A pool of independent voices, each its own
// oscillator + amp-envelope gain, summed into a shared output node (the engine's
// filter input). Voices are allocated on note-on and self-destruct after their
// release tail; when the pool is full the oldest voice is stolen.
//
// This module is deliberately decoupled from the rest of the engine — it takes a
// ctx, an output node, and a getParams() accessor — so it's unit-testable with a
// fake AudioContext and reusable per-track once E4 (multi-track) lands.
//
// The live keyboard now drives this too (chords), alongside the scheduler.
// Filter-envelope stays a shared, chord-level effect (one filter for every
// voice) — see keyboard.js — but LFO→Pitch/Amp needs to reach each voice's
// own oscillator/gain individually, hence the optional `lfoMod` below.
//
// Mono/glide (Roland TB-303/TR-808 slice, phase 2): when S.mono is on,
// noteOn() retunes the currently-held voice into the new pitch over
// S.glideTime instead of spawning a fresh one — a real monophonic-synth
// slide, not just a parameter. Deliberately only ever finds a "currently
// held" voice for genuinely live input (keyboard/MIDI, where noteOff only
// fires on an actual key-up): the sequencer/piano-roll always schedule a
// note's noteOff essentially immediately (ahead of real time, alongside its
// noteOn), so by the time the next note's noteOn runs, the previous voice
// already has `_ending: true` — meaning mono mode has no observable effect
// on scheduled playback today, only on live-played notes. Making scheduled
// patterns glide too would need revivable voices (cancelling an
// already-scheduled release and re-extending the stop time) — a separate,
// riskier follow-up, not attempted here.
//
// Each voice carries a `generation`, bumped every time a note-on retunes it
// in place. noteOn() returns a plain number while generation is 0 (i.e. the
// voice has never been glided — identical to every id this module has ever
// returned), and a composite "id:generation" string once it has been. This
// keeps every existing (non-mono) call site and test working unchanged —
// their voices' generation never leaves 0 — while letting noteOff() tell a
// genuinely-current release apart from one whose note has since been
// glided over: a noteOff for an earlier generation of a voice that's since
// moved on to a newer note is a stale request and is silently ignored,
// rather than cutting off the note that superseded it.

const RELEASE_FLOOR = 0.0005; // exp ramps can't reach 0; aim just below audible
const STEAL_RELEASE = 0.02;   // fast fade when stealing a voice, to avoid clicks
const MIN_GLIDE_FREQ = 1;     // exponentialRamp targets must be > 0

export function createVoiceManager({ ctx, output, getParams, maxVoices = 16, lfoMod = null }) {
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

    // LFO→Pitch/Amp: connect this voice's own targets to the shared LFO
    // modulation signal (a GainNode output can fan out to many destinations
    // at once). Filter routing needs no equivalent — all voices already share
    // one downstream filter, so LFO→Filter just works without this.
    let lfoTargets = null;
    if (lfoMod) {
      if (S.lfoDest === 'pitch') {
        lfoMod.connect(osc.detune);
        lfoMod.connect(osc2.detune);
        lfoTargets = [osc.detune, osc2.detune];
      } else if (S.lfoDest === 'amp') {
        lfoMod.connect(amp.gain);
        lfoTargets = [amp.gain];
      }
    }

    return { id: nextId++, generation: 0, freq, osc, osc2, noiseSrc, amp, lfoTargets, startedAt: time };
  }

  // Mono glide: retune a still-held voice's oscillators to `freq` over
  // `glideTime`, leaving the amp envelope alone entirely (a slide changes
  // pitch, it doesn't retrigger the note). Continues from wherever the
  // frequency currently is if a previous glide is still in flight.
  function retuneVoice(voice, S, freq, time, glideTime) {
    const targets = [[voice.osc, 1], [voice.osc2, 2 ** S.osc2Octave]];
    for (const [osc, mul] of targets) {
      if (!osc) continue;
      if (typeof osc.frequency.cancelAndHoldAtTime === 'function') {
        osc.frequency.cancelAndHoldAtTime(time);
      } else {
        osc.frequency.cancelScheduledValues(time);
        osc.frequency.setValueAtTime(osc.frequency.value, time);
      }
      osc.frequency.exponentialRampToValueAtTime(Math.max(MIN_GLIDE_FREQ, freq * mul), time + Math.max(0.001, glideTime));
    }
    voice.freq = freq;
  }

  // A plain integer id while a voice has never been glided (generation 0 —
  // every id this module has ever returned, unchanged), a composite string
  // once it has — see the module-level comment on why.
  function idFor(voice) {
    return voice.generation === 0 ? voice.id : `${voice.id}:${voice.generation}`;
  }
  function parseId(id) {
    if (typeof id === 'number') return { voiceId: id, generation: 0 };
    const [voiceId, generation] = String(id).split(':').map(Number);
    return { voiceId, generation };
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
      if (lfoMod && voice.lfoTargets) {
        for (const target of voice.lfoTargets) {
          try { lfoMod.disconnect(target); } catch { /* noop */ }
        }
      }
    };
    // Self-clean when the oscillator ends; fall back to immediate removal if the
    // environment doesn't fire onended (e.g. a fake ctx in tests).
    if ('onended' in osc) osc.onended = remove; else remove();
    voice._ending = true;
  }

  return {
    /**
     * Allocate (or steal) a voice for `freq` at `time`. Returns a voice id.
     * In mono mode (S.mono), retunes the currently-held voice in place
     * (glide) instead of allocating a new one, if one is genuinely held —
     * see the module-level comment for why this only ever engages for live
     * keyboard/MIDI input, not scheduled playback.
     */
    noteOn(freq, time, velocity = 1) {
      const S = getParams();
      if (S.mono) {
        const held = voices.find(v => !v._ending);
        if (held) {
          retuneVoice(held, S, freq, time, S.glideTime ?? 0.08);
          held.generation++;
          return idFor(held);
        }
      }
      if (voices.length >= maxVoices) {
        // Steal the oldest voice that isn't already releasing; fall back to the
        // very oldest. Fast-release it so its slot frees up.
        const victim = voices.find(v => !v._ending) || voices[0];
        if (victim) endVoice(victim, time, STEAL_RELEASE);
      }
      const voice = buildVoice(freq, time, velocity);
      voices.push(voice);
      return idFor(voice); // generation 0 → plain number, same as before mono existed
    },

    /** Release the voice with `id` at `time` (ramps over the current S.release). */
    noteOff(id, time) {
      const { voiceId, generation } = parseId(id);
      const voice = voices.find(v => v.id === voiceId && !v._ending);
      // A generation mismatch means this note has since been glided over by
      // a newer one on the same voice — that later note's own noteOff will
      // release it; releasing now would cut the newer note off early.
      if (!voice || voice.generation !== generation) return;
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
