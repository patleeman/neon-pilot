import { describe, expect, it } from 'vitest';

import { buildAttachmentAssetDataUrl, buildAttachmentAssetResponse } from './localApiAttachmentAssetResponse';

describe('localApiAttachmentAssetResponse', () => {
  it('builds attachment data URLs', () => {
    expect(buildAttachmentAssetDataUrl({ mimeType: 'image/png', base64Data: 'abc=' })).toBe('data:image/png;base64,abc=');
  });

  it('builds attachment asset responses', () => {
    expect(buildAttachmentAssetResponse({ mimeType: 'text/plain', fileName: 'note.txt', base64Data: 'SGk=' })).toEqual({
      dataUrl: 'data:text/plain;base64,SGk=',
      mimeType: 'text/plain',
      fileName: 'note.txt',
    });
  });
});
