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
    getDurableMemorySkillsDir: () => memorySkillsDir,
    resolveRuntimeResources: () => ({
      skillDirs: [],
      extensionEntries: [],
      promptEntries: [],
      themeEntries: [],
    }),
  };
});

vi.mock('../extensions/extensionRegistry.js', () => ({
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

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    listPromptAssemblyContributions: async () => ({ assemblyProviders: [], contextProviders: [], hooks: [] }),
    listStaticContributions: async () => ({
      tools: [],
      modelDiscovery: [],
      skills: [
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
    }),
  }),
}));

let stateRoot = '';
let durableSkillsDir = '';
let memorySkillsDir = '';
let extensionRoot = '';

describe('buildSkillInventory', () => {
  it('runs all beforeSkillInjection hooks in priority order', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-skill-inventory-'));
    stateRoot = join(root, 'state');
    durableSkillsDir = join(root, 'knowledge', 'skills');
    memorySkillsDir = join(root, 'knowledge', 'memory', 'skills');
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
        buildSkillInventory({ runtimeScope: 'test', repoRoot: root })
          .filter((skill) => skill.enabled)
          .map((skill) => skill.id),
      ).toEqual([]);
      expect(
        (await buildSkillInventoryAsync({ runtimeScope: 'test', repoRoot: root }))
          .filter((skill) => skill.enabled)
          .map((skill) => skill.id),
      ).toEqual([]);
    } finally {
      unregisterFirst();
      unregisterSecond();
    }
  });

  it('discovers skills stored under memory/skills', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-memory-skill-inventory-'));
    stateRoot = join(root, 'state');
    durableSkillsDir = join(root, 'knowledge', 'skills');
    memorySkillsDir = join(root, 'knowledge', 'memory', 'skills');
    extensionRoot = join(root, 'extension');
    mkdirSync(join(memorySkillsDir, 'memory-review'), { recursive: true });
    writeFileSync(
      join(memorySkillsDir, 'memory-review', 'SKILL.md'),
      '---\nname: Memory Review\ndescription: Review memory updates\n---\n',
    );

    const { buildSkillInventory } = await import('./skillInventory.js');

    expect(buildSkillInventory({ runtimeScope: 'test', repoRoot: root })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'memory-review',
          title: 'Memory Review',
          description: 'Review memory updates',
          source: expect.objectContaining({ kind: 'knowledge', label: 'Knowledge', root: memorySkillsDir }),
          location: expect.objectContaining({ path: join(memorySkillsDir, 'memory-review', 'SKILL.md') }),
        }),
      ]),
    );
  });
});
