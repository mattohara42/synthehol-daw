// Project persistence (E6 lean step): the whole project (synth params,
// pattern, clips, transport settings) auto-saves to localStorage on every
// committed change and restores on load — so work survives a page refresh.
// Debounced so a slider drag doesn't write to disk on every tick.
//
// Scope: localStorage only, no .json file export/import, no .wav offline
// render, no .mid import/export — those are separate, larger pieces of E6.

const STORAGE_KEY = 'synthehol_project';
const SAVE_DEBOUNCE_MS = 500;

let saveTimer = null;

/**
 * Restore a saved project (if any) and start auto-saving on every committed
 * store change. `applyPreset` resyncs sliders/toggles/engine from the
 * restored params — store.load() alone only updates the plain params
 * object, the same gap undo/redo hit (see main.js's resyncControlsFromStore).
 */
export function initPersistence(store, applyPreset) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && store.load(saved)) {
    applyPreset(store.params());
  }

  store.subscribe(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, store.serialize()); }
      catch { /* storage full/unavailable — silently skip, not fatal */ }
    }, SAVE_DEBOUNCE_MS);
  });
}
