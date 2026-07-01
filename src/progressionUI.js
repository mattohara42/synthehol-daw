// Progression UI — wires boss HUD, module locking, stage intro banner,
// and graduation screen to the progression/bossEngine singletons.

import { progression, STAGE_IDS } from './progression.js';
import STAGES from './stages.js';
import { bossEngine } from './bossEngine.js';
import { BOSS_SVG } from './bossArt.js';
import { teach } from './teaching.js';
import { previewPatch } from './audio.js';

export function initProgressionUI() {
  progression.load();
  bossEngine.activateStage();
  document.body.dataset.layers = String(progression.defeated.length);

  // Register listeners
  bossEngine.onDamage(({ hp, maxHp }) => updateHpBar(hp, maxHp));
  bossEngine.onRestore(({ stage }) => handleRestore(stage));

  renderLocks();
  updateHUD();
  showStageIntro();
  enterBattle();

  document.querySelectorAll('.lore-btn').forEach(btn => {
    btn.addEventListener('click', () => teach('lore-' + btn.dataset.lore));
  });

  // Match-the-sound stages (B15) expose a reference patch to audition —
  // reads the current stage fresh on each click, so one listener covers
  // every future match-the-sound stage, not just this one.
  const previewBtn = document.getElementById('boss-preview-btn');
  previewBtn?.addEventListener('click', () => {
    const stage = STAGES[progression.currentStageIndex];
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

  // Mark the current active stage
  const activeStage = STAGES[progression.currentStageIndex];
  if (activeStage) {
    const el = document.getElementById(activeStage.moduleId);
    if (el) el.classList.add('active-stage');
  }
}

// Boss name + HP + taunt now live in the boss-panel (below the boss art);
// visibility is driven by the .battle-active class on <main>.
function updateHUD() {
  if (bossEngine.graduated) return;

  const stage = STAGES[progression.currentStageIndex];
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

// Populate the History tab of the Learn panel with the current stage's lore.
// (Formerly a transient slide-down banner; now permanently available as a tab.)
function showStageIntro() {
  const stage = STAGES[progression.currentStageIndex];
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

function enterBattle() {
  if (bossEngine.graduated) return;
  const main = document.querySelector('main');
  if (main) {
    main.classList.remove('battle-active');
    void main.offsetWidth; // force reflow so battle-enter animation restarts
    main.classList.add('battle-active');
  }
  // Apply corrupted effect to active module and load boss character
  const stage = STAGES[progression.currentStageIndex];
  if (stage) {
    const el = document.getElementById(stage.moduleId);
    if (el) {
      el.classList.remove('boss-restored');
      el.classList.add('boss-corrupted');
    }
    loadBossCharacter(stage);
    teach('boss-hint-' + stage.id);

    const previewBtn = document.getElementById('boss-preview-btn');
    if (previewBtn) previewBtn.hidden = !stage.matchTarget;
  }
}

function exitBattle() {
  const main = document.querySelector('main');
  if (main) main.classList.remove('battle-active');
}

function handleRestore(stage) {
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

  // Visual feedback on the restored module
  const el = document.getElementById(stage.moduleId);
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

    if (bossEngine.graduated) {
      const banner = document.getElementById('graduation-banner');
      if (banner) banner.classList.add('visible');
      document.body.dataset.layers = '4';
    } else {
      showStageIntro();
      enterBattle();
    }
  }, 1200);
}
