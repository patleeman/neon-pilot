import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { getDurableSkillsDir, getStateRoot, resolveRuntimeResources } from '@personal-agent/core';

import { invokeExtensionAction } from '../extensions/extensionBackend.js';
import { listExtensionAssemblyProviderRegistrations, listExtensionSkillRegistrations } from '../extensions/extensionRegistry.js';

const REGISTRY_FILE = 'skills-registry.json';

export type SkillSourceKind = 'extension' | 'knowledge' | 'configured-folder';

export interface SkillSource {
  kind: SkillSourceKind;
  label: string;
  extensionId?: string;
  root?: string;
}

export interface SkillDefinition {
  id: string;
  providerId: string;
  title: string;
  description: string;
  source: SkillSource;
  location?: { kind: 'file'; path: string; root?: string };
  metadata?: Record<string, unknown>;
}

export interface RuntimeSkill extends SkillDefinition {
  enabled: boolean;
  priority: number;
  diagnostics: SkillDiagnostic[];
}

export interface SkillDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface RuntimeSkillInjectionPlan {
  skills: RuntimeSkill[];
  skillPaths: string[];
  inlineSkills: RuntimeSkill[];
  diagnostics: SkillDiagnostic[];
}

export interface SkillRuntimeContext {
  profile: string;
  repoRoot: string;
}

export interface SkillRuntimeHook {
  id: string;
  priority?: number;
  afterSkillDiscovery?(skills: SkillDefinition[], ctx: SkillRuntimeContext): SkillDefinition[];
  beforeSkillInjection?(skills: RuntimeSkill[], ctx: SkillRuntimeContext): RuntimeSkill[];
  afterSkillInjection?(plan: RuntimeSkillInjectionPlan, ctx: SkillRuntimeContext): void;
}

const runtimeHooks: SkillRuntimeHook[] = [];

export function registerSkillRuntimeHook(hook: SkillRuntimeHook): () => void {
  runtimeHooks.push(hook);
  runtimeHooks.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id));
  return () => {
    const index = runtimeHooks.findIndex((candidate) => candidate === hook);
    if (index >= 0) runtimeHooks.splice(index, 1);
  };
}

export function readDisabledSkillIds(): Set<string> {
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

export function setSkillEnabled(id: string, enabled: boolean): void {
  const disabled = readDisabledSkillIds();
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  writeSkillsRegistry(disabled);
}

export function listSkillDefinitions(ctx: SkillRuntimeContext): SkillDefinition[] {
  let skills = [...listConfiguredSkillDefinitions(ctx), ...listExtensionSkillDefinitions()];
  for (const hook of runtimeHooks) {
    if (hook.afterSkillDiscovery) skills = hook.afterSkillDiscovery(skills, ctx);
  }
  return dedupeSkills(skills);
}

export async function listSkillDefinitionsAsync(ctx: SkillRuntimeContext): Promise<SkillDefinition[]> {
  const skills = listSkillDefinitions(ctx);
  const providers = listExtensionAssemblyProviderRegistrations().filter((provider) => provider.kind === 'skills');
  await Promise.allSettled(
    providers.map(async (provider) => {
      const result = await invokeExtensionAction(provider.extensionId, provider.handler, { profile: ctx.profile, repoRoot: ctx.repoRoot });
      if (!result.ok) return;
      const payload = result.result as { skills?: SkillDefinition[] } | SkillDefinition[];
      const provided = Array.isArray(payload) ? payload : Array.isArray(payload.skills) ? payload.skills : [];
      skills.push(
        ...provided.map((skill) => ({
          ...skill,
          providerId: skill.providerId || `extension-provider:${provider.extensionId}/${provider.id}`,
          source: skill.source || { kind: 'extension', label: provider.title ?? provider.id, extensionId: provider.extensionId },
        })),
      );
    }),
  );
  return dedupeSkills(skills);
}

export function buildSkillInventory(ctx: SkillRuntimeContext): RuntimeSkill[] {
  const disabled = readDisabledSkillIds();
  const skills = listSkillDefinitions(ctx).map((skill, index): RuntimeSkill => {
    const diagnostics = validateSkill(skill);
    return {
      ...skill,
      enabled: !disabled.has(skill.id) && !diagnostics.some((item) => item.severity === 'error'),
      priority: index,
      diagnostics,
    };
  });
  for (const hook of runtimeHooks) {
    if (hook.beforeSkillInjection) return hook.beforeSkillInjection(skills, ctx);
  }
  return skills;
}

export async function buildSkillInventoryAsync(ctx: SkillRuntimeContext): Promise<RuntimeSkill[]> {
  const disabled = readDisabledSkillIds();
  const skills = (await listSkillDefinitionsAsync(ctx)).map((skill, index): RuntimeSkill => {
    const diagnostics = validateSkill(skill);
    return {
      ...skill,
      enabled: !disabled.has(skill.id) && !diagnostics.some((item) => item.severity === 'error'),
      priority: index,
      diagnostics,
    };
  });
  for (const hook of runtimeHooks) {
    if (hook.beforeSkillInjection) return hook.beforeSkillInjection(skills, ctx);
  }
  return skills;
}

export function buildSkillInjectionPlan(ctx: SkillRuntimeContext): RuntimeSkillInjectionPlan {
  return buildSkillInjectionPlanFromRuntimeSkills(buildSkillInventory(ctx), ctx);
}

export async function buildSkillInjectionPlanAsync(ctx: SkillRuntimeContext): Promise<RuntimeSkillInjectionPlan> {
  const skills = await buildSkillInventoryAsync(ctx);
  return buildSkillInjectionPlanFromRuntimeSkills(skills, ctx);
}

function buildSkillInjectionPlanFromRuntimeSkills(skills: RuntimeSkill[], ctx: SkillRuntimeContext): RuntimeSkillInjectionPlan {
  const diagnostics = skills.flatMap((skill) => skill.diagnostics);
  const skillPaths = [
    ...new Set(skills.filter((skill) => skill.enabled && skill.location?.kind === 'file').map((skill) => dirname(skill.location!.path))),
  ];
  const plan: RuntimeSkillInjectionPlan = {
    skills,
    skillPaths,
    inlineSkills: skills.filter((skill) => skill.enabled && !skill.location),
    diagnostics,
  };
  for (const hook of runtimeHooks) {
    hook.afterSkillInjection?.(plan, ctx);
  }
  return plan;
}

export function buildFilteredSkillPaths(skillDirs: string[], extensionSkillDirs: string[]): string[] {
  const disabled = readDisabledSkillIds();
  const configured = listSkillDefinitionsFromParents(skillDirs, 'configured-folder').filter((skill) => !disabled.has(skill.id));
  const extension = extensionSkillDirs
    .map((dir) => ({ id: basename(dir), dir }))
    .filter((skill) => !disabled.has(skill.id))
    .map((skill) => skill.dir);
  return [...new Set([...configured.map((skill) => dirname(skill.location!.path)), ...extension])];
}

function listConfiguredSkillDefinitions(ctx: SkillRuntimeContext): SkillDefinition[] {
  const resolved = resolveRuntimeResources(ctx.profile, { repoRoot: ctx.repoRoot });
  const durableSkillsDir = getDurableSkillsDir();
  return dedupeSkills([
    ...listSkillDefinitionsFromParents(resolved.skillDirs, 'configured-folder'),
    ...listSkillDefinitionsFromParents([durableSkillsDir], 'knowledge'),
  ]);
}

function listExtensionSkillDefinitions(): SkillDefinition[] {
  return listExtensionSkillRegistrations().map(
    (skill): SkillDefinition => ({
      id: skill.id,
      providerId: `extension:${skill.extensionId}`,
      title: skill.title || skill.name || skill.id,
      description: skill.description ?? '',
      source: { kind: 'extension', label: skill.extensionId, extensionId: skill.extensionId, root: skill.packageRoot },
      location: { kind: 'file', path: skill.path, root: skill.packageRoot },
      metadata: { packageType: skill.packageType },
    }),
  );
}

function listSkillDefinitionsFromParents(parents: readonly string[], kind: SkillSourceKind): SkillDefinition[] {
  const definitions: SkillDefinition[] = [];
  for (const parent of parents) {
    if (!existsSync(parent)) continue;
    let entries: string[];
    try {
      entries = readdirSync(parent);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const dir = join(parent, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const path = [join(dir, 'SKILL.md'), join(dir, 'INDEX.md')].find((candidate) => existsSync(candidate));
      if (!path) continue;
      const metadata = readSkillMetadata(path);
      definitions.push({
        id: basename(dir),
        providerId: kind,
        title: metadata.name || basename(dir),
        description: metadata.description,
        source: { kind, label: kind === 'knowledge' ? 'Vault' : parent, root: parent },
        location: { kind: 'file', path, root: parent },
      });
    }
  }
  return definitions;
}

function validateSkill(skill: SkillDefinition): SkillDiagnostic[] {
  const diagnostics: SkillDiagnostic[] = [];
  if (!skill.description.trim())
    diagnostics.push({ severity: 'warning', code: 'missing-description', message: `${skill.id} has no description.` });
  if (skill.location?.kind === 'file' && !existsSync(skill.location.path)) {
    diagnostics.push({ severity: 'error', code: 'missing-file', message: `${skill.id} file is missing: ${skill.location.path}` });
  }
  return diagnostics;
}

function dedupeSkills<T extends SkillDefinition>(skills: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const skill of skills) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    result.push(skill);
  }
  return result.sort((a, b) => a.title.localeCompare(b.title));
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
  return join(getStateRoot(), REGISTRY_FILE);
}

function writeSkillsRegistry(disabledSkillIds: Set<string>): void {
  const registryPath = skillsRegistryPath();
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify({ disabledSkillIds: [...disabledSkillIds].sort() }, null, 2)}\n`);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
