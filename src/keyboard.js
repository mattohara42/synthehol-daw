// On-screen piano + computer-keyboard input.

import { S } from './state.js';
import { store } from './store.js';
import { engine, startAudio, voiceNoteOn, voiceNoteOff, applyFilterEnv, releaseFilterEnv, restartLfoOsc } from './audio.js';

// Notes currently held via the keyboard: note name → voice id. The filter
// envelope is a shared, chord-level effect (every voice sums into one filter),
// so it fires once when the first note of a chord starts and releases once
// when the last note lets go — not per individual note. engine.noteOn mirrors
// "at least one key is held", for the boss engine's isPlaying check.
const heldNotes = new Map();

const KEYS = [
  { note:'C',  type:'white', kb:'a' },
  { note:'C#', type:'black', kb:'w' },
  { note:'D',  type:'white', kb:'s' },
  { note:'D#', type:'black', kb:'e' },
  { note:'E',  type:'white', kb:'d' },
  { note:'F',  type:'white', kb:'f' },
  { note:'F#', type:'black', kb:'t' },
  { note:'G',  type:'white', kb:'g' },
  { note:'G#', type:'black', kb:'y' },
  { note:'A',  type:'white', kb:'h' },
  { note:'A#', type:'black', kb:'u' },
  { note:'B',  type:'white', kb:'j' },
  { note:'C5', type:'white', kb:'k' },
];

// White keys are 37px wide + 1px gap = 38px each
// C=0 D=38 E=76 F=114 G=152 A=190 B=228 C5=266  (total 304px for 8 whites)
const BLACK_OFFSETS = { 'C#':25, 'D#':63, 'F#':139, 'G#':177, 'A#':215 };

const keyEls = {}; // note or kb-char → element
const kbMap = {};  // kb-char → note
let hintDismissed = false;

// Pointer position on a key → velocity: pressing lower (toward the front of the
// key) plays louder, like a real keyboard. Maps to a musical 0.55–1.0 range.
function velocityFromPointer(clientY, el) {
  const rect = el.getBoundingClientRect();
  if (!rect.height) return 0.85;
  const rel = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return 0.55 + 0.45 * rel;
}

function dismissHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  document.getElementById('play-hint')?.classList.add('hidden');
}

export function initKeyboard() {
  const keyboardEl = document.getElementById('keyboard');
  let whiteIdx = 0;

  KEYS.forEach(k => {
    const el = document.createElement('div');
    el.className = `key ${k.type}`;
    el.dataset.note = k.note;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${k.note} note (computer key ${k.kb.toUpperCase()})`);

    const lbl = document.createElement('span');
    lbl.textContent = k.kb.toUpperCase();
    el.appendChild(lbl);

    if (k.type === 'white') {
      el.style.left = (whiteIdx * 37) + 'px';
      whiteIdx++;
    } else {
      el.style.left = BLACK_OFFSETS[k.note] + 'px';
    }

    keyboardEl.appendChild(el);
    keyEls[k.note] = el;
    keyEls[k.kb] = el;
    kbMap[k.kb] = k.note;
  });

  keyboardEl.style.width = (whiteIdx * 37 - 1) + 'px'; // 8 white keys

  keyboardEl.querySelectorAll('.key').forEach(el => {
    el.addEventListener('mousedown', e => { e.preventDefault(); pressKey(el.dataset.note, velocityFromPointer(e.clientY, el)); });
    el.addEventListener('mouseup',   () => { if (heldNotes.has(el.dataset.note)) liftKey(el.dataset.note); });
    el.addEventListener('mouseleave',() => { if (heldNotes.has(el.dataset.note)) liftKey(el.dataset.note); });
    el.addEventListener('touchstart', e => { e.preventDefault(); pressKey(el.dataset.note, velocityFromPointer(e.touches[0].clientY, el)); }, { passive: false });
    el.addEventListener('touchend',   () => { if (heldNotes.has(el.dataset.note)) liftKey(el.dataset.note); });
  });

  document.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey) return;
    const ch = e.key.toLowerCase();
    if (ch === 'z') { store.set('octave', Math.max(1, S.octave - 1)); document.getElementById('v-oct').textContent = S.octave; return; }
    if (ch === 'x') { store.set('octave', Math.min(7, S.octave + 1)); document.getElementById('v-oct').textContent = S.octave; return; }
    // Computer keys have no position, so humanize slightly for liveliness.
    if (kbMap[ch]) pressKey(kbMap[ch], 0.8 + Math.random() * 0.2);
  });

  document.addEventListener('keyup', e => {
    const ch = e.key.toLowerCase();
    if (kbMap[ch] && heldNotes.has(kbMap[ch])) liftKey(kbMap[ch]);
  });
}

// Chords: every held note gets its own polyphonic voice (voices.js). The
// filter envelope, LFO key-sync retrigger, and engine.noteOn are chord-level,
// not per-note — they transition only when the FIRST note starts or the LAST
// one lets go (there's one shared filter and one shared LFO oscillator).
function pressKey(note, velocity = 0.85) {
  dismissHint();
  if (heldNotes.has(note)) return;
  startAudio(); // ensure engine.ctx exists before reading currentTime below
  const wasSilent = heldNotes.size === 0;
  const id = voiceNoteOn(note, S.octave, engine.ctx.currentTime, velocity);
  heldNotes.set(note, id);
  keyEls[note]?.classList.add('pressed');
  if (wasSilent) {
    applyFilterEnv(engine.ctx.currentTime);
    if (S.lfoRetrigger) restartLfoOsc(engine.ctx.currentTime);
    engine.noteOn = true;
    engine.currentNote = note;
  }
}

function liftKey(note) {
  const id = heldNotes.get(note);
  if (id == null) return;
  heldNotes.delete(note);
  voiceNoteOff(id, engine.ctx.currentTime);
  keyEls[note]?.classList.remove('pressed');
  if (heldNotes.size === 0) {
    releaseFilterEnv(engine.ctx.currentTime);
    engine.noteOn = false;
    engine.currentNote = null;
  }
}
