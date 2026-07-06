// Mixer view (E4 step 5 / L10 lean slice). A "Mixer" tab in the existing
// #lower-tabs strip (no region system needed — see docs/brainstorms/
// 2026-07-04-mixer-view-requirements.md, which corrects the layout
// backlog's assumption that L10 needs L1/L3 first). One channel strip per
// track (name, pan, fader, mute/solo, a peak meter) plus a master strip
// (meter only — the header's existing master-vol slider stays the sole
// fader for that value, so there's exactly one control per value, not two).
// Gated on graduation, like tracksUI.js's bar and the Practice tab.
//
// Two-tier render, mirroring sequencerUI.js's grid: rebuild the strip DOM
// only when which tracks exist changes (add/remove/undo/redo/load), and
// otherwise just repaint existing controls' values — store.subscribe(render)
// fires on every store change (any knob turn anywhere), and knobs are
// real SVG-skinned elements (knob.js), not cheap <option> tags like
// tracksUI.js's picker, so rebuilding them on an unrelated slider drag
// elsewhere in the rack would be a visible, unnecessary regression.

import { store } from './store.js';
import { progression, STAGE_IDS } from './progression.js';
import { switchTrack } from './tracksUI.js';
import { engine } from './audio.js';
import { peakLevel } from './signalFlow.js';
import { fillSlider } from './ui.js';
import { enhanceKnob } from './knob.js';

let tabEl, viewEl, stripsEl;
let renderedTrackIds = null;
// trackId -> { el, nameBtn, pan, fader, muteBtn, soloBtn, meterFill }; a
// synthetic 'master' entry holds just { meterFill }.
let strips = new Map();
let meterBufs = new Map(); // trackId (or 'master') -> reusable Uint8Array

function trackIdsSignature(tracks) {
  return tracks.map(t => t.id).join(',');
}

function trackIndex(trackId) {
  return store.tracks().findIndex(t => t.id === trackId);
}

function buildChannelStrip(track) {
  const el = document.createElement('div');
  el.className = 'channel-strip';

  const nameBtn = document.createElement('button');
  nameBtn.className = 'channel-name';
  nameBtn.title = 'Switch to this track';
  nameBtn.addEventListener('click', () => switchTrack(track.id));
  el.appendChild(nameBtn);

  const panCtrl = document.createElement('div');
  panCtrl.className = 'ctrl channel-pan-ctrl';
  const pan = document.createElement('input');
  pan.type = 'range';
  pan.min = '-1'; pan.max = '1'; pan.step = '0.01';
  pan.dataset.knob = '';
  pan.title = 'Pan';
  pan.setAttribute('aria-label', `${track.name} pan`);
  pan.addEventListener('input', () => {
    store.setPath(`tracks.${trackIndex(track.id)}.mixer.pan`, +pan.value);
  });
  panCtrl.appendChild(pan);
  el.appendChild(panCtrl);

  const meter = document.createElement('div');
  meter.className = 'channel-meter';
  const meterFill = document.createElement('div');
  meterFill.className = 'channel-meter-fill';
  meter.appendChild(meterFill);
  el.appendChild(meter);

  const fader = document.createElement('input');
  fader.type = 'range';
  fader.className = 'channel-fader';
  fader.min = '0'; fader.max = '1.5'; fader.step = '0.01';
  fader.title = 'Level';
  fader.setAttribute('aria-label', `${track.name} level`);
  fader.addEventListener('input', () => {
    fillSlider(fader);
    store.setPath(`tracks.${trackIndex(track.id)}.mixer.gain`, +fader.value);
  });
  el.appendChild(fader);

  const btnRow = document.createElement('div');
  btnRow.className = 'channel-buttons';
  const muteBtn = document.createElement('button');
  muteBtn.className = 'channel-btn channel-mute-btn';
  muteBtn.textContent = 'M';
  muteBtn.title = 'Mute';
  muteBtn.addEventListener('click', () => {
    const t = store.tracks()[trackIndex(track.id)];
    store.setPath(`tracks.${trackIndex(track.id)}.mixer.mute`, !t.mixer.mute);
  });
  const soloBtn = document.createElement('button');
  soloBtn.className = 'channel-btn channel-solo-btn';
  soloBtn.textContent = 'S';
  soloBtn.title = 'Solo';
  soloBtn.addEventListener('click', () => {
    const t = store.tracks()[trackIndex(track.id)];
    store.setPath(`tracks.${trackIndex(track.id)}.mixer.solo`, !t.mixer.solo);
  });
  btnRow.append(muteBtn, soloBtn);
  el.appendChild(btnRow);

  stripsEl.appendChild(el);
  enhanceKnob(pan); // requires the .ctrl wrapper to already be in the DOM

  return { el, nameBtn, pan, fader, muteBtn, soloBtn, meterFill };
}

function buildMasterStrip() {
  const el = document.createElement('div');
  el.className = 'channel-strip channel-master';
  const label = document.createElement('div');
  label.className = 'channel-name channel-name-static';
  label.textContent = 'Master';
  el.appendChild(label);
  const meter = document.createElement('div');
  meter.className = 'channel-meter';
  const meterFill = document.createElement('div');
  meterFill.className = 'channel-meter-fill';
  meter.appendChild(meterFill);
  el.appendChild(meter);
  stripsEl.appendChild(el);
  return { el, meterFill };
}

function buildStrips(tracks) {
  stripsEl.innerHTML = '';
  strips = new Map();
  for (const track of tracks) strips.set(track.id, buildChannelStrip(track));
  strips.set('master', buildMasterStrip());
}

function paintStrips(tracks) {
  const activeId = store.get().activeTrackId;
  for (const track of tracks) {
    const s = strips.get(track.id);
    if (!s) continue;
    s.el.classList.toggle('active', track.id === activeId);
    s.nameBtn.textContent = track.name;
    if (+s.pan.value !== track.mixer.pan) {
      s.pan.value = String(track.mixer.pan);
      s.pan.dispatchEvent(new Event('input')); // redraws the knob skin (knob.js) — the store write-back is a no-op, same value
    }
    if (+s.fader.value !== track.mixer.gain) {
      s.fader.value = String(track.mixer.gain);
      fillSlider(s.fader);
    }
    s.muteBtn.classList.toggle('active', !!track.mixer.mute);
    s.muteBtn.setAttribute('aria-pressed', String(!!track.mixer.mute));
    s.soloBtn.classList.toggle('active', !!track.mixer.solo);
    s.soloBtn.setAttribute('aria-pressed', String(!!track.mixer.solo));
  }
}

function render() {
  if (!stripsEl) return;
  const tracks = store.tracks();
  const sig = trackIdsSignature(tracks);
  if (sig !== renderedTrackIds) {
    buildStrips(tracks);
    renderedTrackIds = sig;
  }
  paintStrips(tracks);
}

function getBuf(key, size) {
  let buf = meterBufs.get(key);
  if (!buf || buf.length !== size) { buf = new Uint8Array(size); meterBufs.set(key, buf); }
  return buf;
}

function setMeter(fillEl, level) {
  fillEl.style.height = `${Math.round(Math.min(1, level) * 100)}%`;
}

/** Per-frame meter update (main.js's rAF loop, E8) — a no-op unless the Mixer tab is active. */
export function refreshMixerMeters() {
  if (!viewEl || document.body.dataset.stage !== 'mixer' || !engine.ctx) return;
  for (const [key, s] of strips) {
    if (key === 'master') {
      const buf = getBuf('master', engine.scope.frequencyBinCount);
      engine.scope.getByteTimeDomainData(buf);
      setMeter(s.meterFill, peakLevel(buf));
      continue;
    }
    const te = engine.tracks.get(key);
    if (!te) { setMeter(s.meterFill, 0); continue; }
    const buf = getBuf(key, te.tapOut.frequencyBinCount);
    te.tapOut.getByteTimeDomainData(buf);
    setMeter(s.meterFill, peakLevel(buf));
  }
}

export function initMixerUI() {
  tabEl = document.getElementById('tab-mixer');
  viewEl = document.getElementById('view-mixer');
  stripsEl = document.getElementById('mixer-strips');
  if (!stripsEl) return;

  store.subscribe(render);
  render();
}

// Graduation-gated, like revealTracksBar()/revealPracticeTab() — called on
// init and after every restore.
export function revealMixerTab() {
  if (tabEl) tabEl.hidden = progression.defeated.length < STAGE_IDS.length;
}
