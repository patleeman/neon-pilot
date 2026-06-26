import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { refreshRegisteredSkillRuntimeResources } from '../app/runtimeState.js';
import { buildSkillInjectionPlanAsync } from '../skills/skillInventory.js';
import { callServerModuleExport } from './backendApi/serverModuleResolver.js';

export interface ExtensionRuntimeRefreshSkillMcpConfigInput {
  runtimeScope?: string;
  repoRoot?: string;
  runtimeDir: string;
}

export async function refreshHostSkillMcpConfig(
  input: ExtensionRuntimeRefreshSkillMcpConfigInput,
): Promise<{ mcpConfigPath: string | null }> {
  const repoRoot = input.repoRoot ?? process.cwd();
  const runtimeScope = input.runtimeScope ?? 'shared';
  const plan = await buildSkillInjectionPlanAsync({ runtimeScope, repoRoot });
  const outputPath = join(input.runtimeDir, 'mcp_servers.json');
  const env = { ...process.env };
  if (env.MCP_CONFIG_PATH === outputPath) delete env.MCP_CONFIG_PATH;
  const merged = await callServerModuleExport<{ bundledServerCount: number }>('@neon-pilot/core', 'writeMergedMcpConfigFile', {
    outputPath,
    cwd: existsSync(repoRoot) ? repoRoot : process.cwd(),
    env,
    skillDirs: plan.skillPaths,
  });
  refreshRegisteredSkillRuntimeResources({ runtimeScope, runtimeDir: input.runtimeDir });
  if (merged.bundledServerCount > 0) {
    process.env.MCP_CONFIG_PATH = outputPath;
    return { mcpConfigPath: outputPath };
  }
  delete process.env.MCP_CONFIG_PATH;
  return { mcpConfigPath: null };
}
