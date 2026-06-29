// Teaching panel: value-aware copy + illustrative canvas per topic.
// teach(key, value) — value is the current parameter value (number or string).

import { S } from './state.js';
import { noteFreq } from './notes.js';
import { setupCanvas, drawWaveOnCanvas, drawFilterCurveOnCanvas, drawADSRShape } from './canvas.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ms(v) { return v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s'; }
function hz(v) { return v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz'; }

// ── Value-aware copy ──────────────────────────────────────────────────────────

const TEACHINGS = {

  // ── Oscillator ──────────────────────────────────────────────────────────────

  'osc-wave': {
    title: (v) => ({ sine: 'Sine Wave — Pure Tone', square: 'Square Wave — Hollow & Reedy', sawtooth: 'Sawtooth Wave — Bright & Buzzy', triangle: 'Triangle Wave — Soft & Mellow' }[v] || 'Waveform'),
    body: (v) => ({
      sine:
        'The sine wave contains only the fundamental frequency — zero harmonics. It is the simplest waveform in nature. Flutes, ocarinas, and whistles approach this purity. ' +
        'On its own it sounds thin, but it is the foundation every other waveform is built from. Bob Moog\'s first oscillators in 1964 generated all four shapes simultaneously on separate outputs.',
      square:
        'The square wave contains only odd harmonics (3rd, 5th, 7th…) falling off as 1/n. This is physically what a clarinet does — its cylindrical bore filters out even harmonics. ' +
        'The result is hollow and reedy with a slight "bite". Excellent for retro leads and game music. Detuning two square waves together produces the classic hollow chorus of 1980s synth-pop.',
      sawtooth:
        'The richest standard waveform — all harmonics (1st, 2nd, 3rd…) present, falling off as 1/n. It approximates the pressure wave inside a bowed string or brass bell. ' +
        'This was the primary waveform of the Moog 901 Oscillator Bank (1964) and remains the go-to starting point for leads, basses, and pads. Run it through a filter and you can carve almost any timbre.',
      triangle:
        'Like the square wave, the triangle contains only odd harmonics — but they fall off far faster (as 1/n²), making it much softer and more sine-like. ' +
        'Warmer than square, cooler than saw. Used for flute-like leads and sub-bass reinforcement. The Minimoog\'s triangle output was sometimes called "digitally pure before digital existed."',
    }[v] || 'Select a waveform above to learn about it.'),
    draw: (c, v) => drawTeachWave(c, v),
  },

  'osc-oct': {
    title: () => 'Octave — Pitch Register',
    body: (v) => {
      const freq = Math.round(noteFreq('A', v));
      if (v <= 2) return `Sub-bass octave (A${v} = ${freq} Hz). Below A2 (110 Hz), most speakers struggle to reproduce the fundamental — you feel it more than hear it. Used for floor-shaking bass and rumble effects in electronic music.`;
      if (v === 3) return `Bass octave (A${v} = ${freq} Hz). The classic range for bass patches — thick, full, musical. Most acoustic bass instruments live here. Double-bass open strings are E1–G2; electric bass is typically tuned E1–G3.`;
      if (v === 4) return `Middle octave (A${v} = ${freq} Hz, concert pitch). The default for leads, pads, and most melodic work. A4 = 440 Hz is the international tuning reference. Wendy Carlos tuned to this standard for her 1968 Moog recordings of Bach.`;
      if (v === 5) return `Upper-mid octave (A${v} = ${freq} Hz). Bright leads and high melodic lines. Wendy Carlos often played in this range on Switched-On Bach to capture the brightness of harpsichord and oboe voices.`;
      return `High octave (A${v} = ${freq} Hz). Piercing, bell-like. Above A5 you're in piccolo and whistle territory. Harmonic content may alias or distort pleasantly through the filter. Best used for accents and sound effects.`;
    },
    draw: (c, v) => drawTeachOctave(c, v),
  },

  'osc-detune': {
    title: () => 'Detune — Pitch Nudge in Cents',
    body: (v) => {
      const abs = Math.abs(v);
      if (abs < 5) return `Near zero (${v}¢) — imperceptible detuning. Even "in tune" Moog oscillators of the 1960s drifted by 5–10¢ as they warmed up. That instability was part of the charm: it gave the sound a slightly "live" quality.`;
      if (abs < 20) return `Slight detune (${v}¢) — adds a subtle "human" quality, as though two players are performing in near-unison. Stacking two oscillators with ~10¢ of mutual detune is the origin of the classic chorus/unison sound.`;
      if (abs < 40) return `Moderate detune (${v}¢) — you can hear the interference beating between the fundamental and this shifted pitch. Beat rate ≈ detune × freq / 1200 Hz; at A4 that's roughly ${(abs * 440 / 1200).toFixed(1)} Hz of wobble.`;
      return `Heavy detune (${v}¢) — approaching half a semitone of pitch shift. At ±50¢ you're halfway between two notes. Useful for dissonant textures, siren sweeps, and the alien-sounding "pitch fighting" of two detuned oscillators.`;
    },
    draw: (c, v) => drawTeachDetune(c, v),
  },

  // ── Filter ──────────────────────────────────────────────────────────────────

  'filter-type': {
    title: (v) => ({ lowpass: 'Low-Pass Filter — Warm & Round', highpass: 'High-Pass Filter — Thin & Airy', bandpass: 'Band-Pass Filter — Nasal & Vocal' }[v] || 'Filter Type'),
    body: (v) => ({
      lowpass:
        'Bass passes, highs are cut. The most common filter type in synthesis history. ' +
        'The Moog transistor ladder filter (1965) was a low-pass design, and its warm 24 dB/octave rolloff became the defining sound of the Moog era. ' +
        'Sweep the cutoff up from a low value and you\'re recreating one of electronic music\'s most iconic motions.',
      highpass:
        'Treble passes, bass is cut. The inverse of the classic Moog sound — thin, airy, almost telephone-like at low cutoffs. ' +
        'Use it to carve bass out of pads, separate elements in a mix, or create the "filtered room" effect where only the attack of a sound comes through.',
      bandpass:
        'Only a narrow frequency band passes; everything above and below is attenuated. Creates nasal, vowel-like tones — the filter mimics the resonant cavities of the human voice. ' +
        'At high resonance the filter narrows to a single frequency, producing the "wah" that defined funk guitar before synthesizers adopted it.',
    }[v] || ''),
    draw: (c) => drawTeachFilterCurve(c),
  },

  'filter-cutoff': {
    title: () => 'Cutoff Frequency — Where the Filter Cuts',
    body: (v) => {
      if (v < 300) return `Nearly closed (${hz(v)}). Almost all harmonics are blocked — only the lowest sub-bass fundamental passes. This is the "muffled" quality The Muffled boss embodies: a sound buried under a blanket. Hold the key and slowly sweep the cutoff up from here.`;
      if (v < 1500) return `Low-mid cutoff (${hz(v)}). Warm, rounded, "plummy" tone. Body resonances of acoustic instruments cluster in this range. The Moog ladder filter in this position has a characteristic woody warmth that made it popular for bass patches.`;
      if (v < 4000) return `Mid cutoff (${hz(v)}). You're in the voice range — fundamentals are present, brightness is opening. Sweeping through here is one of electronic music's most emotionally charged gestures. Bob Moog's 1965 filter had its most expressive character in this band.`;
      if (v < 9000) return `Opening up (${hz(v)}). Upper harmonics are singing through freely. This bright-but-controlled range is where a filter sweep peaks emotionally. The Moog ladder filter's resonance peak (controlled by Q) is most audible here.`;
      return `Wide open (${hz(v)}). The filter is essentially out of the signal path — you're hearing the raw oscillator. All harmonics present, full brightness. The character of the Moog ladder fades; if you want it back, drop the cutoff and raise resonance.`;
    },
    draw: (c) => drawTeachFilterCurve(c),
  },

  'filter-res': {
    title: () => 'Resonance — Filter Self-Emphasis',
    body: (v) => {
      if (v < 2) return `Gentle Q (${v.toFixed(1)}) — natural, uncolored slope. Sounds like a subtle EQ cut rather than a synthesis filter. The Moog ladder at minimum resonance approaches this character, though even "zero" resonance has some inherent coloring.`;
      if (v < 6) return `Moderate Q (${v.toFixed(1)}) — a subtle peak is emerging at the cutoff frequency. The Moog ladder naturally had about 6 dB of resonance built into its character even at minimum Q setting. This is where the filter starts to "speak".`;
      if (v < 12) return `High Q (${v.toFixed(1)}) — the filter is resonating strongly, adding a clear "wah" or vowel-like quality. Sweeping the cutoff at this resonance level produces the most dramatic version of the classic filter sweep sound.`;
      return `Near self-oscillation (${v.toFixed(1)}) — the filter is on the verge of generating its own tone at the cutoff frequency. Push it to maximum and it will sing with no input signal at all. Bob Moog discovered this property of the ladder filter by accident in 1964 and immediately recognized its musical potential.`;
    },
    draw: (c) => drawTeachFilterCurve(c),
  },

  'filter-env': {
    title: () => 'Filter Envelope — Per-Note Sweep',
    body: (v) => {
      if (v <= 0) return 'Off. The envelope is not routed to the filter, so the cutoff stays exactly where you set it. Raise the amount to make each note sweep the filter open and then settle — the single most iconic synth gesture.';
      return `Amount ${v.toFixed(1)} octaves. Each note jumps the cutoff up by ${v.toFixed(1)} octaves at the attack peak, then decays to the sustain level using the same ADSR times as the amp. Short decay + high amount = a snappy "pew"; long decay = a slow filter swell. This is how the classic per-note Moog sweep is made.`;
    },
    draw: (c) => drawTeachFilterCurve(c),
  },

  // ── ADSR ────────────────────────────────────────────────────────────────────

  'adsr-atk': {
    title: () => 'Attack — Time to Reach Full Volume',
    body: (v) => {
      if (v < 0.02) return `Instant attack (${ms(v)}) — percussive, no build-up. The transient is sharp and immediate, like a drum hit or a plucked string. Wendy Carlos used fast attacks on the Moog to mimic the pluck of harpsichord strings for her 1968 Bach transcriptions.`;
      if (v < 0.08) return `Fast attack (${ms(v)}) — snappy and present. The onset is rounded just enough to remove harshness. Good for leads that need bite without clicking. Trumpet and piano attacks are in this range.`;
      if (v < 0.4) return `Medium attack (${ms(v)}) — the sound builds noticeably before reaching full volume. You'll hear the swell. Good for pad layers and sustained chords where the note should emerge rather than pop.`;
      return `Slow attack (${ms(v)}) — the note fades in over a long period. The Moog Contour Generator was praised in 1968 precisely for this capability: it could match the slow, lush swell of a string section. Use it for atmospheric pads and evolving textures.`;
    },
    draw: (c) => drawTeachADSR(c, 'atk'),
  },

  'adsr-dec': {
    title: () => 'Decay — Fall from Peak to Sustain',
    body: (v) => {
      if (v < 0.05) return `Very short decay (${ms(v)}) — the peak vanishes almost instantly. Combine with low sustain for sharp, percussive sounds. The note's character lives entirely in its attack transient.`;
      if (v < 0.2) return `Fast decay (${ms(v)}) — brief brightness at onset that quickly settles. Standard for plucks and hits. The piano's initial hammer strike dies away in roughly this time before the sustained string tone takes over.`;
      if (v < 0.8) return `Medium decay (${ms(v)}) — the initial bright peak lingers noticeably before settling. Piano-like: a bright attack that melts into a softer body. Most "organic" feeling range for melodic patches.`;
      return `Long decay (${ms(v)}) — the peak takes a long time to fall. Brassy, wind-instrument quality. The note maintains its initial brightness for an extended hold before settling. Good for pads that need a slow, evolving tone.`;
    },
    draw: (c) => drawTeachADSR(c, 'dec'),
  },

  'adsr-sus': {
    title: () => 'Sustain — Volume While Key Is Held',
    body: (v) => {
      const pct = Math.round(v * 100);
      if (v < 0.1) return `Near zero sustain (${pct}%) — sound dies away even while the key is held. Piano-like: the note lives in its attack and decay, not the sustained portion. Excellent for rhythmic, percussive patches where note length is controlled by how long you hold each key.`;
      if (v < 0.4) return `Low sustain (${pct}%) — most of the note's life is in the attack transient. The sustained tail is present but quiet. Good for plucky guitar-like tones where the note rings out and fades.`;
      if (v < 0.75) return `Mid sustain (${pct}%) — a balanced envelope. The note persists while held but isn't at full volume. The most versatile range; covers most lead and pad sounds.`;
      return `High sustain (${pct}%) — nearly full volume for as long as the key is held. Organ-like: the note doesn't decay, it simply plays. Moog demonstrated this quality in early live performances where the constant sustain let players shape phrasing through timing alone.`;
    },
    draw: (c) => drawTeachADSR(c, 'sus'),
  },

  'adsr-rel': {
    title: () => 'Release — Tail After Key Is Released',
    body: (v) => {
      if (v < 0.05) return `Instant release (${ms(v)}) — sound cuts off the moment you lift the key. Staccato, abrupt. Used for rhythmic patterns where note boundaries must be crisp, or for bass lines where overlapping notes would muddy a mix.`;
      if (v < 0.2) return `Fast release (${ms(v)}) — a brief tail after releasing the key. The note has a clean, defined ending without being abrupt. Standard for most melodic patches.`;
      if (v < 1.2) return `Medium release (${ms(v)}) — a natural-sounding decay tail, like a piano without the sustain pedal. The note completes itself rather than stopping dead. Adds realism and space.`;
      return `Long release (${ms(v)}) — the note rings well after you let go, like a piano with its sustain pedal held. Long attack + long release = the "pad" shape that defined ambient and new-age synthesis. The Minimoog's envelope could reach 10 seconds of release.`;
    },
    draw: (c) => drawTeachADSR(c, 'rel'),
  },

  // ── LFO ─────────────────────────────────────────────────────────────────────

  'lfo-dest': {
    title: (v) => ({ none: 'LFO — Off', filter: 'LFO → Filter — Auto-Wah', pitch: 'LFO → Pitch — Vibrato', amp: 'LFO → Amp — Tremolo' }[v] || 'LFO Destination'),
    body: (v) => ({
      none: 'The LFO is disconnected — no modulation is happening. The sound is static. Choose a target above to bring it to life. Modulation is what separates a lifeless tone from an expressive instrument.',
      filter: 'The LFO is rhythmically sweeping the filter cutoff up and down. At slow rates (below 1 Hz) this is a gentle "breathing" effect; at medium rates (2–5 Hz) it becomes a "wah-wah". One of the most iconic sounds in electronic music — a staple of funk, electronica, and dance music.',
      pitch: 'Vibrato — the LFO is bending the pitch up and down cyclically. Natural human vibrato is 5–7 Hz with about 30¢ of depth. Violin players produce it by rocking their finger on the string. The Minimoog\'s LFO was wired to pitch by default, making vibrato its signature expressive tool.',
      amp: 'Tremolo — the LFO is pulsing the volume. Common in vintage electric pianos (Fender Rhodes) and guitar amplifiers (Fender Vibrolux). Distinguished from vibrato by feel: a volume flutter rather than a pitch wobble. Slower rates feel rhythmic; faster rates feel more mechanical.',
    }[v] || ''),
    draw: (c) => drawTeachLFO(c),
  },

  'lfo-rate': {
    title: () => 'LFO Rate — Speed of Modulation',
    body: (v) => {
      if (v < 0.5) return `Very slow (${v.toFixed(2)} Hz) — one full cycle every ${(1/v).toFixed(1)} seconds. Barely perceptible as oscillation; creates long, sweeping evolutions. Good for ambient textures where the sound should change over many seconds rather than pulse.`;
      if (v < 3) return `Slow rate (${v.toFixed(1)} Hz) — clearly perceptible oscillation with a long period. The "wah" effect on filter, or a very wide, slow vibrato. This was the classic LFO range on 1970s synthesizers — used for expressive swells and auto-filter effects.`;
      if (v < 8) return `Vibrato/tremolo range (${v.toFixed(1)} Hz) — natural human vibrato sits at 5–7 Hz. This is where LFO modulation starts to feel expressive and organic. The Minimoog's LFO was calibrated with this range as its center.`;
      if (v < 15) return `Fast modulation (${v.toFixed(1)} Hz) — the effect becomes a rapid "flutter" rather than a sweep. Metallic, buzzy quality emerges, especially on pitch. Chorus and flanger effects use oscillators in this range.`;
      return `Near audio-rate (${v.toFixed(1)} Hz) — above ~20 Hz, the LFO becomes audio-rate AM or FM, creating sidebands and ring-modulator-like metallic effects. This is exactly how FM synthesis works: modulating pitch at audio rate with another oscillator.`;
    },
    draw: (c, v) => drawTeachLFO(c, v),
  },

  'lfo-depth': {
    title: () => 'LFO Depth — Intensity of Modulation',
    body: (v) => {
      if (v < 0.08) return `Barely there (${Math.round(v*100)}%) — the modulation is almost imperceptible. Adds subtle "life" to an otherwise static sound without obviously changing the character. Useful for background pads where movement shouldn't be audible but presence should be felt.`;
      if (v < 0.25) return `Light depth (${Math.round(v*100)}%) — modulation is present and musical. Natural-sounding vibrato or gentle filter movement lives here. The sound has organic quality without the LFO dominating.`;
      if (v < 0.55) return `Medium depth (${Math.round(v*100)}%) — clearly audible modulation. The LFO's character becomes a primary feature of the sound. Classic wah range for filter, or expressive wide vibrato for pitch.`;
      return `Deep modulation (${Math.round(v*100)}%) — dramatic, expressive effect. The LFO is sweeping across a large portion of the target's range. Good for sci-fi effects, extreme sweeps, and leads where expression is the point rather than a subtle ornament.`;
    },
    draw: (c, v) => drawTeachLFO(c, v),
  },

  // ── FX ──────────────────────────────────────────────────────────────────────

  'fx-delay': {
    title: () => 'Delay — Echo',
    body: 'Delay records the sound and plays it back after a set time, then feeds part of that echo back in to repeat it. Time sets the gap between echoes; Feedback sets how many repeats before they fade; Mix blends the echoes against the dry sound. Short times thicken a sound; long times create rhythmic, dub-style trails.',
    draw: (c) => drawTeachEcho(c),
  },

  'fx-reverb': {
    title: () => 'Reverb — Space',
    body: 'Reverb simulates the dense wash of reflections a sound makes in a physical space — a room, a hall, a cathedral. Unlike a discrete echo, the reflections are too many and too close to hear individually; they blur into a tail that decays smoothly. A little adds depth and glue; a lot puts the sound in a vast, distant space.',
    draw: (c) => drawTeachEcho(c, 0.78),
  },

  // ── Lore (historical context) ───────────────────────────────────────────────

  'lore-osc': {
    title: () => 'Bob Moog · Oscillator · 1964',
    body: () => 'Bob Moog debuted the first voltage-controlled synthesizer modules at the AES convention in October 1964, giving composers electronic control over pitch for the first time. His oscillator bank generated four simultaneous waveforms (sine, triangle, sawtooth, square) on separate outputs — the same shapes you control here.',
    draw: (c) => drawLoreOsc(c),
  },
  'lore-filter': {
    title: () => 'Bob Moog · Transistor Ladder Filter · 1965',
    body: () => "Moog's transistor ladder filter — introduced in his 1965 commercial modules — produced a warm resonance that became the defining sound of the synthesizer era. The cascade of four transistor pairs creates a 24 dB/octave rolloff with a self-resonating quality that no other filter of the era matched.",
    draw: (c) => drawLoreFilter(c),
  },
  'lore-envelope': {
    title: () => 'Wendy Carlos · Contour Generator · 1968',
    body: () => "Wendy Carlos's 1968 album Switched-On Bach demonstrated that the Moog's contour generators could match the attack and decay of acoustic instruments with uncanny expressiveness. Her meticulous programming — each note recorded individually with carefully shaped envelopes — showed that synthesis could be a performance art.",
    draw: (c) => drawLoreEnvelope(c),
  },
  'lore-lfo': {
    title: () => 'Wendy Carlos · Minimoog Model D · 1970',
    body: () => 'The Minimoog Model D (1970), developed with input from Wendy Carlos, collapsed the modular patch cables of earlier synthesizers into a single playable instrument. Its built-in LFO — hardwired to pitch for vibrato, with a rate knob — made expressive performance accessible to musicians who were not engineers.',
    draw: (c) => drawLoreLFO(c),
  },

  // ── Boss battle hints ────────────────────────────────────────────────────────
  // Shown automatically when a boss fight begins. Each hint names the exact
  // target condition and shows it visually so players know what to aim for.

  'boss-hint-osc': {
    title: () => '⚔ Mission: Change the Waveform',
    body: () => 'Vox Corruptus feeds on pure sine waves — their simplicity is its power. Switch to Square, Sawtooth, or Triangle, then play a note. Any non-sine waveform deals damage. Hold the sound to drain its health.',
    draw: (c) => drawHintOsc(c),
  },
  'boss-hint-filter': {
    title: () => '⚔ Mission: Open the Filter',
    body: () => 'The Muffled thrives in darkness. Set the filter to Low Pass and sweep the Cutoff above 4 kHz while playing a note. The brighter the tone, the more it hurts.',
    draw: (c) => drawHintFilter(c),
  },
  'boss-hint-envelope': {
    title: () => '⚔ Mission: Make It Punch',
    body: () => "Dronekeeper blurs every note into an endless drone. Set Attack below 50 ms and Sustain below 30% while playing. The sound needs a sharp beginning and a fast end — a percussive hit, not a wash.",
    draw: (c) => drawHintEnvelope(c),
  },
  'boss-hint-lfo': {
    title: () => '⚔ Mission: Add Movement',
    body: () => "The Still has frozen all modulation. Route the LFO to any target — Filter, Pitch, or Amp — and push Depth above 30% while playing. A static sound deals no damage. The sound must move.",
    draw: (c) => drawHintLFO(c),
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

let drawPending = false;
let lastKey = null;
let lastValue;

// Update the teaching panel. Title/body change synchronously (cheap, and what
// the unit tests assert), but the illustration draw — which can be costly, e.g.
// the filter curve's getFrequencyResponse — is coalesced to at most one per
// frame so dragging a slider doesn't redraw it on every input event. Falls back
// to a synchronous draw when requestAnimationFrame is unavailable (unit tests).
export function teach(key, value) {
  const t = TEACHINGS[key];
  if (!t) return;
  lastKey = key;
  lastValue = value;

  const titleEl = document.getElementById('teach-title');
  const bodyEl  = document.getElementById('teach-body');
  if (titleEl) titleEl.textContent = typeof t.title === 'function' ? t.title(value) : t.title;
  if (bodyEl)  bodyEl.textContent  = typeof t.body  === 'function' ? t.body(value)  : t.body;

  const drawNow = () => {
    const cur = TEACHINGS[lastKey];
    const canvasEl = document.getElementById('teach-canvas');
    if (cur && canvasEl) cur.draw(canvasEl, lastValue);
  };

  if (typeof requestAnimationFrame !== 'function') { drawNow(); return; }
  if (!drawPending) {
    drawPending = true;
    requestAnimationFrame(() => { drawPending = false; drawNow(); });
  }
}

// ── Canvas draw functions ─────────────────────────────────────────────────────

function drawTeachWave(canvas, activeWave) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const types = ['sine', 'square', 'sawtooth', 'triangle'];
  const labels = ['Sine', 'Square', 'Saw', 'Triangle'];
  const segW = W / 4;
  const waveH = H - 18;

  types.forEach((t, i) => {
    const isActive = t === (activeWave || S.waveform);
    ctx2.save();
    ctx2.translate(i * segW, 0);

    // Background tint for active
    if (isActive) {
      ctx2.fillStyle = 'rgba(212,150,10,0.08)';
      ctx2.fillRect(0, 0, segW - 2, H);
    }

    // Clip wave area
    ctx2.beginPath();
    ctx2.rect(0, 0, segW - 2, waveH);
    ctx2.clip();
    drawWaveOnCanvas(ctx2, segW - 2, waveH, t, isActive ? '#d4960a' : '#3a3630', isActive ? 2 : 1, 1.5);
    ctx2.restore();

    // Label below
    ctx2.save();
    ctx2.translate(i * segW, 0);
    ctx2.font = `${isActive ? 700 : 400} 9px -apple-system, sans-serif`;
    ctx2.fillStyle = isActive ? '#d4960a' : '#6b6560';
    ctx2.textAlign = 'center';
    ctx2.fillText(labels[i], (segW - 2) / 2, H - 4);
    ctx2.restore();
  });

  ctx2.restore();
}

function drawTeachOctave(canvas, octave) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const oct = octave || S.octave;
  const baseFreq = noteFreq('A', oct);

  ctx2.fillStyle = '#1a1714';
  ctx2.fillRect(0, 0, W, H);

  // Draw a frequency scale as overlapping sine wave cycles
  const cycles = Math.pow(2, oct - 4) * 2;
  drawWaveOnCanvas(ctx2, W, H - 24, 'sine', '#d4960a', 1.5, Math.min(cycles, 12));

  // Labels
  ctx2.font = '11px -apple-system, sans-serif';
  ctx2.fillStyle = '#d4960a';
  ctx2.textAlign = 'left';
  ctx2.fillText(`A${oct} = ${Math.round(baseFreq)} Hz`, 8, H - 10);

  // Octave bar
  const barW = ((oct - 2) / 4) * (W - 16);
  ctx2.fillStyle = '#3a3630';
  ctx2.fillRect(8, H - 6, W - 16, 3);
  ctx2.fillStyle = '#d4960a';
  ctx2.fillRect(8, H - 6, barW, 3);

  ctx2.restore();
}

function drawTeachDetune(canvas, detune) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const d = detune !== undefined ? detune : S.detune;
  const offset = d / 1200;

  // Base wave
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#d4960a', 2, 2);

  // Detuned wave (frequency shifted slightly)
  ctx2.globalAlpha = 0.5;
  drawWaveOnCanvas(ctx2, W, H, 'sine', '#d4960a88', 1.2, 2 * (1 + offset));
  ctx2.globalAlpha = 1;

  // Cent label
  ctx2.font = 'bold 11px monospace';
  ctx2.fillStyle = Math.abs(d) > 5 ? '#d4960a' : '#6b6560';
  ctx2.textAlign = 'right';
  ctx2.fillText((d >= 0 ? '+' : '') + d + ' ¢', W - 6, H - 6);

  ctx2.restore();
}

function drawTeachFilterCurve(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  drawFilterCurveOnCanvas(ctx2, W, H - 16, '#22d3ee');

  // X-axis frequency labels
  ctx2.font = '9px monospace';
  ctx2.fillStyle = '#4a4a60';
  ctx2.textAlign = 'center';
  const freqLabels = [[20, '20'], [200, '200'], [2000, '2k'], [10000, '10k'], [20000, '20k']];
  freqLabels.forEach(([f, label]) => {
    const x = Math.log10(f / 20) / 3 * W;
    ctx2.fillText(label, x, H - 2);
  });

  ctx2.restore();
}

function drawTeachEcho(canvas, ratio = 0.6) {
  const { ctx2, W, H } = setupCanvas(canvas);
  ctx2.strokeStyle = '#f472b6';
  ctx2.lineWidth = 2;
  ctx2.lineCap = 'round';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = 12 + i * (W - 24) / n;
    const amp = (H - 14) * Math.pow(ratio, i);
    ctx2.globalAlpha = Math.max(0.25, Math.pow(ratio, i));
    ctx2.beginPath();
    ctx2.moveTo(x, H - 6);
    ctx2.lineTo(x, H - 6 - amp);
    ctx2.stroke();
  }
  ctx2.globalAlpha = 1;
  ctx2.restore();
}

function drawTeachADSR(canvas, highlight) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const pts = drawADSRShape(ctx2, W, H - 14, '#a78bfa', 6);

  // Highlight the active segment
  const segColor = '#a78bfa';
  if (highlight) {
    const segs = { atk: [pts.x0, pts.x1], dec: [pts.x1, pts.x2], sus: [pts.x2, pts.x3], rel: [pts.x3, pts.x4] };
    const seg = segs[highlight];
    if (seg) {
      ctx2.strokeStyle = segColor;
      ctx2.lineWidth = 2.5;
      ctx2.shadowColor = segColor;
      ctx2.shadowBlur = 6;
      ctx2.beginPath();
      ctx2.moveTo(seg[0], highlight === 'atk' ? pts.bot : highlight === 'dec' ? pts.top : pts.susY);
      ctx2.lineTo(seg[1], highlight === 'atk' ? pts.top : highlight === 'dec' ? pts.susY : highlight === 'sus' ? pts.susY : pts.bot);
      ctx2.stroke();
      ctx2.shadowBlur = 0;
    }
  }

  // Segment labels
  ctx2.font = '9px monospace';
  ctx2.textAlign = 'center';
  const labels = [
    { label: 'A', x: (pts.x0 + pts.x1) / 2, active: highlight === 'atk' },
    { label: 'D', x: (pts.x1 + pts.x2) / 2, active: highlight === 'dec' },
    { label: 'S', x: (pts.x2 + pts.x3) / 2, active: highlight === 'sus' },
    { label: 'R', x: (pts.x3 + pts.x4) / 2, active: highlight === 'rel' },
  ];
  labels.forEach(({ label, x, active }) => {
    ctx2.fillStyle = active ? '#a78bfa' : '#4a4060';
    ctx2.fillText(label, x, H - 2);
  });

  ctx2.restore();
}

function drawTeachLFO(canvas, rateOrDepth) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const active = S.lfoDest !== 'none';

  if (!active) {
    ctx2.strokeStyle = '#2a2a44';
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    ctx2.moveTo(0, H / 2); ctx2.lineTo(W, H / 2);
    ctx2.stroke();
    ctx2.fillStyle = '#3a3a60';
    ctx2.font = '11px -apple-system, sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('LFO off — select a target above', W / 2, H / 2 + 4);
  } else {
    const cycles = Math.max(1, Math.min(6, S.lfoRate * 0.7));
    const scaleY = 0.3 + S.lfoDepth * 0.65;
    const topY   = H / 2 * (1 - scaleY);

    // Depth envelope shading
    ctx2.fillStyle = 'rgba(74,222,128,0.06)';
    ctx2.fillRect(0, topY, W, H - topY * 2);

    // Depth boundary lines
    ctx2.strokeStyle = 'rgba(74,222,128,0.2)';
    ctx2.lineWidth = 1;
    ctx2.setLineDash([3, 4]);
    ctx2.beginPath(); ctx2.moveTo(0, topY); ctx2.lineTo(W, topY); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(0, H - topY); ctx2.lineTo(W, H - topY); ctx2.stroke();
    ctx2.setLineDash([]);

    ctx2.save();
    ctx2.translate(0, H / 2 * (1 - scaleY));
    ctx2.scale(1, scaleY);
    drawWaveOnCanvas(ctx2, W, H, 'sine', '#4ade80', 2, cycles);
    ctx2.restore();

    // Rate label
    ctx2.font = '9px monospace';
    ctx2.fillStyle = '#4ade80';
    ctx2.textAlign = 'right';
    ctx2.fillText(S.lfoRate.toFixed(1) + ' Hz', W - 6, H - 4);
  }
  ctx2.restore();
}

// ── Lore illustrations ────────────────────────────────────────────────────────
// Simple rack-unit silhouettes drawn in the style of bossArt.js

function drawLoreOsc(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  ctx2.strokeStyle = '#d4960a';
  ctx2.fillStyle = '#1a1412';

  // Panel outline
  ctx2.fillRect(4, 4, W - 8, H - 8);
  ctx2.strokeStyle = '#d4960a44';
  ctx2.lineWidth = 1;
  ctx2.strokeRect(4, 4, W - 8, H - 8);

  // Four waveforms in a row
  const types = ['sine', 'square', 'sawtooth', 'triangle'];
  const cols  = 4;
  const colW  = (W - 8) / cols;
  const wH    = H * 0.55;
  const yOff  = 14;

  types.forEach((t, i) => {
    ctx2.save();
    ctx2.translate(4 + i * colW, yOff);
    ctx2.beginPath();
    ctx2.rect(0, 0, colW - 2, wH);
    ctx2.clip();
    drawWaveOnCanvas(ctx2, colW - 2, wH, t, '#d4960a88', 1.2, 1.5);
    ctx2.restore();
  });

  // Year / label strip
  ctx2.font = 'bold 10px monospace';
  ctx2.fillStyle = '#d4960a';
  ctx2.textAlign = 'center';
  ctx2.fillText('MOOG 901 · 1964', W / 2, H - 8);

  ctx2.restore();
}

function drawLoreFilter(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  ctx2.fillStyle = '#0e1618';
  ctx2.fillRect(4, 4, W - 8, H - 8);

  // Draw three filter curves (LP, BP, HP) overlapping
  const curves = [
    { type: 'lowpass',  color: '#22d3ee', cutoff: 800 },
    { type: 'bandpass', color: '#7eb8c466', cutoff: 2000 },
    { type: 'highpass', color: '#22d3ee44', cutoff: 4000 },
  ];
  const nPts = Math.ceil(W - 8);
  curves.forEach(({ type, color, cutoff }) => {
    const magArr = new Float32Array(nPts);
    for (let i = 0; i < nPts; i++) {
      const f = 20 * Math.pow(1000, i / nPts);
      const ratio = f / cutoff;
      if (type === 'lowpass')  magArr[i] = 1 / Math.sqrt(1 + Math.pow(ratio * 2, 6));
      else if (type === 'highpass') magArr[i] = 1 / Math.sqrt(1 + Math.pow(2 / ratio, 6));
      else magArr[i] = 2 / Math.sqrt(4 + Math.pow(ratio - 1/ratio, 2) * 4);
    }
    const drawH = H - 28;
    ctx2.strokeStyle = color;
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    for (let i = 0; i < nPts; i++) {
      const x = 4 + i;
      const db = 20 * Math.log10(Math.max(0.001, magArr[i]));
      const y = 8 + drawH / 2 - (db / 36) * (drawH - 4);
      i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
    }
    ctx2.stroke();
  });

  ctx2.font = 'bold 10px monospace';
  ctx2.fillStyle = '#22d3ee';
  ctx2.textAlign = 'center';
  ctx2.fillText('MOOG LADDER FILTER · 1965', W / 2, H - 8);
  ctx2.restore();
}

function drawLoreEnvelope(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  ctx2.fillStyle = '#120e18';
  ctx2.fillRect(4, 4, W - 8, H - 8);

  // Draw three different ADSR shapes to show variety
  const envs = [
    { attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.05, color: '#a78bfa' },  // pluck
    { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3, color: '#a78bfa99' }, // piano
    { attack: 1.0,  decay: 0.5, sustain: 0.8, release: 1.5, color: '#a78bfa44' }, // pad
  ];

  envs.forEach(env => {
    const drawH = H - 28;
    const totalT = env.attack + env.decay + 0.4 + env.release;
    const scale = (W - 16) / totalT;
    const bot = 8 + drawH, top = 8;
    const susY = top + (1 - env.sustain) * drawH;
    const x0 = 8;
    const x1 = x0 + env.attack * scale;
    const x2 = x1 + env.decay  * scale;
    const x3 = x2 + 0.4        * scale;
    const x4 = x3 + env.release* scale;

    ctx2.strokeStyle = env.color;
    ctx2.lineWidth = 1.5;
    ctx2.lineJoin = 'round';
    ctx2.beginPath();
    ctx2.moveTo(x0, bot); ctx2.lineTo(x1, top);
    ctx2.lineTo(x2, susY); ctx2.lineTo(x3, susY);
    ctx2.lineTo(x4, bot);
    ctx2.stroke();
  });

  ctx2.font = 'bold 10px monospace';
  ctx2.fillStyle = '#a78bfa';
  ctx2.textAlign = 'center';
  ctx2.fillText('MOOG CONTOUR · 1968', W / 2, H - 8);
  ctx2.restore();
}

function drawLoreLFO(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  ctx2.fillStyle = '#0e1410';
  ctx2.fillRect(4, 4, W - 8, H - 8);

  const drawH = H - 28;

  // Three LFO shapes at different rates
  const rates = [
    { rate: 0.5, color: '#4ade8044', depth: 0.3 },
    { rate: 2.0, color: '#4ade8088', depth: 0.6 },
    { rate: 6.0, color: '#4ade80',   depth: 0.9 },
  ];
  rates.forEach(({ rate, color, depth }) => {
    const cycles = Math.min(8, rate * 2.5);
    ctx2.save();
    ctx2.translate(4, 8 + drawH / 2 * (1 - depth));
    ctx2.scale(1, depth);
    drawWaveOnCanvas(ctx2, W - 8, drawH, 'sine', color, 1.2, cycles);
    ctx2.restore();
  });

  ctx2.font = 'bold 10px monospace';
  ctx2.fillStyle = '#4ade80';
  ctx2.textAlign = 'center';
  ctx2.fillText('MINIMOOG MODEL D · 1970', W / 2, H - 8);
  ctx2.restore();
}

// ── Boss hint draw functions ───────────────────────────────────────────────────
// These show the TARGET state so players know exactly what to aim for.

function drawHintOsc(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const types  = ['sine', 'square', 'sawtooth', 'triangle'];
  const labels = ['Sine ✗', 'Square ✓', 'Saw ✓', 'Tri ✓'];
  const segW   = W / 4;
  const waveH  = H - 18;

  types.forEach((t, i) => {
    const damages = t !== 'sine';
    ctx2.save();
    ctx2.translate(i * segW, 0);
    if (damages) {
      ctx2.fillStyle = 'rgba(212,150,10,0.1)';
      ctx2.fillRect(0, 0, segW - 2, H);
    }
    ctx2.beginPath();
    ctx2.rect(0, 0, segW - 2, waveH);
    ctx2.clip();
    drawWaveOnCanvas(ctx2, segW - 2, waveH, t, damages ? '#d4960a' : '#3a3630', damages ? 1.5 : 1, 1.5);
    ctx2.restore();

    ctx2.save();
    ctx2.translate(i * segW, 0);
    ctx2.font = `${damages ? 700 : 400} 9px -apple-system, sans-serif`;
    ctx2.fillStyle = damages ? '#d4960a' : '#4a3a30';
    ctx2.textAlign = 'center';
    ctx2.fillText(labels[i], (segW - 2) / 2, H - 4);
    ctx2.restore();
  });
  ctx2.restore();
}

function drawHintFilter(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const drawH = H - 20;

  // Helper: draw a lowpass curve at a given cutoff
  const drawLP = (cutoff, color, lw) => {
    ctx2.strokeStyle = color;
    ctx2.lineWidth   = lw;
    ctx2.beginPath();
    for (let i = 0; i < W; i++) {
      const f     = 20 * Math.pow(1000, i / W);
      const ratio = f / cutoff;
      const mag   = 1 / Math.sqrt(1 + Math.pow(ratio * 1.5, 6));
      const db    = 20 * Math.log10(Math.max(0.001, mag));
      const x     = i;
      const y     = drawH / 2 - (db / 48) * (drawH - 6);
      i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
    }
    ctx2.stroke();
  };

  // Current (muffled) state — dim
  drawLP(400,  '#22d3ee28', 1);
  // Target (open) state — bright
  drawLP(6000, '#22d3ee',   2);

  // Target cutoff marker
  const tx = Math.log10(4000 / 20) / 3 * W;
  ctx2.strokeStyle = '#22d3ee55';
  ctx2.lineWidth   = 1;
  ctx2.setLineDash([3, 3]);
  ctx2.beginPath(); ctx2.moveTo(tx, 0); ctx2.lineTo(tx, drawH); ctx2.stroke();
  ctx2.setLineDash([]);

  // Labels
  ctx2.font      = '9px monospace';
  ctx2.fillStyle = '#22d3ee88';
  ctx2.textAlign = 'left';
  ctx2.fillText('muffled', 4, drawH - 4);
  ctx2.fillStyle = '#22d3ee';
  ctx2.textAlign = 'right';
  ctx2.fillText('target → open (> 4 kHz)', W - 4, H - 4);
  ctx2.restore();
}

function drawHintEnvelope(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);

  // Draw the target ADSR shape with fixed target values (not current S)
  const target = { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.3 };
  const drawW  = W - 8;
  const bot    = H - 22;
  const top    = 4;
  const totalT = target.attack + target.decay + 0.4 + target.release;
  const aW     = (target.attack  / totalT) * drawW;
  const dW     = (target.decay   / totalT) * drawW;
  const sW     = (0.4            / totalT) * drawW;
  const rW     = (target.release / totalT) * drawW;
  const susY   = top + (1 - target.sustain) * (bot - top);
  const x0 = 4, x1 = x0+aW, x2 = x1+dW, x3 = x2+sW, x4 = x3+rW;

  ctx2.fillStyle = 'rgba(167,139,250,0.1)';
  ctx2.strokeStyle = '#a78bfa';
  ctx2.lineWidth   = 2;
  ctx2.lineJoin    = 'round';

  ctx2.beginPath();
  ctx2.moveTo(x0, bot); ctx2.lineTo(x1, top);
  ctx2.lineTo(x2, susY); ctx2.lineTo(x3, susY);
  ctx2.lineTo(x4, bot); ctx2.lineTo(x0, bot);
  ctx2.closePath(); ctx2.fill();

  ctx2.beginPath();
  ctx2.moveTo(x0, bot); ctx2.lineTo(x1, top);
  ctx2.lineTo(x2, susY); ctx2.lineTo(x3, susY);
  ctx2.lineTo(x4, bot);
  ctx2.stroke();

  // Sustain level reference line
  ctx2.strokeStyle = '#a78bfa44';
  ctx2.lineWidth   = 1;
  ctx2.setLineDash([2, 4]);
  ctx2.beginPath(); ctx2.moveTo(0, susY); ctx2.lineTo(W, susY); ctx2.stroke();
  ctx2.setLineDash([]);

  // Annotations
  ctx2.font      = '9px monospace';
  ctx2.fillStyle = '#a78bfa';
  ctx2.textAlign = 'center';
  ctx2.fillText('A < 50ms', (x0 + x1) / 2, H - 6);
  ctx2.fillText('S < 30%',  (x2 + x3) / 2, susY - 5);
  ctx2.restore();
}

function drawHintLFO(canvas) {
  const { ctx2, W, H } = setupCanvas(canvas);
  const drawH     = H - 18;
  const depth     = 0.45;
  const scaleY    = 0.3 + depth * 0.65;
  const topY      = drawH / 2 * (1 - scaleY);

  // Depth shading
  ctx2.fillStyle = 'rgba(74,222,128,0.08)';
  ctx2.fillRect(0, topY, W, drawH - topY * 2);

  // Depth boundary lines
  ctx2.strokeStyle = 'rgba(74,222,128,0.35)';
  ctx2.lineWidth   = 1;
  ctx2.setLineDash([3, 4]);
  ctx2.beginPath(); ctx2.moveTo(0, topY);          ctx2.lineTo(W, topY);          ctx2.stroke();
  ctx2.beginPath(); ctx2.moveTo(0, drawH - topY);  ctx2.lineTo(W, drawH - topY);  ctx2.stroke();
  ctx2.setLineDash([]);

  // Wave at target depth
  ctx2.save();
  ctx2.translate(0, drawH / 2 * (1 - scaleY));
  ctx2.scale(1, scaleY);
  drawWaveOnCanvas(ctx2, W, drawH, 'sine', '#4ade80', 2, 3);
  ctx2.restore();

  // Labels
  ctx2.font      = '9px monospace';
  ctx2.fillStyle = '#4ade80';
  ctx2.textAlign = 'center';
  ctx2.fillText('target: depth > 30%, any destination', W / 2, H - 4);
  ctx2.restore();
}
