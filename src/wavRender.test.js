import { describe, it, expect } from 'vitest';
import { audioBufferToWav } from './wavRender.js';

// A minimal AudioBuffer stand-in — duck-typed, no real Web Audio API needed.
function fakeAudioBuffer(channelsData, sampleRate = 44100) {
  return {
    numberOfChannels: channelsData.length,
    length: channelsData[0].length,
    sampleRate,
    getChannelData: (ch) => channelsData[ch],
  };
}

// Parse a .wav Blob back out for assertions (Node/vitest Blob supports arrayBuffer()).
async function parseWav(blob) {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const readStr = (offset, len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
    return s;
  };
  return {
    riff: readStr(0, 4),
    wave: readStr(8, 4),
    fmtId: readStr(12, 4),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataId: readStr(36, 4),
    dataSize: view.getUint32(40, true),
    samples: (count) => {
      const out = [];
      for (let i = 0; i < count; i++) out.push(view.getInt16(44 + i * 2, true));
      return out;
    },
  };
}

describe('wavRender – audioBufferToWav', () => {
  it('writes a valid RIFF/WAVE/PCM header matching the buffer', async () => {
    const buffer = fakeAudioBuffer([new Float32Array([0, 0.5, -0.5]), new Float32Array([0, 0.5, -0.5])], 48000);
    const wav = await parseWav(audioBufferToWav(buffer));
    expect(wav.riff).toBe('RIFF');
    expect(wav.wave).toBe('WAVE');
    expect(wav.fmtId).toBe('fmt ');
    expect(wav.audioFormat).toBe(1); // PCM
    expect(wav.numChannels).toBe(2);
    expect(wav.sampleRate).toBe(48000);
    expect(wav.bitsPerSample).toBe(16);
    expect(wav.dataId).toBe('data');
    expect(wav.dataSize).toBe(3 * 2 * 2); // 3 frames * 2 channels * 2 bytes
  });

  it('interleaves channels and converts float samples to 16-bit PCM', async () => {
    const left = new Float32Array([1, -1, 0]);
    const right = new Float32Array([0.5, -0.5, 0]);
    const buffer = fakeAudioBuffer([left, right]);
    const wav = await parseWav(audioBufferToWav(buffer));
    const samples = wav.samples(6); // 3 frames * 2 channels, interleaved L/R
    expect(samples[0]).toBe(0x7fff);   // left[0] = 1.0 → max positive int16
    expect(samples[1]).toBeCloseTo(0x4000, -1); // right[0] = 0.5
    expect(samples[2]).toBe(-0x8000);  // left[1] = -1.0 → max negative int16
    expect(samples[4]).toBe(0);        // left[2] = 0
    expect(samples[5]).toBe(0);        // right[2] = 0
  });

  it('clamps out-of-range samples instead of wrapping', async () => {
    const buffer = fakeAudioBuffer([new Float32Array([2.5, -3.0])]);
    const wav = await parseWav(audioBufferToWav(buffer));
    const samples = wav.samples(2);
    expect(samples[0]).toBe(0x7fff);
    expect(samples[1]).toBe(-0x8000);
  });

  it('handles mono buffers', async () => {
    const buffer = fakeAudioBuffer([new Float32Array([0, 0, 0, 0])]);
    const wav = await parseWav(audioBufferToWav(buffer));
    expect(wav.numChannels).toBe(1);
    expect(wav.dataSize).toBe(4 * 1 * 2);
  });
});
