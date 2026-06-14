import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/cli', () => {
  const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;
  const originalResourcesPath = process.resourcesPath;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEON_PILOT_REPO_ROOT;
    Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
  });

  afterEach(() => {
    if (originalRepoRoot === undefined) delete process.env.NEON_PILOT_REPO_ROOT;
    else process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
    Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
  });

  it('delegates CLI install operations through the host CLI environment module', async () => {
    resolver.callServerModuleExport.mockResolvedValue({ globallyInstalled: false, linkPath: '/bin/neon-pilot' });
    const cli = await import('./cli.js');

    await expect(cli.readNeonPilotCliInstallStatus()).resolves.toMatchObject({ globallyInstalled: false });
    await expect(cli.installNeonPilotUserCli()).resolves.toMatchObject({ globallyInstalled: false });
    await expect(cli.uninstallNeonPilotUserCli()).resolves.toMatchObject({ globallyInstalled: false });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../cliEnvironment.js',
      'readNeonPilotCliInstallStatus',
      expect.objectContaining({ repoRoot: expect.any(String) }),
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../cliEnvironment.js',
      'installNeonPilotUserCli',
      expect.objectContaining({ repoRoot: expect.any(String) }),
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../cliEnvironment.js',
      'uninstallNeonPilotUserCli',
      expect.objectContaining({ repoRoot: expect.any(String) }),
    );
  });

  it('prefers packaged resourcesPath when repo root env is unavailable', async () => {
    resolver.callServerModuleExport.mockResolvedValue({ globallyInstalled: false, linkPath: '/bin/neon-pilot' });
    Object.defineProperty(process, 'resourcesPath', { value: '/Applications/Neon Pilot.app/Contents/Resources', configurable: true });

    const cli = await import('./cli.js');
    await cli.readNeonPilotCliInstallStatus();

    expect(resolver.callServerModuleExport).toHaveBeenCalledWith(
      '../../cliEnvironment.js',
      'readNeonPilotCliInstallStatus',
      expect.objectContaining({ repoRoot: '/Applications/Neon Pilot.app/Contents/Resources' }),
    );
  });
});
