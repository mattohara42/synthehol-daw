// Progression state — single source of truth for stage unlocks, XP, and
// defeated bosses. Independent of src/state.js (no imports from it).

const STORAGE_KEY = 'synthehol_progress';

export const STAGE_IDS = ['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2'];

const INITIAL_STATE = () => ({
  currentStageIndex: 0,
  unlockedCount: 1,
  xp: 0,
  defeated: [],
});

function isValid(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.currentStageIndex === 'number' &&
    typeof obj.unlockedCount === 'number' &&
    typeof obj.xp === 'number' &&
    Array.isArray(obj.defeated)
  );
}

export const progression = {
  /** Rehydrate from localStorage, falling back to a fresh initial state. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return Object.assign(this, INITIAL_STATE());
      const parsed = JSON.parse(raw);
      if (!isValid(parsed)) return Object.assign(this, INITIAL_STATE());
      return Object.assign(this, {
        currentStageIndex: parsed.currentStageIndex,
        unlockedCount: parsed.unlockedCount,
        xp: parsed.xp,
        defeated: parsed.defeated,
      });
    } catch {
      return Object.assign(this, INITIAL_STATE());
    }
  },

  /** Persist current state to localStorage. */
  save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentStageIndex: this.currentStageIndex,
        unlockedCount: this.unlockedCount,
        xp: this.xp,
        defeated: this.defeated,
      }),
    );
  },

  /** Reset to initial state and persist. */
  reset() {
    Object.assign(this, INITIAL_STATE());
    this.save();
  },

  /**
   * Advance to the next stage. Idempotent at the last stage.
   * Increments both currentStageIndex and unlockedCount by 1.
   */
  unlockNext() {
    const lastIndex = STAGE_IDS.length - 1;
    if (this.currentStageIndex < lastIndex) {
      this.currentStageIndex += 1;
      this.unlockedCount += 1;
      this.save();
    }
  },

  /** Add XP to the running total. */
  addXp(n) {
    this.xp += n;
    this.save();
  },

  /** Mark a stage id as defeated. Duplicate calls are no-ops. */
  markDefeated(id) {
    if (!this.defeated.includes(id)) {
      this.defeated.push(id);
      this.save();
    }
  },
};
