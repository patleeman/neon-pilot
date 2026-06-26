import { describe, expect, it } from 'vitest';

import {
  buildWhisperRequireCandidatePaths,
  formatWhisperSegments,
  resolveCustomHuggingFaceUrl,
  resolveModelDownloadUrl,
  resolveModelFileName,
} from './localWhisperProvider.js';

describe('local whisper provider', () => {
  it('includes the desktop package when resolving whisper-cpp-node from the bundled server module', () => {
    const candidates = buildWhisperRequireCandidatePaths(
      'file:///repo/packages/desktop/server/dist/transcription/transcriptionService.js',
      '/tmp/not-the-repo-root',
    );

    expect(candidates).toContain('/repo/packages/desktop/package.json');
  });

  it('resolves curated and custom Hugging Face model downloads', () => {
    expect(resolveModelFileName('small.en')).toBe('ggml-small.en.bin');
    expect(resolveModelDownloadUrl('small.en')).toBe('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin');

    const custom = 'https://huggingface.co/acme/whisper-models/resolve/main/ggml-custom.bin';
    expect(resolveCustomHuggingFaceUrl(custom)?.toString()).toBe(custom);
    expect(resolveModelFileName(custom)).toBe('ggml-custom.bin');
    expect(resolveModelDownloadUrl(custom)).toBe(custom);
  });

  it('rejects vague or non-Hugging Face custom model URLs', () => {
    expect(resolveCustomHuggingFaceUrl('https://huggingface.co/acme/whisper-models')).toBeNull();
    expect(() => resolveModelFileName('https://huggingface.co/acme/whisper-models')).toThrow(
      'Custom Whisper models must be direct Hugging Face /resolve/ URLs to .bin files.',
    );
    expect(resolveCustomHuggingFaceUrl('https://example.com/ggml-model.bin')).toBeNull();
    expect(() => resolveModelFileName('https://example.com/ggml-model.bin')).toThrow(
      'Custom Whisper models must be direct Hugging Face /resolve/ URLs to .bin files.',
    );
  });

  it('rejects local model names that escape the model cache directory', () => {
    expect(() => resolveModelFileName('../secret')).toThrow('Invalid Whisper model name.');
    expect(() => resolveModelFileName('nested/model')).toThrow('Invalid Whisper model name.');
  });

  it('formats tuple segments returned by whisper-cpp-node', () => {
    expect(
      formatWhisperSegments([
        ['00:00:00.000', '00:00:01.000', ' hello '],
        ['00:00:01.000', '00:00:02.000', 'world'],
      ]),
    ).toBe('hello world');
  });

  it('formats object segments defensively', () => {
    expect(
      formatWhisperSegments([
        { start: '00:00:00.000', end: '00:00:01.000', text: ' hello ' },
        { start: '00:00:01.000', end: '00:00:02.000', text: 'world' },
      ]),
    ).toBe('hello world');
  });
});
