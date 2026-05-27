import { callServerModuleExport } from './serverModuleResolver.js';

async function callModuleExport<T>(specifier: string, name: string, ...args: unknown[]): Promise<T> {
  return callServerModuleExport<T>(specifier, name, ...args);
}

export async function buildRecentReadUsage(...args: unknown[]) {
  return callModuleExport<Map<string, unknown>>('../../knowledge/memoryDocs.js', 'buildRecentReadUsage', ...args);
}

export async function listMemoryDocs(...args: unknown[]) {
  return callModuleExport<Array<Record<string, unknown>>>('../../knowledge/memoryDocs.js', 'listMemoryDocs', ...args);
}

export async function listSkillsForProfile(...args: unknown[]) {
  return callModuleExport<Array<Record<string, unknown>>>('../../knowledge/memoryDocs.js', 'listSkillsForProfile', ...args);
}

export async function normalizeMemoryPath(...args: unknown[]) {
  return callModuleExport<string>('../../knowledge/memoryDocs.js', 'normalizeMemoryPath', ...args);
}

export async function getDurableAgentFilePath(...args: unknown[]) {
  return callModuleExport<string>('@neon-pilot/core', 'getDurableAgentFilePath', ...args);
}

export async function getKnowledgeRoot(...args: unknown[]) {
  return callModuleExport<string>('@neon-pilot/core', 'getKnowledgeRoot', ...args);
}

export async function resolveRuntimeResources(...args: unknown[]) {
  return callModuleExport<{ agentsFiles: string[] }>('@neon-pilot/core', 'resolveRuntimeResources', ...args);
}
