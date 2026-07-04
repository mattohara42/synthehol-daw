// Tracks UI (E4 step 2 lean slice). A minimal track picker — not L9's real
// track-lane container, which needs a work area to dock into that doesn't
// exist yet (see docs/brainstorms/2026-07-03-multitrack-mixer-
// requirements.md's step 4). Gated on graduation, like eraWorkspacesUI.js's
// Workspace picker and practiceUI.js's Practice tab: multi-track is
// free-play DAW territory, not part of the boss-fight teaching path.
//
// Switching which track is active is the one genuinely new piece of wiring
// here: store.setActiveTrack() repoints S's CONTENTS in place (see store.js
// for why its identity can never change), but nothing resyncs the rack's
// sliders/toggles/canvases from that automatically — controls.js only wires
// DOM -> store, never the reverse. applyPreset(store.params()) is the exact
// same resync main.js's undo/redo already leans on for this.

import { store } from './store.js';
import { progression, STAGE_IDS } from './progression.js';
import { applyPreset } from './controls.js';

let sectionEl, selectEl, addBtn, removeBtn;

function render() {
  if (!selectEl) return;
  const tracks = store.tracks();
  const activeId = store.get().activeTrackId;

  selectEl.innerHTML = '';
  for (const t of tracks) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    selectEl.appendChild(opt);
  }
  selectEl.value = activeId;

  if (addBtn) addBtn.disabled = tracks.length >= 4; // MAX_TRACKS in store.js
  if (removeBtn) removeBtn.disabled = tracks.length <= 1;
}

// Switch tracks AND resync the rack from the newly-active track's params —
// store.setActiveTrack() alone only updates the data model.
function switchTrack(id) {
  if (!store.setActiveTrack(id)) return;
  applyPreset(store.params());
  render();
}

export function initTracksUI() {
  sectionEl = document.getElementById('tracks-bar');
  selectEl = document.getElementById('track-select');
  addBtn = document.getElementById('track-add-btn');
  removeBtn = document.getElementById('track-remove-btn');
  if (!sectionEl) return;

  selectEl?.addEventListener('change', () => switchTrack(selectEl.value));

  addBtn?.addEventListener('click', () => {
    const id = store.addTrack();
    if (id) switchTrack(id); // jump straight to the new track — that's the point of adding one
  });

  removeBtn?.addEventListener('click', () => {
    const tracks = store.tracks();
    if (tracks.length <= 1) return;
    const activeId = store.get().activeTrackId;
    const idx = tracks.findIndex(t => t.id === activeId);
    // removeTrack() refuses to remove the active track (store.js), so switch
    // to a neighbor first — prefer the previous track, or the next one if
    // removing the first.
    const fallback = tracks[idx === 0 ? 1 : idx - 1];
    switchTrack(fallback.id);
    store.removeTrack(activeId);
    render();
  });

  store.subscribe(render); // undo/redo can change the track list out from under this UI
  render();
}

// Graduation-gated, like revealEraWorkspaces()/revealPracticeTab() — called
// on init and after every restore.
export function revealTracksBar() {
  if (sectionEl) sectionEl.hidden = progression.defeated.length < STAGE_IDS.length;
}

// If the active track isn't the first one when progression resets, switch
// back to it — the tracks bar is about to hide again, and leaving the rack
// pointed at a now-unreachable track would strand the player mid-edit, the
// same reasoning D5's era-reset and D1's gated-value clamp already follow.
export function resetToFirstTrack() {
  const first = store.tracks()[0];
  if (first && store.get().activeTrackId !== first.id && store.setActiveTrack(first.id)) {
    applyPreset(store.params());
  }
  render();
}
