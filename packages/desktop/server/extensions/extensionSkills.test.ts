import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeExtensionSkillContribution, readSkillFrontmatterFields, validateExtensionSkillContribution } from './extensionSkills';

describe('extensionSkills', () => {
  it('normalizes string skill contributions using parent directory for SKILL.md files', () => {
    expect(normalizeExtensionSkillContribution('skills/browser/SKILL.md')).toEqual({ id: 'browser', path: 'skills/browser/SKILL.md' });
    expect(normalizeExtensionSkillContribution('docs/help.md')).toEqual({ id: 'help', path: 'docs/help.md' });
  });

  it('reads Agent Skills frontmatter name and description', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-skill-'));
    const skillPath = join(root, 'SKILL.md');
    writeFileSync(skillPath, '---\nname: browser\ndescription: Automate browsers\n---\n# Body\n');

    expect(readSkillFrontmatterFields(skillPath)).toEqual({ name: 'browser', description: 'Automate browsers' });
  });

  it('validates required skill paths, filenames, package boundaries, and frontmatter', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-skill-'));
    mkdirSync(join(root, 'skills', 'good'), { recursive: true });
    mkdirSync(join(root, 'skills', 'bad-name'), { recursive: true });
    mkdirSync(join(root, 'skills', 'missing-frontmatter'), { recursive: true });
    writeFileSync(join(root, 'skills', 'good', 'SKILL.md'), '---\nname: good\ndescription: Good skill\n---\n');
    writeFileSync(join(root, 'skills', 'bad-name', 'README.md'), '---\nname: bad\ndescription: Bad skill\n---\n');
    writeFileSync(join(root, 'skills', 'missing-frontmatter', 'SKILL.md'), '# Missing\n');

    expect(validateExtensionSkillContribution({ packageRoot: undefined, skill: 'skills/good/SKILL.md' })).toBe(
      'Extension skill contributions require a package root.',
    );
    expect(validateExtensionSkillContribution({ packageRoot: root, skill: { id: '', path: 'skills/good/SKILL.md' } })).toBe(
      'Extension skill contribution is missing an id.',
    );
    expect(validateExtensionSkillContribution({ packageRoot: root, skill: { id: 'missing', path: '' } })).toBe(
      'Extension skill missing is missing a path.',
    );
    expect(validateExtensionSkillContribution({ packageRoot: root, skill: { id: 'escape', path: '../SKILL.md' } })).toBe(
      'Extension skill escape path must stay inside the extension package.',
    );
    expect(validateExtensionSkillContribution({ packageRoot: root, skill: { id: 'missing', path: 'skills/missing/SKILL.md' } })).toBe(
      'Extension skill missing path does not exist: skills/missing/SKILL.md',
    );
    expect(validateExtensionSkillContribution({ packageRoot: root, skill: { id: 'bad', path: 'skills/bad-name/README.md' } })).toBe(
      'Extension skill bad should use the Agent Skills file name SKILL.md.',
    );
    expect(
      validateExtensionSkillContribution({
        packageRoot: root,
        skill: { id: 'missing-frontmatter', path: 'skills/missing-frontmatter/SKILL.md' },
      }),
    ).toBe('Extension skill missing-frontmatter must use Agent Skills frontmatter with name and description.');
    expect(validateExtensionSkillContribution({ packageRoot: root, skill: 'skills/good/SKILL.md' })).toBeNull();
  });
});
