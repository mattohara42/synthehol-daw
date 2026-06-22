// Wires every slider and button group to state updates, audio params,
// the module mini-canvas redraw, and the teaching panel.

import { S } from './state.js';
import { engine, applyLFORouting, lfoDepthScaled, applyNoiseType, setNoiseMix } from './audio.js';
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
    teach('osc-wave');
  });

  wireToggleGroup('ftype-btns', b => {
    S.filterType = b.dataset.ftype;
    if (engine.vcf) engine.vcf.type = S.filterType;
    drawModCanvas('filter');
    teach('filter-type');
  });

  wireToggleGroup('lfodest-btns', b => {
    S.lfoDest = b.dataset.dest;
    applyLFORouting();
    updateLFODepthDisplay();
    teach('lfo-dest');
  });

  wire('master-vol', v => {
    S.masterVol = v;
    if (engine.master) engine.master.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
  });

  wire('s-oct', v => {
    S.octave = v;
    document.getElementById('v-oct').textContent = v;
    teach('osc-oct');
  });

  wire('s-detune', v => {
    S.detune = v;
    document.getElementById('v-detune').textContent = v + ' ¢';
    if (engine.osc) engine.osc.detune.value = v;
    teach('osc-detune');
  });

  wire('s-cutoff', v => {
    S.cutoff = v;
    document.getElementById('v-cutoff').textContent = v >= 1000 ? (v/1000).toFixed(1)+' kHz' : Math.round(v)+' Hz';
    if (engine.vcf) engine.vcf.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-cutoff');
  });

  wire('s-res', v => {
    S.resonance = v;
    document.getElementById('v-res').textContent = v.toFixed(1);
    if (engine.vcf) engine.vcf.Q.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    drawModCanvas('filter');
    teach('filter-res');
  });

  wire('s-atk', v => {
    S.attack = v;
    document.getElementById('v-atk').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-atk');
  });

  wire('s-dec', v => {
    S.decay = v;
    document.getElementById('v-dec').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-dec');
  });

  wire('s-sus', v => {
    S.sustain = v;
    document.getElementById('v-sus').textContent = Math.round(v*100)+'%';
    drawModCanvas('adsr');
    teach('adsr-sus');
  });

  wire('s-rel', v => {
    S.release = v;
    document.getElementById('v-rel').textContent = v < 1 ? Math.round(v*1000)+' ms' : v.toFixed(2)+' s';
    drawModCanvas('adsr');
    teach('adsr-rel');
  });

  wire('s-lforate', v => {
    S.lfoRate = v;
    document.getElementById('v-lforate').textContent = v.toFixed(1)+' Hz';
    if (engine.lfoOsc) engine.lfoOsc.frequency.setTargetAtTime(v, engine.ctx.currentTime, 0.01);
    teach('lfo-rate');
  });

  wire('s-lfodepth', v => {
    S.lfoDepth = v;
    updateLFODepthDisplay();
    if (engine.lfoMod) engine.lfoMod.gain.setTargetAtTime(lfoDepthScaled(), engine.ctx.currentTime, 0.01);
    teach('lfo-depth');
  });

  wireToggleGroup('noise-type-btns', b => {
    S.noiseType = b.dataset.ntype;
    applyNoiseType();
    teach('noise-type');
  });

  wire('s-noisemix', v => {
    S.noiseMix = v;
    document.getElementById('v-noisemix').textContent = Math.round(v * 100) + '%';
    setNoiseMix(v);
    teach('noise-mix');
  });
}
