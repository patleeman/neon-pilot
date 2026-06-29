import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { buildSkillInventoryAsync, setSkillEnabled } from '@neon-pilot/extensions/backend/skills';

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  const skills = (await buildSkillInventoryAsync({ runtimeScope: ctx.runtimeScope, repoRoot: ctx.runtime.getRepoRoot() })).map((skill) => ({
    id: skill.id,
    name: skill.title,
    description: skill.description,
    path: skill.location?.kind === 'file' ? skill.location.path : '',
    source: skill.source.kind === 'knowledge' ? 'knowledge' : skill.source.kind === 'configured-folder' ? 'project' : skill.source.kind,
    sourceLabel: skill.source.label,
    extensionId: skill.source.extensionId,
    enabled: skill.enabled,
    diagnostics: skill.diagnostics,
  }));
  return { ok: true, skills };
}

export async function updateSkillEnabled(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) throw new Error('skill id is required.');
  const enabled = body.enabled !== false;
  await setSkillEnabled(id, enabled);
  await _ctx.runtime.refreshSkillMcpConfig();
  return { ok: true, id, enabled };
}

export async function skillsCli(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const action = typeof body.action === 'string' ? body.action : 'list';
  const cli = asRecord(body.cli);
  const args = Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
  if (action === 'list') return listSkills(body, ctx);
  if (action === 'enable' || action === 'disable') {
    const id = args[0] ?? (typeof body.id === 'string' ? body.id : undefined);
    return updateSkillEnabled({ id, enabled: action === 'enable' }, ctx);
  }
  throw new Error(`Unsupported skills CLI action: ${action}`);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
