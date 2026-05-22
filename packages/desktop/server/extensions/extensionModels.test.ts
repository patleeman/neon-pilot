import { beforeEach, describe, expect, it, vi } from 'vitest';

const readModelState = vi.fn();
const getPiAgentRuntimeDir = vi.fn();

vi.mock('../models/modelState.js', () => ({ readModelState }));
vi.mock('@neon-pilot/core', () => ({ getPiAgentRuntimeDir }));

const { createExtensionModelsCapability } = await import('./extensionModels.js');

describe('extensionModels', () => {
  beforeEach(() => {
    readModelState.mockReset();
    getPiAgentRuntimeDir.mockReset().mockReturnValue('/runtime/pi-agent');
  });

  it('lists normalized model capabilities from the runtime settings file', async () => {
    readModelState.mockResolvedValue({
      models: [
        { id: 'm1', name: 'Model One', provider: 'provider', contextWindow: 123, reasoning: true, input: ['text', 'image'] },
        { id: 'm2' },
      ],
    });

    await expect(createExtensionModelsCapability().list()).resolves.toEqual([
      { id: 'm1', name: 'Model One', provider: 'provider', contextWindow: 123, reasoning: true, input: ['text', 'image'] },
      { id: 'm2', name: 'm2', provider: '', contextWindow: 0, reasoning: false, input: ['text'] },
    ]);
    expect(readModelState).toHaveBeenCalledWith('/runtime/pi-agent/settings.json');
  });

  it('returns an empty list when model state loading fails', async () => {
    readModelState.mockRejectedValue(new Error('no models'));

    await expect(createExtensionModelsCapability().list()).resolves.toEqual([]);
  });
});
