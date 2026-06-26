import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/transcription', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes transcription operations through the host service', async () => {
    const transcription = await import('./transcription.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });

    await transcription.transcribeAudio({ dataBase64: 'AAE=', mimeType: 'audio/ogg' });
    await transcription.installTranscriptionModel({ model: 'base.en' });
    await transcription.readTranscriptionModelStatus({ model: 'small.en' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../transcription/transcriptionService.js', 'transcribeAudio', {
      dataBase64: 'AAE=',
      mimeType: 'audio/ogg',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../transcription/transcriptionService.js',
      'installTranscriptionModel',
      { model: 'base.en' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../transcription/transcriptionService.js',
      'readTranscriptionModelStatus',
      { model: 'small.en' },
    );
  });
});
