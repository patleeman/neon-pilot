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
      skillDirs: [configuredSkillsDir],
      extensionEntries: [],
      promptEntries: [promptTemplatePath],
      themeEntries: [],
    }),
  };
});

vi.mock('../extensions/extensionRegistry.js', () => ({
  listExtensionAssemblyProviderRegistrations: () => [
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'dynamic-tools',
      kind: 'tools',
      handler: 'provideTools',
      title: 'Dynamic Tools',
    },
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'bad-skills',
      kind: 'skills',
      handler: 'provideBadSkills',
      title: 'Bad Skills',
    },
    {
      extensionId: 'test-extension',
      packageType: 'system',
      id: 'bad-templates',
      kind: 'promptTemplates',
      handler: 'provideBadTemplates',
      title: 'Bad Templates',
    },
  ],
  listExtensionPromptAssemblyHookRegistrations: () => promptAssemblyHooks,
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

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    listStaticContributions: async () => ({
      skills: [
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
      tools: [
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
    }),
    listPromptAssemblyContributions: async () => ({
      assemblyProviders: [
        {
          extensionId: 'test-extension',
          packageType: 'system',
          id: 'dynamic-tools',
          kind: 'tools',
          handler: 'provideTools',
          title: 'Dynamic Tools',
        },
        {
          extensionId: 'test-extension',
          packageType: 'system',
          id: 'bad-skills',
          kind: 'skills',
          handler: 'provideBadSkills',
          title: 'Bad Skills',
        },
        {
          extensionId: 'test-extension',
          packageType: 'system',
          id: 'bad-templates',
          kind: 'promptTemplates',
          handler: 'provideBadTemplates',
          title: 'Bad Templates',
        },
      ],
      contextProviders: [],
      hooks: promptAssemblyHooks,
    }),
    invokeAction: async ({ actionId }: { actionId: string }) => {
      if (actionId === 'provideTools') {
        return {
          ok: true,
          result: {
            tools: [
              {
                id: 'dynamic-tool',
                name: 'dynamic_tool',
                action: 'dynamicTool',
                description: 'Dynamic tool',
                inputSchema: { type: 'object' },
                priority: 1,
              },
            ],
          },
        };
      }
      if (actionId === 'provideBadSkills') {
        return {
          ok: true,
          result: { skills: [{ id: 'bad-location', title: 'Bad Location', description: 'Bad', location: { kind: 'file' } }] },
        };
      }
      if (actionId === 'provideBadTemplates') {
        return { ok: true, result: { templates: [{ id: 'bad-template', title: 'Bad Template', location: { kind: 'file' } }] } };
      }
      if (actionId === 'replaceDiagnostics') {
        return { ok: true, result: { plan: { diagnostics: [] } } };
      }
      return { ok: false, error: new Error(`Unexpected action ${actionId}`) };
    },
  }),
}));

let stateRoot = '';
let durableSkillsDir = '';
let configuredSkillsDir = '';
let promptTemplatePath = '';
let extensionRoot = '';
let extensionSkillPath = '';
let promptAssemblyHooks: unknown[] = [];

describe('buildPromptAssemblyPlan', () => {
  it('assembles skills, tools, and prompt templates through canonical inventories', async () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-prompt-assembly-'));
    stateRoot = join(root, 'state');
    durableSkillsDir = join(root, 'knowledge', 'skills');
    configuredSkillsDir = join(root, 'configured-skills');
    extensionRoot = join(root, 'extension');
    promptTemplatePath = join(root, 'prompts', 'summary.md');
    promptAssemblyHooks = [];

    mkdirSync(join(durableSkillsDir, 'knowledge-skill'), { recursive: true });
    writeFileSync(
      join(durableSkillsDir, 'knowledge-skill', 'SKILL.md'),
      '---\nname: Knowledge Skill\ndescription: Knowledge skill description\n---\n',
    );
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
        join(durableSkillsDir, 'knowledge-skill'),
        join(configuredSkillsDir, 'configured-skill'),
        join(extensionRoot, 'skills', 'extension-skill'),
      ]),
    );
    expect(plan.tools.activeToolNames).toContain('hello_tool');
    expect(asyncPlan.tools.activeToolNames).toEqual(expect.arrayContaining(['hello_tool', 'dynamic_tool']));
    expect(asyncPlan.diagnostics.filter((diagnostic) => diagnostic.code === 'prompt-assembly-provider-invalid-item')).toHaveLength(2);
    expect(plan.promptTemplates.templatePaths).toEqual([promptTemplatePath]);
    expect(plan.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(asyncPlan.skills.skillPaths).toEqual(plan.skills.skillPaths);
    expect(asyncPlan.tools.activeToolNames).toEqual(expect.arrayContaining(plan.tools.activeToolNames));
  });

  it('preserves existing diagnostics when hooks return a replacement plan', async () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-prompt-assembly-hooks-'));
    stateRoot = join(root, 'state');
    durableSkillsDir = join(root, 'knowledge', 'skills');
    configuredSkillsDir = join(root, 'configured-skills');
    extensionRoot = join(root, 'extension');
    promptTemplatePath = join(root, 'prompts', 'summary.md');
    promptAssemblyHooks = [
      {
        extensionId: 'test-extension',
        id: 'replace-diagnostics',
        handler: 'replaceDiagnostics',
        phase: 'after-assembly',
      },
    ];

    mkdirSync(join(root, 'prompts'), { recursive: true });
    writeFileSync(promptTemplatePath, '# Summary\n');

    const { buildPromptAssemblyPlanAsync } = await import('./promptAssembly.js');
    const asyncPlan = await buildPromptAssemblyPlanAsync({ profile: 'test', repoRoot: root, modelRef: 'openai/gpt-4o' });

    expect(asyncPlan.diagnostics.filter((diagnostic) => diagnostic.code === 'prompt-assembly-provider-invalid-item')).toHaveLength(2);
    promptAssemblyHooks = [];
  });
});
