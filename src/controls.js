// Wires every slider and button group to state updates, audio params,
// the module mini-canvas redraw, and the teaching panel.
//
// State writes route through `store.set(...)` (the project store, E1) so they
// are recorded for undo and serialization; reads still use the live `S` object.

import { S } from './state.js';
import { store } from './store.js';
import { engine, applyLFORouting, lfoDepthScaled } from './audio.js';
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
    if (engine.osc) engine.osc.type = S.waveform;
    drawModCanvas('osc');
    teach('osc-wave', S.waveform);
  });

  wireToggleGroup('ftype-btns', b => {
    store.set('filterType', b.dataset.ftype);
    if (engine.vcf) engine.vcf.type = S.filterType;
    drawModCanvas('filter');
    teach('filter-type', S.filterType);
  });

  wireToggleGroup('lfodest-btns', b => {
    store.set('lfoDest', b.dataset.dest);
    applyLFORouting();
    updateLFODepthDisplay();
    teach('lfo-dest', S.lfoDest);
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
    if (engine.osc) engine.osc.detune.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    teach('osc-detune', v);
  });

  wire('s-cutoff', v => {
    store.set('cutoff', v);
    document.getElementById('v-cutoff').textContent = v >= 1000 ? (v/1000).toFixed(1)+' kHz' : Math.round(v)+' Hz';
    if (engine.vcf) engine.vcf.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-cutoff', v);
  });

  wire('s-res', v => {
    store.set('resonance', v);
    document.getElementById('v-res').textContent = v.toFixed(1);
    if (engine.vcf) engine.vcf.Q.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-res', v);
  });

  wire('s-fenv', v => {
    store.set('filterEnvAmount', v);
    document.getElementById('v-fenv').textContent = v === 0 ? 'off' : '+' + v.toFixed(1) + ' oct';
    drawModCanvas('filter');
    teach('filter-env');
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
    if (engine.lfoOsc) engine.lfoOsc.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    teach('lfo-rate', v);
  });

  wire('s-lfodepth', v => {
    store.set('lfoDepth', v);
    updateLFODepthDisplay();
    if (engine.lfoMod) engine.lfoMod.gain.setTargetAtTime(lfoDepthScaled(), engine.ctx.currentTime, 0.01);
    teach('lfo-depth', v);
  });

  initSliderEnhancements();
}

export function applyPreset(patch) {
  const setSlider = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const setToggle = (groupId, dataAttr, val) => {
    document.querySelectorAll(`#${groupId} .tog-btn`).forEach(b => {
      if (b.dataset[dataAttr] === String(val)) b.click();
    });
  };

  setToggle('wave-btns',   'wave',  patch.waveform);
  setToggle('ftype-btns',  'ftype', patch.filterType);
  setToggle('lfodest-btns','dest',  patch.lfoDest);

  setSlider('s-oct',      patch.octave);
  setSlider('s-detune',   patch.detune);
  setSlider('s-cutoff',   patch.cutoff);
  setSlider('s-res',      patch.resonance);
  setSlider('s-atk',      patch.attack);
  setSlider('s-dec',      patch.decay);
  setSlider('s-sus',      patch.sustain);
  setSlider('s-rel',      patch.release);
  setSlider('s-lforate',  patch.lfoRate);
  setSlider('s-lfodepth', patch.lfoDepth);
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
}
