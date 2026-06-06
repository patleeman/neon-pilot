import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/cli', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
