import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const releaseSmokeArgs = [
  '--max-conversation-content-open-phase-ms=1500',
  '--max-conversation-extension-open-phase-ms=1500',
  '--max-related-conversation-results-ms=1500',
  '--max-recovery-ms=3000',
];

describe('release smoke perf budgets', () => {
  it('uses explicit packaged-app conversation-open phase budgets when publishing', () => {
    const source = readFileSync(new URL('./publish-desktop-release.mjs', import.meta.url), 'utf8');

    for (const arg of releaseSmokeArgs) {
      expect(source).toContain(arg);
    }
  });

  it('keeps local release verification aligned with publish smoke budgets', () => {
    const source = readFileSync(new URL('./verify-desktop-release-build.mjs', import.meta.url), 'utf8');

    for (const arg of releaseSmokeArgs) {
      expect(source).toContain(arg);
    }
  });

  it('runs a fast release smoke before notarization', () => {
    const source = readFileSync(new URL('./publish-desktop-release.mjs', import.meta.url), 'utf8');
    const preSmokeIndex = source.indexOf('requirePreNotarizationSmokeTest(env, releaseDir, buildRoot);');
    const notarizeIndex = source.indexOf('notarizeDistributionContainers(env, desktopReleaseFiles);');

    expect(preSmokeIndex).toBeGreaterThan(0);
    expect(notarizeIndex).toBeGreaterThan(preSmokeIndex);
  });

  it('requires release QA acknowledgment before pushing or uploading release artifacts', () => {
    const source = readFileSync(new URL('./publish-desktop-release.mjs', import.meta.url), 'utf8');
    const qaGateIndex = source.indexOf('requireReleaseQaAcknowledgement(env);');
    const pushIndex = source.indexOf('pushReleaseRef(tag);');
    const releaseUploadIndex = source.indexOf("run('gh', ['release', 'upload'");
    const releaseCreateIndex = source.indexOf("run('gh', args);");

    expect(qaGateIndex).toBeGreaterThan(0);
    expect(pushIndex).toBeGreaterThan(qaGateIndex);
    expect(releaseUploadIndex).toBeGreaterThan(qaGateIndex);
    expect(releaseCreateIndex).toBeGreaterThan(qaGateIndex);
    expect(source).toContain('NEON_PILOT_RELEASE_QA_ACK');
    expect(source).toContain('NEON_PILOT_RELEASE_QA_NOTES');
  });

  it('requires first-party extension release assets before pushing release artifacts', () => {
    const source = readFileSync(new URL('./publish-desktop-release.mjs', import.meta.url), 'utf8');
    const extensionGateIndex = source.indexOf('requireFirstPartyExtensionReleaseGate(env, tag);');
    const pushIndex = source.indexOf('pushReleaseRef(tag);');
    const releaseUploadIndex = source.indexOf("run('gh', ['release', 'upload'");

    expect(extensionGateIndex).toBeGreaterThan(0);
    expect(pushIndex).toBeGreaterThan(extensionGateIndex);
    expect(releaseUploadIndex).toBeGreaterThan(extensionGateIndex);
    expect(source).toContain('neon-extension-catalog.json');
    expect(source).toContain('NEON_PILOT_FIRST_PARTY_EXTENSIONS_RELEASE_WAIVED');
  });

  it('validates packaged auto-update config during local release verification', () => {
    const source = readFileSync(new URL('./verify-desktop-release-build.mjs', import.meta.url), 'utf8');
    const appPathIndex = source.indexOf('const appPath = collectPackagedAppPath();');
    const autoUpdateIndex = source.indexOf('validatePackagedAutoUpdateConfig(appPath);');
    const packagedExtensionsIndex = source.indexOf("run('node', ['scripts/check-packaged-extensions.mjs', appPath]);");

    expect(autoUpdateIndex).toBeGreaterThan(appPathIndex);
    expect(packagedExtensionsIndex).toBeGreaterThan(autoUpdateIndex);
  });
});
