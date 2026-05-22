import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ importServerModule: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/daemonBridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads the daemon module through the server module resolver', async () => {
    const daemonModule = { pingDaemon: vi.fn() };
    resolver.importServerModule.mockResolvedValueOnce(daemonModule);
    const { loadDaemonModule } = await import('./daemonBridge.js');

    await expect(loadDaemonModule()).resolves.toBe(daemonModule);
    expect(resolver.importServerModule).toHaveBeenCalledWith('@neon-pilot/daemon');
  });

  it('calls named daemon exports with arguments', async () => {
    const startBackgroundRun = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-1' });
    resolver.importServerModule.mockResolvedValueOnce({ startBackgroundRun });
    const { callDaemonExport } = await import('./daemonBridge.js');

    await expect(callDaemonExport('startBackgroundRun', { taskSlug: 'test' })).resolves.toEqual({ accepted: true, runId: 'run-1' });
    expect(startBackgroundRun).toHaveBeenCalledWith({ taskSlug: 'test' });
  });

  it('throws a clear error when the daemon export is unavailable', async () => {
    resolver.importServerModule.mockResolvedValueOnce({});
    const { callDaemonExport } = await import('./daemonBridge.js');

    await expect(callDaemonExport('missingExport')).rejects.toThrow('Daemon export missingExport is unavailable.');
  });
});
