import { describe, expect, it } from 'vitest';

import { buildSessionBlockImagePath, buildSessionUserImagePath, decorateSessionAssetUrls } from './sessionAssetUrls';

describe('sessionAssetUrls', () => {
  it('builds encoded session image paths', () => {
    expect(buildSessionUserImagePath('session/id', 'block id', 2)).toBe('/api/sessions/session%2Fid/blocks/block%20id/images/2');
    expect(buildSessionBlockImagePath('session/id', 'block id')).toBe('/api/sessions/session%2Fid/blocks/block%20id/image');
  });

  it('decorates user and block images while leaving other blocks unchanged', () => {
    const blocks = [
      { type: 'user', id: 'u1', ts: 't', text: 'hello', images: [{ mimeType: 'image/png' }, { src: 'old' }] },
      { type: 'image', id: 'i1', ts: 't', alt: 'image' },
      { type: 'text', id: 'x1', ts: 't', text: 'plain' },
    ];

    expect(decorateSessionAssetUrls(blocks, 's1')).toEqual([
      {
        type: 'user',
        id: 'u1',
        ts: 't',
        text: 'hello',
        images: [{ mimeType: 'image/png', src: '/api/sessions/s1/blocks/u1/images/0' }, { src: '/api/sessions/s1/blocks/u1/images/1' }],
      },
      { type: 'image', id: 'i1', ts: 't', alt: 'image', src: '/api/sessions/s1/blocks/i1/image' },
      { type: 'text', id: 'x1', ts: 't', text: 'plain' },
    ]);
  });
});
