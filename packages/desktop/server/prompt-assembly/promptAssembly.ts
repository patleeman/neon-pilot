import { buildPromptTemplatePlan } from '../prompts/promptTemplateInventory.js';
import { buildSkillInjectionPlan } from '../skills/skillInventory.js';
import { buildToolInjectionPlan } from '../tools/toolInventory.js';
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
    diagnostics: [...skills.diagnostics, ...tools.diagnostics, ...promptTemplates.diagnostics],
  };
}
