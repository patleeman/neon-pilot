import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/settings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('reads and updates extension settings through the host settings store', async () => {
    const store = {
      read: vi.fn(() => ({ 'caffeinate.autoStart': true })),
      readSchema: vi.fn(() => [{ key: 'caffeinate.autoStart', type: 'boolean' }]),
      update: vi.fn((overrides: Record<string, unknown>) => ({ ...overrides })),
      reset: vi.fn((keys: string[]) => ({ resetKeys: keys })),
    };
    resolver.callServerModuleExport.mockResolvedValue(store);
    const settings = await import('./settings.js');

    await expect(settings.readExtensionSettings()).resolves.toEqual({ 'caffeinate.autoStart': true });
    await expect(settings.readExtensionSettingsSchema()).resolves.toEqual([{ key: 'caffeinate.autoStart', type: 'boolean' }]);
    await expect(settings.updateExtensionSettings({ 'caffeinate.autoStart': false })).resolves.toEqual({
      'caffeinate.autoStart': false,
    });
    await expect(settings.resetExtensionSettings(['caffeinate.autoStart'])).resolves.toEqual({
      resetKeys: ['caffeinate.autoStart'],
    });

    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('../../settings/settingsStore.js', 'createSettingsStore');
    expect(store.read).toHaveBeenCalledOnce();
    expect(store.readSchema).toHaveBeenCalledOnce();
    expect(store.update).toHaveBeenCalledWith({ 'caffeinate.autoStart': false });
    expect(store.reset).toHaveBeenCalledWith(['caffeinate.autoStart']);
  });

  it('uses the worker host capability bridge when available', async () => {
    const bridge = vi.fn(async (_capability: string, operation: string, input?: unknown) => ({ operation, input }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const settings = await import('./settings.js');

    await expect(settings.readExtensionSettings()).resolves.toEqual({ operation: 'read', input: undefined });
    await expect(settings.readExtensionSettingsSchema()).resolves.toEqual({ operation: 'readSchema', input: undefined });
    await expect(settings.updateExtensionSettings({ 'caffeinate.autoStart': false })).resolves.toEqual({
      operation: 'update',
      input: { overrides: { 'caffeinate.autoStart': false } },
    });
    await expect(settings.resetExtensionSettings(['caffeinate.autoStart'])).resolves.toEqual({
      operation: 'reset',
      input: { keys: ['caffeinate.autoStart'] },
    });

    expect(bridge).toHaveBeenNthCalledWith(1, 'settings', 'read');
    expect(bridge).toHaveBeenNthCalledWith(2, 'settings', 'readSchema');
    expect(bridge).toHaveBeenNthCalledWith(3, 'settings', 'update', { overrides: { 'caffeinate.autoStart': false } });
    expect(bridge).toHaveBeenNthCalledWith(4, 'settings', 'reset', { keys: ['caffeinate.autoStart'] });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });
});
