import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initPersistence } from './persistence.js';

function makeLocalStorageMock() {
  let data = {};
  return {
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => { data[key] = String(value); }),
    removeItem: vi.fn((key) => { delete data[key]; }),
    clear: vi.fn(() => { data = {}; }),
  };
}

// A minimal fake store: just enough of the real API (subscribe/load/
// serialize/params) for persistence.js to drive.
function makeFakeStore() {
  let subs = [];
  const project = { value: 1 };
  const store = {
    subscribe: vi.fn((fn) => { subs.push(fn); return () => { subs = subs.filter(f => f !== fn); }; }),
    notify: () => subs.forEach(fn => fn()),
    load: vi.fn((json) => {
      try { Object.assign(project, JSON.parse(json)); return true; }
      catch { return false; }
    }),
    serialize: vi.fn(() => JSON.stringify(project)),
    params: vi.fn(() => ({ cutoff: 2000 })),
  };
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', makeLocalStorageMock());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('persistence – restore on init', () => {
  it('does nothing when there is no saved project', () => {
    const store = makeFakeStore();
    const applyPreset = vi.fn();
    initPersistence(store, applyPreset);
    expect(store.load).not.toHaveBeenCalled();
    expect(applyPreset).not.toHaveBeenCalled();
  });

  it('loads a saved project and resyncs controls from it', () => {
    localStorage.setItem('synthehol_project', '{"value":42}');
    const store = makeFakeStore();
    const applyPreset = vi.fn();
    initPersistence(store, applyPreset);
    expect(store.load).toHaveBeenCalledWith('{"value":42}');
    expect(applyPreset).toHaveBeenCalledWith(store.params());
  });

  it('does not call applyPreset when the saved data is malformed', () => {
    localStorage.setItem('synthehol_project', 'not json');
    const store = makeFakeStore();
    const applyPreset = vi.fn();
    initPersistence(store, applyPreset);
    expect(applyPreset).not.toHaveBeenCalled();
  });
});

describe('persistence – debounced auto-save', () => {
  it('does not write to localStorage immediately on a change', () => {
    const store = makeFakeStore();
    initPersistence(store, vi.fn());
    store.notify();
    expect(localStorage.setItem).not.toHaveBeenCalledWith('synthehol_project', expect.anything());
  });

  it('writes once, after the debounce window, following a change', () => {
    const store = makeFakeStore();
    initPersistence(store, vi.fn());
    store.notify();
    vi.advanceTimersByTime(500);
    expect(localStorage.setItem).toHaveBeenCalledWith('synthehol_project', store.serialize());
  });

  it('coalesces rapid successive changes into a single write', () => {
    const store = makeFakeStore();
    initPersistence(store, vi.fn());
    store.notify();
    vi.advanceTimersByTime(100);
    store.notify();
    vi.advanceTimersByTime(100);
    store.notify();
    vi.advanceTimersByTime(500);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
