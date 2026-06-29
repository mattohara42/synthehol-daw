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
  const LORE_IDS = ['lore-osc', 'lore-filter', 'lore-envelope', 'lore-lfo'];

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
  });
});
