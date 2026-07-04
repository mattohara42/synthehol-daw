import { describe, it, expect } from 'vitest';
import { buildJaggedPath } from './bossZap.js';

describe('bossZap – buildJaggedPath', () => {
  it('starts exactly at the first point and ends exactly at the second', () => {
    const d = buildJaggedPath(10, 20, 300, 400);
    expect(d.startsWith('M 10 20')).toBe(true);
    expect(d.endsWith('L 300 400')).toBe(true);
  });

  it('emits one command per segment plus the closing point', () => {
    const d = buildJaggedPath(0, 0, 100, 100, 5);
    // Splitting on " L " yields: the "M"-start chunk, (segments - 1)
    // intermediate points (i=1..4), and 1 closing point — 6 pieces total.
    const commands = d.split(' L ');
    expect(commands.length).toBe(6);
  });

  it('with zero jitter, every intermediate point sits exactly on the straight line', () => {
    const d = buildJaggedPath(0, 0, 100, 0, 4, 0);
    const ys = d.match(/-?\d+\.?\d*/g).filter((_, i) => i % 2 === 1); // every y coordinate
    for (const y of ys) expect(Number(y)).toBeCloseTo(0, 5);
  });

  it('is deterministic in shape (same endpoint count) across repeated calls despite randomness', () => {
    const d1 = buildJaggedPath(0, 0, 50, 50, 6);
    const d2 = buildJaggedPath(0, 0, 50, 50, 6);
    expect(d1.split(' L ').length).toBe(d2.split(' L ').length);
  });
});
