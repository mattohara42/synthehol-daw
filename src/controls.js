// Wires every slider and button group to state updates, audio params,
// the module mini-canvas redraw, and the teaching panel.
//
// State writes route through `store.set(...)` (the project store, E1) so they
// are recorded for undo and serialization; reads still use the live `S` object.

import { S } from './state.js';
import { store } from './store.js';
import { engine, applyLFORouting, applyLFOWaveform, lfoDepthScaled, makeDriveCurve } from './audio.js';
import { fillSlider } from './ui.js';
import { drawModCanvas } from './canvas.js';
import { teach } from './teaching.js';

// Boss damage is no longer fired per control change — main.js ticks the
// bossEngine each frame off the live `S` and `engine.noteOn`, so changing a
// control while holding a note is reflected within one frame.

function wire(id, handler) {
  const el = document.getElementById(id);
  // a11y: label the slider from its visible label text if not already set.
  if (!el.getAttribute('aria-label')) {
    const labelText = el.closest('.ctrl')?.querySelector('.ctrl-label')?.textContent;
    if (labelText) el.setAttribute('aria-label', labelText.trim());
  }
  el.addEventListener('input', () => {
    fillSlider(el);
    handler(+el.value);
  });
  fillSlider(el);
}

function wireToggleGroup(groupId, onSelect) {
  const group = document.getElementById(groupId);
  if (group && !group.getAttribute('role')) group.setAttribute('role', 'group');
  const btns = document.querySelectorAll(`#${groupId} .tog-btn`);
  btns.forEach(b => {
    b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
    b.addEventListener('click', () => {
      btns.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('active');
      b.setAttribute('aria-pressed', 'true');
      onSelect(b);
    });
  });
}

function updateLFODepthDisplay() {
  const v = S.lfoDepth;
  let txt;
  if (S.lfoDest === 'pitch') txt = Math.round(v*1200)+' ¢';
  else if (S.lfoDest === 'amp') txt = Math.round(v*100)+'%';
  else txt = Math.round(v*8000)+' Hz';
  document.getElementById('v-lfodepth').textContent = txt;
}

export function initControls() {
  wireToggleGroup('wave-btns', b => {
    store.set('waveform', b.dataset.wave);
    drawModCanvas('osc');
    teach('osc-wave', S.waveform);
  });

  wireToggleGroup('ftype-btns', b => {
    store.set('filterType', b.dataset.ftype);
    const active = engine.active();
    if (active) active.vcf.type = S.filterType;
    drawModCanvas('filter');
    teach('filter-type', S.filterType);
  });

  wireToggleGroup('lfodest-btns', b => {
    store.set('lfoDest', b.dataset.dest);
    applyLFORouting();
    updateLFODepthDisplay();
    teach('lfo-dest', S.lfoDest);
  });

  wireToggleGroup('lfowave-btns', b => {
    store.set('lfoWaveform', b.dataset.wave);
    if (engine.ctx) applyLFOWaveform();
    drawModCanvas('lfo');
    teach('lfo-wave', S.lfoWaveform);
  });

  const keySyncBtn = document.getElementById('lfo-keysync');
  keySyncBtn?.addEventListener('click', () => {
    store.set('lfoRetrigger', !S.lfoRetrigger);
    keySyncBtn.classList.toggle('active', S.lfoRetrigger);
    keySyncBtn.setAttribute('aria-pressed', String(S.lfoRetrigger));
    teach('lfo-retrigger', S.lfoRetrigger);
  });

  wire('master-vol', v => {
    store.set('masterVol', v);
    if (engine.master) engine.master.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
  });

  wire('s-oct', v => {
    store.set('octave', v);
    document.getElementById('v-oct').textContent = v;
    teach('osc-oct', v);
  });

  wire('s-detune', v => {
    store.set('detune', v);
    document.getElementById('v-detune').textContent = v + ' ¢';
    teach('osc-detune', v);
  });

  wire('s-cutoff', v => {
    store.set('cutoff', v);
    document.getElementById('v-cutoff').textContent = v >= 1000 ? (v/1000).toFixed(1)+' kHz' : Math.round(v)+' Hz';
    const active = engine.active();
    if (active) active.vcf.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-cutoff', v);
  });

  wire('s-res', v => {
    store.set('resonance', v);
    document.getElementById('v-res').textContent = v.toFixed(1);
    const active = engine.active();
    if (active) active.vcf.Q.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-res', v);
  });

  wire('s-fenv', v => {
    store.set('filterEnvAmount', v);
    document.getElementById('v-fenv').textContent = v === 0 ? 'off' : '+' + v.toFixed(1) + ' oct';
    drawModCanvas('filter');
    teach('filter-env', v);
  });

  wire('s-atk', v => {
    store.set('attack', v);
    document.getElementById('v-atk').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-atk', v);
  });

  wire('s-dec', v => {
    store.set('decay', v);
    document.getElementById('v-dec').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-dec', v);
  });

  wire('s-sus', v => {
    store.set('sustain', v);
    document.getElementById('v-sus').textContent = Math.round(v*100)+'%';
    drawModCanvas('adsr');
    teach('adsr-sus', v);
  });

  wire('s-rel', v => {
    store.set('release', v);
    document.getElementById('v-rel').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-rel', v);
  });

  wire('s-lforate', v => {
    store.set('lfoRate', v);
    document.getElementById('v-lforate').textContent = v.toFixed(1)+' Hz';
    const active = engine.active();
    if (active) active.lfoOsc.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    teach('lfo-rate', v);
  });

  wire('s-lfodepth', v => {
    store.set('lfoDepth', v);
    updateLFODepthDisplay();
    const active = engine.active();
    if (active) active.lfoMod.gain.setTargetAtTime(lfoDepthScaled(), engine.ctx.currentTime, 0.01);
    teach('lfo-depth', v);
  });

  // ─── Noise (VNO) ───
  wireToggleGroup('noise-btns', b => {
    store.set('noiseType', b.dataset.noise);
    drawModCanvas('noise');
    teach('noise-type', S.noiseType);
  });

  wire('s-noisemix', v => {
    store.set('noiseMix', v);
    document.getElementById('v-noisemix').textContent = Math.round(v*100)+'%';
    drawModCanvas('noise');
    teach('noise-mix', v);
  });

  // ─── Oscillator 2 (VCO2) ───
  wireToggleGroup('osc2wave-btns', b => {
    store.set('osc2Waveform', b.dataset.osc2wave);
    drawModCanvas('osc2');
    teach('osc2-wave', S.osc2Waveform);
  });

  wire('s-osc2oct', v => {
    store.set('osc2Octave', v);
    document.getElementById('v-osc2oct').textContent = v > 0 ? '+' + v : String(v);
    drawModCanvas('osc2');
    teach('osc2-oct', v);
  });

  wire('s-osc2detune', v => {
    store.set('osc2Detune', v);
    document.getElementById('v-osc2detune').textContent = (v > 0 ? '+' : '') + v + ' ¢';
    drawModCanvas('osc2');
    teach('osc2-detune', v);
  });

  wire('s-osc2mix', v => {
    store.set('osc2Mix', v);
    document.getElementById('v-osc2mix').textContent = Math.round(v*100)+'%';
    drawModCanvas('osc2');
    teach('osc2-mix', v);
  });

  // ─── EQ (3-band) ───
  const fmtDb = v => (v > 0 ? '+' : '') + v + ' dB';
  wire('s-eqlow', v => {
    store.set('eqLow', v);
    document.getElementById('v-eqlow').textContent = fmtDb(v);
    if (engine.eqLow) engine.eqLow.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('eq');
    teach('eq-low', v);
  });
  wire('s-eqmid', v => {
    store.set('eqMid', v);
    document.getElementById('v-eqmid').textContent = fmtDb(v);
    if (engine.eqMid) engine.eqMid.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('eq');
    teach('eq-mid', v);
  });
  wire('s-eqhigh', v => {
    store.set('eqHigh', v);
    document.getElementById('v-eqhigh').textContent = fmtDb(v);
    if (engine.eqHigh) engine.eqHigh.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('eq');
    teach('eq-high', v);
  });

  initSliderEnhancements();
}

export function applyPreset(patch) {
  const setSlider = (id, val) => {
    if (val === undefined) return; // older/factory presets predate this param — leave it as-is
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const setToggle = (groupId, dataAttr, val) => {
    if (val === undefined) return;
    document.querySelectorAll(`#${groupId} .tog-btn`).forEach(b => {
      if (b.dataset[dataAttr] === String(val)) b.click();
    });
  };

  setToggle('wave-btns',    'wave',     patch.waveform);
  setToggle('noise-btns',   'noise',    patch.noiseType);
  setToggle('osc2wave-btns','osc2wave', patch.osc2Waveform);
  setToggle('ftype-btns',   'ftype',    patch.filterType);
  setToggle('lfodest-btns', 'dest',     patch.lfoDest);
  setToggle('lfowave-btns', 'wave',     patch.lfoWaveform);

  if (patch.lfoRetrigger !== undefined) {
    const keySyncBtn = document.getElementById('lfo-keysync');
    if (keySyncBtn && keySyncBtn.classList.contains('active') !== !!patch.lfoRetrigger) keySyncBtn.click();
  }

  setSlider('s-oct',      patch.octave);
  setSlider('s-detune',   patch.detune);
  setSlider('s-noisemix', patch.noiseMix);
  setSlider('s-osc2oct',  patch.osc2Octave);
  setSlider('s-osc2detune', patch.osc2Detune);
  setSlider('s-osc2mix',  patch.osc2Mix);
  setSlider('s-cutoff',   patch.cutoff);
  setSlider('s-res',      patch.resonance);
  setSlider('s-fenv',     patch.filterEnvAmount);
  setSlider('s-atk',      patch.attack);
  setSlider('s-dec',      patch.decay);
  setSlider('s-sus',      patch.sustain);
  setSlider('s-rel',      patch.release);
  setSlider('s-lforate',  patch.lfoRate);
  setSlider('s-lfodepth', patch.lfoDepth);
  setSlider('s-drive',    patch.drive);
  setSlider('s-eqlow',    patch.eqLow);
  setSlider('s-eqmid',    patch.eqMid);
  setSlider('s-eqhigh',   patch.eqHigh);
  setSlider('s-delaytime', patch.delayTime);
  setSlider('s-delayfb',   patch.delayFeedback);
  setSlider('s-delaymix',  patch.delayMix);
  setSlider('s-reverbmix', patch.reverbMix);
  setSlider('s-chorusmix', patch.chorusMix);
  setSlider('master-vol', patch.masterVol);
}

function initSliderEnhancements() {
  document.querySelectorAll('input[type="range"]').forEach(el => {
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const step  = +(el.step || 1);
      const delta = e.deltaY < 0 ? 1 : -1;
      const mult  = e.shiftKey ? 0.1 : (e.ctrlKey || e.metaKey) ? 10 : 1;
      el.value = Math.min(+el.max, Math.max(+el.min, +el.value + delta * step * mult));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, { passive: false });

    el.addEventListener('keydown', (e) => {
      if (!e.shiftKey) return;
      const dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp')   ?  1
                : (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      el.value = Math.min(+el.max, Math.max(+el.min, +el.value + dir * +(el.step || 1) * 0.1));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  wire('s-drive', v => {
    store.set('drive', v);
    document.getElementById('v-drive').textContent = Math.round(v * 100) + '%';
    if (engine.drive) engine.drive.curve = makeDriveCurve(v);
    drawModCanvas('fx');
    teach('fx-drive');
  });

  wire('s-delaytime', v => {
    store.set('delayTime', v);
    document.getElementById('v-delaytime').textContent = Math.round(v * 1000) + ' ms';
    if (engine.delay) engine.delay.delayTime.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('fx');
    teach('fx-delay');
  });

  wire('s-delayfb', v => {
    store.set('delayFeedback', v);
    document.getElementById('v-delayfb').textContent = Math.round(v * 100) + '%';
    if (engine.delayFb) engine.delayFb.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('fx');
    teach('fx-delay');
  });

  wire('s-delaymix', v => {
    store.set('delayMix', v);
    document.getElementById('v-delaymix').textContent = Math.round(v * 100) + '%';
    if (engine.delayWet) engine.delayWet.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('fx');
    teach('fx-delay');
  });

  wire('s-reverbmix', v => {
    store.set('reverbMix', v);
    document.getElementById('v-reverbmix').textContent = Math.round(v * 100) + '%';
    if (engine.reverbWet) engine.reverbWet.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('fx');
    teach('fx-reverb');
  });

  wire('s-chorusmix', v => {
    store.set('chorusMix', v);
    document.getElementById('v-chorusmix').textContent = Math.round(v * 100) + '%';
    if (engine.chorusWet) engine.chorusWet.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
    drawModCanvas('fx'); // no chorus-specific visual yet — just keeps the FX canvas redraw convention
    teach('fx-chorus');
  });
}
