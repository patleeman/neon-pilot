import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  createRuntimeExtension,
  installCatalogExtension as installCatalogExtensionFromHost,
  installExtensionBundleFromUrl,
  listExtensionInstallSummaries,
  listInstallableExtensionCatalog as listInstallableExtensionCatalogFromHost,
  reloadExtensionBackend,
  snapshotRuntimeExtension,
  validateExtensionPackage,
} from '@neon-pilot/extensions/backend/extensions';
import { HOST_VIEW_COMPONENT_DEFINITIONS } from '@neon-pilot/extensions/host-view-components';

const ADDITIONAL_EXTENSION_PATHS_SETTING = 'extensions.additionalPaths';

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

export async function listInstallableExtensions(_input: unknown, _ctx: ExtensionBackendContext) {
  return listInstallableExtensionCatalogFromHost();
}

export async function installCatalogExtension(input: unknown, _ctx: ExtensionBackendContext) {
  const result = await installCatalogExtensionFromHost(asRecord(input));
  return { ok: true, ...result };
}

export async function installExtensionFromUrl(input: unknown, _ctx: ExtensionBackendContext) {
  const result = await installExtensionBundleFromUrl(asRecord(input));
  return { ok: true, ...result };
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
    environmentPaths: splitEnvironmentPathList(process.env.NEON_PILOT_EXTENSION_PATHS),
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
  writeSettingsValue(ctx.runtimeSettingsFilePath, pathsJoined);
  writeSettingsValue(join(ctx.runtimeDir, 'settings.json'), pathsJoined);
  // Also write to the canonical state-root settings file that the extension
  // loader reads from (readConfiguredExtensionPaths). Without this, saved
  // search paths appear to be persisted but have no effect.
  writeSettingsValue(join(resolve(ctx.runtimeDir, '..'), 'settings.json'), pathsJoined);
  return readSearchPaths(input, ctx);
}

export async function reloadExtensions(_input: unknown, _ctx: ExtensionBackendContext) {
  return { ok: true, reloaded: false, message: 'Runtime manifests are read on demand.' };
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
  if (action === 'listInstallable') return listInstallableExtensions(input, ctx);
  if (action === 'installCatalog') return installCatalogExtension(input, ctx);
  if (action === 'installFromUrl') return installExtensionFromUrl(input, ctx);
  if (action === 'readSearchPaths') return readSearchPaths(input, ctx);
  if (action === 'updateSearchPaths') return updateSearchPaths(input, ctx);
  if (action === 'reloadExtensions') return reloadExtensions(input, ctx);
  throw new Error(`Unsupported extension manager action: ${action}`);
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
  const localProfilePaths = splitConfiguredValue(readSettingsFile(ctx.runtimeSettingsFilePath)[ADDITIONAL_EXTENSION_PATHS_SETTING]);
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
