import { describe, expect, it } from 'vitest';

import { buildExtensionGatewayProviderRegistrations, validateGatewayProviderContributions } from './extensionGatewayContributions.js';
import type { ExtensionRegistryEntry } from './extensionRegistry.js';

describe('extensionGatewayContributions', () => {
  it('validates gateway provider contributions and applies registration defaults', () => {
    validateGatewayProviderContributions([
      {
        id: 'telegram',
        label: 'Telegram',
        description: 'Telegram bridge',
        icon: 'message-circle',
        setupRoute: '/gateways/telegram',
        docsUrl: 'https://example.com/docs',
        order: 10,
      },
    ]);

    const registrations = buildExtensionGatewayProviderRegistrations({
      packageRoot: '/extensions/system-gateways',
      manifest: {
        id: 'system-gateways',
        packageType: 'system',
        contributes: {
          gatewayProviders: [
            { id: 'telegram', label: 'Telegram', setupRoute: '/gateways/telegram' },
            { id: 'external-chat', label: 'External Chat', implemented: false, configurationLocation: 'external', order: 20 },
          ],
        },
      },
    } as ExtensionRegistryEntry);

    expect(registrations).toEqual([
      {
        extensionId: 'system-gateways',
        packageType: 'system',
        id: 'telegram',
        label: 'Telegram',
        implemented: true,
        configurationLocation: 'extension',
        setupRoute: '/gateways/telegram',
      },
      {
        extensionId: 'system-gateways',
        packageType: 'system',
        id: 'external-chat',
        label: 'External Chat',
        implemented: false,
        configurationLocation: 'external',
        order: 20,
      },
    ]);
  });

  it('rejects malformed gateway provider contributions', () => {
    expect(() => validateGatewayProviderContributions([{ id: '-bad', label: 'Bad' }])).toThrow(
      'Extension manifest contributes.gatewayProviders[0].id must start with an alphanumeric character',
    );
    expect(() => validateGatewayProviderContributions([{ id: 'telegram', label: 'Telegram', implemented: 'yes' }])).toThrow(
      'Extension manifest contributes.gatewayProviders[0].implemented must be a boolean.',
    );
    expect(() => validateGatewayProviderContributions([{ id: 'telegram', label: 'Telegram', order: 1.5 }])).toThrow(
      'Extension manifest contributes.gatewayProviders[0].order must be an integer.',
    );
    expect(() =>
      validateGatewayProviderContributions([{ id: 'telegram', label: 'Telegram', configurationLocation: 'somewhere' }]),
    ).toThrow('contributes.gatewayProviders[0].configurationLocation');
  });
});
