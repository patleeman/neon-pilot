import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildDictationSettingsState = vi.fn();
const readDictationSettings = vi.fn();
const writeDictationSettings = vi.fn();
const getModelStatus = vi.fn();
const installModel = vi.fn();
const transcribeFileProvider = vi.fn();
const providerConstructor = vi.fn();

vi.mock('./settings.js', () => ({ buildDictationSettingsState, readDictationSettings, writeDictationSettings }));
vi.mock('./localWhisperProvider.js', () => ({
  LocalWhisperTranscriptionProvider: vi.fn().mockImplementation(function LocalWhisperTranscriptionProvider(options) {
    providerConstructor(options);
    return { getModelStatus, installModel, transcribeFile: transcribeFileProvider };
  }),
}));

const { installModel: installModelAction, modelStatus, readSettings, transcribeFile, updateSettings } = await import('./backend.js');

describe('local dictation backend', () => {
  const ctx = { runtimeDir: '/runtime', runtimeSettingsFilePath: '/runtime-settings.json' } as never;

  beforeEach(() => {
    buildDictationSettingsState.mockReset().mockReturnValue({ settings: { enabled: false, model: 'base.en' } });
    readDictationSettings.mockReset().mockReturnValue({ enabled: true, model: 'base.en' });
    writeDictationSettings.mockReset();
    getModelStatus.mockReset().mockResolvedValue({ installed: true });
    installModel.mockReset().mockResolvedValue({ installed: true });
    transcribeFileProvider.mockReset().mockResolvedValue({ text: 'hello' });
    providerConstructor.mockReset();
  });

  it('reads settings from the runtime settings file', async () => {
    await expect(readSettings({}, ctx)).resolves.toEqual({ settings: { enabled: false, model: 'base.en' } });

    expect(buildDictationSettingsState).toHaveBeenCalledWith('/runtime/settings.json');
  });

  it('validates and persists settings to runtime settings then runtime-local settings', async () => {
    await updateSettings({ enabled: true, model: ' tiny.en ' }, ctx);

    expect(writeDictationSettings).toHaveBeenNthCalledWith(1, '/runtime-settings.json', { enabled: true, model: 'tiny.en' });
    expect(writeDictationSettings).toHaveBeenNthCalledWith(2, '/runtime/settings.json', { enabled: true, model: 'tiny.en' });
    expect(buildDictationSettingsState).toHaveBeenCalledWith('/runtime/settings.json');

    await expect(updateSettings({ enabled: 'yes' }, ctx)).rejects.toThrow('enabled must be a boolean');
    await expect(updateSettings({ model: '   ' }, ctx)).rejects.toThrow('model must be a non-empty string');
  });

  it('uses requested or configured models for status and install operations', async () => {
    await expect(modelStatus({ model: ' tiny ' }, ctx)).resolves.toEqual({ installed: true });
    expect(providerConstructor).toHaveBeenLastCalledWith({ model: 'tiny', modelRootPath: '/runtime/transcription-models' });

    await expect(installModelAction({}, ctx)).resolves.toEqual({ installed: true });
    expect(providerConstructor).toHaveBeenLastCalledWith({ model: 'base.en', modelRootPath: '/runtime/transcription-models' });
  });

  it('transcribes base64 audio when dictation is enabled', async () => {
    await expect(
      transcribeFile(
        { dataBase64: Buffer.from('audio').toString('base64'), mimeType: ' audio/wav ', fileName: ' clip.wav ', language: ' en ' },
        ctx,
      ),
    ).resolves.toEqual({ text: 'hello' });

    expect(transcribeFileProvider).toHaveBeenCalledWith(
      { data: Buffer.from('audio'), mimeType: 'audio/wav', fileName: 'clip.wav' },
      { language: 'en' },
    );
  });

  it('rejects transcription when disabled or base64 input is invalid', async () => {
    readDictationSettings.mockReturnValue({ enabled: false, model: 'base.en' });
    await expect(transcribeFile({ dataBase64: 'YQ==' }, ctx)).rejects.toThrow('Enable dictation');

    readDictationSettings.mockReturnValue({ enabled: true, model: 'base.en' });
    await expect(transcribeFile({ dataBase64: '' }, ctx)).rejects.toThrow('dataBase64 is required');
    await expect(transcribeFile({ dataBase64: 'abcde' }, ctx)).rejects.toThrow('valid base64');
  });
});
