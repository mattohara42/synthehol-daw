// Boss engine — evaluates whether the player is dealing damage to the active
// boss on each control-change or note-on tick. Drives XP rewards, HP tracking,
// stage restoration, and the graduated (Act I complete) flag.

import { STAGES, stageById } from './stages.js';
import { progression, STAGE_IDS } from './progression.js';

const restoreListeners = [];
const damageListeners = [];

export const bossEngine = {
  currentHp: 0,
  graduated: false,

  /**
   * Called by instrumentation hooks on every control change or note-on.
   * snapshot: { S, isPlaying }
   * Returns: { damaged: boolean, damage: number, restored: boolean }
   */
  notify({ S, isPlaying }) {
    if (this.graduated) return { damaged: false, damage: 0, restored: false };

    const stage = STAGES[progression.currentStageIndex];

    // No damage if not playing or target not met
    if (!isPlaying || !stage.target(S, isPlaying)) {
      return { damaged: false, damage: 0, restored: false };
    }

    const { damagePerHit, maxHp } = stage.boss;

    // Apply damage
    this.currentHp = Math.max(0, this.currentHp - damagePerHit);
    progression.addXp(damagePerHit);

    // Fire damage callbacks
    const dmgPayload = { hp: this.currentHp, maxHp, damage: damagePerHit };
    for (const fn of damageListeners) fn(dmgPayload);

    // Check for restore
    if (this.currentHp === 0) {
      progression.markDefeated(stage.id);
      progression.unlockNext();
      progression.addXp(maxHp);

      // Graduation: all stages defeated
      if (progression.defeated.length === STAGE_IDS.length) {
        this.graduated = true;
      }

      // Fire restore callbacks
      const restorePayload = {
        stage,
        instrument: stage.instrument,
        pioneer: stage.pioneer,
      };
      for (const fn of restoreListeners) fn(restorePayload);

      // Activate next boss (or set HP to 0 if graduated)
      this.activateStage();

      return { damaged: true, damage: damagePerHit, restored: true };
    }

    return { damaged: true, damage: damagePerHit, restored: false };
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
    if (stage) {
      this.currentHp = stage.boss.maxHp;
      stage.onActivate?.();
    }
  },

  /**
   * Register a callback fired on boss restore: fn({ stage, instrument, pioneer })
   */
  onRestore(fn) {
    restoreListeners.push(fn);
  },

  /**
   * Register a callback fired on damage: fn({ hp, maxHp, damage })
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
