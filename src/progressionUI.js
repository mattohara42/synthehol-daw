// Progression UI — wires boss HUD, module locking, stage intro banner,
// and graduation screen to the progression/bossEngine singletons.

import { progression, STAGE_IDS } from './progression.js';
import STAGES from './stages.js';
import { bossEngine } from './bossEngine.js';

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

function updateHUD() {
  const hud = document.getElementById('boss-hud');
  if (!hud) return;

  if (bossEngine.graduated) {
    hud.classList.remove('visible');
    return;
  }

  const stage = STAGES[progression.currentStageIndex];
  if (!stage) return;

  document.getElementById('boss-name').textContent = stage.boss.name;
  document.getElementById('boss-taunt').textContent = stage.boss.taunt;
  document.getElementById('boss-hp-fill').style.width =
    (bossEngine.currentHp / stage.boss.maxHp * 100) + '%';

  hud.classList.add('visible');
}

function updateHpBar(hp, maxHp) {
  const fill = document.getElementById('boss-hp-fill');
  if (fill) fill.style.width = (hp / maxHp * 100) + '%';
}

function showStageIntro() {
  const intro = document.getElementById('stage-intro');
  const text = document.getElementById('stage-intro-text');
  if (!intro || !text) return;

  const stage = STAGES[progression.currentStageIndex];
  if (!stage) return;

  text.textContent = stage.intro;
  intro.classList.add('visible');

  setTimeout(() => {
    intro.classList.remove('visible');
  }, 4000);
}

function enterBattle() {
  if (bossEngine.graduated) return;
  const main = document.querySelector('main');
  if (main) {
    main.classList.remove('battle-active');
    void main.offsetWidth; // force reflow so battle-enter animation restarts
    main.classList.add('battle-active');
  }
  // Apply corrupted effect to active module
  const stage = STAGES[progression.currentStageIndex];
  if (stage) {
    const el = document.getElementById(stage.moduleId);
    if (el) {
      el.classList.remove('boss-restored');
      el.classList.add('boss-corrupted');
    }
  }
}

function exitBattle() {
  const main = document.querySelector('main');
  if (main) main.classList.remove('battle-active');
}

function handleRestore(stage) {
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
