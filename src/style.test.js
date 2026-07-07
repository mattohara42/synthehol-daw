import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, 'style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments so prose mentioning a selector can't fake a match

// Hiding an element with the `hidden` attribute only works if no author CSS
// rule also sets `display` on it — the browser's UA-stylesheet default
// `[hidden] { display: none }` loses to ANY author-origin rule that sets
// `display`, regardless of specificity, because author styles always beat
// user-agent styles in the cascade. When that happens the element stays
// visible (and clickable) despite `el.hidden === true`.
//
// This exact bug shipped twice in this project — D1's first two gated
// challenges were live-but-invisibly-broken for a full commit each — and
// was only ever caught by a screenshot, never by reading `el.hidden` (which
// is true regardless of whether the CSS actually hid anything). Each fix is
// a `<selector>[hidden] { display: none; }` override placed next to the rule
// that competes with it. This test pins those four known fixes so a CSS
// reorganization can't silently delete one and reintroduce the same bug a
// third time. See CLAUDE.md's "Hiding an element..." Conventions entry.
const KNOWN_HIDDEN_OVERRIDES = [
  // selector,     the rule (elsewhere in the file) it has to beat
  ['.ctrl',        '.ctrl-knob { display: flex; ... } (knob-style controls, e.g. the D1-gated Chorus knob)'],
  ['.tog-btn',     'its own `display: flex` (all waveform/filter/LFO toggle buttons, e.g. the D1-gated S&H button)'],
  ['.teach-view',  'its own `display: flex` (the Learn/History tab panels)'],
  ['.tracks-bar',  '.presets-bar { display: flex }, which .tracks-bar (E4) reuses for its own base layout'],
];

describe('style.css – [hidden] vs display regression guard', () => {
  it.each(KNOWN_HIDDEN_OVERRIDES)(
    '%s has a `[hidden] { display: none; }` override (beats %s)',
    (selector) => {
      const escaped = selector.replace('.', '\\.');
      const pattern = new RegExp(`${escaped}\\[hidden\\]\\s*\\{[^}]*display\\s*:\\s*none\\s*;`);
      expect(css).toMatch(pattern);
    },
  );

  // Elements gated with `el.hidden = ...` in JS that deliberately do NOT
  // need the override above, because nothing in their own CSS competes with
  // the UA default. If either of these gains a `display` rule without also
  // gaining a `[hidden]` override, this test should start failing — that's
  // the point, not a false positive to silence.
  it('.era-workspaces sets no display of its own (documented exception — relies on the UA [hidden] default)', () => {
    const match = css.match(/(?:^|[\s,}])\.era-workspaces\s*\{([^}]*)\}/);
    expect(match, '.era-workspaces rule not found').toBeTruthy();
    expect(match[1]).not.toMatch(/display\s*:/);
  });

  it('.boss-transition-overlay is shown via :not([hidden]) rather than a plain class rule, so [hidden] always wins unopposed', () => {
    expect(css).not.toMatch(/(?:^|[\s,}])\.boss-transition-overlay\s*\{[^}]*display\s*:/);
    expect(css).toMatch(/\.boss-transition-overlay:not\(\[hidden\]\)\s*\{[^}]*display\s*:/);
  });
});
