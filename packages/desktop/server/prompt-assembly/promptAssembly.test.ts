import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@personal-agent/core', async () => {
  const actual = await vi.importActual<typeof import('@personal-agent/core')>('@personal-agent/core');
  return {
    ...actual,
    getStateRoot: () => stateRoot,
    getDurableSkillsDir: () => durableSkillsDir,
    resolveRuntimeResources: () => ({
      skillDirs: [configuredSkillsDir],
      extensionEntries: [],
      promptEntries: [promptTemplatePath],
      themeEntries: [],
    }),
  };
});

vi.mock('../extensions/extensionRegistry.js', () => ({
  listExtensionSkillRegistrations: () => [
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'extension-skill',
      name: 'test-extension/extension-skill',
      title: 'Extension Skill',
      description: 'Extension skill description',
      path: extensionSkillPath,
      packageRoot: extensionRoot,
    },
  ],
  listExtensionToolRegistrations: () => [
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'hello-tool',
      name: 'hello_tool',
      action: 'hello',
      description: 'Say hello',
      inputSchema: { type: 'object' },
    },
  ],
}));

let stateRoot = '';
let durableSkillsDir = '';
let configuredSkillsDir = '';
let promptTemplatePath = '';
let extensionRoot = '';
let extensionSkillPath = '';

describe('buildPromptAssemblyPlan', () => {
  it('assembles skills, tools, and prompt templates through canonical inventories', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-prompt-assembly-'));
    stateRoot = join(root, 'state');
    durableSkillsDir = join(root, 'vault', 'skills');
    configuredSkillsDir = join(root, 'configured-skills');
    extensionRoot = join(root, 'extension');
    promptTemplatePath = join(root, 'prompts', 'summary.md');

    mkdirSync(join(durableSkillsDir, 'vault-skill'), { recursive: true });
    writeFileSync(join(durableSkillsDir, 'vault-skill', 'SKILL.md'), '---\nname: Vault Skill\ndescription: Vault skill description\n---\n');
    mkdirSync(join(configuredSkillsDir, 'configured-skill'), { recursive: true });
    writeFileSync(
      join(configuredSkillsDir, 'configured-skill', 'SKILL.md'),
      '---\nname: Configured Skill\ndescription: Configured skill description\n---\n',
    );
    mkdirSync(join(extensionRoot, 'skills', 'extension-skill'), { recursive: true });
    extensionSkillPath = join(extensionRoot, 'skills', 'extension-skill', 'SKILL.md');
    writeFileSync(extensionSkillPath, '---\nname: Extension Skill\ndescription: Extension skill description\n---\n');
    mkdirSync(join(root, 'prompts'), { recursive: true });
    writeFileSync(promptTemplatePath, '# Summary\n');

    const { buildPromptAssemblyPlan, buildPromptAssemblyPlanAsync } = await import('./promptAssembly.js');
    const plan = buildPromptAssemblyPlan({ profile: 'test', repoRoot: root, modelRef: 'openai/gpt-4o' });
    const asyncPlan = await buildPromptAssemblyPlanAsync({ profile: 'test', repoRoot: root, modelRef: 'openai/gpt-4o' });

    expect(plan.skills.skillPaths).toEqual(
      expect.arrayContaining([
        join(durableSkillsDir, 'vault-skill'),
        join(configuredSkillsDir, 'configured-skill'),
        join(extensionRoot, 'skills', 'extension-skill'),
      ]),
    );
    expect(plan.tools.activeToolNames).toContain('hello_tool');
    expect(plan.promptTemplates.templatePaths).toEqual([promptTemplatePath]);
    expect(plan.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(asyncPlan.skills.skillPaths).toEqual(plan.skills.skillPaths);
    expect(asyncPlan.tools.activeToolNames).toEqual(plan.tools.activeToolNames);
  });
});
