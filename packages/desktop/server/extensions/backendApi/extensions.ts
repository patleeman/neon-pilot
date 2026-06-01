import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import type { ExtensionDoctorReport } from '@neon-pilot/extensions/backend/extensions';

import { importServerExtensionModule } from './serverModuleResolver.js';
import { importServerModule } from './serverModuleResolver.js';

type ExtensionLifecycleModule = typeof import('../extensionLifecycle.js');
type ExtensionBackendModule = typeof import('../extensionBackend.js');
type ExtensionRegistryModule = typeof import('../extensionRegistry.js');
type ExtensionCatalogModule = typeof import('../extensionCatalog.js');
type CoreModule = typeof import('@neon-pilot/core');

type RuntimeExtensionCreateOptions = Parameters<ExtensionLifecycleModule['createRuntimeExtension']>[0];
type ValidateExtensionPackageOptions = { extensionId?: string; packageRoot?: string };
type ExtensionSearchPathWriteOptions = { runtimeDir?: string; runtimeSettingsFilePath?: string; paths?: string[] };

const ADDITIONAL_EXTENSION_PATHS_SETTING = 'extensions.additionalPaths';
const IMPORTED_PACKAGE_SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'target']);
const MARKETPLACE_BEHAVIOR_PACKAGE_TYPES = new Set(['skill', 'instruction-pack', 'agent', 'template']);

interface ExtensionDoctorModule {
  validateExtensionPackage(input: ValidateExtensionPackageOptions): Promise<ExtensionDoctorReport>;
}

async function importExtensionLifecycle(): Promise<ExtensionLifecycleModule> {
  return importServerExtensionModule<ExtensionLifecycleModule>('../extensionLifecycle.js');
}

async function importExtensionBackend(): Promise<ExtensionBackendModule> {
  return importServerExtensionModule<ExtensionBackendModule>('../extensionBackend.js');
}

async function importExtensionDoctor(): Promise<ExtensionDoctorModule> {
  return importServerExtensionModule<ExtensionDoctorModule>('../extensionDoctor.js');
}

async function importExtensionRegistry(): Promise<ExtensionRegistryModule> {
  return importServerExtensionModule<ExtensionRegistryModule>('../extensionRegistry.js');
}

async function importExtensionCatalog(): Promise<ExtensionCatalogModule> {
  return importServerExtensionModule<ExtensionCatalogModule>('../extensionCatalog.js');
}

async function importCore(): Promise<CoreModule> {
  return importServerModule<CoreModule>('@neon-pilot/core');
}

export async function buildRuntimeExtension(extensionId: string) {
  const module = await importExtensionLifecycle();
  return module.buildRuntimeExtension(extensionId);
}

export async function createRuntimeExtension(options: RuntimeExtensionCreateOptions) {
  const module = await importExtensionLifecycle();
  return module.createRuntimeExtension(options);
}

export async function snapshotRuntimeExtension(extensionId: string) {
  const module = await importExtensionLifecycle();
  return module.snapshotRuntimeExtension(extensionId);
}

export async function reloadExtensionBackend(extensionId: string) {
  const module = await importExtensionBackend();
  return module.reloadExtensionBackend(extensionId);
}

export async function validateExtensionPackage(options: ValidateExtensionPackageOptions) {
  const module = await importExtensionDoctor();
  return module.validateExtensionPackage(options);
}

export async function listExtensionInstallSummaries() {
  const module = await importExtensionRegistry();
  return module.listExtensionInstallSummaries();
}

export async function installMarketplacePackageSource(input: { source?: unknown; target?: unknown; sourceBaseDir?: unknown }) {
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  if (!source) throw new Error('marketplace package source is required.');
  const target = input.target === 'local' || input.target === undefined ? 'local' : undefined;
  if (!target) throw new Error('marketplace package target must be local.');
  const sourceBaseDir = typeof input.sourceBaseDir === 'string' && input.sourceBaseDir.trim() ? input.sourceBaseDir : undefined;
  const module = await importCore();
  return module.installPackageSource({ source, target, sourceBaseDir });
}

export async function installMarketplacePackageAsExtension(input: {
  ecosystem?: unknown;
  packageType?: unknown;
  source?: unknown;
  target?: unknown;
  sourceBaseDir?: unknown;
  runtimeDir?: unknown;
}) {
  const packageType = typeof input.packageType === 'string' ? input.packageType : '';
  if (!MARKETPLACE_BEHAVIOR_PACKAGE_TYPES.has(packageType)) {
    throw new Error('marketplace package install only supports skill, instruction-pack, agent, and template packages.');
  }
  const ecosystem = typeof input.ecosystem === 'string' && input.ecosystem.trim() ? input.ecosystem.trim() : 'external';
  const runtimeDir = typeof input.runtimeDir === 'string' && input.runtimeDir.trim() ? input.runtimeDir : undefined;
  if (!runtimeDir) throw new Error('runtimeDir is required.');

  const result = await installMarketplacePackageSource({
    source: input.source,
    target: input.target,
    sourceBaseDir: input.sourceBaseDir,
  });
  const extension = createImportedPackageExtension({
    ecosystem,
    packageType,
    source: result.source,
    runtimeDir,
  });
  return { ...result, extension };
}

export async function listInstallableExtensionCatalog() {
  const module = await importExtensionCatalog();
  return module.listInstallableExtensionCatalog();
}

export async function installCatalogExtension(input: { id?: unknown }) {
  const module = await importExtensionCatalog();
  return module.installCatalogExtension(input);
}

export async function installExtensionBundleFromUrl(input: { url?: unknown; expectedId?: unknown }) {
  const module = await importExtensionCatalog();
  return module.installExtensionBundleFromUrl(input);
}

export async function writeAdditionalExtensionSearchPaths(options: ExtensionSearchPathWriteOptions): Promise<{ ok: true }> {
  const runtimeDir = typeof options.runtimeDir === 'string' && options.runtimeDir ? options.runtimeDir : undefined;
  const runtimeSettingsFilePath =
    typeof options.runtimeSettingsFilePath === 'string' && options.runtimeSettingsFilePath ? options.runtimeSettingsFilePath : undefined;
  if (!runtimeDir || !runtimeSettingsFilePath) throw new Error('runtimeDir and runtimeSettingsFilePath are required.');
  const paths = Array.isArray(options.paths) ? options.paths.filter((path): path is string => typeof path === 'string') : [];
  const pathsJoined = paths.join('\n');
  writeSettingsValue(runtimeSettingsFilePath, pathsJoined);
  writeSettingsValue(join(runtimeDir, 'settings.json'), pathsJoined);
  // Keep the canonical state-root settings file in sync with the profile file
  // because the extension loader reads configured search paths from state root.
  writeSettingsValue(join(resolve(runtimeDir, '..'), 'settings.json'), pathsJoined);
  return { ok: true };
}

function readSettingsFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
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

function createImportedPackageExtension(input: { ecosystem: string; packageType: string; source: string; runtimeDir: string }): {
  id: string;
  packageRoot: string;
  skillCount: number;
  copiedSource: boolean;
} {
  const sourceLabel = labelForPackageSource(input.source);
  const id = importedPackageExtensionId(input.ecosystem, input.packageType, input.source);
  const packageRoot = join(input.runtimeDir, 'extensions', id);
  const packageDir = join(packageRoot, 'package');
  const sourceIsLocalDirectory = existsSync(input.source) && statSync(input.source).isDirectory();

  mkdirSync(packageRoot, { recursive: true });
  if (sourceIsLocalDirectory) {
    cpSync(input.source, packageDir, {
      recursive: true,
      force: true,
      filter: (sourcePath) => !IMPORTED_PACKAGE_SKIP_DIRS.has(basename(sourcePath)),
    });
  }

  const skills = sourceIsLocalDirectory
    ? discoverSkillFiles(packageDir).map((path) => ({
        id: skillIdFromPath(path),
        path: toManifestPath(packageRoot, path),
      }))
    : [];

  const manifest = {
    schemaVersion: 2,
    id,
    name: `${formatExternalLabel(input.ecosystem)} ${formatExternalLabel(input.packageType)}: ${sourceLabel}`,
    description: `Imported ${input.ecosystem} ${input.packageType} package. Source: ${input.source}`,
    version: '0.1.0',
    defaultEnabled: true,
    contributes: {
      ...(skills.length ? { skills } : {}),
    },
    importedPackage: {
      ecosystem: input.ecosystem,
      packageType: input.packageType,
      source: input.source,
      copiedSource: sourceIsLocalDirectory,
    },
  };
  writeFileSync(join(packageRoot, 'extension.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    join(packageRoot, 'README.md'),
    [
      `# ${manifest.name}`,
      '',
      `Imported from: \`${input.source}\``,
      '',
      'This extension wraps an external agent capability package so Neon Pilot can manage it through the extension registry.',
      sourceIsLocalDirectory
        ? 'The package contents were copied into `package/`; discovered Agent Skills are contributed through `extension.json`.'
        : 'Remote package contents remain registered as a package source; this wrapper records the install in the extension registry.',
      '',
    ].join('\n'),
  );

  return { id, packageRoot, skillCount: skills.length, copiedSource: sourceIsLocalDirectory };
}

function importedPackageExtensionId(ecosystem: string, packageType: string, source: string): string {
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 10);
  return `imported-${slugify(ecosystem)}-${slugify(packageType)}-${slugify(labelForPackageSource(source))}-${hash}`.slice(0, 96);
}

function labelForPackageSource(source: string): string {
  try {
    const url = new URL(source);
    const pathBase = basename(url.pathname.replace(/\/$/, ''));
    return pathBase || url.hostname;
  } catch {
    return basename(source.replace(/\/$/, '')) || 'package';
  }
}

function formatExternalLabel(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'package'
  );
}

function discoverSkillFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (IMPORTED_PACKAGE_SKIP_DIRS.has(entry.name)) return [];
      return discoverSkillFiles(path);
    }
    return entry.isFile() && entry.name === 'SKILL.md' ? [path] : [];
  });
}

function skillIdFromPath(skillPath: string): string {
  const parent = basename(dirname(skillPath));
  return slugify(parent === 'package' ? basename(skillPath, '.md') : parent);
}

function toManifestPath(packageRoot: string, path: string): string {
  return relative(packageRoot, path).split(sep).join('/');
}

export type {
  ExtensionDoctorFinding,
  ExtensionDoctorReport,
  ExtensionDoctorSeverity,
} from '@neon-pilot/extensions/backend/extensions';
