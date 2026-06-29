// Wires every slider and button group to state updates, audio params,
// the module mini-canvas redraw, and the teaching panel.

import { S } from './state.js';
import { engine, applyLFORouting, lfoDepthScaled } from './audio.js';
import { fillSlider } from './ui.js';
import { drawModCanvas } from './canvas.js';
import { teach } from './teaching.js';
import { bossEngine } from './bossEngine.js';

function wire(id, handler) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    fillSlider(el);
    handler(+el.value);
    bossEngine.notify({ S, isPlaying: engine.noteOn });
  });
  fillSlider(el);
}

function wireToggleGroup(groupId, onSelect) {
  document.querySelectorAll(`#${groupId} .tog-btn`).forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll(`#${groupId} .tog-btn`).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onSelect(b);
      bossEngine.notify({ S, isPlaying: engine.noteOn });
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
    S.waveform = b.dataset.wave;
    if (engine.osc) engine.osc.type = S.waveform;
    drawModCanvas('osc');
    teach('osc-wave', S.waveform);
  });

  wireToggleGroup('ftype-btns', b => {
    S.filterType = b.dataset.ftype;
    if (engine.vcf) engine.vcf.type = S.filterType;
    drawModCanvas('filter');
    teach('filter-type', S.filterType);
  });

  wireToggleGroup('lfodest-btns', b => {
    S.lfoDest = b.dataset.dest;
    applyLFORouting();
    updateLFODepthDisplay();
    teach('lfo-dest', S.lfoDest);
  });

  wire('master-vol', v => {
    S.masterVol = v;
    if (engine.master) engine.master.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
  });

  wire('s-oct', v => {
    S.octave = v;
    document.getElementById('v-oct').textContent = v;
    teach('osc-oct', v);
  });

  wire('s-detune', v => {
    S.detune = v;
    document.getElementById('v-detune').textContent = v + ' ¢';
    if (engine.osc) engine.osc.detune.value = v;
    teach('osc-detune', v);
  });

  wire('s-cutoff', v => {
    S.cutoff = v;
    document.getElementById('v-cutoff').textContent = v >= 1000 ? (v/1000).toFixed(1)+' kHz' : Math.round(v)+' Hz';
    if (engine.vcf) engine.vcf.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-cutoff', v);
  });

  wire('s-res', v => {
    S.resonance = v;
    document.getElementById('v-res').textContent = v.toFixed(1);
    if (engine.vcf) engine.vcf.Q.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-res', v);
  });

  wire('s-atk', v => {
    S.attack = v;
    document.getElementById('v-atk').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-atk', v);
  });

  wire('s-dec', v => {
    S.decay = v;
    document.getElementById('v-dec').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-dec', v);
  });

  wire('s-sus', v => {
    S.sustain = v;
    document.getElementById('v-sus').textContent = Math.round(v*100)+'%';
    drawModCanvas('adsr');
    teach('adsr-sus', v);
  });

  wire('s-rel', v => {
    S.release = v;
    document.getElementById('v-rel').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-rel', v);
  });

  wire('s-lforate', v => {
    S.lfoRate = v;
    document.getElementById('v-lforate').textContent = v.toFixed(1)+' Hz';
    if (engine.lfoOsc) engine.lfoOsc.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    teach('lfo-rate', v);
  });

  wire('s-lfodepth', v => {
    S.lfoDepth = v;
    updateLFODepthDisplay();
    if (engine.lfoMod) engine.lfoMod.gain.setTargetAtTime(lfoDepthScaled(), engine.ctx.currentTime, 0.01);
    teach('lfo-depth', v);
  });

  initSliderEnhancements();
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
}
