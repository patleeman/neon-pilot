import { beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  buildRuntimeExtension: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/extensions', () => ({
  buildRuntimeExtension: host.buildRuntimeExtension,
  createRuntimeExtension: vi.fn(),
  deleteRuntimeExtension: vi.fn(),
  installCatalogExtension: vi.fn(),
  installExtensionBundleFromUrl: vi.fn(),
  invalidateExtensionRegistryReadCaches: vi.fn(),
  listExtensionInstallSummaries: vi.fn(),
  listInstallableExtensionCatalog: vi.fn(),
  readExtensionCatalogSources: vi.fn(),
  reloadExtensionBackend: vi.fn(),
  runExtensionSelfTest: vi.fn(),
  snapshotRuntimeExtension: vi.fn(),
  updateCatalogExtension: vi.fn(),
  validateExtensionPackage: vi.fn(),
  writeAdditionalExtensionSearchPaths: vi.fn(),
  writeExtensionCatalogSources: vi.fn(),
}));
vi.mock('@neon-pilot/extensions/host-view-components', () => ({ HOST_VIEW_COMPONENT_DEFINITIONS: [] }));

import { manageExtension } from './backend.js';

describe('extension manager CLI dry runs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not build or invoke extensions during a dry run', async () => {
    const callAction = vi.fn();
    const ctx = { extensions: { callAction } } as never;

    await expect(
      manageExtension({ cli: { command: 'extensions build', args: ['sample'], flags: { 'dry-run': true } } }, ctx),
    ).resolves.toMatchObject({ ok: true, dryRun: true, action: 'build', extensionId: 'sample' });
    await expect(
      manageExtension(
        {
          cli: {
            command: 'extensions invoke',
            args: ['sample', 'refresh'],
            flags: { 'dry-run': true, 'input-json': '{"force":true}' },
          },
        },
        ctx,
      ),
    ).resolves.toMatchObject({ ok: true, dryRun: true, action: 'invoke', extensionId: 'sample', actionId: 'refresh' });

    expect(host.buildRuntimeExtension).not.toHaveBeenCalled();
    expect(callAction).not.toHaveBeenCalled();
  });
});
