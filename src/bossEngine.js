// Boss engine — drains the active boss's HP over time while the player holds
// that stage's target sound. Driven once per animation frame by main.js, so the
// fight rewards *sustained* matching rather than a single control change. Also
// owns XP rewards, HP tracking, stage restoration, and the graduated flag.

import { STAGES, stageById } from './stages.js';
import { progression, STAGE_IDS } from './progression.js';

// HP the boss recovers per second while the target sound is NOT held, so
// dithering past a threshold and stopping doesn't win — you must sustain it.
const HEAL_RATE = 15;

// Flush accumulated XP to progression (and thus localStorage) at most this
// often, so a 60fps tick doesn't write storage every frame.
const XP_FLUSH_INTERVAL = 0.5;

const restoreListeners = [];
const damageListeners = [];

export const bossEngine = {
  currentHp: 0,
  graduated: false,
  _xpAccum: 0,        // fractional XP earned since the last flush
  _flushTimer: 0,     // seconds of tick time since the last flush

  /**
   * Per-frame update. Called by the animation loop with the elapsed time.
   * snapshot: { S, isPlaying, dt } — dt in seconds (clamped by the caller).
   * Drains HP while the target is held + playing, heals it back otherwise,
   * and runs the defeat/restore sequence when HP hits zero.
   */
  tick({ S, isPlaying, dt }) {
    if (this.graduated || !dt) return;
    const stage = STAGES[progression.currentStageIndex];
    if (!stage) return; // guards against out-of-range persisted state

    const { maxHp } = stage.boss;

    if (isPlaying && stage.target(S, isPlaying)) {
      const before = this.currentHp;
      this.currentHp = Math.max(0, before - stage.boss.dps * dt);
      const applied = before - this.currentHp; // XP tracks HP actually drained
      this._xpAccum += applied;
      this._flushTimer += dt;
      if (this._flushTimer >= XP_FLUSH_INTERVAL) this.flushXp();

      for (const fn of damageListeners) fn({ hp: this.currentHp, maxHp, damage: applied });

      if (this.currentHp === 0) this._defeat(stage);
      return;
    }

    // Target not held: recover toward full HP.
    if (this.currentHp < maxHp) {
      this.currentHp = Math.min(maxHp, this.currentHp + HEAL_RATE * dt);
      for (const fn of damageListeners) fn({ hp: this.currentHp, maxHp, damage: 0 });
    }
  },

  /** Runs the defeat → unlock → restore → next-stage sequence. */
  _defeat(stage) {
    progression.markDefeated(stage.id);
    progression.unlockNext();
    this._xpAccum += stage.boss.maxHp; // defeat bonus
    this.flushXp();

    if (progression.defeated.length === STAGE_IDS.length) {
      this.graduated = true;
    }

    const restorePayload = {
      stage,
      instrument: stage.instrument,
      pioneer: stage.pioneer,
    };
    for (const fn of restoreListeners) fn(restorePayload);

    this.activateStage();
  },

  /** Move whole accumulated XP points into progression; keep the remainder. */
  flushXp() {
    const whole = Math.floor(this._xpAccum);
    if (whole > 0) {
      progression.addXp(whole);
      this._xpAccum -= whole;
    }
    this._flushTimer = 0;
  },

  /**
   * Activate the current stage from progression — sets currentHp to the
   * stage's maxHp. Call on load and after each restore to set up the next boss.
   */
  activateStage() {
    if (progression.defeated.length === STAGE_IDS.length) {
      this.graduated = true;
    }
    if (this.graduated) {
      this.currentHp = 0;
      return;
    }
    const stage = STAGES[progression.currentStageIndex];
    if (stage) this.currentHp = stage.boss.maxHp;
  },

  /**
   * Register a callback fired on boss restore: fn({ stage, instrument, pioneer })
   */
  onRestore(fn) {
    restoreListeners.push(fn);
  },

  /**
   * Register a callback fired on damage/heal: fn({ hp, maxHp, damage })
   */
  onDamage(fn) {
    damageListeners.push(fn);
  },

  /** Clear all registered listeners. Intended for test teardown only. */
  _clearListeners() {
    restoreListeners.length = 0;
    damageListeners.length = 0;
  },
};
