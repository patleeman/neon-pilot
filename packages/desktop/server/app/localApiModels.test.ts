import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  modelPreferencesImportedMock,
  providerDesktopCapabilityImportedMock,
  prewarmModelDefinitionsMock,
  readSavedModelRefMock,
  readModelStateMock,
} = vi.hoisted(() => ({
  modelPreferencesImportedMock: vi.fn(),
  providerDesktopCapabilityImportedMock: vi.fn(),
  prewarmModelDefinitionsMock: vi.fn(),
  readSavedModelRefMock: vi.fn(),
  readModelStateMock: vi.fn(),
}));

vi.mock('../models/modelPreferences.js', () => {
  modelPreferencesImportedMock();
  return {
    prewarmModelDefinitions: prewarmModelDefinitionsMock,
    readSavedModelRef: readSavedModelRefMock,
    readModelState: readModelStateMock,
  };
});

vi.mock('../models/modelState.js', () => ({}));

vi.mock('../models/providerAuth.js', () => ({}));

vi.mock('../models/providerDesktopCapability.js', () => {
  providerDesktopCapabilityImportedMock();
  return {};
});

describe('localApi model provider loading', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('keeps provider-management modules lazy when read-only model APIs are used', async () => {
    vi.useFakeTimers();
    readModelStateMock.mockResolvedValue({ models: [{ id: 'gpt-test' }] });

    const { readDesktopModels } = await import('./localApi.js');

    expect(providerDesktopCapabilityImportedMock).not.toHaveBeenCalled();

    await expect(readDesktopModels()).resolves.toEqual({ models: [{ id: 'gpt-test' }] });

    expect(modelPreferencesImportedMock).toHaveBeenCalledTimes(1);
    expect(providerDesktopCapabilityImportedMock).not.toHaveBeenCalled();
    expect(prewarmModelDefinitionsMock).not.toHaveBeenCalled();
  });
});
