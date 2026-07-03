// Progression UI — wires boss HUD, module locking, stage intro banner,
// and graduation screen to the progression/bossEngine singletons.

import { progression, STAGE_IDS } from './progression.js';
import STAGES from './stages.js';
import { bossEngine } from './bossEngine.js';
import { BOSS_SVG } from './bossArt.js';
import { teach } from './teaching.js';
import { previewPatch } from './audio.js';
import { applyPreset } from './controls.js';
import { S } from './state.js';

export function initProgressionUI() {
  progression.load();
  bossEngine.activateStage();
  document.body.dataset.layers = String(progression.defeated.length);
  revealUnlockedFeatures();
  revealPracticeTab();

  // Register listeners
  bossEngine.onDamage(({ hp, maxHp }) => updateHpBar(hp, maxHp));
  bossEngine.onRestore(handleRestore);

  renderLocks();
  updateHUD();
  showStageIntro();
  enterBattle();

  document.querySelectorAll('.lore-btn').forEach(btn => {
    btn.addEventListener('click', () => teach('lore-' + btn.dataset.lore));
  });

  // Match-the-sound stages (B15) expose a reference patch to audition —
  // reads the current encounter fresh on each click (bossEngine.activeEncounter()
  // rather than STAGES[currentStageIndex] directly, so this also covers a
  // future D1 bonus challenge that gains a matchTarget) so one listener
  // covers every match-the-sound encounter, not just this one.
  const previewBtn = document.getElementById('boss-preview-btn');
  previewBtn?.addEventListener('click', () => {
    const stage = bossEngine.activeEncounter();
    if (stage?.matchTarget) previewPatch(stage.matchTarget);
  });

  document.querySelectorAll('.teach-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTeachView(tab.dataset.teachview));
  });

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('Reset all progress and start over?')) return;
      progression.reset();
      bossEngine.graduated = false;
      bossEngine.activateStage();
      document.body.dataset.layers = '0';
      renderLocks();
      updateHUD();
      showStageIntro();
      enterBattle();
      revealUnlockedFeatures();
      revealPracticeTab();
      // D1-gated controls are hidden again above, but a reset must also
      // relock the sound they control — otherwise the knob/button vanish
      // while the chorus/S&H effect the player earned keeps audibly running.
      const clamp = {};
      if (S.lfoWaveform === 'sampleHold') clamp.lfoWaveform = 'sine';
      if (S.chorusMix) clamp.chorusMix = 0;
      if (Object.keys(clamp).length) applyPreset(clamp);
    });
  }
}

function renderLocks() {
  STAGES.forEach((stage, index) => {
    const el = document.getElementById(stage.moduleId);
    if (!el) return;
    if (index >= progression.unlockedCount) {
      el.classList.add('locked');
    } else {
      el.classList.remove('locked');
    }
    el.classList.remove('active-stage');
  });

  // Mark the current active stage — bossEngine.activeEncounter() rather than
  // STAGES[progression.currentStageIndex] directly, so a post-graduation
  // bonus challenge (D1) still highlights its module; currentStageIndex is
  // permanently pinned at the capstone (moduleId: null) once graduated.
  const activeStage = bossEngine.activeEncounter();
  if (activeStage?.moduleId) {
    const el = document.getElementById(activeStage.moduleId);
    if (el) el.classList.add('active-stage');
  }
}

// Reveal (or keep hidden) any UI gated behind a post-graduation bonus
// challenge (D1). Called on init and after every restore, since a challenge
// defeat can unlock one mid-session.
function revealUnlockedFeatures() {
  const shBtn = document.getElementById('lfowave-sh-btn');
  if (shBtn) shBtn.hidden = !progression.hasFeature('lfoSampleHold');
  const chorusCtrl = document.getElementById('ctrl-chorus');
  if (chorusCtrl) chorusCtrl.hidden = !progression.hasFeature('chorusFx');
}

// The Practice tab (D6) gates on graduation itself, not a D1 challenge —
// its target bank spans osc2/noise dimensions that only make sense once
// every module (and thus every scored dimension) has actually been taught.
function revealPracticeTab() {
  const tab = document.getElementById('tab-practice');
  if (tab) tab.hidden = progression.defeated.length < STAGE_IDS.length;
}

// Boss name + HP + taunt now live in the boss-panel (below the boss art);
// visibility is driven by the .battle-active class on <main>. Works for
// either unlock track — the main 7-stage progression, or a post-graduation
// bonus challenge (D1) — via bossEngine.activeEncounter().
function updateHUD() {
  const stage = bossEngine.activeEncounter();
  if (!stage) return;

  const nameEl  = document.getElementById('boss-panel-name');
  const tauntEl = document.getElementById('boss-taunt');
  const fill    = document.getElementById('boss-hp-fill');
  if (nameEl)  nameEl.textContent  = stage.boss.name;
  if (tauntEl) tauntEl.textContent = stage.boss.taunt;
  if (fill)    fill.style.width = (bossEngine.currentHp / stage.boss.maxHp * 100) + '%';
}

function updateHpBar(hp, maxHp) {
  const fill = document.getElementById('boss-hp-fill');
  if (fill) fill.style.width = (hp / maxHp * 100) + '%';
  const panel = document.getElementById('boss-panel');
  if (panel) panel.style.setProperty('--gi', (1 - hp / maxHp).toFixed(3));
}

function loadBossCharacter(stage) {
  const panel = document.getElementById('boss-panel');
  const nameEl = document.getElementById('boss-panel-name');
  if (!panel || !nameEl) return;

  const wrap = panel.querySelector('.boss-svg-wrap');
  if (wrap) wrap.innerHTML = BOSS_SVG[stage.id] ?? '';

  nameEl.textContent = stage.boss.name;
  panel.style.setProperty('--gi', '0');

  const svg = wrap?.querySelector('svg');
  if (svg) {
    svg.classList.remove('boss-svg-restored');
    svg.classList.add('boss-svg-active');
  }
}

// Populate the History tab of the Learn panel with the current encounter's
// lore. (Formerly a transient slide-down banner; now permanently available
// as a tab.) Works for either unlock track — see updateHUD() above.
function showStageIntro() {
  const stage = bossEngine.activeEncounter();
  if (!stage) return;

  const pioneerEl    = document.getElementById('stage-intro-pioneer');
  const instrumentEl = document.getElementById('stage-intro-instrument');
  const factEl       = document.getElementById('stage-intro-fact');

  if (pioneerEl)    pioneerEl.textContent    = stage.pioneer;
  if (instrumentEl) instrumentEl.textContent = stage.instrument + ' (' + stage.historyYear + ')';
  if (factEl)       factEl.textContent       = stage.historyFact;
}

// Learn ↔ History tab switching in the teach panel.
function switchTeachView(view) {
  document.querySelectorAll('.teach-tab').forEach(t => {
    const on = t.dataset.teachview === view;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.teach-view').forEach(v => {
    v.hidden = v.id !== 'teach-view-' + view;
  });
}

// Works for either unlock track — see updateHUD() above. Returns early once
// there's truly nothing left to fight (every stage AND every bonus challenge
// cleared), leaving the graduation banner as the final state.
function enterBattle() {
  const stage = bossEngine.activeEncounter();
  if (!stage) return;
  const main = document.querySelector('main');
  if (main) {
    main.classList.remove('battle-active');
    void main.offsetWidth; // force reflow so battle-enter animation restarts
    main.classList.add('battle-active');
  }
  // Apply corrupted effect to active module and load boss character. The
  // capstone and some bonus challenges have moduleId: null (they span/revisit
  // more than one module), so there's no single panel to mark corrupted.
  const el = stage.moduleId ? document.getElementById(stage.moduleId) : null;
  if (el) {
    el.classList.remove('boss-restored');
    el.classList.add('boss-corrupted');
  }
  loadBossCharacter(stage);
  teach('boss-hint-' + stage.id);

  const previewBtn = document.getElementById('boss-preview-btn');
  if (previewBtn) previewBtn.hidden = !stage.matchTarget;
}

function exitBattle() {
  const main = document.querySelector('main');
  if (main) main.classList.remove('battle-active');
}

function handleRestore({ stage }) {
  // Peak glitch burst then resolve SVG to restored state
  const panel = document.getElementById('boss-panel');
  if (panel) {
    panel.style.setProperty('--gi', '1');
    setTimeout(() => {
      const svg = panel.querySelector('svg');
      if (svg) {
        svg.classList.remove('boss-svg-active');
        svg.classList.add('boss-svg-restored');
      }
    }, 400);
  }

  // Visual feedback on the restored module (some bonus challenges have no
  // single module to mark — see enterBattle()).
  const el = stage.moduleId ? document.getElementById(stage.moduleId) : null;
  if (el) {
    el.classList.remove('boss-corrupted');
    el.classList.add('boss-restored');
  }
  exitBattle();

  // Increment body data-layers (osc restore → 1, filter → 2, envelope → 3, lfo → 4)
  const current = parseInt(document.body.dataset.layers ?? '0', 10);
  document.body.dataset.layers = String(Math.min(current + 1, 4));

  setTimeout(() => {
    renderLocks();
    updateHUD();
    revealUnlockedFeatures();
    revealPracticeTab();

    // The graduation banner is a one-time "you beat the main game" moment —
    // show it (idempotently; a later challenge defeat re-running this is
    // harmless) the instant the main 7-stage progression clears, whether or
    // not a bonus challenge (D1) is still pending.
    if (bossEngine.graduated) {
      const banner = document.getElementById('graduation-banner');
      if (banner) banner.classList.add('visible');
      document.body.dataset.layers = '4';
    }

    // Re-engage the boss panel for whatever's next — the following main
    // stage, or (once graduated) the next bonus challenge, if any.
    if (bossEngine.activeEncounter()) {
      showStageIntro();
      enterBattle();
    }
  }, 1200);
}
