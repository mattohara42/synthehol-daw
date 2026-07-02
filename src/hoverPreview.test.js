import { describe, it, expect } from 'vitest';
import { buildHoverPreview } from './hoverPreview.js';

const liveParams = { waveform: 'sine', cutoff: 2000, resonance: 1 };

describe('hoverPreview – buildHoverPreview', () => {
  it('returns null when hovering the already-active option', () => {
    expect(buildHoverPreview(liveParams, 'waveform', 'sine')).toBeNull();
  });

  it('returns null when the hovered value is missing (e.g. not a data-* button)', () => {
    expect(buildHoverPreview(liveParams, 'waveform', undefined)).toBeNull();
  });

  it('builds a before/after pair when hovering a different option', () => {
    const preview = buildHoverPreview(liveParams, 'waveform', 'square');
    expect(preview.before).toEqual(liveParams);
    expect(preview.after).toEqual({ ...liveParams, waveform: 'square' });
  });

  it('before and after are independent copies, not references to liveParams', () => {
    const preview = buildHoverPreview(liveParams, 'waveform', 'square');
    preview.before.cutoff = 9999;
    expect(liveParams.cutoff).toBe(2000);
  });

  it('only changes the targeted param, leaving the rest of the patch intact', () => {
    const preview = buildHoverPreview(liveParams, 'resonance', 8);
    expect(preview.after).toEqual({ waveform: 'sine', cutoff: 2000, resonance: 8 });
  });
});
