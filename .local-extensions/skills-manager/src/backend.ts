import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

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

// ── Agent extension ───────────────────────────────────────────────────────────

type AgentExtensionAPI = {
  on: (event: string, handler: (event: Record<string, unknown>) => Promise<unknown> | unknown) => void;
};

function getRegistryPathForAgent(): string {
  return join(homedir(), '.local', 'state', 'personal-agent-rc', 'skills-registry.json');
}

function readRegistryForAgent(): SkillsRegistry {
  return readRegistry(getRegistryPathForAgent());
}

function filterDisabledSkills(systemPrompt: string, disabledIds: Set<string>): string {
  if (disabledIds.size === 0) return systemPrompt;
  return systemPrompt.replace(
    /(<available_skills>)([\s\S]*?)(<\/available_skills>)/,
    (_match: string, open: string, content: string, close: string) => {
      const filtered = content.replace(/<skill>[\s\S]*?<\/skill>/g, (skillBlock: string) => {
        const nameMatch = skillBlock.match(/<name>(.*?)<\/name>/);
        const skillName = nameMatch?.[1]?.trim();
        if (skillName && disabledIds.has(skillName)) return '';
        return skillBlock;
      });
      return open + filtered + close;
    },
  );
}

export function skillsManagerAgentExtension(pi: AgentExtensionAPI): void {
  pi.on('before_agent_start', (event: Record<string, unknown>) => {
    const systemPrompt = typeof event.systemPrompt === 'string' ? event.systemPrompt : '';
    if (!systemPrompt) return;

    const registry = readRegistryForAgent();
    if (registry.disabledSkillIds.length === 0) return;

    const disabledIds = new Set(registry.disabledSkillIds);
    const filtered = filterDisabledSkills(systemPrompt, disabledIds);
    if (filtered === systemPrompt) return;
    return { systemPrompt: filtered };
  });
}
