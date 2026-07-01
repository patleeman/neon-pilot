import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildDictationSettingsState = vi.fn();
const readDictationSettings = vi.fn();
const writeDictationSettings = vi.fn();
const readTranscriptionModelStatus = vi.fn();
const readTranscriptionRuntimeStatus = vi.fn();
const installTranscriptionModel = vi.fn();
const transcribeAudio = vi.fn();

vi.mock('./settings.js', () => ({ buildDictationSettingsState, readDictationSettings, writeDictationSettings }));
vi.mock('@neon-pilot/extensions/backend/transcription', () => ({
  installTranscriptionModel,
  readTranscriptionModelStatus,
  readTranscriptionRuntimeStatus,
  transcribeAudio,
}));

const {
  installModel: installModelAction,
  dictationModelSetupStatus,
  modelStatus,
  readSettings,
  runtimeStatus,
  transcribeFile,
  updateSettings,
} = await import('./backend.js');

describe('local dictation backend', () => {
  const ctx = { runtimeDir: '/runtime', runtimeSettingsFilePath: '/runtime-settings.json' } as never;

  beforeEach(() => {
    buildDictationSettingsState.mockReset().mockReturnValue({ settings: { model: 'base.en' } });
    readDictationSettings.mockReset().mockReturnValue({ model: 'base.en' });
    writeDictationSettings.mockReset();
    readTranscriptionModelStatus.mockReset().mockResolvedValue({ installed: true });
    readTranscriptionRuntimeStatus.mockReset().mockResolvedValue({ available: true });
    installTranscriptionModel.mockReset().mockResolvedValue({ installed: true });
    transcribeAudio.mockReset().mockResolvedValue({ text: 'hello' });
  });

  it('reads settings from the runtime settings file', async () => {
    await expect(readSettings({}, ctx)).resolves.toEqual({ settings: { model: 'base.en' } });

    expect(buildDictationSettingsState).toHaveBeenCalledWith('/runtime/settings.json');
  });

  it('validates and persists settings to runtime settings then runtime-local settings', async () => {
    await updateSettings({ model: ' tiny.en ' }, ctx);

    expect(writeDictationSettings).toHaveBeenNthCalledWith(1, '/runtime-settings.json', { model: 'tiny.en' });
    expect(writeDictationSettings).toHaveBeenNthCalledWith(2, '/runtime/settings.json', { model: 'tiny.en' });
    expect(buildDictationSettingsState).toHaveBeenCalledWith('/runtime/settings.json');

    await expect(updateSettings({ model: '   ' }, ctx)).rejects.toThrow('model must be a non-empty string');
  });

  it('uses requested or configured models for status and install operations', async () => {
    await expect(modelStatus({ model: ' tiny ' }, ctx)).resolves.toEqual({ installed: true });
    expect(readTranscriptionModelStatus).toHaveBeenLastCalledWith({ model: 'tiny' });

    await expect(installModelAction({}, ctx)).resolves.toEqual({ installed: true });
    expect(installTranscriptionModel).toHaveBeenLastCalledWith({ model: 'base.en' });
  });

  it('reports dictation model setup readiness', async () => {
    readTranscriptionModelStatus.mockResolvedValueOnce({
      provider: 'local-whisper',
      model: 'base.en',
      cacheDir: '/models',
      installed: false,
      runtime: { provider: 'local-whisper', available: true, dependencies: [] },
    });

    await expect(dictationModelSetupStatus({}, ctx)).resolves.toMatchObject({
      status: 'needs_setup',
      actions: ['install'],
      detail: expect.stringContaining('base.en dictation model is not installed'),
    });

    readTranscriptionModelStatus.mockResolvedValueOnce({
      provider: 'local-whisper',
      model: 'base.en',
      cacheDir: '/models',
      installed: true,
      runtime: {
        provider: 'local-whisper',
        available: false,
        dependencies: [{ id: 'whisper', label: 'Whisper runtime', available: false, error: 'missing native binding' }],
      },
    });

    await expect(dictationModelSetupStatus({}, ctx)).resolves.toMatchObject({
      status: 'blocked',
      actions: [],
      detail: expect.stringContaining('local Whisper runtime is not available'),
    });
  });

  it('reports host transcription runtime status', async () => {
    await expect(runtimeStatus()).resolves.toEqual({ available: true });

    expect(readTranscriptionRuntimeStatus).toHaveBeenCalledWith();
  });

  it('transcribes base64 audio', async () => {
    await expect(
      transcribeFile(
        { dataBase64: Buffer.from('audio').toString('base64'), mimeType: ' audio/wav ', fileName: ' clip.wav ', language: ' en ' },
        ctx,
      ),
    ).resolves.toEqual({ text: 'hello' });

    expect(transcribeAudio).toHaveBeenCalledWith({
      dataBase64: Buffer.from('audio').toString('base64'),
      mimeType: 'audio/wav',
      fileName: 'clip.wav',
      language: 'en',
      model: 'base.en',
    });
  });

  it('rejects invalid base64 input', async () => {
    await expect(transcribeFile({ dataBase64: '' }, ctx)).rejects.toThrow('dataBase64 is required');
    await expect(transcribeFile({ dataBase64: 'abcde' }, ctx)).rejects.toThrow('valid base64');
  });
});
