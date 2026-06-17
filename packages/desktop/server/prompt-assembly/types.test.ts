import { describe, expect, it } from 'vitest';

import type { AssemblyDiagnostic, AssemblyRuntimeContext, AssemblySource, PromptAssemblyPlan } from './types.js';

describe('prompt assembly public types', () => {
  it('keeps assembly diagnostics, sources, context, and plan shapes assignable', () => {
    const diagnostic: AssemblyDiagnostic = { severity: 'warning', code: 'code', message: 'message', sourceId: 'source' };
    const source: AssemblySource = { kind: 'extension', label: 'Extension', extensionId: 'ext', root: '/root' };
    const context: AssemblyRuntimeContext = {
      runtimeScope: 'shared',
      repoRoot: '/repo',
      modelRef: 'provider/model',
      provider: 'provider',
      cwd: '/repo',
    };
    const plan: PromptAssemblyPlan = {
      runtimeScope: 'shared',
      repoRoot: '/repo',
      skills: { skillPaths: ['/skills'], inlineSkills: [], diagnostics: [diagnostic] },
      tools: { activeToolNames: ['bash'], diagnostics: [] },
      promptTemplates: { templatePaths: ['/prompt.md'], diagnostics: [] },
      context: { blocks: [{ id: 'block' }], diagnostics: [] },
      instructions: { layers: [{ id: 'layer' }], diagnostics: [] },
      diagnostics: [diagnostic],
    };

    expect({ diagnostic, source, context, plan }).toMatchObject({
      diagnostic: { severity: 'warning', code: 'code' },
      source: { kind: 'extension', extensionId: 'ext' },
      context: { runtimeScope: 'shared' },
      plan: { runtimeScope: 'shared', tools: { activeToolNames: ['bash'] } },
    });
  });
});
