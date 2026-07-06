import { describe, it, expect, vi } from 'vitest';

// teaching.js reads the DOM and imports from state.js/canvas.js at module load.
// Mock those so we can import and inspect TEACHINGS without a browser.
vi.mock('./state.js', () => ({ S: { waveform: 'sine', filterType: 'lowpass', cutoff: 1000, lfoDest: 'none' } }));
// Stub any property access on ctx2 as a no-op function so draw functions
// that call ctx2.fillRect, ctx2.strokeStyle = x, etc. don't throw.
const makeCtx2 = () => new Proxy({}, { get: () => () => {} });

vi.mock('./canvas.js', () => ({
  setupCanvas: vi.fn(() => ({ ctx2: makeCtx2(), W: 200, H: 60 })),
  drawWaveOnCanvas: vi.fn(),
  drawFilterCurveOnCanvas: vi.fn(),
  drawADSRShape: vi.fn(() => ({ x0:0, x1:40, x2:80, x3:120, x4:160, bot:50, top:5, susY:30 })),
}));

// Stub the DOM elements teach() writes to
global.document = {
  getElementById: vi.fn(() => ({ textContent: '', style: {} })),
};

const { TEACHINGS } = await import('./teaching.js').then(m => {
  // TEACHINGS is not exported — access via the module's internal test hook
  // Instead test through the exported teach() function behaviour
  return m;
}).catch(() => ({}));

// teaching.js doesn't export TEACHINGS, so we test via a lightweight re-import
// pattern: import the module, then verify teach() writes expected content.
describe('lore TEACHINGS entries', () => {
  const LORE_IDS = ['lore-osc', 'lore-filter', 'lore-envelope', 'lore-lfo', 'lore-noise', 'lore-osc2', 'lore-eq', 'lore-fx'];

  it('teach() does not throw for any lore key', async () => {
    const { teach } = await import('./teaching.js');
    for (const id of LORE_IDS) {
      expect(() => teach(id)).not.toThrow();
    }
  });

  it('teach() writes non-empty title for each lore key', async () => {
    const { teach } = await import('./teaching.js');
    const titleEl = { textContent: '' };
    const bodyEl  = { textContent: '' };
    const canvasEl = {};

    vi.mocked(global.document.getElementById).mockImplementation((id) => {
      if (id === 'teach-title')  return titleEl;
      if (id === 'teach-body')   return bodyEl;
      if (id === 'teach-canvas') return canvasEl;
      return null;
    });

    for (const id of LORE_IDS) {
      titleEl.textContent = '';
      teach(id);
      expect(titleEl.textContent.length, `lore key '${id}' title is empty`).toBeGreaterThan(0);
    }
  });

  it('teach() writes non-empty body for each lore key', async () => {
    const { teach } = await import('./teaching.js');
    const titleEl  = { textContent: '' };
    const bodyEl   = { textContent: '' };
    const canvasEl = {};

    vi.mocked(global.document.getElementById).mockImplementation((id) => {
      if (id === 'teach-title')  return titleEl;
      if (id === 'teach-body')   return bodyEl;
      if (id === 'teach-canvas') return canvasEl;
      return null;
    });

    for (const id of LORE_IDS) {
      bodyEl.textContent = '';
      teach(id);
      expect(bodyEl.textContent.length, `lore key '${id}' body is empty`).toBeGreaterThan(20);
    }
  });
});

// The rotating lore-fact pool (LORE_FACTS/pickLoreFact/rerollLore) is what
// gives replaying the game different historical content each time — tested
// directly against Math.random rather than statistically, since a "does it
// eventually pick a different one" test would be flaky.
describe('lore fact pool (LORE_FACTS / pickLoreFact / rerollLore)', () => {
  it('every pool entry has a non-empty title and body', async () => {
    const { LORE_FACTS } = await import('./teaching.js');
    for (const [key, facts] of Object.entries(LORE_FACTS)) {
      expect(Array.isArray(facts) && facts.length > 0, `'${key}' has no facts`).toBe(true);
      for (const fact of facts) {
        expect(fact.title.length, `'${key}' has an empty title`).toBeGreaterThan(0);
        expect(fact.body.length, `'${key}' has an empty body`).toBeGreaterThan(20);
      }
    }
  });

  it('mentions every requested pioneer somewhere across the pool', async () => {
    const { LORE_FACTS } = await import('./teaching.js');
    const allText = Object.values(LORE_FACTS).flat().map(f => f.title + ' ' + f.body).join(' ');
    for (const name of ['Wendy Carlos', 'Vangelis', 'Moroder', 'Daft Punk', 'King Tubby', 'Prince Jammy', 'Perry']) {
      expect(allText, `pool never mentions '${name}'`).toContain(name);
    }
  });

  it('picks a deterministic fact from Math.random and memoizes it until reroll', async () => {
    const { pickLoreFact, rerollLore, LORE_FACTS } = await import('./teaching.js');
    rerollLore();

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickLoreFact('lore-osc')).toBe(LORE_FACTS['lore-osc'][0]);

    // Still memoized to the first pick even if Math.random would now answer differently.
    randomSpy.mockReturnValue(0.99);
    expect(pickLoreFact('lore-osc')).toBe(LORE_FACTS['lore-osc'][0]);

    // A high Math.random value picks the pool's last entry once re-rolled.
    rerollLore();
    expect(pickLoreFact('lore-osc')).toBe(LORE_FACTS['lore-osc'][LORE_FACTS['lore-osc'].length - 1]);

    randomSpy.mockRestore();
  });

  it('returns null for a key with no pool', async () => {
    const { pickLoreFact } = await import('./teaching.js');
    expect(pickLoreFact('lore-does-not-exist')).toBe(null);
  });
});
