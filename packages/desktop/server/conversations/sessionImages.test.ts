import { describe, expect, it } from 'vitest';

import { buildSessionImageAsset, buildSessionImageAssets, imageMimeType, imageSrc, normalizeBase64ImageData } from './sessionImages';

describe('sessionImages', () => {
  it('normalizes image mime types and base64 data', () => {
    expect(imageMimeType({ mimeType: ' image/png ' })).toBe('image/png');
    expect(imageMimeType({ mediaType: 'text/plain' })).toBeUndefined();
    expect(normalizeBase64ImageData(' aGVsbG8= ')).toBe('aGVsbG8=');
    expect(normalizeBase64ImageData('abcde')).toBeUndefined();
    expect(normalizeBase64ImageData('')).toBeUndefined();
  });

  it('builds data URLs and binary assets', () => {
    const block = { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=', name: ' file.png ' };
    expect(imageSrc(block)).toBe('data:image/png;base64,aGVsbG8=');
    expect(buildSessionImageAsset(block)).toEqual({ mimeType: 'image/png', data: Buffer.from('hello'), fileName: 'file.png' });
    expect(buildSessionImageAsset({ type: 'image', mimeType: 'text/plain', data: 'aGVsbG8=' })).toBeNull();
  });

  it('filters image blocks when building asset lists', () => {
    expect(
      buildSessionImageAssets([
        { type: 'text', data: 'ignored' },
        { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' },
      ]),
    ).toEqual([
      { block: { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' }, asset: { mimeType: 'image/png', data: Buffer.from('hello') } },
    ]);
  });
});
