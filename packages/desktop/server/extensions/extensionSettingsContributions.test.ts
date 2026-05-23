import { describe, expect, it } from 'vitest';

import { buildExtensionSecretRegistrations, buildExtensionSettingsRegistrations } from './extensionSettingsContributions';

describe('extensionSettingsContributions', () => {
  it('builds settings registrations with defaults and filtered enum values', () => {
    expect(
      buildExtensionSettingsRegistrations({
        extensionId: 'settings-board',
        packageType: 'system',
        settings: {
          apiHost: {
            type: 'select',
            default: 'prod',
            description: 'API host',
            group: 'Network',
            enum: ['prod', 123, 'staging'] as unknown as string[],
            placeholder: 'Choose host',
            order: 2,
          },
          ignored: { type: 'unsupported' },
        },
      }),
    ).toEqual([
      {
        extensionId: 'settings-board',
        packageType: 'system',
        key: 'apiHost',
        type: 'select',
        default: 'prod',
        description: 'API host',
        group: 'Network',
        enum: ['prod', 'staging'],
        placeholder: 'Choose host',
        order: 2,
      },
    ]);
  });

  it('defaults setting type, group, and order', () => {
    expect(buildExtensionSettingsRegistrations({ extensionId: 'settings-board', settings: { token: {} } })).toEqual([
      {
        extensionId: 'settings-board',
        packageType: 'user',
        key: 'token',
        type: 'string',
        default: undefined,
        description: undefined,
        group: 'General',
        enum: undefined,
        placeholder: undefined,
        order: 0,
      },
    ]);
  });

  it('builds secret registrations and skips invalid ids or labels', () => {
    expect(
      buildExtensionSecretRegistrations({
        extensionId: 'secret-board',
        secrets: {
          ' apiKey ': { label: ' API key ', description: 'Token', env: ' SECRET_TOKEN ', placeholder: 'sk-...', order: 3 },
          ' ': { label: 'No id' },
          emptyLabel: { label: ' ' },
        },
      }),
    ).toEqual([
      {
        extensionId: 'secret-board',
        packageType: 'user',
        id: 'apiKey',
        key: 'secret-board.apiKey',
        label: 'API key',
        description: 'Token',
        env: 'SECRET_TOKEN',
        placeholder: 'sk-...',
        order: 3,
      },
    ]);
  });
});
