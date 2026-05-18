import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@personal-agent/extensions';
import { listExtensionInstallSummaries } from '@personal-agent/extensions/backend/extensions';

// ── Registry ─────────────────────────────────────────────────────────────────

interface SkillsRegistry {
  disabledSkillIds: string[];
}

function getRegistryPath(runtimeDir: string): string {
  return join(runtimeDir, 'skills-registry.json');
}

function readRegistry(registryPath: string): SkillsRegistry {
  if (!existsSync(registryPath)) return { disabledSkillIds: [] };
  try {
    const parsed = JSON.parse(readFileSync(registryPath, 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const ids = Array.isArray(record.disabledSkillIds)
        ? record.disabledSkillIds.filter((id): id is string => typeof id === 'string')
        : [];
      return { disabledSkillIds: ids };
    }
  } catch {
    // fall through
  }
  return { disabledSkillIds: [] };
}

function writeRegistry(registryPath: string, registry: SkillsRegistry): void {
  mkdirSync(resolve(registryPath, '..'), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

// ── Skill discovery ───────────────────────────────────────────────────────────

export interface SkillEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  source: 'extension' | 'vault';
  extensionId?: string;
  extensionName?: string;
  enabled: boolean;
}

async function discoverSkills(runtimeDir: string): Promise<SkillEntry[]> {
  const registry = readRegistry(getRegistryPath(runtimeDir));
  const disabledSet = new Set(registry.disabledSkillIds);

  const skills: SkillEntry[] = [];

  // Extension-contributed skills
  const extensions = await listExtensionInstallSummaries();
  for (const ext of extensions) {
    for (const skill of ext.skills ?? []) {
      skills.push({
        id: skill.id ?? skill.name,
        title: skill.title ?? skill.name,
        description: skill.description ?? '',
        path: skill.path,
        source: 'extension',
        extensionId: ext.id,
        extensionName: ext.name,
        enabled: !disabledSet.has(skill.id ?? skill.name),
      });
    }
  }

  // Vault skills
  const vaultSkillsDir = join(runtimeDir, 'knowledge-base', 'repo', 'skills');
  if (existsSync(vaultSkillsDir)) {
    const entries = readdirSync(vaultSkillsDir);
    for (const dirName of entries) {
      const skillMdPath = join(vaultSkillsDir, dirName, 'SKILL.md');
      if (existsSync(skillMdPath) && statSync(join(vaultSkillsDir, dirName)).isDirectory()) {
        // Parse name/description from frontmatter if present
        let title = dirName;
        let description = '';
        try {
          const content = readFileSync(skillMdPath, 'utf-8');
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const fm = fmMatch[1];
            const nameMatch = fm.match(/^name:\s*(.+)$/m);
            const descMatch = fm.match(/^description:\s*(.+)$/m);
            if (nameMatch) title = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
          }
        } catch {
          // ignore parse errors
        }
        skills.push({
          id: dirName,
          title,
          description,
          path: skillMdPath,
          source: 'vault',
          enabled: !disabledSet.has(dirName),
        });
      }
    }
  }

  return skills.sort((a, b) => a.title.localeCompare(b.title));
}

// ── Backend actions ───────────────────────────────────────────────────────────

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  const skills = await discoverSkills(ctx.runtimeDir);
  return { ok: true, skills };
}

export async function toggleSkill(input: unknown, ctx: ExtensionBackendContext) {
  const body = input as Record<string, unknown>;
  const skillId = typeof body.skillId === 'string' ? body.skillId : undefined;
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;
  if (!skillId) throw new Error('skillId is required');

  const registryPath = getRegistryPath(ctx.runtimeDir);
  const registry = readRegistry(registryPath);
  const disabledSet = new Set(registry.disabledSkillIds);

  if (enabled === true) {
    disabledSet.delete(skillId);
  } else if (enabled === false) {
    disabledSet.add(skillId);
  } else {
    // toggle
    if (disabledSet.has(skillId)) {
      disabledSet.delete(skillId);
    } else {
      disabledSet.add(skillId);
    }
  }

  registry.disabledSkillIds = [...disabledSet];
  writeRegistry(registryPath, registry);
  return { ok: true, skillId, enabled: !disabledSet.has(skillId) };
}

export async function readSkillFile(input: unknown, _ctx: ExtensionBackendContext) {
  const body = input as Record<string, unknown>;
  const path = typeof body.path === 'string' ? body.path : undefined;
  if (!path) throw new Error('path is required');
  if (!existsSync(path)) throw new Error(`Skill file not found: ${path}`);
  const content = readFileSync(path, 'utf-8');
  return { ok: true, content };
}

export async function writeSkillFile(input: unknown, _ctx: ExtensionBackendContext) {
  const body = input as Record<string, unknown>;
  const path = typeof body.path === 'string' ? body.path : undefined;
  const content = typeof body.content === 'string' ? body.content : undefined;
  if (!path) throw new Error('path is required');
  if (content === undefined) throw new Error('content is required');
  // Only allow writing to vault skills (not system extension skills)
  const vaultSkillsBase = homedir();
  if (!path.startsWith(vaultSkillsBase)) {
    throw new Error('Can only edit vault skills');
  }
  writeFileSync(path, content, 'utf-8');
  return { ok: true };
}

// ── Skill folders (machine config) ───────────────────────────────────────────

function getConfigFilePath(): string {
  const explicit = process.env.PERSONAL_AGENT_CONFIG_FILE;
  if (explicit?.trim()) return resolve(explicit.trim());
  const configRoot = process.env.PERSONAL_AGENT_CONFIG_ROOT;
  const stateRoot = process.env.PERSONAL_AGENT_STATE_ROOT ?? join(homedir(), '.local', 'state', 'personal-agent-rc');
  return join(configRoot?.trim() || join(stateRoot, 'config'), 'config.json');
}

function readConfigFile(): Record<string, unknown> {
  const path = getConfigFilePath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeConfigFile(data: Record<string, unknown>): void {
  const path = getConfigFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readSkillFolders(_input: unknown, _ctx: ExtensionBackendContext) {
  const config = readConfigFile();
  const skillDirs = Array.isArray(config.skillDirs)
    ? (config.skillDirs as unknown[]).filter((d): d is string => typeof d === 'string')
    : [];
  return { ok: true, configFile: getConfigFilePath(), skillDirs };
}

export async function writeSkillFolders(input: unknown, _ctx: ExtensionBackendContext) {
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.skillDirs) || !body.skillDirs.every((d: unknown) => typeof d === 'string')) {
    throw new Error('skillDirs must be an array of strings');
  }
  const normalized = [...new Set((body.skillDirs as string[]).map((d) => d.trim()).filter(Boolean))];
  const config = readConfigFile();
  if (normalized.length > 0) {
    config.skillDirs = normalized;
  } else {
    delete config.skillDirs;
  }
  writeConfigFile(config);
  return { ok: true, configFile: getConfigFilePath(), skillDirs: normalized };
}
