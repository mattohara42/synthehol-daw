// Hover preview (D2) — hovering an inactive option in a toggle group (Sine/
// Square/Saw/Tri, Low/High/Band Pass, ...) plays a short before/after: the
// current patch, then the same patch with that one option swapped in — so
// you can hear the difference before committing to it by clicking. Reuses
// the same one-off preview voice pool as the boss "Hear the target" button
// (B15's previewPatch), so it never touches the live sound or a held note.
//
// Scoped to toggle groups (discrete options) for v1, not sliders — a slider
// has no natural "hover value" without computing a position from the mouse,
// and continuous A/B is a fuzzier before/after than a clean discrete swap.

import { S } from './state.js';
import { previewPatch } from './audio.js';

// groupId → the S param that group controls + the button's dataset key.
const HOVER_GROUPS = {
  'wave-btns': { param: 'waveform', dataKey: 'wave' },
  'ftype-btns': { param: 'filterType', dataKey: 'ftype' },
  'noise-btns': { param: 'noiseType', dataKey: 'noise' },
  'osc2wave-btns': { param: 'osc2Waveform', dataKey: 'osc2wave' },
  'lfodest-btns': { param: 'lfoDest', dataKey: 'dest' },
  'lfowave-btns': { param: 'lfoWaveform', dataKey: 'wave' },
};

const HOVER_DELAY_MS = 250;   // dwell before previewing, so passing the mouse over stays silent
const SEGMENT_SECONDS = 0.35; // each half of the before/after

// Pure: given the live params, which param a hover targets, and the hovered
// button's value, decide what to preview. Returns null if the hovered value
// is already active (nothing to compare). Exported for testing.
export function buildHoverPreview(liveParams, param, hoverValue) {
  if (hoverValue == null || hoverValue === liveParams[param]) return null;
  return {
    before: { ...liveParams },
    after: { ...liveParams, [param]: hoverValue },
  };
}

let hoverTimer = null;

function playAB(before, after) {
  previewPatch(before, 'C', 4, SEGMENT_SECONDS);
  setTimeout(() => previewPatch(after, 'C', 4, SEGMENT_SECONDS), SEGMENT_SECONDS * 1000 + 60);
}

export function initHoverPreview() {
  for (const [groupId, { param, dataKey }] of Object.entries(HOVER_GROUPS)) {
    const group = document.getElementById(groupId);
    if (!group) continue;
    group.querySelectorAll('.tog-btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        const preview = buildHoverPreview(S, param, btn.dataset[dataKey]);
        if (!preview) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => playAB(preview.before, preview.after), HOVER_DELAY_MS);
      });
      btn.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
    });
  }
}
