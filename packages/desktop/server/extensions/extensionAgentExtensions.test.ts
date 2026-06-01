import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionProcessTerminationBlockedError } from './extensionProcessGuard.js';

const loadExtensionAgentFactory = vi.fn();
const runExtensionAgentFactory = vi.fn(async (_extensionId: string, _exportName: string, factory: (pi: unknown) => unknown, pi: unknown) => factory(pi));
const listExtensionAgentRegistrations = vi.fn();
const recordExtensionFailure = vi.fn();
const setExtensionEnabled = vi.fn();
const setExtensionHealthError = vi.fn();

vi.mock('./extensionBackend.js', () => ({ loadExtensionAgentFactory, runExtensionAgentFactory }));
vi.mock('./extensionRegistry.js', () => ({
  listExtensionAgentRegistrations,
  recordExtensionFailure,
  setExtensionEnabled,
  setExtensionHealthError,
}));

const { createManifestAgentExtensions } = await import('./extensionAgentExtensions.js');

describe('extensionAgentExtensions', () => {
  beforeEach(() => {
    loadExtensionAgentFactory.mockReset();
    runExtensionAgentFactory.mockReset().mockImplementation(async (_extensionId: string, _exportName: string, factory: (pi: unknown) => unknown, pi: unknown) =>
      factory(pi),
    );
    listExtensionAgentRegistrations.mockReset();
    recordExtensionFailure.mockReset();
    setExtensionEnabled.mockReset();
    setExtensionHealthError.mockReset();
  });

  it('preloads and runs manifest agent factories', async () => {
    const factory = vi.fn();
    listExtensionAgentRegistrations.mockReturnValue([{ extensionId: 'ext', exportName: 'create' }]);
    loadExtensionAgentFactory.mockResolvedValue(factory);

    const result = createManifestAgentExtensions();
    await Promise.resolve();
    await result.factories[0]?.({ registerTool: vi.fn() } as never);

    expect(factory).toHaveBeenCalledOnce();
    expect(runExtensionAgentFactory).toHaveBeenCalledWith('ext', 'create', factory, expect.objectContaining({ registerTool: expect.any(Function) }));
    expect(result.errors).toEqual([]);
  });

  it('falls back to loading inside the returned factory when preload has not finished yet', async () => {
    const factory = vi.fn();
    let resolvePreload!: (value: unknown) => void;
    listExtensionAgentRegistrations.mockReturnValue([{ extensionId: 'ext', exportName: 'create' }]);
    loadExtensionAgentFactory
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePreload = resolve;
        }),
      )
      .mockResolvedValueOnce(factory);

    const result = createManifestAgentExtensions();
    await result.factories[0]?.({} as never);
    resolvePreload(factory);

    expect(loadExtensionAgentFactory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenCalledOnce();
  });

  it('records preload errors and reports them through onError', async () => {
    const onError = vi.fn();
    listExtensionAgentRegistrations.mockReturnValue([{ extensionId: 'ext', exportName: 'missing' }]);
    loadExtensionAgentFactory.mockRejectedValue(new Error('load failed'));

    const result = createManifestAgentExtensions({ onError });
    await vi.waitFor(() => expect(result.errors).toHaveLength(1));

    expect(result.errors).toEqual([{ extensionId: 'ext', message: 'load failed' }]);
    expect(onError).toHaveBeenCalledWith('failed to load extension agent factory', {
      extensionId: 'ext',
      exportName: 'missing',
      message: 'load failed',
    });
  });

  it('records factory execution errors without disabling the extension', async () => {
    const onError = vi.fn();
    listExtensionAgentRegistrations.mockReturnValue([{ extensionId: 'ext', exportName: 'create' }]);
    loadExtensionAgentFactory.mockResolvedValue(() => {
      throw new Error('factory failed');
    });

    const result = createManifestAgentExtensions({ onError });
    await Promise.resolve();
    await result.factories[0]?.({} as never);

    expect(recordExtensionFailure).toHaveBeenCalledWith({
      extensionId: 'ext',
      operation: 'agent extension factory',
      error: 'factory failed',
    });
    expect(setExtensionEnabled).not.toHaveBeenCalled();
    expect(result.errors).toEqual([{ extensionId: 'ext', message: 'factory failed' }]);
  });

  it('quarantines extensions that try to terminate the process from a factory', async () => {
    listExtensionAgentRegistrations.mockReturnValue([{ extensionId: 'ext', exportName: 'create' }]);
    loadExtensionAgentFactory.mockResolvedValue(() => {
      process.exit(1);
    });
    runExtensionAgentFactory.mockRejectedValueOnce(
      new ExtensionProcessTerminationBlockedError({ extensionId: 'ext', operation: 'agent extension factory' }, 'process.exit'),
    );

    const result = createManifestAgentExtensions();
    await Promise.resolve();
    await result.factories[0]?.({} as never);

    expect(setExtensionHealthError).toHaveBeenCalledWith('ext', expect.stringContaining('attempted to terminate the application'));
    expect(setExtensionEnabled).toHaveBeenCalledWith('ext', false);
    expect(recordExtensionFailure).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatchObject({ extensionId: 'ext', message: expect.stringContaining('process.exit') });
  });
});
