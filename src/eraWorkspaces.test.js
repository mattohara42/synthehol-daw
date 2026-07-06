import { describe, it, expect } from 'vitest';
import { ERA_WORKSPACES, workspaceById } from './eraWorkspaces.js';

describe('ERA_WORKSPACES', () => {
  it('has all five workspaces (the original four plus Acid) with distinct ids', () => {
    const ids = ERA_WORKSPACES.map(w => w.id);
    for (const id of ['moog', 'arp', 'oberheim', 'sequential', 'acid']) {
      expect(ids, `missing workspace '${id}'`).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the Acid workspace isn't named 'roland' — that era tag is already used by stages.js's CE-1 Chorus bonus challenge", () => {
    const ids = ERA_WORKSPACES.map(w => w.id);
    const names = ERA_WORKSPACES.map(w => w.name.toLowerCase());
    expect(ids).not.toContain('roland');
    expect(names).not.toContain('roland');
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

  it('presets within a workspace are named distinctly', () => {
    for (const w of ERA_WORKSPACES) {
      const names = w.presets.map(p => p.name);
      expect(new Set(names).size, `'${w.id}' has duplicate preset names`).toBe(names.length);
    }
  });

  it('no curated preset touches a D1-gated field — eraWorkspacesUI applies these with no progression check of its own', () => {
    for (const w of ERA_WORKSPACES) {
      for (const preset of w.presets) {
        expect(preset.lfoWaveform, `'${w.id}' preset '${preset.name}' sets the gated S&H shape`).not.toBe('sampleHold');
        expect(preset.chorusMix || 0, `'${w.id}' preset '${preset.name}' sets a nonzero gated chorus mix`).toBe(0);
      }
    }
  });
});

describe('workspaceById()', () => {
  it('finds an existing workspace', () => {
    expect(workspaceById('moog')?.name).toBe('Moog');
    expect(workspaceById('arp')?.name).toBe('ARP');
    expect(workspaceById('acid')?.name).toBe('Acid');
  });

  it('returns undefined for an unknown id', () => {
    expect(workspaceById('bogus')).toBeUndefined();
  });
});
