import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

export type {
  ExtensionDoctorFinding,
  ExtensionDoctorReport,
  ExtensionDoctorSeverity,
} from '@neon-pilot/extensions/backend/extensions';
