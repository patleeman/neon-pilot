import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { getDurableSkillsDir, getStateRoot, resolveRuntimeResources } from '@personal-agent/core';
import type { ExtensionBackendContext } from '@personal-agent/extensions';
import {
  createRuntimeExtension,
  listExtensionInstallSummaries,
  reloadExtensionBackend,
  snapshotRuntimeExtension,
  validateExtensionPackage,
} from '@personal-agent/extensions/backend/extensions';
import { HOST_VIEW_COMPONENT_DEFINITIONS } from '@personal-agent/extensions/host-view-components';

const ADDITIONAL_EXTENSION_PATHS_SETTING = 'extensions.additionalPaths';
const SKILLS_REGISTRY_FILE = 'skills-registry.json';

interface ExtensionIdInput {
  id?: unknown;
  extensionId?: unknown;
}

interface SettingsRecord {
  [key: string]: unknown;
}

export async function listExtensions(_input: unknown, _ctx: ExtensionBackendContext) {
  return { ok: true, extensions: await listExtensionInstallSummaries() };
}

export async function listHostViewComponents(_input: unknown, _ctx: ExtensionBackendContext) {
  return { ok: true, hostViewComponents: HOST_VIEW_COMPONENT_DEFINITIONS };
}

export async function createExtension(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const result = await createRuntimeExtension({
    id: body.id,
    name: body.name,
    description: body.description,
    template: body.template,
  });
  return { ok: true, ...result };
}

export async function snapshotExtension(input: ExtensionIdInput, _ctx: ExtensionBackendContext) {
  const extensionId = requireExtensionId(input);
  return { ok: true, ...((await snapshotRuntimeExtension(extensionId)) as object) };
}

export async function reloadExtension(input: ExtensionIdInput, _ctx: ExtensionBackendContext) {
  const extensionId = requireExtensionId(input);
  const result = await reloadExtensionBackend(extensionId);
  return { ok: true, ...result };
}

export async function validateExtension(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const extensionId = typeof body.id === 'string' ? body.id : typeof body.extensionId === 'string' ? body.extensionId : undefined;
  const packageRoot = typeof body.packageRoot === 'string' ? body.packageRoot : undefined;
  return validateExtensionPackage({ extensionId, packageRoot });
}

export async function readSearchPaths(_input: unknown, ctx: ExtensionBackendContext) {
  return {
    ok: true,
    defaultLocation: join(ctx.runtimeDir, 'extensions'),
    configuredPaths: readConfiguredSearchPaths(ctx),
    environmentPaths: splitEnvironmentPathList(process.env.PERSONAL_AGENT_EXTENSION_PATHS),
  };
}

export async function updateSearchPaths(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const paths = Array.isArray(body.paths)
    ? body.paths
        .map((path) => (typeof path === 'string' ? path.trim() : ''))
        .filter((path): path is string => Boolean(path))
        .map((path) => resolve(path))
    : [];
  const pathsJoined = paths.join('\n');
  writeSettingsValue(ctx.profileSettingsFilePath, pathsJoined);
  writeSettingsValue(join(ctx.runtimeDir, 'settings.json'), pathsJoined);
  // Also write to the canonical state-root settings file that the extension
  // loader reads from (readConfiguredExtensionPaths). Without this, saved
  // search paths appear to be persisted but have no effect.
  writeSettingsValue(join(resolve(ctx.runtimeDir, '..'), 'settings.json'), pathsJoined);
  return readSearchPaths(input, ctx);
}

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  const disabledSkillIds = readDisabledSkillIds();
  const extensionSummaries = await listExtensionInstallSummaries();
  const skills = [
    ...listVaultSkillsForProfile(ctx.profile).map((skill) => ({
      id: skill.name,
      name: skill.name,
      description: skill.description,
      path: skill.path,
      source: skill.source === 'global' ? 'vault' : skill.source,
      sourceLabel: skill.source === 'global' ? 'Vault' : 'Project',
      enabled: !disabledSkillIds.has(skill.name),
    })),
    ...extensionSummaries.flatMap((extension) =>
      (extension.skills ?? []).map((skill) => ({
        id: skill.id || basename(dirname(skill.path)),
        name: skill.title || skill.name || skill.id,
        description: skill.description ?? '',
        path: skill.path,
        source: 'extension',
        sourceLabel: extension.name,
        extensionId: extension.id,
        enabled: !disabledSkillIds.has(skill.id || basename(dirname(skill.path))),
      })),
    ),
  ];
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, skills };
}

function listVaultSkillsForProfile(profile: string) {
  const resolved = resolveRuntimeResources(profile, { repoRoot: process.cwd() });
  const skillParents = [...resolved.skillDirs, getDurableSkillsDir()];
  const seen = new Set<string>();
  const skills: Array<{ name: string; description: string; path: string; source: string }> = [];
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
        name: metadata.name || id,
        description: metadata.description,
        path: filePath,
        source: resolve(parent) === resolve(getDurableSkillsDir()) ? 'global' : 'project',
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

export async function manageExtension(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const action = typeof body.action === 'string' ? body.action : 'list';
  if (action === 'list') return listExtensions(input, ctx);
  if (action === 'create') return createExtension(input, ctx);
  if (action === 'snapshot') return snapshotExtension(input as ExtensionIdInput, ctx);
  if (action === 'reload') return reloadExtension(input as ExtensionIdInput, ctx);
  if (action === 'validate') return validateExtension(input, ctx);
  if (action === 'hostViewComponents') return listHostViewComponents(input, ctx);
  if (action === 'readSearchPaths') return readSearchPaths(input, ctx);
  if (action === 'updateSearchPaths') return updateSearchPaths(input, ctx);
  if (action === 'listSkills') return listSkills(input, ctx);
  if (action === 'updateSkillEnabled') return updateSkillEnabled(input, ctx);
  throw new Error(`Unsupported extension manager action: ${action}`);
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

function requireExtensionId(input: ExtensionIdInput): string {
  const extensionId = typeof input?.extensionId === 'string' ? input.extensionId : typeof input?.id === 'string' ? input.id : undefined;
  if (!extensionId?.trim()) throw new Error('extension id is required.');
  return extensionId.trim();
}

function readSettingsFile(path: string): SettingsRecord {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function writeSettingsValue(path: string, value: string): void {
  const settings = readSettingsFile(path);
  settings[ADDITIONAL_EXTENSION_PATHS_SETTING] = value;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
}

function readConfiguredSearchPaths(ctx: ExtensionBackendContext): string[] {
  const localProfilePaths = splitConfiguredValue(readSettingsFile(ctx.profileSettingsFilePath)[ADDITIONAL_EXTENSION_PATHS_SETTING]);
  if (localProfilePaths.length > 0) return localProfilePaths;
  return splitConfiguredValue(readSettingsFile(join(ctx.runtimeDir, 'settings.json'))[ADDITIONAL_EXTENSION_PATHS_SETTING]);
}

function splitConfiguredValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string').flatMap(splitExtensionPathList);
  return typeof value === 'string' ? splitExtensionPathList(value) : [];
}

function splitExtensionPathList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitEnvironmentPathList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\n:]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
