// Progression UI — wires boss HUD, module locking, stage intro banner,
// and graduation screen to the progression/bossEngine singletons.

import { progression, STAGE_IDS } from './progression.js';
import STAGES from './stages.js';
import { bossEngine } from './bossEngine.js';
import { BOSS_SVG } from './bossArt.js';
import { teach } from './teaching.js';

let shownTauntThresholds = new Set();

export function initProgressionUI() {
  progression.load();
  bossEngine.activateStage();
  document.body.dataset.layers = String(progression.defeated.length);

  // Register listeners
  bossEngine.onDamage(({ hp, maxHp }) => updateHpBar(hp, maxHp));
  bossEngine.onRestore(({ stage }) => handleRestore(stage));

  renderLocks();
  updateHUD();
  updateHistory();
  showStageIntro();
  enterBattle();

  document.querySelectorAll('.lore-btn').forEach(btn => {
    btn.addEventListener('click', () => teach('lore-' + btn.dataset.lore));
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
      updateHistory();
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
  const panel = document.getElementById('boss-panel');
  if (panel) panel.style.setProperty('--gi', (1 - hp / maxHp).toFixed(3));

  const stage = STAGES[progression.currentStageIndex];
  const phases = stage?.boss?.tauntPhases;
  if (!phases) return;
  const pct = (hp / maxHp) * 100;
  const phase = phases
    .filter(p => pct <= p.threshold && !shownTauntThresholds.has(p.threshold))
    .sort((a, b) => b.threshold - a.threshold)[0];
  if (phase) {
    shownTauntThresholds.add(phase.threshold);
    pulseTaunt(phase.text);
  }
}

function pulseTaunt(text) {
  const el = document.getElementById('boss-taunt');
  if (!el) return;
  el.classList.remove('taunt-pulse');
  void el.offsetWidth;
  el.textContent = text;
  el.classList.add('taunt-pulse');
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

function showStageIntro() {
  const intro = document.getElementById('stage-intro');
  if (!intro) return;

  const stage = STAGES[progression.currentStageIndex];
  if (!stage) return;

  const pioneerEl    = document.getElementById('stage-intro-pioneer');
  const instrumentEl = document.getElementById('stage-intro-instrument');
  const factEl       = document.getElementById('stage-intro-fact');

  if (pioneerEl)    pioneerEl.textContent    = stage.pioneer;
  if (instrumentEl) instrumentEl.textContent = stage.instrument + ' (' + stage.historyYear + ')';
  if (factEl)       factEl.textContent       = stage.historyFact;

  intro.classList.add('visible');

  const dismiss = () => {
    intro.classList.remove('visible');
    document.removeEventListener('keydown', dismiss);
  };

  const timer = setTimeout(dismiss, 5000);

  // Keypress dismiss — clean up timer too
  document.addEventListener('keydown', () => {
    clearTimeout(timer);
    dismiss();
  }, { once: true });
}

function enterBattle() {
  if (bossEngine.graduated) return;
  shownTauntThresholds = new Set();
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

  // Increment body data-layers (osc → 1, filter → 2, envelope → 3, lfo → 4, noise → 5, osc2 → 6)
  const current = parseInt(document.body.dataset.layers ?? '0', 10);
  document.body.dataset.layers = String(Math.min(current + 1, 6));

  setTimeout(() => {
    renderLocks();
    updateHUD();

    if (bossEngine.graduated) {
      const banner = document.getElementById('graduation-banner');
      if (banner) banner.classList.add('visible');
      document.body.dataset.layers = '6';
    } else {
      updateHistory();
      showStageIntro();
      enterBattle();
    }
  }, 1200);
}

function updateHistory() {
  const instEl = document.getElementById('boss-history-instrument');
  const factEl = document.getElementById('boss-history-fact');
  if (!instEl || !factEl) return;
  const stage = STAGES[progression.currentStageIndex];
  if (!stage) return;
  instEl.textContent = stage.pioneer + ' — ' + stage.instrument + ' (' + stage.historyYear + ')';
  factEl.textContent = stage.historyFact;
}
