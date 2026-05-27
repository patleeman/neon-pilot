import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

import { readMachineInstructionFiles, readMachineSkillDirs, readMachineSystemPromptTemplate } from './machine-config.js';
import { listUnifiedSkillNodeDirs } from './nodes.js';
import {
  getDurableAgentFilePath,
  getDurableRuntimeConfigRoot as getCanonicalRuntimeConfigRoot,
  getDurableRuntimeScopeDir as getDurableRuntimeConfigDir,
  getDurableRuntimeScopeModelsFilePath as getDurableRuntimeModelsFilePath,
  getDurableRuntimeScopeSettingsFilePath as getDurableRuntimeSettingsFilePath,
  getDurableSkillsDir,
  getDurableTasksDir,
  getKnowledgeRoot,
  getLocalRuntimeConfigDir as getCanonicalLocalProfileDir,
  getStateRoot,
  getSyncRoot,
} from './runtime/paths.js';
import { renderSystemPromptTemplate, type SystemPromptTemplateVariables } from './system-prompt-template.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export interface ResourceLayer {
  name: string;
  agentDir: string;
}

export interface ResolvedRuntimeResources {
  name: string;
  repoRoot: string;
  knowledgeRoot: string;
  runtimeConfigRoot: string;
  layers: ResourceLayer[];
  extensionDirs: string[];
  extensionEntries: string[];
  skillDirs: string[];
  promptDirs: string[];
  promptEntries: string[];
  themeDirs: string[];
  themeEntries: string[];
  agentsFiles: string[];
  appendSystemFiles: string[];
  systemPromptFile?: string;
  settingsFiles: string[];
  modelsFiles: string[];
}

export interface ResolveResourceOptions {
  repoRoot?: string;
  knowledgeRoot?: string;
  vaultRoot?: string;
  localProfileDir?: string;
  runtimeConfigRoot?: string;
  /** Optional pre-resolved extension directory paths. When provided, core will use these instead of auto-discovering extensions. */
  extensionDirs?: string[];
  /** Optional pre-resolved extension entry paths. When provided, core will use these instead of auto-discovering entries. */
  extensionEntries?: string[];
  /** Working directory used for project instruction discovery. Defaults to process.cwd(). */
  cwd?: string;
}

export type PackageInstallTarget = 'local';

export interface ConfiguredPackageSource {
  source: string;
  filtered: boolean;
}

export interface PackageSourceTargetState {
  target: PackageInstallTarget;
  settingsPath: string;
  packages: ConfiguredPackageSource[];
}

export interface InstallPackageSourceOptions extends ResolveResourceOptions {
  source: string;
  target: PackageInstallTarget;
  sourceBaseDir?: string;
}

export interface InstallPackageSourceResult {
  installed: boolean;
  alreadyPresent: boolean;
  source: string;
  target: PackageInstallTarget;
  settingsPath: string;
}

function readJsonFile(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Failed to read JSON file ${path}: ${(error as Error).message}`);
  }
}

const DANGEROUS_MERGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (DANGEROUS_MERGE_KEYS.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = [...value];
      continue;
    }

    if (value && typeof value === 'object') {
      const current = output[key];
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        output[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        output[key] = deepMerge({}, value as Record<string, unknown>);
      }
      continue;
    }

    output[key] = value;
  }

  return output;
}

function dedupe(paths: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const path of paths) {
    const resolvedPath = resolve(path);
    if (seen.has(resolvedPath)) continue;
    seen.add(resolvedPath);
    output.push(resolvedPath);
  }

  return output;
}

function existingDir(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  if (!statSync(path).isDirectory()) return undefined;
  return resolve(path);
}

function existingFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  if (!statSync(path).isFile()) return undefined;
  return resolve(path);
}

function readSettingsObject(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) {
    return {};
  }

  const parsed = readJsonFile(settingsPath);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Settings file must contain a JSON object: ${settingsPath}`);
  }

  return parsed;
}

function writeSettingsObject(settingsPath: string, settings: Record<string, unknown>): void {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function isRemotePackageSource(value: string): boolean {
  return (
    value.startsWith('npm:') ||
    value.startsWith('git:') ||
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('ssh://') ||
    value.startsWith('git://')
  );
}

function expandHomePath(value: string): string {
  if (value === '~') {
    return homedir();
  }

  if (value.startsWith('~/')) {
    return join(homedir(), value.slice(2));
  }

  return value;
}

function looksLikeExplicitLocalPath(value: string): boolean {
  return (
    value === '.' ||
    value === '..' ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('~/') ||
    value === '~' ||
    value.startsWith('/')
  );
}

function normalizePackageSource(value: string, baseDir: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('Package source must not be empty');
  }

  if (isRemotePackageSource(trimmed)) {
    return trimmed;
  }

  const expanded = expandHomePath(trimmed);
  if (isAbsolute(expanded)) {
    return resolve(expanded);
  }

  const candidate = resolve(baseDir, expanded);
  if (looksLikeExplicitLocalPath(trimmed) || existsSync(candidate)) {
    return candidate;
  }

  return trimmed;
}

function extractPackageSource(entry: unknown): string | undefined {
  if (typeof entry === 'string') {
    return entry;
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return undefined;
  }

  const source = (entry as { source?: unknown }).source;
  return typeof source === 'string' ? source : undefined;
}

export function resolveLocalProfileDir(options: ResolveResourceOptions = {}): string {
  const explicit = options.localProfileDir;

  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return resolve(expandHomePath(explicit.trim()));
  }

  return getCanonicalLocalProfileDir();
}

export function resolveLocalProfileSettingsFilePath(options: ResolveResourceOptions = {}): string {
  const localProfileDir = resolveLocalProfileDir(options);
  const nestedAgentDir = join(localProfileDir, 'agent');

  if (existsSync(nestedAgentDir)) {
    if (!statSync(nestedAgentDir).isDirectory()) {
      throw new Error(`Local profile agent path is not a directory: ${nestedAgentDir}`);
    }

    return join(nestedAgentDir, 'settings.json');
  }

  if (existsSync(localProfileDir) && !statSync(localProfileDir).isDirectory()) {
    throw new Error(`Local profile path is not a directory: ${localProfileDir}`);
  }

  return join(localProfileDir, 'settings.json');
}

export function resolveRuntimeSettingsFilePath(runtimeScope: string, options: ResolveResourceOptions = {}): string {
  validateRuntimeScopeName(runtimeScope || 'shared');
  return getDurableRuntimeSettingsFilePath(runtimeScope || 'shared', resolveRuntimeConfigRoot(options));
}

export function resolveRuntimeModelsFilePath(runtimeScope: string, options: ResolveResourceOptions = {}): string {
  validateRuntimeScopeName(runtimeScope || 'shared');
  return getDurableRuntimeModelsFilePath(runtimeScope || 'shared', resolveRuntimeConfigRoot(options));
}

function readConfiguredPackageEntries(settingsPath: string): unknown[] {
  const settings = readSettingsObject(settingsPath);
  const value = settings.packages;

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Expected "packages" in ${settingsPath} to be an array`);
  }

  return [...value];
}

export function readConfiguredPackageSources(settingsPath: string): ConfiguredPackageSource[] {
  return readConfiguredPackageEntries(settingsPath)
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          source: entry,
          filtered: false,
        } satisfies ConfiguredPackageSource;
      }

      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const source = extractPackageSource(entry);
      if (!source) {
        return null;
      }

      return {
        source,
        filtered: true,
      } satisfies ConfiguredPackageSource;
    })
    .filter((entry): entry is ConfiguredPackageSource => entry !== null);
}

export function readPackageSourceTargetState(target: PackageInstallTarget, options: ResolveResourceOptions = {}): PackageSourceTargetState {
  const settingsPath = resolveLocalProfileSettingsFilePath(options);

  return {
    target,
    settingsPath,
    packages: readConfiguredPackageSources(settingsPath),
  };
}

export function installPackageSource(options: InstallPackageSourceOptions): InstallPackageSourceResult {
  const settingsPath = resolveLocalProfileSettingsFilePath(options);
  const normalizedSource = normalizePackageSource(options.source, options.sourceBaseDir ?? process.cwd());
  const configuredPackages = readConfiguredPackageEntries(settingsPath);
  const settingsDir = dirname(settingsPath);
  const alreadyPresent = configuredPackages.some((entry) => {
    const source = extractPackageSource(entry);
    if (!source) {
      return false;
    }

    return normalizePackageSource(source, settingsDir) === normalizedSource;
  });

  if (alreadyPresent) {
    return {
      installed: false,
      alreadyPresent: true,
      source: normalizedSource,
      target: options.target,
      settingsPath,
    };
  }

  const settings = readSettingsObject(settingsPath);
  settings.packages = [...configuredPackages, normalizedSource];
  writeSettingsObject(settingsPath, settings);

  return {
    installed: true,
    alreadyPresent: false,
    source: normalizedSource,
    target: options.target,
    settingsPath,
  };
}

export function getRepoRoot(explicitRepoRoot?: string): string {
  const value = explicitRepoRoot ?? process.env.NEON_PILOT_REPO_ROOT ?? PACKAGE_ROOT;
  return resolve(value);
}

export function getRepoDefaultsAgentDir(explicitRepoRoot?: string): string {
  return join(getRepoRoot(explicitRepoRoot), 'defaults', 'agent');
}

function resolveKnowledgeRoot(options: ResolveResourceOptions = {}): string {
  const explicit = options.knowledgeRoot ?? options.vaultRoot ?? process.env.NEON_PILOT_KNOWLEDGE_ROOT ?? process.env.NEON_PILOT_VAULT_ROOT;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return resolve(expandHomePath(explicit.trim()));
  }

  return resolve(getKnowledgeRoot());
}

function resolveRuntimeConfigRoot(options: ResolveResourceOptions = {}): string {
  const explicit = options.runtimeConfigRoot ?? process.env.NEON_PILOT_PROFILES_ROOT;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return resolve(expandHomePath(explicit.trim()));
  }

  return resolve(getCanonicalRuntimeConfigRoot());
}

function getRuntimeConfigDir(runtimeScope: string, options: ResolveResourceOptions = {}): string {
  return getDurableRuntimeConfigDir(runtimeScope || 'shared', resolveRuntimeConfigRoot(options));
}

export function listRuntimeScopes(options: ResolveResourceOptions = {}): string[] {
  void options;
  return ['shared'];
}

function collectLayerDirs(layers: ResourceLayer[], relativePath: string): string[] {
  const dirs = layers
    .map((layer) => existingDir(join(layer.agentDir, relativePath)))
    .filter((value): value is string => value !== undefined);

  return dedupe(dirs);
}

function collectLayerFiles(layers: ResourceLayer[], relativePath: string): string[] {
  const files = layers
    .map((layer) => existingFile(join(layer.agentDir, relativePath)))
    .filter((value): value is string => value !== undefined);

  return dedupe(files);
}

function resolveConfiguredInstructionFiles(): string[] {
  return dedupe(
    readMachineInstructionFiles().flatMap((path) => {
      const file = existingFile(path);
      return file ? [file] : [];
    }),
  );
}

const PROJECT_INSTRUCTION_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursorrules', '.windsurfrules'] as const;
const PROJECT_ROOT_INSTRUCTION_FILE_PATHS = ['.github/copilot-instructions.md'] as const;

function isPathInsideOrEqual(parent: string, child: string): boolean {
  const childRelativePath = relative(resolve(parent), resolve(child));
  return childRelativePath.length === 0 || (!childRelativePath.startsWith('..') && !isAbsolute(childRelativePath));
}

function collectProjectInstructionFiles(repoRoot: string, cwd: string): string[] {
  const root = resolve(repoRoot);
  const current = resolve(cwd);
  if (!isPathInsideOrEqual(root, current)) return [];

  const dirs: string[] = [];
  let dir = current;
  while (isPathInsideOrEqual(root, dir)) {
    dirs.unshift(dir);
    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return dedupe([
    ...PROJECT_ROOT_INSTRUCTION_FILE_PATHS.flatMap((relativePath) => {
      const file = existingFile(join(root, relativePath));
      return file ? [file] : [];
    }),
    ...dirs.flatMap((directory) =>
      PROJECT_INSTRUCTION_FILE_NAMES.flatMap((fileName) => {
        const file = existingFile(join(directory, fileName));
        return file ? [file] : [];
      }),
    ),
  ]);
}

function collectConfiguredSkillDirs(rootDir: string): string[] {
  const directSkillFiles = [existingFile(join(rootDir, 'SKILL.md')), existingFile(join(rootDir, 'INDEX.md'))].filter(
    (value): value is string => value !== undefined,
  );
  if (directSkillFiles.length > 0) {
    return [rootDir];
  }

  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    return [];
  }

  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(rootDir, entry.name))
    .filter((dir) => existingFile(join(dir, 'SKILL.md')) !== undefined || existingFile(join(dir, 'INDEX.md')) !== undefined)
    .sort((left, right) => left.localeCompare(right));
}

function resolveConfiguredSkillDirs(): string[] {
  return dedupe(
    readMachineSkillDirs().flatMap((path) => {
      const dir = existingDir(path);
      return dir ? collectConfiguredSkillDirs(dir) : [];
    }),
  );
}

function isExtensionEntrypointFile(name: string): boolean {
  if (!name.endsWith('.ts') && !name.endsWith('.js')) {
    return false;
  }

  if (name.endsWith('.test.ts') || name.endsWith('.test.js')) {
    return false;
  }

  if (name.endsWith('.spec.ts') || name.endsWith('.spec.js')) {
    return false;
  }

  return true;
}

function discoverExtensionEntries(extensionDir: string): string[] {
  if (!existsSync(extensionDir)) return [];

  const entries = readdirSync(extensionDir, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      if (isExtensionEntrypointFile(entry.name)) {
        output.push(join(extensionDir, entry.name));
      }
      continue;
    }

    if (entry.isDirectory()) {
      const indexTs = join(extensionDir, entry.name, 'index.ts');
      const indexJs = join(extensionDir, entry.name, 'index.js');

      if (existsSync(indexTs)) {
        output.push(indexTs);
      } else if (existsSync(indexJs)) {
        output.push(indexJs);
      }
    }
  }

  output.sort();
  return dedupe(output);
}

function discoverFilesWithExtensions(rootDir: string, extensions: string[]): string[] {
  if (!existsSync(rootDir)) return [];

  const output: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        output.push(fullPath);
      }
    }
  }

  output.sort();
  return dedupe(output);
}

function validateRuntimeScopeName(runtimeScope: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(runtimeScope)) {
    throw new Error(
      `Invalid runtime scope name "${runtimeScope}". ` + 'Runtime scope names may only include letters, numbers, dashes, and underscores.',
    );
  }
}

function resolveSharedKnowledgeAgentFile(options: ResolveResourceOptions = {}): string | undefined {
  return existingFile(getDurableAgentFilePath(resolveKnowledgeRoot(options)));
}

function resolveDurableAgentFiles(_runtimeScope: string, options: ResolveResourceOptions = {}): string[] {
  const sharedAgent = resolveSharedKnowledgeAgentFile(options);
  return sharedAgent ? [sharedAgent] : [];
}

function resolveDurableSettingsFiles(_runtimeScope: string, options: ResolveResourceOptions = {}): string[] {
  const output: string[] = [];
  const sharedSettings = existingFile(resolveRuntimeSettingsFilePath('shared', options));

  if (sharedSettings) {
    output.push(sharedSettings);
  }

  return dedupe(output);
}

function resolveDurableModelsFiles(_runtimeScope: string, options: ResolveResourceOptions = {}): string[] {
  const output: string[] = [];
  const sharedModels = existingFile(resolveRuntimeModelsFilePath('shared', options));

  if (sharedModels) {
    output.push(sharedModels);
  }

  return dedupe(output);
}

function buildResourceLayers(input: {
  repoDefaultsAgentDir: string | undefined;
  durableAgentFiles: string[];
  durableSettingsFiles: string[];
  durableModelsFiles: string[];
  durableSkillDirs: string[];
  runtimeScope: string;
  knowledgeRoot: string;
  options: ResolveResourceOptions;
}): ResourceLayer[] {
  const layers: ResourceLayer[] = [];

  if (input.repoDefaultsAgentDir) {
    layers.push({ name: 'defaults', agentDir: input.repoDefaultsAgentDir });
  }

  if (
    input.durableAgentFiles.length > 0 ||
    input.durableSettingsFiles.length > 0 ||
    input.durableModelsFiles.length > 0 ||
    input.durableSkillDirs.length > 0 ||
    existsSync(getRuntimeConfigDir(input.runtimeScope, input.options)) ||
    input.runtimeScope === 'shared'
  ) {
    layers.push({ name: 'durable', agentDir: input.knowledgeRoot });
  }

  const localBase = resolveLocalProfileDir(input.options);
  const localAgentDir = existingDir(join(localBase, 'agent')) ?? existingDir(localBase);
  if (localAgentDir) {
    layers.push({ name: 'local', agentDir: localAgentDir });
  }

  return layers;
}

function resolveExtensionResources(
  localLayers: ResourceLayer[],
  options: ResolveResourceOptions,
): { extensionDirs: string[]; extensionEntries: string[] } {
  const extensionDirs =
    options.extensionDirs !== undefined ? options.extensionDirs : dedupe([...collectLayerDirs(localLayers, 'extensions')]);
  return {
    extensionDirs,
    extensionEntries:
      options.extensionEntries !== undefined
        ? options.extensionEntries
        : dedupe(extensionDirs.flatMap((dir) => discoverExtensionEntries(dir))),
  };
}

function resolvePromptThemeResources(localLayers: ResourceLayer[]): {
  promptDirs: string[];
  promptEntries: string[];
  themeDirs: string[];
  themeEntries: string[];
} {
  const promptDirs = collectLayerDirs(localLayers, 'prompts');
  const themeDirs = dedupe([...collectLayerDirs(localLayers, 'themes')]);

  return {
    promptDirs,
    promptEntries: dedupe(promptDirs.flatMap((dir) => discoverFilesWithExtensions(dir, ['.md']))),
    themeDirs,
    themeEntries: dedupe(themeDirs.flatMap((dir) => discoverFilesWithExtensions(dir, ['.json']))),
  };
}

function resolveInstructionFiles(input: {
  repoDefaultsAgentDir: string | undefined;
  durableAgentFiles: string[];
  repoRoot: string;
  cwd: string | undefined;
  localLayers: ResourceLayer[];
}): string[] {
  return dedupe([
    ...collectLayerFiles(input.repoDefaultsAgentDir ? [{ name: 'defaults', agentDir: input.repoDefaultsAgentDir }] : [], 'AGENTS.md'),
    ...input.durableAgentFiles,
    ...resolveConfiguredInstructionFiles(),
    ...collectProjectInstructionFiles(input.repoRoot, input.cwd ?? process.cwd()),
    ...collectLayerFiles(input.localLayers, 'AGENTS.md'),
  ]);
}

function resolveSettingsModelFiles(input: {
  repoDefaultsAgentDir: string | undefined;
  durableSettingsFiles: string[];
  durableModelsFiles: string[];
  localLayers: ResourceLayer[];
}): { settingsFiles: string[]; modelsFiles: string[] } {
  const defaultsLayer = input.repoDefaultsAgentDir ? [{ name: 'defaults', agentDir: input.repoDefaultsAgentDir }] : [];
  return {
    settingsFiles: dedupe([
      ...collectLayerFiles(defaultsLayer, 'settings.json'),
      ...input.durableSettingsFiles,
      ...collectLayerFiles(input.localLayers, 'settings.json'),
    ]),
    modelsFiles: dedupe([
      ...collectLayerFiles(defaultsLayer, 'models.json'),
      ...input.durableModelsFiles,
      ...collectLayerFiles(input.localLayers, 'models.json'),
    ]),
  };
}

export function resolveRuntimeResources(name: string, options: ResolveResourceOptions = {}): ResolvedRuntimeResources {
  validateRuntimeScopeName(name || 'shared');
  const runtimeScope = 'shared';

  const repoRoot = getRepoRoot(options.repoRoot);
  const knowledgeRoot = resolveKnowledgeRoot(options);
  const runtimeConfigRoot = resolveRuntimeConfigRoot(options);

  const repoDefaultsAgentDir = existingDir(getRepoDefaultsAgentDir(repoRoot));

  const durableAgentFiles = resolveDurableAgentFiles(runtimeScope, options);
  const configuredSkillDirs = resolveConfiguredSkillDirs();
  const durableSettingsFiles = resolveDurableSettingsFiles(runtimeScope, options);
  const durableModelsFiles = resolveDurableModelsFiles(runtimeScope, options);
  const durableSkillDirs = listUnifiedSkillNodeDirs(runtimeScope, { vaultRoot: knowledgeRoot });

  const layers = buildResourceLayers({
    repoDefaultsAgentDir,
    durableAgentFiles,
    durableSettingsFiles,
    durableModelsFiles,
    durableSkillDirs,
    runtimeScope,
    knowledgeRoot,
    options,
  });

  if (layers.length === 0) {
    throw new Error(`Shared defaults not found. Checked ${getRepoDefaultsAgentDir(repoRoot)} and ${knowledgeRoot}`);
  }

  const localLayers = layers.filter((layer) => layer.name === 'local');
  const systemPromptFile = [...layers]
    .reverse()
    .map((layer) => existingFile(join(layer.agentDir, 'SYSTEM.md')))
    .find((file): file is string => file !== undefined);

  // Extensions: use host-provided entries if supplied, otherwise auto-discover from layers
  const { extensionDirs, extensionEntries } = resolveExtensionResources(localLayers, options);
  const skillDirs = dedupe([...durableSkillDirs, ...configuredSkillDirs, ...collectLayerDirs(localLayers, 'skills')]);
  const { promptDirs, promptEntries, themeDirs, themeEntries } = resolvePromptThemeResources(localLayers);
  const { settingsFiles, modelsFiles } = resolveSettingsModelFiles({
    repoDefaultsAgentDir,
    durableSettingsFiles,
    durableModelsFiles,
    localLayers,
  });

  return {
    name: runtimeScope,
    repoRoot,
    knowledgeRoot,
    runtimeConfigRoot,
    layers,
    extensionDirs,
    extensionEntries,
    skillDirs,
    promptDirs,
    promptEntries,
    themeDirs,
    themeEntries,
    agentsFiles: resolveInstructionFiles({ repoDefaultsAgentDir, durableAgentFiles, repoRoot, cwd: options.cwd, localLayers }),
    appendSystemFiles: collectLayerFiles(
      layers.filter((layer) => layer.name !== 'durable'),
      'APPEND_SYSTEM.md',
    ),
    systemPromptFile,
    settingsFiles,
    modelsFiles,
  };
}

export function mergeJsonFiles(paths: string[]): Record<string, unknown> {
  let merged: Record<string, unknown> = {};
  for (const path of paths) {
    merged = deepMerge(merged, readJsonFile(path));
  }
  return merged;
}

function combineMarkdownChunks(chunks: string[], separator = '\n\n---\n\n'): string {
  return chunks
    .map((chunk) => chunk.trim())
    .filter((text) => text.length > 0)
    .join(separator);
}

function combineMarkdownFiles(paths: string[]): string {
  return combineMarkdownChunks(paths.map((path) => readFileSync(path, 'utf-8')));
}

function readRuntimeLastChangelogVersion(settingsPath: string): string | undefined {
  if (!existsSync(settingsPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8')) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    const value = (parsed as Record<string, unknown>).lastChangelogVersion;
    if (typeof value !== 'string' || value.length === 0) {
      return undefined;
    }

    return value;
  } catch {
    return undefined;
  }
}

const DEFAULT_SETTINGS: Record<string, unknown> = {
  defaultProvider: 'openai-codex',
  defaultModel: 'gpt-5.4',
  defaultThinkingLevel: 'xhigh',
  theme: 'cobalt2',
  themeDark: 'cobalt2',
  themeLight: 'cobalt2-light',
  themeMode: 'system',
};

function mergeMaterializedSettings(settingsFiles: string[], targetSettingsPath: string): Record<string, unknown> {
  let merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const path of settingsFiles) {
    const layerSettings = readJsonFile(path);
    merged = deepMerge(merged, layerSettings);
  }

  const runtimeLastChangelogVersion = readRuntimeLastChangelogVersion(targetSettingsPath);

  if (runtimeLastChangelogVersion) {
    merged.lastChangelogVersion = runtimeLastChangelogVersion;
  } else {
    delete merged.lastChangelogVersion;
  }

  return merged;
}

export interface MaterializeRuntimeResourcesResult {
  agentDir: string;
  writtenFiles: string[];
}

export function materializeRuntimeResourcesToAgentDir(
  resources: ResolvedRuntimeResources,
  agentDir: string,
): MaterializeRuntimeResourcesResult {
  const targetDir = resolve(agentDir);
  mkdirSync(targetDir, { recursive: true });

  const writtenFiles: string[] = [];

  const writeOrRemove = (fileName: string, content: string | undefined) => {
    const targetPath = join(targetDir, fileName);

    if (content === undefined) {
      if (existsSync(targetPath)) {
        rmSync(targetPath, { force: true });
      }
      return;
    }

    writeFileSync(targetPath, content);
    writtenFiles.push(targetPath);
  };

  const materializedSettings =
    resources.settingsFiles.length > 0 ? mergeMaterializedSettings(resources.settingsFiles, join(targetDir, 'settings.json')) : null;

  if (materializedSettings) {
    writeOrRemove('settings.json', JSON.stringify(materializedSettings, null, 2));
  } else {
    writeOrRemove('settings.json', undefined);
  }

  if (resources.modelsFiles.length > 0) {
    const models = mergeJsonFiles(resources.modelsFiles);
    writeOrRemove('models.json', JSON.stringify(models, null, 2));
  } else {
    writeOrRemove('models.json', undefined);
  }

  if (resources.agentsFiles.length > 0) {
    const agentsContent = combineMarkdownFiles(resources.agentsFiles);
    writeOrRemove('AGENTS.md', `${agentsContent}\n`);
  } else {
    writeOrRemove('AGENTS.md', undefined);
  }

  if (resources.systemPromptFile) {
    const systemContent = readFileSync(resources.systemPromptFile, 'utf-8');
    writeOrRemove('SYSTEM.md', systemContent);
  } else {
    writeOrRemove('SYSTEM.md', undefined);
  }

  // Build template variables for the system prompt
  const templateVariables: SystemPromptTemplateVariables = {
    repo_root: resources.repoRoot,
    knowledge_root: resources.knowledgeRoot,
    agents_edit_target: getDurableAgentFilePath(resources.knowledgeRoot),
    skills_dir: getDurableSkillsDir(resources.knowledgeRoot),
    tasks_dir: getDurableTasksDir(getSyncRoot(getStateRoot())),
    docs_dir: join(resources.repoRoot, 'docs'),
    docs_index: join(resources.repoRoot, 'docs', 'README.md'),
  };

  const generatedAppendContent = renderSystemPromptTemplate(templateVariables, readMachineSystemPromptTemplate());
  const fileAppendContent = resources.appendSystemFiles.length > 0 ? combineMarkdownFiles(resources.appendSystemFiles) : undefined;
  const appendContent = combineMarkdownChunks([generatedAppendContent ?? '', fileAppendContent ?? '']);

  if (appendContent.length > 0) {
    writeOrRemove('APPEND_SYSTEM.md', `${appendContent}\n`);
  } else {
    writeOrRemove('APPEND_SYSTEM.md', undefined);
  }

  return { agentDir: targetDir, writtenFiles };
}

export interface BuildPiArgsOptions {
  includeNoDiscoveryFlags?: boolean;
}

export function getExtensionDependencyDirs(resources: ResolvedRuntimeResources): string[] {
  const dependencyDirs: string[] = [];

  for (const extensionDir of resources.extensionDirs) {
    if (!existsSync(extensionDir)) {
      continue;
    }

    if (existsSync(join(extensionDir, 'package.json'))) {
      dependencyDirs.push(extensionDir);
    }

    const entries = readdirSync(extensionDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = join(extensionDir, entry.name);
      if (existsSync(join(candidate, 'package.json'))) {
        dependencyDirs.push(candidate);
      }
    }
  }

  return dedupe(dependencyDirs);
}

export function buildPiResourceArgs(resources: ResolvedRuntimeResources, options: BuildPiArgsOptions = {}): string[] {
  const args: string[] = [];

  if (options.includeNoDiscoveryFlags !== false) {
    args.push('--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes');
  }

  for (const extensionEntry of resources.extensionEntries) {
    args.push('-e', extensionEntry);
  }

  for (const skillDir of resources.skillDirs) {
    args.push('--skill', skillDir);
  }

  for (const promptEntry of resources.promptEntries) {
    args.push('--prompt-template', promptEntry);
  }

  for (const themeEntry of resources.themeEntries) {
    args.push('--theme', themeEntry);
  }

  return args;
}

export { getPromptCatalogRoot, readPromptCatalogEntry, renderPromptCatalogTemplate, requirePromptCatalogEntry } from './prompt-catalog.js';
