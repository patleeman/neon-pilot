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
