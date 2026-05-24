import { describe, expect, it } from 'vitest';

import {
  buildExtensionAssemblyProviderRegistrations,
  sortExtensionAssemblyProviderRegistrations,
} from './extensionAssemblyProviderRegistrations';

describe('extensionAssemblyProviderRegistrations', () => {
  it('builds assembly provider registrations for all supported fields', () => {
    expect(
      buildExtensionAssemblyProviderRegistrations({
        manifest: {
          id: 'ext',
          packageType: 'system',
          contributes: {
            skillProviders: [{ id: ' skills ', handler: ' handle.skills ', title: 'Skills', priority: 2 }],
            toolProviders: [{ id: 'tools', handler: 'handle.tools' }],
            promptTemplateProviders: [{ id: 'templates', handler: 'handle.templates' }],
            instructionProviders: [{ id: 'instructions', handler: 'handle.instructions' }],
          },
        },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        id: 'skills',
        packageType: 'system',
        handler: 'handle.skills',
        kind: 'skills',
        title: 'Skills',
        priority: 2,
      },
      { extensionId: 'ext', id: 'tools', packageType: 'system', handler: 'handle.tools', kind: 'tools' },
      {
        extensionId: 'ext',
        id: 'templates',
        packageType: 'system',
        handler: 'handle.templates',
        kind: 'promptTemplates',
      },
      {
        extensionId: 'ext',
        id: 'instructions',
        packageType: 'system',
        handler: 'handle.instructions',
        kind: 'instructions',
      },
    ]);
  });

  it('drops incomplete providers and ignores non-integer priorities', () => {
    expect(
      buildExtensionAssemblyProviderRegistrations({
        manifest: {
          id: 'ext',
          contributes: {
            skillProviders: [
              { id: ' ', handler: 'handler' },
              { id: 'id', handler: ' ' },
              { id: 'ok', handler: 'handler', priority: 1.5 },
            ],
          },
        },
      }),
    ).toEqual([{ extensionId: 'ext', id: 'ok', packageType: 'user', handler: 'handler', kind: 'skills' }]);
  });

  it('sorts by priority then id', () => {
    const providers = [{ id: 'b' }, { id: 'a' }, { id: 'late', priority: 1 }, { id: 'early', priority: -1 }];
    expect(sortExtensionAssemblyProviderRegistrations(providers)).toEqual([
      { id: 'early', priority: -1 },
      { id: 'a' },
      { id: 'b' },
      { id: 'late', priority: 1 },
    ]);
  });
});
