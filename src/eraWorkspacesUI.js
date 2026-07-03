// Era workspaces UI (D5). Wires the History tab's workspace picker: swatch
// buttons switch body[data-era] (style.css reads it for --era-accent/-2)
// and persist the choice; a small preset list per era loads one of its
// curated sounds via the existing applyPreset() path. Gated on graduation,
// like practiceUI.js's Practice tab — the roster only makes sense to browse
// once every module behind it has actually been taught.

import { ERA_WORKSPACES, workspaceById } from './eraWorkspaces.js';
import { progression, STAGE_IDS } from './progression.js';
import { applyPreset } from './controls.js';

const STORAGE_KEY = 'synthehol_era';

let sectionEl, swatchesEl, presetsEl;

function currentEraId() {
  return document.body.dataset.era || 'moog';
}

function setEra(id) {
  document.body.dataset.era = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage full/unavailable — not fatal */ }
  render();
}

function render() {
  if (!swatchesEl) return;
  const active = currentEraId();

  swatchesEl.innerHTML = '';
  for (const era of ERA_WORKSPACES) {
    const btn = document.createElement('button');
    btn.className = 'era-swatch' + (era.id === active ? ' active' : '');
    btn.textContent = era.name;
    btn.title = `${era.pioneer} — ${era.tagline}`;
    btn.setAttribute('aria-pressed', String(era.id === active));
    btn.addEventListener('click', () => setEra(era.id));
    swatchesEl.appendChild(btn);
  }

  presetsEl.innerHTML = '';
  const workspace = workspaceById(active);
  for (const preset of workspace?.presets ?? []) {
    const btn = document.createElement('button');
    btn.className = 'era-preset-btn';
    btn.textContent = preset.name;
    btn.title = `Load '${preset.name}'`;
    btn.addEventListener('click', () => applyPreset(preset));
    presetsEl.appendChild(btn);
  }
}

export function initEraWorkspacesUI() {
  sectionEl = document.getElementById('era-workspaces');
  swatchesEl = document.getElementById('era-swatches');
  presetsEl = document.getElementById('era-presets');
  if (!sectionEl) return;

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable — fall back to the default */ }
  if (saved && workspaceById(saved)) document.body.dataset.era = saved;

  render();
}

// Graduation-gated, like practiceUI.js's Practice tab — called on init and
// after every restore (a defeat mid-session can flip this on).
export function revealEraWorkspaces() {
  if (sectionEl) sectionEl.hidden = progression.defeated.length < STAGE_IDS.length;
}
