import { describe, it, expect, vi } from 'vitest';

// teaching.js reads the DOM and imports from state.js/canvas.js at module load.
// Mock those so we can import and inspect TEACHINGS without a browser.
vi.mock('./state.js', () => ({ S: { waveform: 'sine', filterType: 'lowpass', cutoff: 1000, lfoDest: 'none' } }));
vi.mock('./canvas.js', () => ({
  setupCanvas: vi.fn(() => ({ ctx2: {}, W: 200, H: 60 })),
  drawWaveOnCanvas: vi.fn(),
  drawFilterCurveOnCanvas: vi.fn(),
  drawADSRShape: vi.fn(),
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
  const LORE_IDS = ['lore-osc', 'lore-filter', 'lore-envelope', 'lore-lfo', 'lore-noise'];

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

  it('lore titles include the pioneer name', async () => {
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

    teach('lore-osc');
    expect(titleEl.textContent).toContain('Moog');

    teach('lore-filter');
    expect(titleEl.textContent).toContain('Moog');

    teach('lore-envelope');
    expect(titleEl.textContent).toContain('Carlos');

    teach('lore-lfo');
    expect(titleEl.textContent).toContain('Carlos');

    teach('lore-noise');
    expect(titleEl.textContent).toContain('Pearlman');
  });
});

describe('noise TEACHINGS entries', () => {
  const NOISE_IDS = ['noise-type', 'noise-mix'];

  it('teach() does not throw for noise control keys', async () => {
    const { teach } = await import('./teaching.js');
    for (const id of NOISE_IDS) {
      expect(() => teach(id)).not.toThrow();
    }
  });

  it('teach() writes non-empty title and body for noise-type', async () => {
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

    teach('noise-type');
    expect(titleEl.textContent.length).toBeGreaterThan(0);
    expect(bodyEl.textContent.length).toBeGreaterThan(20);
  });

  it('teach() writes non-empty title and body for noise-mix', async () => {
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

    teach('noise-mix');
    expect(titleEl.textContent.length).toBeGreaterThan(0);
    expect(bodyEl.textContent.length).toBeGreaterThan(20);
  });
});
