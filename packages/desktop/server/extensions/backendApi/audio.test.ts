import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes audio probe attachment operations through the audio probe store', async () => {
    const audio = await import('./audio.js');
    resolver.callServerModuleExport.mockResolvedValue([]);

    await audio.clearAudioProbeAttachmentCacheForTests();
    await audio.getAudioProbeAttachments('session-1');
    await audio.getAudioProbeAttachmentsById('session-1', ['aud_123456789abc']);
    await audio.getAudioProbeAttachmentsByIdFromAnySession(['aud_123456789abc']);
    await audio.rememberAudioProbeAttachments('session-1', []);
    await audio.transcribeAudioAttachment({ audioId: 'aud_123456789abc' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../extensions/audioProbeAttachmentStore.js',
      'clearAudioProbeAttachmentCacheForTests',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../extensions/audioProbeAttachmentStore.js',
      'getAudioProbeAttachments',
      'session-1',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../extensions/audioProbeAttachmentStore.js',
      'getAudioProbeAttachmentsById',
      'session-1',
      ['aud_123456789abc'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../extensions/audioProbeAttachmentStore.js',
      'getAudioProbeAttachmentsByIdFromAnySession',
      ['aud_123456789abc'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      5,
      '../../extensions/audioProbeAttachmentStore.js',
      'rememberAudioProbeAttachments',
      'session-1',
      [],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      6,
      '../../extensions/audioProbeAttachmentStore.js',
      'transcribeAudioAttachment',
      { audioId: 'aud_123456789abc' },
    );
  });
});
