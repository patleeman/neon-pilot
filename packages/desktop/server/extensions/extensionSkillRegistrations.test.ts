import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildExtensionSkillRegistrations } from './extensionSkillRegistrations';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('extensionSkillRegistrations', () => {
  it('returns no registrations without a package root', () => {
    expect(
      buildExtensionSkillRegistrations({ manifest: { id: 'ext', contributes: { skills: [{ id: 'skill', path: 'SKILL.md' }] } } }),
    ).toEqual([]);
  });

  it('builds skill registrations with frontmatter fallbacks', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'extension-skill-registrations-'));
    const skillPath = join(tempDir, 'SKILL.md');
    writeFileSync(skillPath, '---\nname: Frontmatter name\ndescription: Frontmatter description\n---\n');

    expect(
      buildExtensionSkillRegistrations({
        packageRoot: tempDir,
        manifest: {
          id: 'ext',
          packageType: 'system',
          contributes: { skills: [{ id: ' skill ', path: 'SKILL.md' }] },
        },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        packageType: 'system',
        id: 'skill',
        name: 'ext/skill',
        title: 'Frontmatter name',
        description: 'Frontmatter description',
        path: skillPath,
        packageRoot: tempDir,
      },
    ]);
  });

  it('skips invalid skill contributions', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'extension-skill-registrations-'));
    expect(
      buildExtensionSkillRegistrations({
        packageRoot: tempDir,
        manifest: { id: 'ext', contributes: { skills: [{ id: 'skill' }] } },
      }),
    ).toEqual([]);
  });
});
