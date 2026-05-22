import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ importServerExtensionModule: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/extensions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes runtime extension lifecycle operations to extensionLifecycle', async () => {
    const api = await import('./extensions.js');
    const lifecycle = {
      buildRuntimeExtension: vi.fn().mockResolvedValue({ ok: true, action: 'build' }),
      createRuntimeExtension: vi.fn().mockResolvedValue({ id: 'runtime-extension' }),
      snapshotRuntimeExtension: vi.fn().mockResolvedValue({ files: [] }),
    };
    resolver.importServerExtensionModule.mockResolvedValue(lifecycle);

    await expect(api.buildRuntimeExtension('ext-1')).resolves.toEqual({ ok: true, action: 'build' });
    await expect(api.createRuntimeExtension({ id: 'ext-1' } as never)).resolves.toEqual({ id: 'runtime-extension' });
    await expect(api.snapshotRuntimeExtension('ext-1')).resolves.toEqual({ files: [] });

    expect(resolver.importServerExtensionModule).toHaveBeenCalledWith('../extensionLifecycle.js');
    expect(lifecycle.buildRuntimeExtension).toHaveBeenCalledWith('ext-1');
    expect(lifecycle.createRuntimeExtension).toHaveBeenCalledWith({ id: 'ext-1' });
    expect(lifecycle.snapshotRuntimeExtension).toHaveBeenCalledWith('ext-1');
  });

  it('routes backend reloads, package validation, and install summaries to owning modules', async () => {
    const api = await import('./extensions.js');
    const backend = { reloadExtensionBackend: vi.fn().mockResolvedValue({ reloaded: true }) };
    const doctor = { validateExtensionPackage: vi.fn().mockResolvedValue({ valid: true }) };
    const registry = { listExtensionInstallSummaries: vi.fn().mockResolvedValue([{ id: 'ext-1' }]) };
    resolver.importServerExtensionModule.mockImplementation(async (specifier: string) => {
      if (specifier === '../extensionBackend.js') return backend;
      if (specifier === '../extensionDoctor.js') return doctor;
      if (specifier === '../extensionRegistry.js') return registry;
      throw new Error(`unexpected specifier ${specifier}`);
    });

    await expect(api.reloadExtensionBackend('ext-1')).resolves.toEqual({ reloaded: true });
    await expect(api.validateExtensionPackage({ packagePath: '/tmp/ext' } as never)).resolves.toEqual({ valid: true });
    await expect(api.listExtensionInstallSummaries()).resolves.toEqual([{ id: 'ext-1' }]);

    expect(backend.reloadExtensionBackend).toHaveBeenCalledWith('ext-1');
    expect(doctor.validateExtensionPackage).toHaveBeenCalledWith({ packagePath: '/tmp/ext' });
    expect(registry.listExtensionInstallSummaries).toHaveBeenCalledWith();
  });
});
