import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import type { ExtensionDoctorReport, RuntimeExtensionOperationContext } from '@neon-pilot/extensions/backend/extensions';

import { importServerExtensionModule } from './serverModuleResolver.js';
import { importServerModule } from './serverModuleResolver.js';

interface ExtensionLifecycleModule {
  buildRuntimeExtension(extensionId: string, stateRoot?: string, layout?: unknown): unknown;
  createRuntimeExtension(options: RuntimeExtensionCreateOptions, stateRoot?: string, layout?: unknown): unknown;
  readRuntimeExtensionSource(extensionId: string, stateRoot?: string, layout?: unknown): unknown;
  updateRuntimeExtension(extensionId: string, input: RuntimeExtensionUpdateOptions, stateRoot?: string, layout?: unknown): unknown;
  snapshotRuntimeExtension(extensionId: string, stateRoot?: string, layout?: unknown): unknown;
  deleteRuntimeExtension(extensionId: string, stateRoot?: string, layout?: unknown): unknown;
}

interface ExtensionBackendModule {
  reloadExtensionBackend(extensionId: string, context?: { getDesktopRootLayout?: () => unknown }): unknown;
  runExtensionSelfTest(extensionId: string, context?: { getDesktopRootLayout?: () => unknown }): unknown;
}

interface ExtensionRegistryModule {
  getRuntimeExtensionsRoot(): string;
  invalidateExtensionRegistryReadCaches(stateRoot?: string, layout?: unknown): void;
  listExtensionInstallSummaries(stateRoot?: string, layout?: unknown): unknown;
}

interface ExtensionCatalogModule {
  listInstallableExtensionCatalog(): unknown;
  installCatalogExtension(input: { id?: unknown }): unknown;
  updateCatalogExtension(input: { id?: unknown }): unknown;
  installExtensionBundleFromUrl(input: { url?: unknown; expectedId?: unknown }): unknown;
  readConfiguredExtensionCatalogSources(): unknown[];
}

interface CoreModule {
  installPackageSource(input: { source: string; target: 'local'; sourceBaseDir?: string }): MarketplacePackageInstallResult;
  resolveDesktopRootLayout(): { root: string; [key: string]: unknown };
}

interface MarketplacePackageInstallResult {
  installed: boolean;
  alreadyPresent: boolean;
  source: string;
  target: string;
  settingsPath: string;
}

type RuntimeExtensionCreateOptions = Record<string, unknown>;
type RuntimeExtensionUpdateOptions = {
  name?: unknown;
  description?: unknown;
  appearance?: unknown;
  source?: { frontend?: unknown; backend?: unknown };
  autoBuild?: boolean;
};
type ValidateExtensionPackageOptions = { extensionId?: string; packageRoot?: string };
type ExtensionSearchPathWriteOptions = { runtimeDir?: string; runtimeSettingsFilePath?: string; paths?: string[] };
type ExtensionSourceWriteOptions = { runtimeDir?: string; runtimeSettingsFilePath?: string; sources?: unknown[] };

const ADDITIONAL_EXTENSION_PATHS_SETTING = 'extensions.additionalPaths';
const EXTENSION_SOURCES_SETTING = 'extensions.sources';
const IMPORTED_PACKAGE_SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'target']);
const MARKETPLACE_BEHAVIOR_PACKAGE_TYPES = new Set(['skill', 'instruction-pack', 'agent', 'template']);

function assertNoImportedPackageSymlink(path: string): void {
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`Imported package source cannot contain symlinks: ${path}`);
  }
}

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

async function operationLayout(context?: RuntimeExtensionOperationContext): Promise<unknown> {
  if (!context?.desktopRootLayout) return undefined;
  const supplied = context.desktopRootLayout as { root?: unknown };
  const canonical = (await importCore()).resolveDesktopRootLayout();
  if (typeof supplied.root !== 'string' || resolve(supplied.root) !== resolve(canonical.root)) {
    throw new Error('Runtime extension operation context does not match the host desktop root.');
  }
  return canonical;
}

function backendServerContext(layout: unknown): { getDesktopRootLayout?: () => unknown } | undefined {
  return layout ? { getDesktopRootLayout: () => layout } : undefined;
}

export async function buildRuntimeExtension(extensionId: string, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionLifecycle();
  const layout = await operationLayout(context);
  return layout ? module.buildRuntimeExtension(extensionId, undefined, layout) : module.buildRuntimeExtension(extensionId);
}

export async function createRuntimeExtension(options: RuntimeExtensionCreateOptions, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionLifecycle();
  const layout = await operationLayout(context);
  return layout ? module.createRuntimeExtension(options, undefined, layout) : module.createRuntimeExtension(options);
}

export async function readRuntimeExtensionSource(extensionId: string, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionLifecycle();
  const layout = await operationLayout(context);
  return layout ? module.readRuntimeExtensionSource(extensionId, undefined, layout) : module.readRuntimeExtensionSource(extensionId);
}

export async function updateRuntimeExtension(
  extensionId: string,
  input: RuntimeExtensionUpdateOptions,
  context?: RuntimeExtensionOperationContext,
) {
  const module = await importExtensionLifecycle();
  const layout = await operationLayout(context);
  return layout ? module.updateRuntimeExtension(extensionId, input, undefined, layout) : module.updateRuntimeExtension(extensionId, input);
}

export async function snapshotRuntimeExtension(extensionId: string, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionLifecycle();
  const layout = await operationLayout(context);
  return layout ? module.snapshotRuntimeExtension(extensionId, undefined, layout) : module.snapshotRuntimeExtension(extensionId);
}

export async function deleteRuntimeExtension(extensionId: string, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionLifecycle();
  const layout = await operationLayout(context);
  return layout ? module.deleteRuntimeExtension(extensionId, undefined, layout) : module.deleteRuntimeExtension(extensionId);
}

export async function reloadExtensionBackend(extensionId: string, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionBackend();
  const serverContext = backendServerContext(await operationLayout(context));
  return serverContext ? module.reloadExtensionBackend(extensionId, serverContext) : module.reloadExtensionBackend(extensionId);
}

export async function runExtensionSelfTest(extensionId: string, context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionBackend();
  const serverContext = backendServerContext(await operationLayout(context));
  return serverContext ? module.runExtensionSelfTest(extensionId, serverContext) : module.runExtensionSelfTest(extensionId);
}

export async function invalidateExtensionRegistryReadCaches(context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionRegistry();
  const layout = await operationLayout(context);
  if (layout) module.invalidateExtensionRegistryReadCaches(undefined, layout);
  else module.invalidateExtensionRegistryReadCaches();
  return { ok: true as const };
}

export async function validateExtensionPackage(options: ValidateExtensionPackageOptions) {
  const module = await importExtensionDoctor();
  return module.validateExtensionPackage(options);
}

export async function listExtensionInstallSummaries(context?: RuntimeExtensionOperationContext) {
  const module = await importExtensionRegistry();
  const layout = await operationLayout(context);
  return layout ? module.listExtensionInstallSummaries(undefined, layout) : module.listExtensionInstallSummaries();
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
  const registry = await importExtensionRegistry();

  const result = await installMarketplacePackageSource({
    source: input.source,
    target: input.target,
    sourceBaseDir: input.sourceBaseDir,
  });
  const extension = createImportedPackageExtension({
    ecosystem,
    packageType,
    source: result.source,
    extensionRoot: registry.getRuntimeExtensionsRoot(),
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

export async function updateCatalogExtension(input: { id?: unknown }) {
  const module = await importExtensionCatalog();
  return module.updateCatalogExtension(input);
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
  for (const settingsFile of resolveExtensionSettingsWriteTargets(runtimeDir, runtimeSettingsFilePath)) {
    writeSettingsValue(settingsFile, ADDITIONAL_EXTENSION_PATHS_SETTING, pathsJoined);
  }
  return { ok: true };
}

export async function readExtensionCatalogSources(): Promise<{ ok: true; sources: unknown[] }> {
  const module = await importExtensionCatalog();
  return { ok: true, sources: module.readConfiguredExtensionCatalogSources() };
}

export async function writeExtensionCatalogSources(options: ExtensionSourceWriteOptions): Promise<{ ok: true; sources: unknown[] }> {
  const runtimeDir = typeof options.runtimeDir === 'string' && options.runtimeDir ? options.runtimeDir : undefined;
  const runtimeSettingsFilePath =
    typeof options.runtimeSettingsFilePath === 'string' && options.runtimeSettingsFilePath ? options.runtimeSettingsFilePath : undefined;
  if (!runtimeDir || !runtimeSettingsFilePath) throw new Error('runtimeDir and runtimeSettingsFilePath are required.');
  const sources = Array.isArray(options.sources) ? options.sources : [];
  for (const settingsFile of resolveExtensionSettingsWriteTargets(runtimeDir, runtimeSettingsFilePath)) {
    writeSettingsValue(settingsFile, EXTENSION_SOURCES_SETTING, sources);
  }
  return { ok: true, sources };
}

function resolveNonRootStateSettingsFileFromRuntimeDir(runtimeDir: string): string | undefined {
  const resolvedRuntimeDir = resolve(runtimeDir);
  if (basename(resolvedRuntimeDir) !== 'neon-pilot-runtime') {
    return undefined;
  }

  const stateRoot = dirname(resolvedRuntimeDir);
  if (dirname(stateRoot) === stateRoot) {
    throw new Error(`Refusing to resolve extension settings from root runtime directory: ${resolvedRuntimeDir}`);
  }

  return join(stateRoot, 'settings.json');
}

function resolveExtensionSettingsWriteTargets(runtimeDir: string, runtimeSettingsFilePath: string): string[] {
  const targets = [
    resolve(runtimeSettingsFilePath),
    resolve(runtimeDir, 'settings.json'),
    resolveNonRootStateSettingsFileFromRuntimeDir(runtimeDir),
  ].filter((path): path is string => typeof path === 'string' && path.trim().length > 0);

  return [...new Set(targets)];
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

function writeSettingsValue(path: string, key: string, value: unknown): void {
  const settings = readSettingsFile(path);
  settings[key] = value;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
}

function createImportedPackageExtension(input: { ecosystem: string; packageType: string; source: string; extensionRoot: string }): {
  id: string;
  packageRoot: string;
  skillCount: number;
  copiedSource: boolean;
} {
  const sourceLabel = labelForPackageSource(input.source);
  const id = importedPackageExtensionId(input.ecosystem, input.packageType, input.source);
  const packageRoot = join(input.extensionRoot, id);
  const packageDir = join(packageRoot, 'package');
  const sourceIsLocalDirectory = existsSync(input.source) && statSync(input.source).isDirectory();

  mkdirSync(packageRoot, { recursive: true });
  if (sourceIsLocalDirectory) {
    assertNoImportedPackageSymlink(input.source);
    cpSync(input.source, packageDir, {
      recursive: true,
      force: true,
      filter: (sourcePath) => {
        if (IMPORTED_PACKAGE_SKIP_DIRS.has(basename(sourcePath))) return false;
        assertNoImportedPackageSymlink(sourcePath);
        return true;
      },
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
  mkdirSync(join(packageRoot, 'dist'), { recursive: true });
  writeFileSync(
    join(packageRoot, 'dist', 'build-manifest.json'),
    `${JSON.stringify({ kind: 'imported-package-wrapper', generatedAt: new Date().toISOString() }, null, 2)}\n`,
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

export type { ExtensionDoctorFinding, ExtensionDoctorReport, ExtensionDoctorSeverity } from '@neon-pilot/extensions/backend/extensions';
