import { describe, expect, it } from 'vitest';

import { convertAudioWithFfmpeg, resolveFfmpegBinary } from './audioConversion.js';

function buildSilentWav(sampleRate = 16_000, samples = 320): Buffer {
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

describe('audio conversion', () => {
  it('decodes normal audio formats through the bundled ffmpeg binary', async () => {
    expect(resolveFfmpegBinary()).toContain('ffmpeg');

    const converted = await convertAudioWithFfmpeg({
      data: buildSilentWav(),
      mimeType: 'audio/wav',
      fileName: 'sample.wav',
    });

    expect(converted.sampleRate).toBe(16_000);
    expect(converted.pcmf32.length).toBeGreaterThan(0);
    expect([...converted.pcmf32].every((sample) => sample === 0)).toBe(true);
  });
});
