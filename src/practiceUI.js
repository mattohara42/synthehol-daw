// Practice gym UI (D6). Wires the "Practice" tab: Hear Target / New Target
// buttons, a live closeness meter, and the "nailed it" celebration. Ticked
// once per frame from main.js's single rAF dispatcher (E8) — but only does
// real work while the Practice tab is actually the active lower-tab, so
// rounds can't silently advance while the player is looking at the
// sequencer or piano roll instead.

import { createPracticeSession } from './practice.js';
import { previewPatch } from './audio.js';
import { playArp, RESTORE_ARP } from './bossAudio.js';

const session = createPracticeSession();

let nameEl, fillEl, labelEl, roundsEl;
let flashTimer = null;

function renderTarget() {
  if (nameEl) nameEl.textContent = session.target.name;
  if (roundsEl) roundsEl.textContent = `Matched: ${session.rounds}`;
}

export function initPracticeUI() {
  nameEl = document.getElementById('practice-target-name');
  fillEl = document.getElementById('practice-meter-fill');
  labelEl = document.getElementById('practice-meter-label');
  roundsEl = document.getElementById('practice-rounds');
  if (!nameEl) return;

  document.getElementById('practice-hear-btn')?.addEventListener('click', () => {
    previewPatch(session.target);
  });
  document.getElementById('practice-new-btn')?.addEventListener('click', () => {
    session.newTarget();
    renderTarget();
  });

  renderTarget();
}

/**
 * Per-frame update — a no-op unless the Practice tab is the active
 * lower-tab. `dt` is the same clamped per-frame delta main.js already
 * computes for bossEngine.tick(), reused here rather than assuming 60fps.
 */
export function refreshPractice(engine, S, dt) {
  if (!nameEl || document.body.dataset.stage !== 'practice' || !engine.ctx || !dt) return;

  const { intensity, nailed } = session.tick({ S, isPlaying: engine.noteOn, dt });
  if (fillEl) fillEl.style.width = `${Math.round(intensity * 100)}%`;
  if (labelEl) labelEl.textContent = `${Math.round(intensity * 100)}%`;

  if (nailed) {
    playArp(RESTORE_ARP);
    renderTarget(); // session already advanced to a new target
    if (fillEl) {
      fillEl.classList.add('nailed');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => fillEl.classList.remove('nailed'), 500);
    }
  }
}
