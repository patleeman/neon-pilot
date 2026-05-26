import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/settings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reads and updates extension settings through the host settings store', async () => {
    const store = {
      read: vi.fn(() => ({ 'caffeinate.autoStart': true })),
      readSchema: vi.fn(() => [{ key: 'caffeinate.autoStart', type: 'boolean' }]),
      update: vi.fn((overrides: Record<string, unknown>) => ({ ...overrides })),
    };
    resolver.callServerModuleExport.mockResolvedValue(store);
    const settings = await import('./settings.js');

    await expect(settings.readExtensionSettings()).resolves.toEqual({ 'caffeinate.autoStart': true });
    await expect(settings.readExtensionSettingsSchema()).resolves.toEqual([{ key: 'caffeinate.autoStart', type: 'boolean' }]);
    await expect(settings.updateExtensionSettings({ 'caffeinate.autoStart': false })).resolves.toEqual({
      'caffeinate.autoStart': false,
    });

    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('../../settings/settingsStore.js', 'createSettingsStore');
    expect(store.read).toHaveBeenCalledOnce();
    expect(store.readSchema).toHaveBeenCalledOnce();
    expect(store.update).toHaveBeenCalledWith({ 'caffeinate.autoStart': false });
  });
});
