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
});
