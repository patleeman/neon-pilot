import { callServerModuleExport } from './serverModuleResolver.js';

async function callModuleExport<T>(specifier: string, name: string, ...args: unknown[]): Promise<T> {
  return callServerModuleExport<T>(specifier, name, ...args);
}

export async function buildSkillInjectionPlanAsync(...args: unknown[]) {
  return callModuleExport<Record<string, unknown>>('../../skills/skillInventory.js', 'buildSkillInjectionPlanAsync', ...args);
}

export async function buildSkillInventoryAsync(...args: unknown[]) {
  return callModuleExport<Array<Record<string, unknown>>>('../../skills/skillInventory.js', 'buildSkillInventoryAsync', ...args);
}

export async function setSkillEnabled(...args: unknown[]) {
  return callModuleExport<void>('../../skills/skillInventory.js', 'setSkillEnabled', ...args);
}

export async function writeMergedMcpConfigFile(...args: unknown[]) {
  return callModuleExport<{ bundledServerCount: number }>('@neon-pilot/core', 'writeMergedMcpConfigFile', ...args);
}
