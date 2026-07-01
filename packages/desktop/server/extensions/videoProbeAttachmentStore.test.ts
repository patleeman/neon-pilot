import { describe, expect, it } from 'vitest';

import { testExports } from './videoProbeAttachmentStore.js';

describe('videoProbeAttachmentStore', () => {
  it('keeps whole-video sample timestamps before EOF', () => {
    expect(testExports.normalizeFrameTimestamps({ startSec: 0, endSec: 4, count: 5, durationMs: 4000, fps: 24 })).toEqual([
      0, 1, 2, 3, 3.9,
    ]);
    expect(testExports.normalizeFrameTimestamps({ startSec: 4, endSec: 4, count: 1, durationMs: 4000, fps: 24 })).toEqual([3.9]);
  });

  it('rejects frame sample ranges beyond known duration', () => {
    expect(() => testExports.normalizeFrameTimestamps({ startSec: 4.01, endSec: 4.01, count: 1, durationMs: 4000 })).toThrow(
      /startSec exceeds/,
    );
    expect(() => testExports.normalizeFrameTimestamps({ startSec: 0, endSec: 4.01, count: 1, durationMs: 4000 })).toThrow(/endSec exceeds/);
  });

  it('includes registered image ids in frame summaries for follow-up image probing', () => {
    expect(
      testExports.buildFrameSummary(
        {
          id: 'vid_aaaaaaaaaaaa',
          path: '/tmp/video.mp4',
          mimeType: 'video/mp4',
          name: 'video.mp4',
          sizeBytes: 10,
        },
        [{ timestampMs: 2500, sizeBytes: 42, imageId: 'img_bbbbbbbbbbbb' }],
      ),
    ).toContain('image ID img_bbbbbbbbbbbb');
  });
});
