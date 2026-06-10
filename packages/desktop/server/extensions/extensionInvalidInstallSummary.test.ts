import { describe, expect, it } from 'vitest';

import { buildInvalidExtensionInstallSummary } from './extensionInvalidInstallSummary';

describe('extensionInvalidInstallSummary', () => {
  it('builds invalid install summaries with empty contribution arrays', () => {
    expect(
      buildInvalidExtensionInstallSummary({ id: 'bad', name: 'Bad', packageType: 'user', errors: ['oops'], packageRoot: '/tmp/bad' }),
    ).toEqual({
      id: 'bad',
      name: 'Bad',
      packageType: 'user',
      enabled: false,
      status: 'invalid',
      errors: ['oops'],
      packageRoot: '/tmp/bad',
      uninstallable: true,
      manifest: { schemaVersion: 2, id: 'bad', name: 'Bad', packageType: 'user' },
      permissions: [],
      surfaces: [],
      backendActions: [],
      services: [],
      subscriptions: [],
      dependsOn: [],
      skills: [],
      mentions: [],
      tools: [],
      modelProfiles: [],
      routes: [],
    });
  });
});
