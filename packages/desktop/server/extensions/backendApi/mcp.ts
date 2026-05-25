import { callServerModuleExport } from './serverModuleResolver.js';

async function callCoreExport<T>(name: string, ...args: unknown[]): Promise<T> {
  return callServerModuleExport<T>('@neon-pilot/core', name, ...args);
}

export async function authenticateMcpServer(...args: unknown[]) {
  return callCoreExport('authenticateMcpServer', ...args);
}

export async function buildMergedMcpConfigDocument(...args: unknown[]) {
  return callCoreExport('buildMergedMcpConfigDocument', ...args);
}

export async function callMcpTool(...args: unknown[]) {
  return callCoreExport('callMcpTool', ...args);
}

export async function clearMcpServerAuth(...args: unknown[]) {
  return callCoreExport('clearMcpServerAuth', ...args);
}

export async function grepMcpTools(...args: unknown[]) {
  return callCoreExport('grepMcpTools', ...args);
}

export async function inspectMcpServer(...args: unknown[]) {
  return callCoreExport('inspectMcpServer', ...args);
}

export async function inspectMcpTool(...args: unknown[]) {
  return callCoreExport('inspectMcpTool', ...args);
}

export async function listMcpCatalog(...args: unknown[]) {
  return callCoreExport('listMcpCatalog', ...args);
}

export async function readBundledSkillMcpManifests(...args: unknown[]) {
  return callCoreExport('readBundledSkillMcpManifests', ...args);
}

export async function readMcpConfigDocument(...args: unknown[]) {
  return callCoreExport('readMcpConfigDocument', ...args);
}
