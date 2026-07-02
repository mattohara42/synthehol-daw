// Sound diagnostics (D4) — a "grammar checker for sound." Interprets the
// live spectrum (and time-domain data, for clipping) into one short,
// actionable line instead of just showing a graph. Reuses the existing
// scope analyser (already tapped for the Spectrum visualizer) — no new
// audio nodes.

// Frequency bands (Hz) and roughly what excess energy in each means.
const BANDS = [
  { id: 'sub', lo: 20, hi: 80 },
  { id: 'low', lo: 80, hi: 250 },
  { id: 'lowMid', lo: 250, hi: 500 },
  { id: 'mid', lo: 500, hi: 2000 },
  { id: 'highMid', lo: 2000, hi: 5000 },
  { id: 'high', lo: 5000, hi: 12000 },
];

// Pure: given frequency-domain byte data (0..255 per bin, as returned by
// AnalyserNode.getByteFrequencyData) and the context's sample rate, compute
// each band's average energy, normalized 0..1. Exported for testing.
export function analyzeSpectrum(data, sampleRate) {
  const nyquist = sampleRate / 2;
  const binHz = nyquist / data.length;
  const bands = {};
  for (const b of BANDS) {
    const startBin = Math.floor(b.lo / binHz);
    const endBin = Math.min(data.length, Math.ceil(b.hi / binHz));
    let sum = 0, count = 0;
    for (let i = startBin; i < endBin; i++) { sum += data[i]; count++; }
    bands[b.id] = count ? (sum / count) / 255 : 0;
  }
  return bands;
}

// Pure: given time-domain byte data (0..255, 128 = silence, as returned by
// AnalyserNode.getByteTimeDomainData), detect sustained clipping — samples
// pinned at the rails, not just occasional peaks. Exported for testing.
export function detectClipping(timeData) {
  let pinned = 0;
  for (let i = 0; i < timeData.length; i++) {
    if (timeData[i] <= 1 || timeData[i] >= 254) pinned++;
  }
  return pinned / timeData.length > 0.02; // >2% of samples at the rail
}

// Pure: turn band energies (+ whether clipping was detected) into at most
// one short, actionable diagnosis, or null if there's nothing worth saying
// (near silence, or a genuinely balanced spectrum doesn't need a nag).
// Exported for testing.
export function diagnose(bands, clipping) {
  if (clipping) {
    return { kind: 'warn', text: 'Clipping — the signal is too hot. Lower Master Vol or Drive.' };
  }

  const values = Object.values(bands);
  const overall = values.reduce((a, b) => a + b, 0) / values.length;
  if (overall < 0.03) return null; // near silence, nothing to diagnose yet

  const findings = [];
  if (bands.lowMid > overall * 1.6 && bands.lowMid > 0.15) {
    findings.push({ severity: bands.lowMid, text: 'Energy piling up 250–500 Hz — sounds muddy. Try cutting EQ Low, or raising the filter cutoff.' });
  }
  if (bands.high > overall * 1.6 && bands.high > 0.12) {
    findings.push({ severity: bands.high, text: 'Lots of energy above 5 kHz — can sound harsh or brittle. Try cutting EQ High, or easing off Drive.' });
  }
  if (bands.sub > overall * 1.8 && bands.sub > 0.15) {
    findings.push({ severity: bands.sub, text: 'Heavy sub-bass buildup — can sound boomy on small speakers. Try cutting EQ Low.' });
  }
  if (bands.sub < 0.02 && bands.low < 0.03) {
    findings.push({ severity: 0.3, text: 'Very little low end — sounds thin. Try a lower Octave, or boosting EQ Low.' });
  }

  if (!findings.length) return { kind: 'ok', text: 'Balanced spectrum — no single band is dominating.' };
  findings.sort((a, b) => b.severity - a.severity);
  return { kind: 'warn', text: findings[0].text };
}

let el = null;
let scratchFreq = null;
let scratchTime = null;

export function initDiagnostics() {
  el = document.getElementById('diagnosis');
}

// Throttled: called from main.js's rAF dispatcher, but only does real work a
// few times a second — a spectral read doesn't need to be frame-perfect, and
// text that updates 60x/sec is unreadable anyway.
const UPDATE_INTERVAL_MS = 500;
let lastUpdate = 0;

export function refreshDiagnostics(engine, now) {
  if (!el || !engine.scope) return;
  if (now - lastUpdate < UPDATE_INTERVAL_MS) return;
  lastUpdate = now;

  const scope = engine.scope;
  const binCount = scope.frequencyBinCount;
  if (!scratchFreq || scratchFreq.length !== binCount) scratchFreq = new Uint8Array(binCount);
  if (!scratchTime || scratchTime.length !== binCount) scratchTime = new Uint8Array(binCount);
  scope.getByteFrequencyData(scratchFreq);
  scope.getByteTimeDomainData(scratchTime);

  const bands = analyzeSpectrum(scratchFreq, engine.ctx.sampleRate);
  const clipping = detectClipping(scratchTime);
  const result = diagnose(bands, clipping);

  if (!result) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = result.text;
  el.classList.toggle('diagnosis-warn', result.kind === 'warn');
  el.classList.toggle('diagnosis-ok', result.kind === 'ok');
}
