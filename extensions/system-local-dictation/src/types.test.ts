import { describe, expect, it } from 'vitest';

import type {
  DictationSettings,
  TranscriptionFileInput,
  TranscriptionInstallResult,
  TranscriptionModelStatus,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionSegment,
} from './types.js';

describe('local dictation public types', () => {
  it('keeps the settings and transcription result shapes assignable', () => {
    const settings: DictationSettings = { enabled: true, model: 'whisper-tiny' };
    const file: TranscriptionFileInput = { data: Buffer.from('audio'), mimeType: 'audio/wav', fileName: 'sample.wav' };
    const options: TranscriptionOptions = { language: 'en', signal: new AbortController().signal };
    const segment: TranscriptionSegment = { startMs: 0, endMs: 1000, text: 'hello' };
    const result: TranscriptionResult = {
      text: 'hello',
      provider: 'local',
      model: 'whisper-tiny',
      language: 'en',
      durationMs: 1000,
      segments: [segment],
    };
    const install: TranscriptionInstallResult = { provider: 'local', model: 'whisper-tiny', cacheDir: '/cache' };
    const status: TranscriptionModelStatus = {
      provider: 'local',
      model: 'whisper-tiny',
      cacheDir: '/cache',
      installed: true,
      sizeBytes: 123,
    };

    expect({ settings, file, options, result, install, status }).toMatchObject({
      settings: { enabled: true, model: 'whisper-tiny' },
      file: { mimeType: 'audio/wav', fileName: 'sample.wav' },
      result: { text: 'hello', segments: [{ text: 'hello' }] },
      install: { cacheDir: '/cache' },
      status: { installed: true, sizeBytes: 123 },
    });
  });
});
