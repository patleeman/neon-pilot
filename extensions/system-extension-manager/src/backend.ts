import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  createRuntimeExtension,
  deleteRuntimeExtension,
  installCatalogExtension as installCatalogExtensionFromHost,
  installExtensionBundleFromUrl,
  invalidateExtensionRegistryReadCaches,
  listExtensionInstallSummaries,
  listInstallableExtensionCatalog as listInstallableExtensionCatalogFromHost,
  readExtensionCatalogSources,
  reloadExtensionBackend,
  runExtensionSelfTest,
  snapshotRuntimeExtension,
  updateCatalogExtension as updateCatalogExtensionFromHost,
  validateExtensionPackage,
  writeAdditionalExtensionSearchPaths,
  writeExtensionCatalogSources,
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

export async function updateCatalogExtension(input: unknown, _ctx: ExtensionBackendContext) {
  const result = await updateCatalogExtensionFromHost(asRecord(input));
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

export async function deleteExtension(input: ExtensionIdInput, _ctx: ExtensionBackendContext) {
  const extensionId = requireExtensionId(input);
  return deleteRuntimeExtension(extensionId);
}

export async function reloadExtension(input: ExtensionIdInput, _ctx: ExtensionBackendContext) {
  const extensionId = requireExtensionId(input);
  const result = await reloadExtensionBackend(extensionId);
  return { ok: true, ...result };
}

export async function smokeExtension(input: ExtensionIdInput, _ctx: ExtensionBackendContext) {
  const extensionId = requireExtensionId(input);
  const selfTest = await runExtensionSelfTest(extensionId);
  return {
    ok: selfTest.ok,
    extensionId,
    checks: selfTest.checks,
    text: selfTest.ok ? `App package ${extensionId} smoke checks passed.` : `App package ${extensionId} smoke checks failed.`,
  };
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
  await writeAdditionalExtensionSearchPaths({ runtimeDir: ctx.runtimeDir, runtimeSettingsFilePath: ctx.runtimeSettingsFilePath, paths });
  return readSearchPaths(input, ctx);
}

export async function readExtensionSources(_input: unknown, _ctx: ExtensionBackendContext) {
  return readExtensionCatalogSources();
}

export async function updateExtensionSources(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const sources = Array.isArray(body.sources) ? body.sources : [];
  return writeExtensionCatalogSources({ runtimeDir: ctx.runtimeDir, runtimeSettingsFilePath: ctx.runtimeSettingsFilePath, sources });
}

export async function reloadExtensions(_input: unknown, _ctx: ExtensionBackendContext) {
  await invalidateExtensionRegistryReadCaches();
  return { ok: true, reloaded: true, message: 'App package registry caches were invalidated; reopen app pages if needed.' };
}

export async function manageExtension(input: unknown, ctx: ExtensionBackendContext) {
  const body = normalizeManagerInput(input);
  const action = typeof body.action === 'string' ? body.action : 'list';
  if (action === 'list') return listExtensions(body, ctx);
  if (action === 'create') return createExtension(body, ctx);
  if (action === 'snapshot') return snapshotExtension(body as ExtensionIdInput, ctx);
  if (action === 'delete') return deleteExtension(body as ExtensionIdInput, ctx);
  if (action === 'reload') return reloadExtension(body as ExtensionIdInput, ctx);
  if (action === 'smoke') return smokeExtension(body as ExtensionIdInput, ctx);
  if (action === 'validate') return validateExtension(body, ctx);
  if (action === 'hostViewComponents') return listHostViewComponents(body, ctx);
  if (action === 'listInstallable') return listInstallableExtensions(body, ctx);
  if (action === 'installCatalog') return installCatalogExtension(body, ctx);
  if (action === 'updateCatalog') return updateCatalogExtension(body, ctx);
  if (action === 'installFromUrl') return installExtensionFromUrl(body, ctx);
  if (action === 'readSearchPaths') return readSearchPaths(body, ctx);
  if (action === 'updateSearchPaths') return updateSearchPaths(body, ctx);
  if (action === 'readExtensionSources') return readExtensionSources(body, ctx);
  if (action === 'updateExtensionSources') return updateExtensionSources(body, ctx);
  if (action === 'reloadExtensions') return reloadExtensions(body, ctx);
  if (action === 'enable' || action === 'disable') {
    const extensionId = requireExtensionId(body);
    ctx.extensions?.setEnabled?.(extensionId, action === 'enable');
    return {
      ok: true,
      extensionId,
      enabled: action === 'enable',
      text: `${action === 'enable' ? 'Enabled' : 'Disabled'} app package ${extensionId}.`,
    };
  }
  if (action === 'togglePermission') {
    const extensionId = requireExtensionId(body);
    const permission = typeof body.permission === 'string' ? body.permission : '';
    const granted = body.granted === true;
    if (!permission) throw new Error('permission is required.');
    await ctx.extensions.setPermissionGranted(extensionId, permission, granted);
    return {
      ok: true,
      extensionId,
      permission,
      granted,
      text: `${granted ? 'Granted' : 'Revoked'} permission ${permission} for app package ${extensionId}.`,
    };
  }
  throw new Error(`Unsupported extension manager action: ${action}`);
}

function normalizeManagerInput(input: unknown): Record<string, unknown> {
  const body = asRecord(input);
  const cli = asRecord(body.cli);
  const flags = asRecord(cli.flags);
  const packageRoot =
    typeof flags.packageRoot === 'string'
      ? flags.packageRoot
      : typeof flags['package-root'] === 'string'
        ? flags['package-root']
        : undefined;
  if (!cli.command) return body;
  const command = typeof cli.command === 'string' ? cli.command : '';
  const args = Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
  if (command === 'extensions list') return { ...body, action: 'list' };
  if (command === 'extensions create')
    return {
      ...body,
      action: 'create',
      id: flags.id ?? args[0],
      name: flags.name,
      description: flags.description,
      template: flags.template,
    };
  if (command === 'extensions snapshot') return { ...body, action: 'snapshot', extensionId: args[0] };
  if (command === 'extensions delete' || command === 'extensions uninstall') return { ...body, action: 'delete', extensionId: args[0] };
  if (command === 'extensions catalog') return { ...body, action: 'listInstallable' };
  if (command === 'extensions install') return { ...body, action: 'installCatalog', id: args[0] };
  if (command === 'extensions update') return { ...body, action: 'updateCatalog', id: args[0] };
  if (command === 'extensions install-url')
    return { ...body, action: 'installFromUrl', url: args[0] ?? flags.url, expectedId: flags['expected-id'] ?? flags.expectedId };
  if (command === 'extensions validate') return { ...body, action: 'validate', extensionId: args[0], packageRoot };
  if (command === 'extensions reload')
    return args[0] ? { ...body, action: 'reload', extensionId: args[0] } : { ...body, action: 'reloadExtensions' };
  if (command === 'extensions smoke') return { ...body, action: 'smoke', extensionId: args[0] };
  if (command === 'extensions enable') return { ...body, action: 'enable', extensionId: args[0] };
  if (command === 'extensions disable') return { ...body, action: 'disable', extensionId: args[0] };
  if (command === 'extensions paths') return { ...body, action: 'readSearchPaths' };
  if (command === 'extensions sources') return { ...body, action: 'readExtensionSources' };
  return body;
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
