import { describe, it, expect } from 'vitest';
import { formatPosition } from './transportUI.js';

describe('transportUI – formatPosition', () => {
  it('renders 0-indexed position as 1-indexed bar . beat . sixteenth', () => {
    expect(formatPosition({ bar: 0, beat: 0, sixteenth: 0 })).toBe('1 . 1 . 1');
    expect(formatPosition({ bar: 1, beat: 2, sixteenth: 3 })).toBe('2 . 3 . 4');
    expect(formatPosition({ bar: 15, beat: 3, sixteenth: 3 })).toBe('16 . 4 . 4');
  });
});
