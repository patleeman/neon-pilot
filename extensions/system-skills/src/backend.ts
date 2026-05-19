import type { ExtensionBackendContext } from '@personal-agent/extensions';

import { buildSkillInventoryAsync, setSkillEnabled } from '../../../packages/desktop/server/skills/skillInventory.js';

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  const skills = (await buildSkillInventoryAsync({ profile: ctx.profile, repoRoot: process.cwd() })).map((skill) => ({
    id: skill.id,
    name: skill.title,
    description: skill.description,
    path: skill.location?.kind === 'file' ? skill.location.path : '',
    source: skill.source.kind === 'knowledge' ? 'vault' : skill.source.kind === 'configured-folder' ? 'project' : skill.source.kind,
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
  setSkillEnabled(id, enabled);
  return { ok: true, id, enabled };
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
