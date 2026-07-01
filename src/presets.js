import { S } from './state.js';

const STORAGE_KEY = 'synthehol_presets';

const FACTORY = [
  {
    name: 'Init', factory: true,
    waveform: 'sine', octave: 4, detune: 0,
    filterType: 'lowpass', cutoff: 2000, resonance: 1,
    attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3,
    lfoDest: 'filter', lfoRate: 2, lfoDepth: 0.2, masterVol: 0.6,
  },
  {
    name: 'Bass', factory: true,
    waveform: 'sawtooth', octave: 3, detune: 0,
    filterType: 'lowpass', cutoff: 400, resonance: 3,
    attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.15,
    lfoDest: 'none', lfoRate: 2, lfoDepth: 0, masterVol: 0.7,
  },
  {
    name: 'Brass', factory: true,
    waveform: 'sawtooth', octave: 4, detune: 5,
    filterType: 'bandpass', cutoff: 1200, resonance: 4,
    attack: 0.03, decay: 0.25, sustain: 0.6, release: 0.2,
    lfoDest: 'none', lfoRate: 2, lfoDepth: 0, masterVol: 0.6,
  },
  {
    name: 'Lead', factory: true,
    waveform: 'square', octave: 4, detune: 0,
    filterType: 'lowpass', cutoff: 3000, resonance: 6,
    attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1,
    lfoDest: 'pitch', lfoRate: 5, lfoDepth: 0.05, masterVol: 0.6,
  },
  {
    name: 'Pad', factory: true,
    waveform: 'triangle', octave: 4, detune: 0,
    filterType: 'lowpass', cutoff: 1800, resonance: 2,
    attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5,
    lfoDest: 'filter', lfoRate: 0.5, lfoDepth: 0.3, masterVol: 0.6,
  },
];

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveSaved(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const presets = {
  list() { return [...FACTORY, ...loadSaved()]; },
  save(name) {
    const saved = loadSaved().filter(p => p.name !== name);
    // Spread the full live params rather than a hand-picked field list — a
    // hardcoded list silently drops every param added after the preset system
    // was built (noise, osc2, EQ, drive, delay/reverb, filter env amount all
    // went missing this way; see the FX-restore bug).
    saved.push({ name, ...S });
    saveSaved(saved);
  },
  delete(name) {
    saveSaved(loadSaved().filter(p => p.name !== name));
  },
  isFactory(name) { return FACTORY.some(p => p.name === name); },
};

// URL-shareable patches (B16): the current sound round-trips through a
// `#patch=<json>` hash fragment — no server, no shortener, just the same flat
// params object presets already use. Length is a non-issue at ~30 scalar
// fields (a few hundred chars), well under any browser's URL limit.
export function buildShareUrl() {
  const params = new URLSearchParams({ patch: JSON.stringify(S) });
  return `${location.origin}${location.pathname}#${params.toString()}`;
}

// Read a shared patch out of the current URL hash, if present. Returns null
// (never throws) for no hash, a malformed hash, or non-object JSON.
export function readPatchFromHash() {
  if (!location.hash) return null;
  const raw = new URLSearchParams(location.hash.slice(1)).get('patch');
  if (!raw) return null;
  try {
    const patch = JSON.parse(raw);
    return (patch && typeof patch === 'object') ? patch : null;
  } catch {
    return null;
  }
}

export function initPresetsUI(applyPreset) {
  const select    = document.getElementById('preset-select');
  const loadBtn   = document.getElementById('preset-load-btn');
  const saveBtn   = document.getElementById('preset-save-btn');
  const deleteBtn = document.getElementById('preset-delete-btn');
  const nameInput = document.getElementById('preset-name-input');

  if (!select) return;

  function repopulate(selectName) {
    const prev = selectName ?? select.value;
    select.innerHTML = '';
    for (const p of presets.list()) {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = (p.factory ? '' : '★ ') + p.name;
      select.appendChild(opt);
    }
    if (prev) select.value = prev;
    syncDeleteBtn();
  }

  function syncDeleteBtn() {
    if (deleteBtn) deleteBtn.disabled = presets.isFactory(select.value);
  }

  select.addEventListener('change', syncDeleteBtn);

  loadBtn?.addEventListener('click', () => {
    const patch = presets.list().find(p => p.name === select.value);
    if (patch) applyPreset(patch);
  });

  saveBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim();
    if (!name) { nameInput?.focus(); return; }
    if (presets.isFactory(name)) {
      alert(`"${name}" is a factory preset — choose a different name.`);
      return;
    }
    presets.save(name);
    repopulate(name);
    if (nameInput) nameInput.value = '';
  });

  deleteBtn?.addEventListener('click', () => {
    const name = select.value;
    if (presets.isFactory(name)) return;
    presets.delete(name);
    repopulate('Init');
  });

  const shareBtn = document.getElementById('share-btn');
  shareBtn?.addEventListener('click', async () => {
    const url = buildShareUrl();
    history.replaceState(null, '', url);
    const label = shareBtn.textContent;
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = '✓ Copied!';
    } catch {
      window.prompt('Copy this link:', url); // clipboard API unavailable — fall back to a selectable prompt
      shareBtn.textContent = label;
      return;
    }
    setTimeout(() => { shareBtn.textContent = label; }, 1500);
  });

  repopulate();
}
