import { buildPromptTemplatePlan, buildPromptTemplatePlanAsync } from '../prompts/promptTemplateInventory.js';
import { buildSkillInjectionPlan, buildSkillInjectionPlanAsync } from '../skills/skillInventory.js';
import { buildToolInjectionPlan, buildToolInjectionPlanAsync } from '../tools/toolInventory.js';
import { buildPromptContextPlan } from './promptContextInventory.js';
import type { AssemblyRuntimeContext, PromptAssemblyPlan } from './types.js';

export function buildPromptAssemblyPlan(ctx: AssemblyRuntimeContext): PromptAssemblyPlan {
  const skills = buildSkillInjectionPlan(ctx);
  const tools = buildToolInjectionPlan(ctx);
  const promptTemplates = buildPromptTemplatePlan(ctx);
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
  const [skills, tools, promptTemplates] = await Promise.all([
    buildSkillInjectionPlanAsync(ctx),
    buildToolInjectionPlanAsync(ctx),
    buildPromptTemplatePlanAsync(ctx),
  ]);
  const plan: PromptAssemblyPlan = {
    profile: ctx.profile,
    repoRoot: ctx.repoRoot,
    skills: { skillPaths: skills.skillPaths, inlineSkills: skills.inlineSkills, diagnostics: skills.diagnostics },
    tools: { activeToolNames: tools.activeToolNames, diagnostics: tools.diagnostics },
    promptTemplates: { templatePaths: promptTemplates.templatePaths, diagnostics: promptTemplates.diagnostics },
    context: { blocks: [], diagnostics: [] },
    diagnostics: [...skills.diagnostics, ...tools.diagnostics, ...promptTemplates.diagnostics],
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
  return plan;
}
