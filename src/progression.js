// Progression state — single source of truth for stage unlocks, XP, and
// defeated bosses. Independent of src/state.js (no imports from it).

const STORAGE_KEY = 'synthehol_progress';

export const STAGE_IDS = ['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2', 'mimic'];

// Post-graduation bonus features (D1), unlocked by defeating a CHALLENGES
// entry in stages.js rather than by advancing currentStageIndex — a second,
// smaller unlock track that starts only once STAGE_IDS is fully cleared.
const FEATURE_IDS = ['lfoSampleHold', 'chorusFx'];

const INITIAL_STATE = () => ({
  currentStageIndex: 0,
  xp: 0,
  defeated: [],
  unlockedFeatures: [],
});

function isValid(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.currentStageIndex === 'number' &&
    typeof obj.xp === 'number' &&
    Array.isArray(obj.defeated)
  );
}

// Clamp/sanitize a structurally-valid parsed state so out-of-range indices from
// a corrupted store can never crash the stage lookups downstream. unlockedCount
// is derived (not stored), so it is not part of the sanitized shape.
function sanitize(parsed) {
  const last = STAGE_IDS.length - 1;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(n)));
  return {
    currentStageIndex: clamp(parsed.currentStageIndex, 0, last),
    xp: Math.max(0, parsed.xp),
    defeated: [...new Set(parsed.defeated.filter(id => STAGE_IDS.includes(id)))],
    // Optional field — older saves predate it, so a missing value (not just
    // an invalid one) falls back to empty rather than failing validation.
    unlockedFeatures: Array.isArray(parsed.unlockedFeatures)
      ? [...new Set(parsed.unlockedFeatures.filter(id => FEATURE_IDS.includes(id)))]
      : [],
  };
}

export const progression = {
  /**
   * Number of stages unlocked. Derived from the current frontier rather than
   * stored, so it can never drift out of sync with currentStageIndex. The
   * frontier and the unlocked count always advance together.
   */
  get unlockedCount() {
    return this.currentStageIndex + 1;
  },

  /** Rehydrate from localStorage, falling back to a fresh initial state. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return Object.assign(this, INITIAL_STATE());
      const parsed = JSON.parse(raw);
      if (!isValid(parsed)) return Object.assign(this, INITIAL_STATE());
      return Object.assign(this, sanitize(parsed));
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
        xp: this.xp,
        defeated: this.defeated,
        unlockedFeatures: this.unlockedFeatures,
      }),
    );
  },

  /** Reset to initial state and persist. */
  reset() {
    Object.assign(this, INITIAL_STATE());
    this.save();
  },

  /** Advance to the next stage. Idempotent at the last stage. */
  unlockNext() {
    const lastIndex = STAGE_IDS.length - 1;
    if (this.currentStageIndex < lastIndex) {
      this.currentStageIndex += 1;
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

  /** Whether a post-graduation bonus feature (D1) has been unlocked. */
  hasFeature(id) {
    return this.unlockedFeatures.includes(id);
  },

  /** Unlock a post-graduation bonus feature. Duplicate calls are no-ops. */
  unlockFeature(id) {
    if (!this.unlockedFeatures.includes(id)) {
      this.unlockedFeatures.push(id);
      this.save();
    }
  },
};
