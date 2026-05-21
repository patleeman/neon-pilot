import { writeMergedMcpConfigFile } from '@neon-pilot/core';
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

import {
  buildSkillInjectionPlanAsync,
  buildSkillInventoryAsync,
  setSkillEnabled,
} from '../../../packages/desktop/server/skills/skillInventory.js';

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  const skills = (await buildSkillInventoryAsync({ runtimeScope: ctx.runtimeScope ?? ctx.profile, repoRoot: process.cwd() })).map(
    (skill) => ({
      id: skill.id,
      name: skill.title,
      description: skill.description,
      path: skill.location?.kind === 'file' ? skill.location.path : '',
      source: skill.source.kind === 'knowledge' ? 'vault' : skill.source.kind === 'configured-folder' ? 'project' : skill.source.kind,
      sourceLabel: skill.source.label,
      extensionId: skill.source.extensionId,
      enabled: skill.enabled,
      diagnostics: skill.diagnostics,
    }),
  );
  return { ok: true, skills };
}

export async function updateSkillEnabled(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) throw new Error('skill id is required.');
  const enabled = body.enabled !== false;
  setSkillEnabled(id, enabled);
  await refreshSkillMcpConfig(_ctx);
  return { ok: true, id, enabled };
}

async function refreshSkillMcpConfig(ctx: ExtensionBackendContext): Promise<void> {
  const plan = await buildSkillInjectionPlanAsync({ runtimeScope: ctx.runtimeScope ?? ctx.profile, repoRoot: process.cwd() });
  const outputPath = `${ctx.runtimeDir}/mcp_servers.json`;
  const env = { ...process.env };
  if (env.MCP_CONFIG_PATH === outputPath) delete env.MCP_CONFIG_PATH;
  const merged = writeMergedMcpConfigFile({ outputPath, cwd: process.cwd(), env, skillDirs: plan.skillPaths });
  if (merged.bundledServerCount > 0) process.env.MCP_CONFIG_PATH = outputPath;
  else delete process.env.MCP_CONFIG_PATH;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
