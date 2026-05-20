import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/core', async () => {
  const actual = await vi.importActual<typeof import('@neon-pilot/core')>('@neon-pilot/core');
  return {
    ...actual,
    getStateRoot: () => stateRoot,
    getDurableSkillsDir: () => durableSkillsDir,
    resolveRuntimeResources: () => ({
      skillDirs: [],
      extensionEntries: [],
      promptEntries: [],
      themeEntries: [],
    }),
  };
});

vi.mock('../extensions/extensionRegistry.js', () => ({
  listExtensionAssemblyProviderRegistrations: () => [],
  listExtensionSkillRegistrations: () => [
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'alpha',
      name: 'alpha',
      title: 'Alpha',
      description: 'Alpha skill',
      path: join(extensionRoot, 'skills', 'alpha', 'SKILL.md'),
      packageRoot: extensionRoot,
    },
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'beta',
      name: 'beta',
      title: 'Beta',
      description: 'Beta skill',
      path: join(extensionRoot, 'skills', 'beta', 'SKILL.md'),
      packageRoot: extensionRoot,
    },
  ],
}));

let stateRoot = '';
let durableSkillsDir = '';
let extensionRoot = '';

describe('buildSkillInventory', () => {
  it('runs all beforeSkillInjection hooks in priority order', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-skill-inventory-'));
    stateRoot = join(root, 'state');
    durableSkillsDir = join(root, 'vault', 'skills');
    extensionRoot = join(root, 'extension');
    mkdirSync(join(extensionRoot, 'skills', 'alpha'), { recursive: true });
    mkdirSync(join(extensionRoot, 'skills', 'beta'), { recursive: true });
    writeFileSync(join(extensionRoot, 'skills', 'alpha', 'SKILL.md'), '---\nname: Alpha\ndescription: Alpha skill\n---\n');
    writeFileSync(join(extensionRoot, 'skills', 'beta', 'SKILL.md'), '---\nname: Beta\ndescription: Beta skill\n---\n');

    const { buildSkillInventory, buildSkillInventoryAsync, registerSkillRuntimeHook } = await import('./skillInventory.js');
    const unregisterFirst = registerSkillRuntimeHook({
      id: 'first-disable-alpha',
      priority: 1,
      beforeSkillInjection: (skills) => skills.map((skill) => (skill.id === 'alpha' ? { ...skill, enabled: false } : skill)),
    });
    const unregisterSecond = registerSkillRuntimeHook({
      id: 'second-disable-beta',
      priority: 2,
      beforeSkillInjection: (skills) => skills.map((skill) => (skill.id === 'beta' ? { ...skill, enabled: false } : skill)),
    });

    try {
      expect(
        buildSkillInventory({ profile: 'test', repoRoot: root })
          .filter((skill) => skill.enabled)
          .map((skill) => skill.id),
      ).toEqual([]);
      expect(
        (await buildSkillInventoryAsync({ profile: 'test', repoRoot: root })).filter((skill) => skill.enabled).map((skill) => skill.id),
      ).toEqual([]);
    } finally {
      unregisterFirst();
      unregisterSecond();
    }
  });
});
