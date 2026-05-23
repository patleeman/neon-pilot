import { describe, expect, it } from 'vitest';

import { buildExtensionRuntimeProviderRegistrations } from './extensionRuntimeProviderRegistrations';

describe('extensionRuntimeProviderRegistrations', () => {
  it('builds runtime providers with trimmed required fields and optional description', () => {
    expect(
      buildExtensionRuntimeProviderRegistrations({
        manifest: {
          id: 'ext',
          packageType: 'system',
          contributes: {
            runtimeProviders: [{ id: ' runtime ', handler: ' handle.runtime ', title: ' Runtime ', description: 'Runs things' }],
          },
        },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        id: 'runtime',
        packageType: 'system',
        handler: 'handle.runtime',
        title: 'Runtime',
        description: 'Runs things',
      },
    ]);
  });

  it('drops providers missing required fields and defaults package type', () => {
    expect(
      buildExtensionRuntimeProviderRegistrations({
        manifest: {
          id: 'ext',
          contributes: {
            runtimeProviders: [
              { id: ' ', handler: 'handler', title: 'Title' },
              { id: 'id', handler: ' ', title: 'Title' },
              { id: 'id', handler: 'handler', title: ' ' },
              { id: 'ok', handler: 'handler', title: 'Title' },
            ],
          },
        },
      }),
    ).toEqual([{ extensionId: 'ext', id: 'ok', packageType: 'user', handler: 'handler', title: 'Title' }]);
  });
});
