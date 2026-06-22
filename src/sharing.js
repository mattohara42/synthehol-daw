import { S } from './state.js';

const SHARE_KEYS = [
  'waveform', 'octave', 'detune',
  'filterType', 'cutoff', 'resonance',
  'attack', 'decay', 'sustain', 'release',
  'lfoDest', 'lfoRate', 'lfoDepth',
  'noiseType', 'noiseMix',
  'osc2Waveform', 'osc2Octave', 'osc2Detune', 'osc2Mix',
];

export function encodeState() {
  const data = {};
  for (const k of SHARE_KEYS) data[k] = S[k];
  return '#s=' + btoa(JSON.stringify(data));
}

export function decodeHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#s=')) return null;
  try {
    return JSON.parse(atob(hash.slice(3)));
  } catch {
    return null;
  }
}

export function applyState(data) {
  for (const k of SHARE_KEYS) {
    if (k in data) S[k] = data[k];
  }
  syncDOMToState();
}

function syncDOMToState() {
  const sliders = {
    's-oct': S.octave, 's-detune': S.detune,
    's-cutoff': S.cutoff, 's-res': S.resonance,
    's-atk': S.attack, 's-dec': S.decay, 's-sus': S.sustain, 's-rel': S.release,
    's-lforate': S.lfoRate, 's-lfodepth': S.lfoDepth,
    's-noisemix': S.noiseMix,
    's-osc2detune': S.osc2Detune, 's-osc2mix': S.osc2Mix,
  };
  for (const [id, val] of Object.entries(sliders)) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  setActiveToggle('wave-btns', 'wave', S.waveform);
  setActiveToggle('ftype-btns', 'ftype', S.filterType);
  setActiveToggle('lfodest-btns', 'dest', S.lfoDest);
  setActiveToggle('noise-type-btns', 'ntype', S.noiseType);
  setActiveToggle('osc2-wave-btns', 'wave', S.osc2Waveform);
  setActiveToggle('osc2-oct-btns', 'oct', String(S.osc2Octave));
}

function setActiveToggle(groupId, dataAttr, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.tog-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset[dataAttr] === value);
  });
}

export function initSharing() {
  const data = decodeHash();
  if (data) applyState(data);

  const btn = document.getElementById('share-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const hash = encodeState();
    history.replaceState(null, '', hash);
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    }).catch(() => {
      btn.textContent = 'Link set';
      setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    });
  });
}
