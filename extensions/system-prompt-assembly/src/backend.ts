import type { ExtensionBackendContext } from '@personal-agent/extensions';

import { buildPromptAssemblyPlanAsync } from '../../../packages/desktop/server/prompt-assembly/promptAssembly.js';
import { buildPromptTemplatePlanAsync } from '../../../packages/desktop/server/prompts/promptTemplateInventory.js';
import { buildSkillInventoryAsync } from '../../../packages/desktop/server/skills/skillInventory.js';
import { buildToolInjectionPlanAsync } from '../../../packages/desktop/server/tools/toolInventory.js';

export async function inspectPromptAssembly(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const repoRoot = typeof body.repoRoot === 'string' && body.repoRoot.trim() ? body.repoRoot.trim() : process.cwd();
  const modelRef = typeof body.modelRef === 'string' ? body.modelRef : undefined;
  const runtimeCtx = { profile: ctx.profile, repoRoot, modelRef };
  const [plan, skills, tools, promptTemplates] = await Promise.all([
    buildPromptAssemblyPlanAsync(runtimeCtx),
    buildSkillInventoryAsync(runtimeCtx),
    buildToolInjectionPlanAsync(runtimeCtx),
    buildPromptTemplatePlanAsync(runtimeCtx),
  ]);
  return { ok: true, plan, skills, tools: tools.tools, promptTemplates: promptTemplates.templates };
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
