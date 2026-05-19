import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { getDurableSkillsDir, getStateRoot, resolveRuntimeResources } from '@personal-agent/core';
import type { ExtensionBackendContext } from '@personal-agent/extensions';
import { listExtensionInstallSummaries } from '@personal-agent/extensions/backend/extensions';

const SKILLS_REGISTRY_FILE = 'skills-registry.json';

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  const disabledSkillIds = readDisabledSkillIds();
  const extensionSummaries = await listExtensionInstallSummaries();
  const skills = [
    ...listVaultSkillsForProfile(ctx.profile).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      path: skill.path,
      source: skill.source === 'global' ? 'vault' : skill.source,
      sourceLabel: skill.source === 'global' ? 'Vault' : 'Project',
      enabled: !disabledSkillIds.has(skill.id),
    })),
    ...extensionSummaries.flatMap((extension) =>
      (extension.skills ?? []).map((skill) => {
        const id = skill.id || basename(dirname(skill.path));
        return {
          id,
          name: skill.title || skill.name || skill.id,
          description: skill.description ?? '',
          path: skill.path,
          source: 'extension',
          sourceLabel: extension.name,
          extensionId: extension.id,
          enabled: !disabledSkillIds.has(id),
        };
      }),
    ),
  ];
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, skills };
}

export async function updateSkillEnabled(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) throw new Error('skill id is required.');
  const enabled = body.enabled !== false;
  const disabledSkillIds = readDisabledSkillIds();
  if (enabled) disabledSkillIds.delete(id);
  else disabledSkillIds.add(id);
  writeSkillsRegistry(disabledSkillIds);
  return { ok: true, id, enabled };
}

function listVaultSkillsForProfile(profile: string) {
  const resolved = resolveRuntimeResources(profile, { repoRoot: process.cwd() });
  const durableSkillsDir = getDurableSkillsDir();
  const skillParents = [...resolved.skillDirs, durableSkillsDir];
  const seen = new Set<string>();
  const skills: Array<{ id: string; name: string; description: string; path: string; source: string }> = [];
  for (const parent of skillParents) {
    if (!existsSync(parent)) continue;
    let entries: string[];
    try {
      entries = readdirSync(parent);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = join(parent, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const filePath = [join(dir, 'SKILL.md'), join(dir, 'INDEX.md')].find((candidate) => existsSync(candidate));
      if (!filePath) continue;
      const id = basename(dir);
      if (seen.has(id)) continue;
      seen.add(id);
      const metadata = readSkillMetadata(filePath);
      skills.push({
        id,
        name: metadata.name || id,
        description: metadata.description,
        path: filePath,
        source: resolve(parent) === resolve(durableSkillsDir) ? 'global' : 'project',
      });
    }
  }
  return skills;
}

function readSkillMetadata(filePath: string): { name: string; description: string } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const name = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim() ?? '';
    const description = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim() ?? '';
    return { name, description };
  } catch {
    return { name: '', description: '' };
  }
}

function skillsRegistryPath(): string {
  return join(getStateRoot(), SKILLS_REGISTRY_FILE);
}

function readDisabledSkillIds(): Set<string> {
  const registryPath = skillsRegistryPath();
  if (!existsSync(registryPath)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(registryPath, 'utf-8')) as unknown;
    const record = asRecord(parsed);
    return new Set(
      Array.isArray(record.disabledSkillIds) ? record.disabledSkillIds.filter((id): id is string => typeof id === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function writeSkillsRegistry(disabledSkillIds: Set<string>): void {
  const registryPath = skillsRegistryPath();
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify({ disabledSkillIds: [...disabledSkillIds].sort() }, null, 2)}\n`);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
