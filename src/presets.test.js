import { describe, it, expect, beforeEach, vi } from 'vitest';
import { presets, buildShareUrl, readPatchFromHash } from './presets.js';
import { S } from './state.js';

// The implementation reads/writes localStorage and `location` directly
// (browser globals). Stub both before each test so state never bleeds
// across tests via the module-singleton `S` or a shared in-memory store.

function makeLocalStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorageMock());
  vi.stubGlobal('location', {
    origin: 'https://example.test',
    pathname: '/synthehol.html',
    hash: '',
  });
});

describe('presets – factory list', () => {
  it('list() includes the five factory presets with no saved presets', () => {
    const names = presets.list().map((p) => p.name);
    expect(names).toEqual(['Init', 'Bass', 'Brass', 'Lead', 'Pad']);
  });

  it('isFactory() is true for factory names and false otherwise', () => {
    expect(presets.isFactory('Bass')).toBe(true);
    expect(presets.isFactory('My Custom Sound')).toBe(false);
  });
});

describe('presets – save() / delete() (localStorage-backed)', () => {
  it('save() appends a new preset that round-trips every current param', () => {
    presets.save('My Sound');
    const saved = presets.list().find((p) => p.name === 'My Sound');
    expect(saved).toBeTruthy();
    // The save must spread the FULL live params object, not a hand-picked
    // field list — a hardcoded list has silently dropped newly-added params
    // before (see the FX-restore bug noted in presets.js). Every key in S
    // must appear, with the same value, on the saved preset.
    for (const key of Object.keys(S)) {
      expect(saved).toHaveProperty(key, S[key]);
    }
  });

  it('save() with an existing name overwrites rather than duplicating', () => {
    presets.save('Dup');
    presets.save('Dup');
    const matches = presets.list().filter((p) => p.name === 'Dup');
    expect(matches).toHaveLength(1);
  });

  it('delete() removes a saved preset', () => {
    presets.save('Temp');
    expect(presets.list().some((p) => p.name === 'Temp')).toBe(true);
    presets.delete('Temp');
    expect(presets.list().some((p) => p.name === 'Temp')).toBe(false);
  });

  it('delete() on a factory name is a no-op (factory presets are not stored)', () => {
    const before = presets.list().length;
    presets.delete('Bass');
    expect(presets.list()).toHaveLength(before);
    expect(presets.list().some((p) => p.name === 'Bass')).toBe(true);
  });

  it('saved presets persist independently of the factory list', () => {
    presets.save('Custom A');
    presets.save('Custom B');
    const names = presets.list().map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Init', 'Bass', 'Custom A', 'Custom B']));
  });
});

describe('presets – buildShareUrl() / readPatchFromHash() round trip', () => {
  it('round-trips the full current patch through the URL hash', () => {
    const url = buildShareUrl();
    expect(url.startsWith('https://example.test/synthehol.html#patch=')).toBe(true);

    const hashIndex = url.indexOf('#');
    vi.stubGlobal('location', {
      origin: 'https://example.test',
      pathname: '/synthehol.html',
      hash: url.slice(hashIndex),
    });

    const patch = readPatchFromHash();
    expect(patch).toEqual(S);
  });

  it('readPatchFromHash() returns null when there is no hash', () => {
    vi.stubGlobal('location', { origin: 'https://example.test', pathname: '/x', hash: '' });
    expect(readPatchFromHash()).toBeNull();
  });

  it('readPatchFromHash() returns null (never throws) for malformed JSON', () => {
    vi.stubGlobal('location', {
      origin: 'https://example.test', pathname: '/x', hash: '#patch=not-json',
    });
    expect(() => readPatchFromHash()).not.toThrow();
    expect(readPatchFromHash()).toBeNull();
  });

  it('readPatchFromHash() returns null for non-object JSON (a bare number/string)', () => {
    vi.stubGlobal('location', {
      origin: 'https://example.test', pathname: '/x', hash: '#patch=42',
    });
    expect(readPatchFromHash()).toBeNull();
  });

  it('readPatchFromHash() returns null when the patch param is missing entirely', () => {
    vi.stubGlobal('location', {
      origin: 'https://example.test', pathname: '/x', hash: '#other=value',
    });
    expect(readPatchFromHash()).toBeNull();
  });
});
