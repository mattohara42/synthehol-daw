// Pattern clip UI (L8). Save/load/duplicate/delete named snapshots of the
// active track's pattern (step grid + drums + automation + piano roll) —
// the same mental model as presets.js, just scoped to one track's patterns
// instead of a global cross-project sound library. Shared by the Sequencer
// and Piano Roll tabs, since both edit the same store.pattern().

import { store } from './store.js';

export function initClipsUI() {
  const select    = document.getElementById('clip-select');
  const loadBtn   = document.getElementById('clip-load-btn');
  const saveBtn   = document.getElementById('clip-save-btn');
  const dupBtn    = document.getElementById('clip-duplicate-btn');
  const deleteBtn = document.getElementById('clip-delete-btn');
  const nameInput = document.getElementById('clip-name-input');

  if (!select) return;

  function repopulate(selectId) {
    const prev = selectId ?? select.value;
    select.innerHTML = '';
    const clips = store.clips();
    if (clips.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No saved patterns';
      select.appendChild(opt);
    } else {
      for (const clip of clips) {
        const opt = document.createElement('option');
        opt.value = clip.id;
        opt.textContent = clip.name;
        select.appendChild(opt);
      }
      if (prev) select.value = prev;
    }
    syncButtons();
  }

  function syncButtons() {
    const has = store.clips().length > 0 && select.value;
    if (loadBtn) loadBtn.disabled = !has;
    if (dupBtn) dupBtn.disabled = !has;
    if (deleteBtn) deleteBtn.disabled = !has;
  }

  select.addEventListener('change', syncButtons);

  loadBtn?.addEventListener('click', () => {
    if (select.value) store.loadClip(select.value);
  });

  saveBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim();
    if (!name) { nameInput?.focus(); return; }
    store.saveClip(name);
    repopulate();
    const saved = store.clips().find(c => c.name === name);
    if (saved) select.value = saved.id;
    syncButtons();
    if (nameInput) nameInput.value = '';
  });

  dupBtn?.addEventListener('click', () => {
    if (!select.value) return;
    const source = store.clips().find(c => c.id === select.value);
    if (!source) return;
    let name = source.name + ' copy';
    let n = 2;
    while (store.clips().some(c => c.name === name)) name = `${source.name} copy ${n++}`;
    store.duplicateClip(select.value, name);
    repopulate();
    const created = store.clips().find(c => c.name === name);
    if (created) select.value = created.id;
    syncButtons();
  });

  deleteBtn?.addEventListener('click', () => {
    if (!select.value) return;
    store.deleteClip(select.value);
    repopulate('');
  });

  // Clip save/load/duplicate/delete are undo-tracked (they live in the
  // project tree), so undo/redo can change the list out from under us —
  // resync whenever anything in the store changes.
  store.subscribe(() => repopulate());
  repopulate();
}
