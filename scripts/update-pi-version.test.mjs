import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyLatestPiPatchVersion,
  applyLatestPiVersion,
  resolvePiDependencyRange,
  updatePiPatchForRelease,
} from './update-pi-version.mjs';

describe('update-pi-version', () => {
  it('updates the root pi dependency to the latest exact version', () => {
    const rootPackage = {
      name: 'neon-pilot',
      dependencies: {
        '@earendil-works/pi-ai': '^0.69.0',
        '@earendil-works/pi-agent-core': '^0.69.0',
        '@earendil-works/pi-coding-agent': '^0.69.0',
        jsdom: '^24.0.0',
      },
    };

    const result = applyLatestPiVersion(rootPackage, '0.70.0');

    expect(result.changed).toBe(true);
    expect(result.nextRange).toBe('0.70.0');
    expect(result.packageJson.dependencies['@earendil-works/pi-ai']).toBe('0.70.0');
    expect(result.packageJson.dependencies['@earendil-works/pi-agent-core']).toBe('0.70.0');
    expect(result.packageJson.dependencies['@earendil-works/pi-coding-agent']).toBe('0.70.0');
    expect(result.packageJson.dependencies.jsdom).toBe('^24.0.0');
  });

  it('is a no-op when pi is already at the latest range', () => {
    const rootPackage = {
      name: 'neon-pilot',
      dependencies: {
        '@earendil-works/pi-ai': '0.70.0',
        '@earendil-works/pi-agent-core': '0.70.0',
        '@earendil-works/pi-coding-agent': '0.70.0',
      },
    };

    const result = applyLatestPiVersion(rootPackage, '0.70.0');

    expect(result.changed).toBe(false);
    expect(result.packageJson).toBe(rootPackage);
  });

  it('uses the exact published pi version', () => {
    expect(resolvePiDependencyRange('0.70.0')).toBe('0.70.0');
  });

  it('advances the version-qualified pi-ai patch registration with the runtime', () => {
    const workspaceYaml = [
      'packages:',
      '  - packages/*',
      '',
      'patchedDependencies:',
      "  '@earendil-works/pi-ai@0.80.6': patches/@earendil-works__pi-ai@0.80.6.patch",
      '',
    ].join('\n');

    const result = applyLatestPiPatchVersion(workspaceYaml, '0.80.7');

    expect(result.changed).toBe(true);
    expect(result.previousVersion).toBe('0.80.6');
    expect(result.nextVersion).toBe('0.80.7');
    expect(result.workspaceYaml).toContain("'@earendil-works/pi-ai@0.80.7': patches/@earendil-works__pi-ai@0.80.7.patch");
    expect(result.workspaceYaml).not.toContain('0.80.6');
  });

  it('rejects an inconsistent pi-ai patch registration', () => {
    expect(() =>
      applyLatestPiPatchVersion(
        "patchedDependencies:\n  '@earendil-works/pi-ai@0.80.6': patches/@earendil-works__pi-ai@0.80.5.patch\n",
        '0.80.7',
      ),
    ).toThrow(/inconsistent/);
  });

  it('renames the pi-ai patch file when advancing the release version', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-pi-update-'));
    const patchesDir = join(repoRoot, 'patches');
    mkdirSync(patchesDir);
    writeFileSync(
      join(repoRoot, 'pnpm-workspace.yaml'),
      "patchedDependencies:\n  '@earendil-works/pi-ai@0.80.6': patches/@earendil-works__pi-ai@0.80.6.patch\n",
    );
    writeFileSync(join(patchesDir, '@earendil-works__pi-ai@0.80.6.patch'), 'patch contents\n');

    try {
      updatePiPatchForRelease(repoRoot, '0.80.7');

      expect(existsSync(join(patchesDir, '@earendil-works__pi-ai@0.80.6.patch'))).toBe(false);
      expect(readFileSync(join(patchesDir, '@earendil-works__pi-ai@0.80.7.patch'), 'utf-8')).toBe('patch contents\n');
      expect(readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf-8')).toContain(
        "'@earendil-works/pi-ai@0.80.7': patches/@earendil-works__pi-ai@0.80.7.patch",
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
