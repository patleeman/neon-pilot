import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsApi = vi.hoisted(() => ({
  readExtensionSettings: vi.fn(),
  readExtensionSettingsSchema: vi.fn(),
  updateExtensionSettings: vi.fn(),
  resetExtensionSettings: vi.fn(),
}));
const cliApi = vi.hoisted(() => ({
  readNeonPilotCliInstallStatus: vi.fn(),
  installNeonPilotUserCli: vi.fn(),
  uninstallNeonPilotUserCli: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/settings', () => settingsApi);
vi.mock('@neon-pilot/extensions/backend/cli', () => cliApi);

import { manageCli, manageSettings } from './backend.js';

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
    settingsApi.resetExtensionSettings.mockResolvedValue({
      'conversation.pinnedToolCalls': true,
      'conversation.transcriptDisclosure': 'auto',
    });
    cliApi.readNeonPilotCliInstallStatus.mockResolvedValue({ globallyInstalled: false, linkPath: '/bin/neon-pilot' });
    cliApi.installNeonPilotUserCli.mockResolvedValue({ globallyInstalled: true, linkPath: '/bin/neon-pilot' });
    cliApi.uninstallNeonPilotUserCli.mockResolvedValue({ globallyInstalled: false, linkPath: '/bin/neon-pilot', removed: true });
  });

  it('lists settings with optional prefix filtering', async () => {
    await expect(manageSettings({ cli: { command: 'settings list', args: ['conversation'] } }, {} as never)).resolves.toMatchObject({
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

    await expect(manageSettings({ cli: { command: 'settings set', args: ['unknown.value', 'true'] } }, {} as never)).rejects.toThrow(
      'Unknown setting: unknown.value',
    );
  });

  it('resets manifest-declared settings through the settings reset API', async () => {
    await expect(
      manageSettings({ cli: { command: 'settings reset', args: ['conversation.transcriptDisclosure'] } }, {} as never),
    ).resolves.toMatchObject({ keys: ['conversation.transcriptDisclosure'] });

    expect(settingsApi.resetExtensionSettings).toHaveBeenCalledWith(['conversation.transcriptDisclosure']);
  });

  it('routes CLI install management through the host CLI backend API', async () => {
    await expect(manageCli({ action: 'status' }, {} as never)).resolves.toMatchObject({ globallyInstalled: false });
    await expect(manageCli({ action: 'install' }, {} as never)).resolves.toMatchObject({ globallyInstalled: true });
    await expect(manageCli({ action: 'uninstall' }, {} as never)).resolves.toMatchObject({ removed: true });

    expect(cliApi.readNeonPilotCliInstallStatus).toHaveBeenCalledOnce();
    expect(cliApi.installNeonPilotUserCli).toHaveBeenCalledOnce();
    expect(cliApi.uninstallNeonPilotUserCli).toHaveBeenCalledOnce();
    await expect(manageCli({ action: 'repair' }, {} as never)).rejects.toThrow('Unsupported CLI action: repair');
  });
});
