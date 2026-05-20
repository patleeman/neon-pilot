import type { ExtensionBackendContext } from '@neon-pilot/extensions';

import { buildInstructionPlan } from '../../../packages/desktop/server/prompt-assembly/instructionInventory.js';
import { buildPromptAssemblyPlanAsync } from '../../../packages/desktop/server/prompt-assembly/promptAssembly.js';
import { buildPromptTemplatePlanAsync } from '../../../packages/desktop/server/prompts/promptTemplateInventory.js';
import { buildSkillInventoryAsync, setSkillEnabled } from '../../../packages/desktop/server/skills/skillInventory.js';
import { buildToolInjectionPlanAsync } from '../../../packages/desktop/server/tools/toolInventory.js';

export async function inspectPromptAssembly(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const repoRoot = typeof body.repoRoot === 'string' && body.repoRoot.trim() ? body.repoRoot.trim() : process.cwd();
  const modelRef = typeof body.modelRef === 'string' ? body.modelRef : undefined;
  const runtimeCtx = { profile: ctx.profile, repoRoot, modelRef };
  const [plan, skills, tools, promptTemplates, instructions] = await Promise.all([
    buildPromptAssemblyPlanAsync(runtimeCtx),
    buildSkillInventoryAsync(runtimeCtx),
    buildToolInjectionPlanAsync(runtimeCtx),
    buildPromptTemplatePlanAsync(runtimeCtx),
    buildInstructionPlan(runtimeCtx),
  ]);
  return { ok: true, plan, skills, tools: tools.tools, promptTemplates: promptTemplates.templates, instructions: instructions.layers };
}

export async function updateSkillEnabled(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) throw new Error('skill id is required.');
  const enabled = body.enabled !== false;
  setSkillEnabled(id, enabled);
  return { ok: true, id, enabled };
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
