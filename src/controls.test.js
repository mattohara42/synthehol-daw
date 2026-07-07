import { describe, it, expect, beforeEach, vi } from 'vitest';

// canvas.js reads window.devicePixelRatio at MODULE LOAD time (controls.js
// imports drawModCanvas from it transitively via teaching.js too), so the
// stub has to be in place before the dynamic import below, not just in
// beforeEach. Nothing else touched by controls.js's import chain (state.js,
// store.js, audio.js, ui.js, teaching.js) touches a global at module load.
vi.stubGlobal('window', { devicePixelRatio: 1 });

const { applyPreset } = await import('./controls.js');

// applyPreset() is controls.js's highest-traffic function — every preset
// load, shared-patch link, project-persistence restore, undo/redo, and
// track switch resyncs the whole rack through it. It's pure DOM plumbing
// (no audio/store logic of its own), so a minimal fake `document` — rich
// enough to observe which element got which value/click, not to actually
// render anything — is enough to test its real risk: the ~30-entry
// field-name-to-element-id table (a typo there silently does nothing) and
// the "leave undefined fields alone" contract older presets depend on.

function fakeSlider() {
  return { value: '', dispatchEvent: vi.fn() };
}

function fakeToggleButton(dataAttr, value, initialActive = false) {
  const btn = {
    dataset: { [dataAttr]: value },
    active: initialActive,
    classList: {
      contains: (c) => c === 'active' && btn.active,
      add: (c) => { if (c === 'active') btn.active = true; },
      remove: (c) => { if (c === 'active') btn.active = false; },
    },
    click: vi.fn(),
  };
  return btn;
}

const SLIDER_FIELD_MAP = {
  's-oct': 'octave', 's-detune': 'detune', 's-glide': 'glideTime',
  's-noisemix': 'noiseMix', 's-osc2oct': 'osc2Octave', 's-osc2detune': 'osc2Detune', 's-osc2mix': 'osc2Mix',
  's-cutoff': 'cutoff', 's-res': 'resonance', 's-fenv': 'filterEnvAmount',
  's-atk': 'attack', 's-dec': 'decay', 's-sus': 'sustain', 's-rel': 'release',
  's-lforate': 'lfoRate', 's-lfodepth': 'lfoDepth',
  's-drive': 'drive', 's-eqlow': 'eqLow', 's-eqmid': 'eqMid', 's-eqhigh': 'eqHigh',
  's-delaytime': 'delayTime', 's-delayfb': 'delayFeedback', 's-delaymix': 'delayMix',
  's-reverbmix': 'reverbMix', 's-chorusmix': 'chorusMix', 'master-vol': 'masterVol',
};

const TOGGLE_GROUPS = {
  'wave-btns':     { dataAttr: 'wave',     field: 'waveform',     values: ['sine', 'sawtooth', 'square', 'triangle'] },
  'noise-btns':    { dataAttr: 'noise',    field: 'noiseType',    values: ['white', 'pink'] },
  'osc2wave-btns': { dataAttr: 'osc2wave', field: 'osc2Waveform', values: ['sine', 'sawtooth', 'square', 'triangle'] },
  'ftype-btns':    { dataAttr: 'ftype',    field: 'filterType',   values: ['lowpass', 'highpass', 'bandpass'] },
  'lfodest-btns':  { dataAttr: 'dest',     field: 'lfoDest',      values: ['filter', 'pitch', 'amp', 'none'] },
  'lfowave-btns':  { dataAttr: 'wave',     field: 'lfoWaveform',  values: ['sine', 'sawtooth', 'square', 'triangle', 'sampleHold'] },
};

// A full patch exercising every field applyPreset knows about, with values
// distinct enough that a field landing on the wrong element is obvious.
const FULL_PATCH = {
  waveform: 'square', noiseType: 'pink', osc2Waveform: 'triangle', filterType: 'bandpass',
  lfoDest: 'pitch', lfoWaveform: 'sampleHold', lfoRetrigger: true, mono: true,
  octave: 5, detune: 12, glideTime: 0.2, noiseMix: 0.3, osc2Octave: -1, osc2Detune: 8, osc2Mix: 0.4,
  cutoff: 1500, resonance: 4, filterEnvAmount: 0.5, attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.4,
  lfoRate: 3, lfoDepth: 0.25, drive: 0.1, eqLow: 2, eqMid: -1, eqHigh: 1.5,
  delayTime: 0.3, delayFeedback: 0.35, delayMix: 0.2, reverbMix: 0.4, chorusMix: 0.6, masterVol: 0.7,
};

function installFakeDocument(overrides = {}) {
  const elements = new Map();
  const groups = new Map();

  for (const id of Object.keys(SLIDER_FIELD_MAP)) elements.set(id, fakeSlider());
  for (const [groupId, { dataAttr, values }] of Object.entries(TOGGLE_GROUPS)) {
    groups.set(groupId, values.map(v => fakeToggleButton(dataAttr, v)));
  }
  elements.set('lfo-keysync', fakeToggleButton('_n/a', '_n/a', overrides.keysyncActive ?? false));
  elements.set('osc-mono', fakeToggleButton('_n/a', '_n/a', overrides.monoActive ?? false));

  for (const removedId of overrides.remove ?? []) elements.delete(removedId);

  const document = {
    getElementById: (id) => elements.get(id) ?? null,
    querySelectorAll: (sel) => {
      const m = sel.match(/^#([\w-]+) \.tog-btn$/);
      return (m && groups.get(m[1])) || [];
    },
  };
  vi.stubGlobal('document', document);
  return { elements, groups };
}

let elements, groups;
beforeEach(() => {
  ({ elements, groups } = installFakeDocument());
});

describe('applyPreset() – slider field mapping', () => {
  it('sets every mapped slider element\'s value from the matching patch field', () => {
    applyPreset(FULL_PATCH);
    for (const [id, field] of Object.entries(SLIDER_FIELD_MAP)) {
      expect(elements.get(id).value, `${id} should map to patch.${field}`).toBe(String(FULL_PATCH[field]));
    }
  });

  it('dispatches an input event on every slider it sets, so live listeners resync', () => {
    applyPreset(FULL_PATCH);
    for (const id of Object.keys(SLIDER_FIELD_MAP)) {
      expect(elements.get(id).dispatchEvent).toHaveBeenCalledTimes(1);
      const evt = elements.get(id).dispatchEvent.mock.calls[0][0];
      expect(evt.type).toBe('input');
      expect(evt.bubbles).toBe(true);
    }
  });

  it('leaves a slider completely untouched when its field is absent from the patch (older/factory presets)', () => {
    const partial = { octave: 3, cutoff: 900 }; // everything else undefined
    applyPreset(partial);
    expect(elements.get('s-oct').value).toBe('3');
    expect(elements.get('s-cutoff').value).toBe('900');
    for (const id of Object.keys(SLIDER_FIELD_MAP)) {
      if (id === 's-oct' || id === 's-cutoff') continue;
      expect(elements.get(id).value, `${id} should be untouched`).toBe('');
      expect(elements.get(id).dispatchEvent).not.toHaveBeenCalled();
    }
  });

  it('does not throw when a slider element is missing from the DOM', () => {
    ({ elements } = installFakeDocument({ remove: ['s-cutoff', 'master-vol'] }));
    expect(() => applyPreset(FULL_PATCH)).not.toThrow();
  });
});

describe('applyPreset() – toggle group field mapping', () => {
  it('clicks exactly the button matching the patch value in every toggle group, and no other button in that group', () => {
    applyPreset(FULL_PATCH);
    for (const [groupId, { field, values }] of Object.entries(TOGGLE_GROUPS)) {
      const btns = groups.get(groupId);
      const wantIndex = values.indexOf(FULL_PATCH[field]);
      btns.forEach((btn, i) => {
        if (i === wantIndex) expect(btn.click, `${groupId} should click ${values[i]}`).toHaveBeenCalledTimes(1);
        else expect(btn.click, `${groupId} should not click ${values[i]}`).not.toHaveBeenCalled();
      });
    }
  });

  it('clicks nothing in a group whose field is absent from the patch', () => {
    applyPreset({ octave: 4 }); // no waveform/noiseType/etc at all
    for (const groupId of Object.keys(TOGGLE_GROUPS)) {
      for (const btn of groups.get(groupId)) expect(btn.click).not.toHaveBeenCalled();
    }
  });

  it('does not throw when a whole toggle group is missing from the DOM', () => {
    const document = {
      getElementById: (id) => (Object.keys(SLIDER_FIELD_MAP).includes(id) ? fakeSlider() : null),
      querySelectorAll: () => [],
    };
    vi.stubGlobal('document', document);
    expect(() => applyPreset(FULL_PATCH)).not.toThrow();
  });
});

describe('applyPreset() – lfoRetrigger / mono checked-toggle semantics', () => {
  it('clicks lfo-keysync only when its current active state disagrees with the patch', () => {
    ({ elements } = installFakeDocument({ keysyncActive: false }));
    applyPreset({ lfoRetrigger: true });
    expect(elements.get('lfo-keysync').click).toHaveBeenCalledTimes(1);
  });

  it('does not click lfo-keysync when it already matches the patch', () => {
    ({ elements } = installFakeDocument({ keysyncActive: true }));
    applyPreset({ lfoRetrigger: true });
    expect(elements.get('lfo-keysync').click).not.toHaveBeenCalled();
  });

  it('clicks osc-mono only when its current active state disagrees with the patch', () => {
    ({ elements } = installFakeDocument({ monoActive: true }));
    applyPreset({ mono: false });
    expect(elements.get('osc-mono').click).toHaveBeenCalledTimes(1);
  });

  it('does not touch either special button when their fields are absent from the patch', () => {
    ({ elements } = installFakeDocument({ keysyncActive: true, monoActive: false }));
    applyPreset({ octave: 4 });
    expect(elements.get('lfo-keysync').click).not.toHaveBeenCalled();
    expect(elements.get('osc-mono').click).not.toHaveBeenCalled();
  });
});
