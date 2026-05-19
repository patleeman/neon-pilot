import { invokeExtensionAction } from '../extensions/extensionBackend.js';
import { listExtensionPromptAssemblyHookRegistrations } from '../extensions/extensionRegistry.js';
import { buildPromptTemplatePlan, buildPromptTemplatePlanAsync } from '../prompts/promptTemplateInventory.js';
import { buildSkillInjectionPlan, buildSkillInjectionPlanAsync } from '../skills/skillInventory.js';
import { buildToolInjectionPlan, buildToolInjectionPlanAsync } from '../tools/toolInventory.js';
import { buildInstructionPlan } from './instructionInventory.js';
import { buildPromptContextPlan } from './promptContextInventory.js';
import type { AssemblyRuntimeContext, PromptAssemblyPlan } from './types.js';

export function buildPromptAssemblyPlan(ctx: AssemblyRuntimeContext): PromptAssemblyPlan {
  const skills = buildSkillInjectionPlan(ctx);
  const tools = buildToolInjectionPlan(ctx);
  const promptTemplates = buildPromptTemplatePlan(ctx);
  const instructions = { layers: [], diagnostics: [] };
  return {
    profile: ctx.profile,
    repoRoot: ctx.repoRoot,
    skills: {
      skillPaths: skills.skillPaths,
      inlineSkills: skills.inlineSkills,
      diagnostics: skills.diagnostics,
    },
    tools: {
      activeToolNames: tools.activeToolNames,
      diagnostics: tools.diagnostics,
    },
    promptTemplates: {
      templatePaths: promptTemplates.templatePaths,
      diagnostics: promptTemplates.diagnostics,
    },
    context: { blocks: [], diagnostics: [] },
    instructions,
    diagnostics: [...skills.diagnostics, ...tools.diagnostics, ...promptTemplates.diagnostics],
  };
}

export async function buildPromptAssemblyPlanAsync(
  ctx: AssemblyRuntimeContext & {
    prompt?: string;
    conversationId?: string;
    selectedSessionIds?: unknown;
    contextMessages?: Array<{ customType: string; content: string }>;
  },
): Promise<PromptAssemblyPlan> {
  const [skills, tools, promptTemplates, instructions] = await Promise.all([
    buildSkillInjectionPlanAsync(ctx),
    buildToolInjectionPlanAsync(ctx),
    buildPromptTemplatePlanAsync(ctx),
    buildInstructionPlan(ctx),
  ]);
  const plan: PromptAssemblyPlan = {
    profile: ctx.profile,
    repoRoot: ctx.repoRoot,
    skills: { skillPaths: skills.skillPaths, inlineSkills: skills.inlineSkills, diagnostics: skills.diagnostics },
    tools: { activeToolNames: tools.activeToolNames, diagnostics: tools.diagnostics },
    promptTemplates: { templatePaths: promptTemplates.templatePaths, diagnostics: promptTemplates.diagnostics },
    context: { blocks: [], diagnostics: [] },
    instructions: { layers: instructions.layers, diagnostics: instructions.diagnostics },
    diagnostics: [...skills.diagnostics, ...tools.diagnostics, ...promptTemplates.diagnostics, ...instructions.diagnostics],
  };
  if (ctx.prompt && ctx.conversationId) {
    const context = await buildPromptContextPlan({
      prompt: ctx.prompt,
      conversationId: ctx.conversationId,
      currentCwd: ctx.cwd,
      selectedSessionIds: ctx.selectedSessionIds,
      contextMessages: ctx.contextMessages,
    });
    plan.context = { blocks: context.blocks, diagnostics: context.diagnostics };
    plan.diagnostics = [...plan.diagnostics, ...context.diagnostics];
  }
  await runPromptAssemblyHooks(plan, ctx);
  return plan;
}

async function runPromptAssemblyHooks(plan: PromptAssemblyPlan, ctx: AssemblyRuntimeContext): Promise<void> {
  const hooks = listExtensionPromptAssemblyHookRegistrations();
  await Promise.allSettled(
    hooks.map(async (hook) => {
      const result = await invokeExtensionAction(hook.extensionId, hook.handler, { plan, context: ctx, phase: hook.phase });
      if (!result.ok) {
        plan.diagnostics.push({
          severity: 'warning',
          code: 'prompt-assembly-hook-failed',
          message: `${hook.title ?? hook.id} hook failed; prompt assembly continued without it.`,
          sourceId: `${hook.extensionId}/${hook.id}`,
        });
        return;
      }
      const payload = result.result as { plan?: PromptAssemblyPlan; diagnostics?: PromptAssemblyPlan['diagnostics'] } | undefined;
      if (payload?.plan) Object.assign(plan, payload.plan);
      if (Array.isArray(payload?.diagnostics)) plan.diagnostics.push(...payload.diagnostics);
    }),
  );
}
