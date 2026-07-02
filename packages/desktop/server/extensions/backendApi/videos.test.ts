import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/videos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes video media operations through the video attachment store', async () => {
    const videos = await import('./videos.js');
    resolver.callServerModuleExport.mockResolvedValue([]);

    await videos.clearVideoProbeAttachmentCacheForTests();
    await videos.getVideoProbeAttachments('session-1');
    await videos.getVideoProbeAttachmentsById('session-1', ['vid_aaaaaaaaaaaa']);
    await videos.getVideoProbeAttachmentsByIdFromAnySession(['vid_aaaaaaaaaaaa']);
    await videos.rememberVideoProbeAttachments('session-1', []);
    await videos.extractVideoFrame({ videoId: 'vid_aaaaaaaaaaaa', timeSec: 0 });
    await videos.sampleVideoFrames({ videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 1, count: 1 });
    await videos.transcribeVideo({ videoId: 'vid_aaaaaaaaaaaa' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../extensions/videoProbeAttachmentStore.js',
      'clearVideoProbeAttachmentCacheForTests',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../extensions/videoProbeAttachmentStore.js',
      'getVideoProbeAttachments',
      'session-1',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../extensions/videoProbeAttachmentStore.js',
      'getVideoProbeAttachmentsById',
      'session-1',
      ['vid_aaaaaaaaaaaa'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../extensions/videoProbeAttachmentStore.js',
      'getVideoProbeAttachmentsByIdFromAnySession',
      ['vid_aaaaaaaaaaaa'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      5,
      '../../extensions/videoProbeAttachmentStore.js',
      'rememberVideoProbeAttachments',
      'session-1',
      [],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      6,
      '../../extensions/videoProbeAttachmentStore.js',
      'extractVideoFrame',
      { videoId: 'vid_aaaaaaaaaaaa', timeSec: 0 },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      7,
      '../../extensions/videoProbeAttachmentStore.js',
      'sampleVideoFrames',
      { videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 1, count: 1 },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(8, '../../extensions/videoProbeAttachmentStore.js', 'transcribeVideo', {
      videoId: 'vid_aaaaaaaaaaaa',
    });
  });
});
