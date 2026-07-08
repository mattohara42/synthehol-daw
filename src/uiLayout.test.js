// UI layout invariants — reads index.html / controls.js / style.css as plain
// text (node test env, no DOM) to guard the contracts that layout tweaks can
// silently break: every wired control id must exist in the markup, and gated
// controls must stay hidden.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const controlsSrc = readFileSync(join(root, 'src', 'controls.js'), 'utf8');
const css = readFileSync(join(root, 'src', 'style.css'), 'utf8');

describe('uiLayout – control wiring integrity', () => {
  it('every id wired in controls.js exists in index.html', () => {
    const wired = [...controlsSrc.matchAll(/wire(?:ToggleGroup)?\('([^']+)'/g)]
      .map((m) => m[1]);
    // Sanity floor: if the extraction regex rots, fail loudly instead of
    // vacuously passing on an empty list.
    expect(wired.length).toBeGreaterThan(25);
    for (const id of wired) {
      expect(html, `index.html is missing wired control id "${id}"`)
        .toContain(`id="${id}"`);
    }
  });
});

describe('uiLayout – FX compact channel-strip layout', () => {
  const fxSection = html.slice(
    html.indexOf('id="mod-fx"'),
    html.indexOf('</section>', html.indexOf('id="mod-fx"'))
  );

  it('the FX knob-bank uses the vertical knob-bank-col variant', () => {
    expect(fxSection).toContain('knob-bank knob-bank-col');
  });

  it('the FX bank still contains all six effect controls', () => {
    for (const id of [
      's-drive', 's-delaytime', 's-delayfb',
      's-delaymix', 's-reverbmix', 's-chorusmix',
    ]) {
      expect(fxSection, `FX module is missing control "${id}"`)
        .toContain(`id="${id}"`);
    }
  });

  it('no other module opts into knob-bank-col (FX-only this pass)', () => {
    expect(html.match(/class="[^"]*\bknob-bank-col\b[^"]*"/g)).toHaveLength(1);
  });

  it('style.css defines the knob-bank-col variant', () => {
    expect(css).toContain('.knob-bank-col');
  });
});

describe('uiLayout – rack grid (no-scroll layout rework)', () => {
  it('the rack is one flat grid whose areas place all eight modules', () => {
    const areas = css.match(/\.rack-rows\s*\{[^}]*grid-template-areas:([^;]+);/);
    expect(areas, 'no grid-template-areas on .rack-rows').not.toBeNull();
    for (const mod of ['osc', 'filter', 'adsr', 'osc2', 'noise', 'eq', 'lfo', 'fx']) {
      expect(areas[1]).toMatch(new RegExp(`\\b${mod}\\b`));
    }
  });

  it('the old .rack-row wrappers are gone from the markup', () => {
    expect(html).not.toMatch(/rack-row[- "]/);
  });

  it('FX is the vertical strip and LFO the horizontal band', () => {
    expect(html).toMatch(/class="module fx module-strip"/);
    expect(html).toMatch(/class="module lfo module-band"/);
    expect(css).toContain('.module-strip');
    expect(css).toContain('.module-band');
  });

  it('the Mono toggle lives inside the waveform button group', () => {
    const waveGroup = html.slice(
      html.indexOf('id="wave-btns"'),
      html.indexOf('</div>', html.indexOf('id="osc-mono"'))
    );
    expect(waveGroup).toContain('id="osc-mono"');
  });
});

describe('uiLayout – gated Chorus control stays hidden', () => {
  it('#ctrl-chorus keeps its hidden attribute in markup', () => {
    expect(html).toMatch(/id="ctrl-chorus"[^>]*\bhidden\b/);
  });

  it('style.css keeps the .ctrl[hidden] display override', () => {
    // .ctrl-knob's display:flex beats the UA's [hidden] rule without this —
    // see CLAUDE.md's [hidden] trap.
    expect(css).toMatch(/\.ctrl\[hidden\]\s*\{\s*display:\s*none/);
  });
});
