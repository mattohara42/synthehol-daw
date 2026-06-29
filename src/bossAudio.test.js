import { describe, it, expect } from 'vitest';
import { damageBlipFreq, RESTORE_ARP, GRADUATION_ARP } from './bossAudio.js';

describe('bossAudio – damageBlipFreq', () => {
  it('is lowest at full HP and highest at zero HP', () => {
    expect(damageBlipFreq(1)).toBeCloseTo(220, 5);
    expect(damageBlipFreq(0)).toBeCloseTo(660, 5);
  });

  it('rises monotonically as HP drains', () => {
    expect(damageBlipFreq(0.75)).toBeLessThan(damageBlipFreq(0.25));
    expect(damageBlipFreq(0.5)).toBeCloseTo(440, 5);
  });

  it('clamps out-of-range fractions', () => {
    expect(damageBlipFreq(2)).toBeCloseTo(220, 5);
    expect(damageBlipFreq(-1)).toBeCloseTo(660, 5);
  });
});

describe('bossAudio – arpeggios', () => {
  it('restore arpeggio is an ascending C-major chord', () => {
    for (let i = 1; i < RESTORE_ARP.length; i++) {
      expect(RESTORE_ARP[i]).toBeGreaterThan(RESTORE_ARP[i - 1]);
    }
  });

  it('graduation arpeggio extends the restore arpeggio higher', () => {
    expect(GRADUATION_ARP.length).toBeGreaterThan(RESTORE_ARP.length);
    expect(Math.max(...GRADUATION_ARP)).toBeGreaterThan(Math.max(...RESTORE_ARP));
  });
});
