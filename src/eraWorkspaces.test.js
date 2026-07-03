import { describe, it, expect } from 'vitest';
import { ERA_WORKSPACES, workspaceById } from './eraWorkspaces.js';

describe('ERA_WORKSPACES', () => {
  it('has moog and arp with distinct ids', () => {
    const ids = ERA_WORKSPACES.map(w => w.id);
    expect(ids).toContain('moog');
    expect(ids).toContain('arp');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every workspace has the required fields', () => {
    for (const w of ERA_WORKSPACES) {
      expect(w, `workspace missing id`).toHaveProperty('id');
      expect(w.name, `'${w.id}' missing name`).toBeTruthy();
      expect(w.pioneer, `'${w.id}' missing pioneer`).toBeTruthy();
      expect(w.tagline, `'${w.id}' missing tagline`).toBeTruthy();
      expect(Array.isArray(w.presets), `'${w.id}'.presets is not an array`).toBe(true);
    }
  });

  it('every curated preset is a complete, playable params object', () => {
    const REQUIRED = ['waveform', 'detune', 'attack', 'decay', 'sustain', 'release', 'osc2Waveform', 'osc2Octave', 'osc2Detune', 'osc2Mix', 'noiseType', 'noiseMix', 'filterType', 'cutoff', 'resonance'];
    for (const w of ERA_WORKSPACES) {
      for (const preset of w.presets) {
        expect(preset.name, `a preset in '${w.id}' is missing a name`).toBeTruthy();
        for (const key of REQUIRED) {
          expect(preset, `'${w.id}' preset '${preset.name}' missing '${key}'`).toHaveProperty(key);
        }
      }
    }
  });

  it('ARP presets are named distinctly', () => {
    const arp = workspaceById('arp');
    const names = arp.presets.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('workspaceById()', () => {
  it('finds an existing workspace', () => {
    expect(workspaceById('moog')?.name).toBe('Moog');
    expect(workspaceById('arp')?.name).toBe('ARP');
  });

  it('returns undefined for an unknown id', () => {
    expect(workspaceById('bogus')).toBeUndefined();
  });
});
