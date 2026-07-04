// Boss-damage lightning FX — a jagged, animated bolt from the corrupted
// module to the boss panel while the player is actively dealing damage.
// Purely decorative: a fixed full-viewport SVG overlay, pointer-events:none,
// redrawn from progressionUI.js's existing onDamage callback (piggybacking
// on bossEngine.tick()'s already-running per-frame cadence rather than a new
// rAF loop of its own — see main.js's E8 single-dispatcher note). No import
// of bossEngine/progression here — moduleId and the active flag are handed
// in by the caller, keeping this a thin, testable DOM/visual layer like
// bossAudio.js.

const SEGMENTS = 7;
const JITTER = 18; // px of perpendicular-ish wobble per segment, for a jagged look

let svg, bolt, glow;

/**
 * A jagged SVG path string from (x1,y1) to (x2,y2): the endpoints are exact,
 * every point in between is randomly offset for a lightning-like crackle.
 * Pure — no DOM — so it's directly unit-testable.
 */
export function buildJaggedPath(x1, y1, x2, y2, segments = SEGMENTS, jitter = JITTER) {
  const dx = x2 - x1, dy = y2 - y1;
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const nx = x1 + dx * t + (Math.random() - 0.5) * jitter;
    const ny = y1 + dy * t + (Math.random() - 0.5) * jitter;
    d += ` L ${nx.toFixed(1)} ${ny.toFixed(1)}`;
  }
  d += ` L ${x2} ${y2}`;
  return d;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initBossZap() {
  svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'boss-zap-overlay');
  svg.setAttribute('aria-hidden', 'true');

  // Two overlaid paths, not one: a wide blurred "glow" underneath a thin
  // bright "bolt" on top — the same core-plus-halo trick the LFO/scope
  // canvases already use for their glow, just in SVG instead of Canvas 2D.
  glow = document.createElementNS(SVG_NS, 'path');
  glow.setAttribute('class', 'boss-zap-glow');
  bolt = document.createElementNS(SVG_NS, 'path');
  bolt.setAttribute('class', 'boss-zap-bolt');

  svg.appendChild(glow);
  svg.appendChild(bolt);
  document.body.appendChild(svg);
}

/**
 * Called every animation frame that bossEngine.onDamage fires (i.e. every
 * frame the boss fight is actually ticking). Shows a fresh jittery bolt from
 * `moduleId`'s rack module to the boss panel while `active` is true; hides
 * otherwise. Silently no-ops (hides) if the encounter has no single module
 * to strike from (moduleId null — the capstone and some bonus challenges
 * span more than one module, same case enterBattle() already handles) or
 * the boss panel isn't currently on screen (a non-scope/practice/mixer
 * lower tab hides .keys-row).
 */
export function updateBossZap(moduleId, active) {
  if (!svg) return;

  const bossPanel = moduleId && active ? document.getElementById('boss-panel') : null;
  const moduleEl = moduleId && active ? document.getElementById(moduleId) : null;
  const bossRect = bossPanel?.getBoundingClientRect();
  const modRect = moduleEl?.getBoundingClientRect();
  const visible = !!(bossRect && modRect && bossRect.width > 0 && modRect.width > 0);

  svg.classList.toggle('active', visible);
  if (!visible) return;

  const x1 = modRect.left + modRect.width / 2;
  const y1 = modRect.top + modRect.height / 2;
  const x2 = bossRect.left + bossRect.width / 2;
  const y2 = bossRect.top + bossRect.height / 2;
  const d = buildJaggedPath(x1, y1, x2, y2);
  bolt.setAttribute('d', d);
  glow.setAttribute('d', d);
}
