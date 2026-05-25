import { callServerModuleExport } from './serverModuleResolver.js';

async function callModuleExport<T>(specifier: string, name: string, ...args: unknown[]): Promise<T> {
  return callServerModuleExport<T>(specifier, name, ...args);
}

export async function buildInstructionPlan(...args: unknown[]) {
  return callModuleExport<Record<string, unknown>>('../../prompt-assembly/instructionInventory.js', 'buildInstructionPlan', ...args);
}

export async function buildPromptAssemblyPlanAsync(...args: unknown[]) {
  return callModuleExport<Record<string, unknown>>('../../prompt-assembly/promptAssembly.js', 'buildPromptAssemblyPlanAsync', ...args);
}

export async function buildPromptTemplatePlanAsync(...args: unknown[]) {
  return callModuleExport<Record<string, unknown>>('../../prompts/promptTemplateInventory.js', 'buildPromptTemplatePlanAsync', ...args);
}

export async function buildToolInjectionPlanAsync(...args: unknown[]) {
  return callModuleExport<Record<string, unknown>>('../../tools/toolInventory.js', 'buildToolInjectionPlanAsync', ...args);
}
