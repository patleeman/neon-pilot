import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createImportedPackageExtension } from './importedPackageWrapper';

const tempDirs: string[] = [];

describe('imported package extension wrappers', () => {
  afterEach(() => {
    vi.clearAllMocks();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('wraps local Codex or Claude packages as Neon Pilot extensions', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'np-import-source-'));
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-import-runtime-'));
    tempDirs.push(sourceRoot, runtimeDir);
    const skillDir = join(sourceRoot, 'skills', 'review-code');
    await mkdir(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: review-code', 'description: Review code carefully.', '---', '', '# Review Code', ''].join('\n'),
    );

    const result = createImportedPackageExtension({ source: sourceRoot, ecosystem: 'codex', packageType: 'skill', runtimeDir });

    expect(result).toMatchObject({ skillCount: 1, copiedSource: true });
    const extension = result;
    const manifestPath = join(extension.packageRoot, 'extension.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      id: string;
      name: string;
      contributes?: { skills?: Array<{ id: string; path: string }> };
      importedPackage?: { ecosystem: string; packageType: string; source: string; copiedSource: boolean };
    };
    expect(manifest.id).toBe(extension.id);
    expect(manifest.name).toContain('Codex Skill');
    expect(manifest.importedPackage).toEqual({
      ecosystem: 'codex',
      packageType: 'skill',
      source: sourceRoot,
      copiedSource: true,
    });
    expect(manifest.contributes?.skills).toEqual([{ id: 'review-code', path: 'package/skills/review-code/SKILL.md' }]);
    expect(existsSync(join(extension.packageRoot, 'package', 'skills', 'review-code', 'SKILL.md'))).toBe(true);
  });

  it('records remote package sources as extension wrappers without copied skills', async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), 'np-import-runtime-'));
    tempDirs.push(runtimeDir);
    const result = createImportedPackageExtension({
      source: 'https://example.com/package.git',
      ecosystem: 'claude',
      packageType: 'instruction-pack',
      runtimeDir,
    });

    expect(result).toMatchObject({ skillCount: 0, copiedSource: false });
    const extension = result;
    const manifest = JSON.parse(readFileSync(join(extension.packageRoot, 'extension.json'), 'utf-8')) as {
      importedPackage?: { source: string; copiedSource: boolean };
      contributes?: { skills?: unknown[] };
    };
    expect(manifest.importedPackage).toMatchObject({ source: 'https://example.com/package.git', copiedSource: false });
    expect(manifest.contributes?.skills).toBeUndefined();
  });

  it('rejects symlinks in copied local package sources', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'np-import-source-symlink-'));
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-import-runtime-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'np-import-target-'));
    tempDirs.push(sourceRoot, runtimeDir, targetRoot);
    symlinkSync(targetRoot, join(sourceRoot, 'linked-target'));

    expect(() => createImportedPackageExtension({ source: sourceRoot, ecosystem: 'codex', packageType: 'skill', runtimeDir })).toThrow(
      'Imported package source cannot contain symlinks',
    );
  });
});
