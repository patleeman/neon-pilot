import { describe, expect, it } from 'vitest';

import { listExtensionContributionDiagnostics } from './extensionContributionDiagnostics';

describe('extensionContributionDiagnostics', () => {
  it('reports missing dependencies', () => {
    expect(
      listExtensionContributionDiagnostics({
        availableExtensionIds: ['present'],
        dependsOn: ['present', 'missing'],
      }),
    ).toEqual(['Missing required extension dependency: missing']);
  });

  it('reports invalid skill contributions', () => {
    expect(
      listExtensionContributionDiagnostics({
        availableExtensionIds: [],
        packageRoot: '/tmp/package',
        skills: [{ id: 'skill' }],
      }),
    ).toEqual(['Extension skill skill is missing a path.']);
  });
});
