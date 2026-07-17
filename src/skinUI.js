// Skeuomorphic skin toggle — a purely cosmetic, ungated preference (unlike
// era workspaces/D5, which are graduation-gated because they also carry
// curated presets; this is just CSS). Flips body[data-skin] between 'flat'
// (the default) and 'skeuomorphic' — style.css reads the attribute to swap
// module panels, knobs, sliders, and toggle buttons over to a wood-and-metal
// hardware treatment. Persists like eraWorkspacesUI.js's era choice.

const STORAGE_KEY = 'synthehol_skin';

let btn;

function apply(skin) {
  document.body.dataset.skin = skin;
  if (btn) {
    const on = skin === 'skeuomorphic';
    btn.textContent = on ? '🪵 Skin: Wood' : '🎛 Skin: Flat';
    btn.setAttribute('aria-pressed', String(on));
  }
  try { localStorage.setItem(STORAGE_KEY, skin); } catch { /* storage full/unavailable — not fatal */ }
}

export function initSkinUI() {
  btn = document.getElementById('skin-btn');
  if (!btn) return;

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable — fall back to the default */ }
  apply(saved === 'skeuomorphic' ? 'skeuomorphic' : 'flat');

  btn.addEventListener('click', () => {
    apply(document.body.dataset.skin === 'skeuomorphic' ? 'flat' : 'skeuomorphic');
  });
}
