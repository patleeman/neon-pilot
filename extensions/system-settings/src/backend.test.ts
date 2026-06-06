import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsApi = vi.hoisted(() => ({
  readExtensionSettings: vi.fn(),
  readExtensionSettingsSchema: vi.fn(),
  updateExtensionSettings: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/settings', () => settingsApi);

import { manageSettings } from './backend.js';

const schema = [
  {
    key: 'conversation.pinnedToolCalls',
    type: 'boolean',
    default: true,
    description: 'Show pinned tool calls.',
  },
  {
    key: 'conversation.transcriptDisclosure',
    type: 'select',
    default: 'auto',
    enum: ['auto', 'expanded'],
  },
];

describe('system-settings backend CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsApi.readExtensionSettings.mockResolvedValue({
      'conversation.pinnedToolCalls': true,
      'conversation.transcriptDisclosure': 'auto',
      'other.value': 1,
    });
    settingsApi.readExtensionSettingsSchema.mockResolvedValue(schema);
    settingsApi.updateExtensionSettings.mockResolvedValue({
      'conversation.pinnedToolCalls': false,
      'conversation.transcriptDisclosure': 'auto',
    });
  });

  it('lists settings with optional prefix filtering', async () => {
    await expect(
      manageSettings({ cli: { command: 'settings list', args: ['conversation'] } }, {} as never),
    ).resolves.toMatchObject({
      settings: {
        'conversation.pinnedToolCalls': true,
        'conversation.transcriptDisclosure': 'auto',
      },
      text: expect.stringContaining('conversation.pinnedToolCalls=true'),
    });
  });

  it('returns schema and individual values', async () => {
    await expect(manageSettings({ cli: { command: 'settings schema', args: [] } }, {} as never)).resolves.toMatchObject({ schema });
    await expect(
      manageSettings({ cli: { command: 'settings get', args: ['conversation.transcriptDisclosure'] } }, {} as never),
    ).resolves.toMatchObject({ key: 'conversation.transcriptDisclosure', value: 'auto' });
  });

  it('updates only manifest-declared settings and parses JSON values', async () => {
    await expect(
      manageSettings({ cli: { command: 'settings set', args: ['conversation.pinnedToolCalls', 'false'] } }, {} as never),
    ).resolves.toMatchObject({ key: 'conversation.pinnedToolCalls', value: false });
    expect(settingsApi.updateExtensionSettings).toHaveBeenCalledWith({ 'conversation.pinnedToolCalls': false });

    await expect(
      manageSettings({ cli: { command: 'settings set', args: ['unknown.value', 'true'] } }, {} as never),
    ).rejects.toThrow('Unknown setting: unknown.value');
  });
});
