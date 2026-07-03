// Boss engine — drains the active boss's HP over time while the player holds
// that stage's target sound. Driven once per animation frame by main.js, so the
// fight rewards *sustained* matching rather than a single control change. Also
// owns XP rewards, HP tracking, stage restoration, and the graduated flag.

import { STAGES, CHALLENGES, stageById } from './stages.js';
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
  _xpAccum: 0,          // fractional XP earned since the last flush
  _flushTimer: 0,       // seconds of tick time since the last flush
  _noChallengesLeft: false, // memoized once true — avoids rescanning CHALLENGES every frame forever

  /**
   * The encounter currently being fought: a STAGES entry while the main
   * 7-stage progression is running, or the first not-yet-unlocked CHALLENGES
   * entry once `graduated` — a second, independent unlock track (D1) that
   * only starts once the main one is cleared. `null` once both are fully
   * cleared (nothing left to fight). Called once per animation frame from
   * tick(), so once every challenge is cleared the "nothing left" result is
   * cached rather than re-scanning CHALLENGES forever — activateStage()
   * resets the cache on every state transition (defeat, load, reset).
   */
  activeEncounter() {
    if (!this.graduated) return STAGES[progression.currentStageIndex] || null;
    if (this._noChallengesLeft) return null;
    const next = CHALLENGES.find(c => !progression.hasFeature(c.unlocks)) || null;
    if (!next) this._noChallengesLeft = true;
    return next;
  },

  /**
   * Per-frame update. Called by the animation loop with the elapsed time.
   * snapshot: { S, isPlaying, dt } — dt in seconds (clamped by the caller).
   * Drains HP while the target is held + playing, heals it back otherwise,
   * and runs the defeat/restore sequence when HP hits zero.
   */
  tick({ S, isPlaying, dt }) {
    if (!dt) return;
    const stage = this.activeEncounter();
    if (!stage) return; // nothing left to fight, or out-of-range persisted state

    const { maxHp } = stage.boss;

    // target() returns a boolean for a threshold stage, or a 0..1 "how close"
    // intensity for a distance-based stage (B15's match-the-sound capstone) —
    // Number(true) === 1, so existing boolean predicates drain at full dps
    // unchanged, and a partial match just drains proportionally slower.
    const hit = isPlaying && stage.target(S, isPlaying);
    if (hit) {
      const intensity = Math.min(1, Math.max(0, Number(hit)));
      const before = this.currentHp;
      this.currentHp = Math.max(0, before - stage.boss.dps * dt * intensity);
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

  /** Runs the defeat → unlock → restore → next-encounter sequence. */
  _defeat(stage) {
    // A CHALLENGES entry carries `unlocks`; a STAGES entry never does — that
    // one field is enough to tell which unlock track this defeat belongs to.
    if (stage.unlocks) {
      progression.unlockFeature(stage.unlocks);
    } else {
      progression.markDefeated(stage.id);
      progression.unlockNext();
      if (progression.defeated.length === STAGE_IDS.length) {
        this.graduated = true;
      }
    }
    this._xpAccum += stage.boss.maxHp; // defeat bonus
    this.flushXp();

    const restorePayload = {
      stage,
      instrument: stage.instrument,
      pioneer: stage.pioneer,
      challenge: !!stage.unlocks,
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
   * Activate the current encounter from progression — sets currentHp to its
   * maxHp (0 if nothing is left to fight). Call on load and after each
   * restore to set up the next boss, whichever unlock track it's on.
   */
  activateStage() {
    if (progression.defeated.length === STAGE_IDS.length) {
      this.graduated = true;
    }
    this._noChallengesLeft = false; // recompute fresh — a defeat, load, or reset may have changed the answer
    const stage = this.activeEncounter();
    this.currentHp = stage ? stage.boss.maxHp : 0;
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
