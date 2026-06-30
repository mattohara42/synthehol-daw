// Audio export — captures the live output to a downloadable file.
//
// Real-time capture via MediaRecorder on the engine's MediaStream tap
// (engine.streamDest), so the recording is exactly what the speakers play —
// dry signal plus all FX. Container/codec is whatever the browser supports
// (webm/opus on Chromium); a true offline .wav render would require rebuilding
// the graph in an OfflineAudioContext (see F2 in the feature-gap backlog).

import { engine, startAudio } from './audio.js';

let recorder = null;
let chunks = [];
let recording = false;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

export function isRecording() { return recording; }

/** Begin capturing the live output. Returns true if recording started. */
export function startExport() {
  startAudio();                        // ensure the context + stream tap exist
  if (!engine.streamDest || recording || typeof MediaRecorder === 'undefined') return false;
  const mimeType = pickMimeType();
  recorder = new MediaRecorder(engine.streamDest.stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    const type = recorder?.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthehol-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    chunks = [];
  };
  recorder.start();
  recording = true;
  return true;
}

/** Stop capturing; the onstop handler assembles the blob and downloads it. */
export function stopExport() {
  if (!recording || !recorder) return;
  recording = false;
  recorder.stop();
  recorder = null;
}

// Wire the Export button: toggles recording and reflects state on the button.
export function initExport() {
  const btn = document.getElementById('export-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (isRecording()) {
      stopExport();
      btn.textContent = '⏺ Export';
      btn.classList.remove('recording');
    } else if (startExport()) {
      btn.textContent = '⏹ Stop';
      btn.classList.add('recording');
    }
  });
}
