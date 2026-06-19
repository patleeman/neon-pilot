import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { installMarketplacePackageAsExtension, invalidateExtensionRegistryReadCaches } from '@neon-pilot/extensions/backend/extensions';

type PluginEcosystem = 'auto' | 'codex' | 'claude';
type StoredPluginEcosystem = 'codex' | 'claude' | 'unknown';
type PluginSourceKind = 'git' | 'local';
type PluginStatus = 'added' | 'enabled' | 'disabled' | 'update-available' | 'update-blocked' | 'error';

interface AgentPluginSource {
  kind: PluginSourceKind;
  url?: string;
  path: string;
  ref?: string;
  resolvedCommit?: string;
}

interface AgentPluginCapabilities {
  skills: Array<{ id: string; path: string }>;
  mcp: Array<{ path: string }>;
  hooks: Array<{ path: string; kind: string }>;
  docs: Array<{ path: string }>;
}

interface AgentPluginCompatibility {
  detectedEcosystem: StoredPluginEcosystem;
  supported: string[];
  ignored: string[];
  warnings: string[];
  blockers: string[];
}

interface AgentPluginRecord {
  id: string;
  displayName: string;
  ecosystem: StoredPluginEcosystem;
  enabled: boolean;
  autoUpdate: boolean;
  source: AgentPluginSource;
  status: PluginStatus;
  capabilities: AgentPluginCapabilities;
  compatibility: AgentPluginCompatibility;
  wrapperExtensionId?: string;
  wrapperExtensionRoot?: string;
  addedAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  availableUpdate?: {
    commit: string;
    checkedAt: string;
  };
  lastError?: string;
}

interface AgentPluginRegistry {
  version: 1;
  plugins: AgentPluginRecord[];
}

const REGISTRY_FILE = 'registry.json';

export async function listPlugins(_input: unknown, ctx: ExtensionBackendContext) {
  const registry = readRegistry(ctx);
  return { ok: true, plugins: registry.plugins, storageRoot: pluginsRoot(ctx) };
}

export async function addPlugin(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const sourceKind = body.sourceKind === 'local' ? 'local' : 'git';
  const requestedEcosystem = normalizeRequestedEcosystem(body.ecosystem);
  const ref = typeof body.ref === 'string' && body.ref.trim() ? body.ref.trim() : undefined;
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  if (!source) throw new Error('Plugin source is required.');

  const prepared =
    sourceKind === 'local' ? await prepareLocalPluginSource(source) : await clonePluginSource({ source, ref, requestedEcosystem, ctx });
  const scan = scanPlugin(prepared.path, requestedEcosystem);
  const id = pluginIdFor(prepared.path, sourceKind === 'git' ? source : prepared.path, scan.ecosystem);
  const now = new Date().toISOString();
  const registry = readRegistry(ctx);
  const existing = registry.plugins.find((plugin) => plugin.id === id);
  const wrapper = await wrapPluginAsExtension({ sourcePath: prepared.path, ecosystem: scan.ecosystem, ctx });
  ctx.extensions.setEnabled(wrapper.extension.id, existing?.enabled ?? false);
  const record: AgentPluginRecord = {
    id,
    displayName: scan.displayName,
    ecosystem: scan.ecosystem,
    enabled: existing?.enabled ?? false,
    autoUpdate: existing?.autoUpdate ?? false,
    source: {
      kind: sourceKind,
      ...(sourceKind === 'git' ? { url: source } : {}),
      path: prepared.path,
      ...(ref ? { ref } : {}),
      ...(prepared.resolvedCommit ? { resolvedCommit: prepared.resolvedCommit } : {}),
    },
    status: existing?.enabled ? 'enabled' : 'added',
    capabilities: scan.capabilities,
    compatibility: scan.compatibility,
    wrapperExtensionId: wrapper.extension.id,
    wrapperExtensionRoot: wrapper.extension.packageRoot,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  };
  writeRegistry(ctx, { version: 1, plugins: [...registry.plugins.filter((plugin) => plugin.id !== id), record] });
  await invalidateExtensionRegistryReadCaches();
  await ctx.runtime.refreshSkillMcpConfig();
  return { ok: true, plugin: record };
}

export async function setPluginEnabled(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = requirePluginId(body);
  const enabled = body.enabled === true;
  const registry = mutatePlugin(ctx, id, (plugin) => ({ ...plugin, enabled, status: enabled ? 'enabled' : 'disabled', updatedAt: now() }));
  const plugin = registry.plugins.find((candidate) => candidate.id === id);
  if (plugin?.wrapperExtensionId) ctx.extensions.setEnabled(plugin.wrapperExtensionId, enabled);
  await invalidateExtensionRegistryReadCaches();
  await ctx.runtime.refreshSkillMcpConfig();
  return { ok: true, plugin: registry.plugins.find((plugin) => plugin.id === id) };
}

export async function setPluginAutoUpdate(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = requirePluginId(body);
  const autoUpdate = body.autoUpdate === true;
  const registry = mutatePlugin(ctx, id, (plugin) => ({ ...plugin, autoUpdate, updatedAt: now() }));
  return { ok: true, plugin: registry.plugins.find((plugin) => plugin.id === id) };
}

export async function checkPluginUpdates(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const requestedId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined;
  const registry = readRegistry(ctx);
  const checkedAt = now();
  const nextPlugins = await Promise.all(
    registry.plugins.map(async (plugin) => {
      if (requestedId && plugin.id !== requestedId) return plugin;
      if (plugin.source.kind !== 'git' || !plugin.source.url) {
        return { ...plugin, lastCheckedAt: checkedAt };
      }
      try {
        const remoteCommit = await readRemoteCommit(plugin, ctx);
        const hasUpdate = Boolean(remoteCommit && remoteCommit !== plugin.source.resolvedCommit);
        if (hasUpdate && remoteCommit && plugin.autoUpdate) {
          const updated = await applyPluginUpdate(plugin, ctx);
          return { ...updated, lastCheckedAt: checkedAt };
        }
        return {
          ...plugin,
          status: hasUpdate ? 'update-available' : plugin.enabled ? 'enabled' : 'disabled',
          lastCheckedAt: checkedAt,
          availableUpdate: hasUpdate && remoteCommit ? { commit: remoteCommit, checkedAt } : undefined,
          lastError: undefined,
        };
      } catch (error) {
        return { ...plugin, status: 'error' as const, lastCheckedAt: checkedAt, lastError: errorMessage(error) };
      }
    }),
  );
  const nextRegistry = { version: 1 as const, plugins: nextPlugins };
  writeRegistry(ctx, nextRegistry);
  return { ok: true, plugins: nextPlugins };
}

export async function updatePlugin(input: unknown, ctx: ExtensionBackendContext) {
  const id = requirePluginId(asRecord(input));
  const registry = readRegistry(ctx);
  const plugin = registry.plugins.find((candidate) => candidate.id === id);
  if (!plugin) throw new Error(`Unknown agent plugin: ${id}`);
  if (plugin.source.kind !== 'git' || !plugin.source.url) throw new Error('Only Git-backed plugins can be updated.');
  const updated = await applyPluginUpdate(plugin, ctx);
  const next = updatePluginRecord(registry, id, updated);
  writeRegistry(ctx, next);
  await invalidateExtensionRegistryReadCaches();
  await ctx.runtime.refreshSkillMcpConfig();
  const nextPlugin = next.plugins.find((candidate) => candidate.id === id);
  return { ok: nextPlugin?.status !== 'update-blocked', plugin: nextPlugin };
}

async function applyPluginUpdate(plugin: AgentPluginRecord, ctx: ExtensionBackendContext): Promise<AgentPluginRecord> {
  if (plugin.source.kind !== 'git' || !plugin.source.url) throw new Error('Only Git-backed plugins can be updated.');
  const sourceRoot = plugin.source.path;
  rmSync(sourceRoot, { recursive: true, force: true });
  const cloned = await clonePluginSource({
    source: plugin.source.url,
    ref: plugin.source.ref,
    requestedEcosystem: plugin.ecosystem,
    ctx,
    targetPath: sourceRoot,
  });
  const scan = scanPlugin(cloned.path, plugin.ecosystem);
  if (scan.compatibility.blockers.length > 0) {
    return {
      ...plugin,
      status: 'update-blocked',
      lastError: scan.compatibility.blockers.join('\n'),
      lastCheckedAt: now(),
    };
  }
  const wrapper = await wrapPluginAsExtension({ sourcePath: cloned.path, ecosystem: scan.ecosystem, ctx });
  ctx.extensions.setEnabled(wrapper.extension.id, plugin.enabled);
  return {
    ...plugin,
    displayName: scan.displayName,
    ecosystem: scan.ecosystem,
    source: { ...plugin.source, path: cloned.path, resolvedCommit: cloned.resolvedCommit },
    capabilities: scan.capabilities,
    compatibility: scan.compatibility,
    wrapperExtensionId: wrapper.extension.id,
    wrapperExtensionRoot: wrapper.extension.packageRoot,
    status: plugin.enabled ? 'enabled' : 'disabled',
    availableUpdate: undefined,
    lastError: undefined,
    updatedAt: now(),
  };
}

export async function removePlugin(input: unknown, ctx: ExtensionBackendContext) {
  const id = requirePluginId(asRecord(input));
  const registry = readRegistry(ctx);
  const plugin = registry.plugins.find((candidate) => candidate.id === id);
  if (!plugin) return { ok: true, removed: false };
  if (plugin.source.kind === 'git') {
    const root = pluginRoot(ctx, plugin.ecosystem, id);
    rmSync(root, { recursive: true, force: true });
  }
  writeRegistry(ctx, { version: 1, plugins: registry.plugins.filter((candidate) => candidate.id !== id) });
  await invalidateExtensionRegistryReadCaches();
  await ctx.runtime.refreshSkillMcpConfig();
  return { ok: true, removed: true };
}

function readRegistry(ctx: ExtensionBackendContext): AgentPluginRegistry {
  const path = registryPath(ctx);
  if (!existsSync(path)) return { version: 1, plugins: [] };
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  const body = asRecord(parsed);
  const plugins = Array.isArray(body.plugins) ? body.plugins.filter(isPluginRecord) : [];
  return { version: 1, plugins };
}

function writeRegistry(ctx: ExtensionBackendContext, registry: AgentPluginRegistry): void {
  const path = registryPath(ctx);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`);
}

async function prepareLocalPluginSource(source: string): Promise<{ path: string; resolvedCommit?: string }> {
  const path = resolve(source);
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error('Local plugin source must be an existing directory.');
  return { path };
}

async function clonePluginSource(input: {
  source: string;
  ref?: string;
  requestedEcosystem: PluginEcosystem | StoredPluginEcosystem;
  ctx: ExtensionBackendContext;
  targetPath?: string;
}): Promise<{ path: string; resolvedCommit?: string }> {
  const root =
    input.targetPath ??
    pluginRoot(
      input.ctx,
      normalizeStoredEcosystem(input.requestedEcosystem),
      pluginIdFor(input.source, input.source, normalizeStoredEcosystem(input.requestedEcosystem)),
    );
  mkdirSync(dirname(root), { recursive: true });
  rmSync(root, { recursive: true, force: true });
  const args = ['clone', '--depth', '1'];
  if (input.ref) args.push('--branch', input.ref);
  args.push(input.source, root);
  const result = await input.ctx.shell.exec({ command: 'git', args, timeoutMs: 120_000, maxBuffer: 1024 * 1024 });
  if (!existsSync(root)) throw new Error(result.stderr.trim() || `Failed to clone ${input.source}.`);
  const resolvedCommit = await readHeadCommit(root, input.ctx).catch(() => undefined);
  return { path: root, resolvedCommit };
}

function scanPlugin(
  sourcePath: string,
  requested: PluginEcosystem | StoredPluginEcosystem,
): {
  displayName: string;
  ecosystem: StoredPluginEcosystem;
  capabilities: AgentPluginCapabilities;
  compatibility: AgentPluginCompatibility;
} {
  const detected = detectEcosystem(sourcePath);
  const ecosystem = normalizeStoredEcosystem(requested) === 'unknown' ? detected : normalizeStoredEcosystem(requested);
  const manifest = readPluginManifest(sourcePath, ecosystem);
  const displayName = manifest.name ?? manifest.title ?? basename(sourcePath);
  const capabilities = discoverCapabilities(sourcePath);
  const supported = [
    capabilities.skills.length ? `${capabilities.skills.length} skill file${capabilities.skills.length === 1 ? '' : 's'}` : '',
    capabilities.mcp.length ? `${capabilities.mcp.length} MCP declaration${capabilities.mcp.length === 1 ? '' : 's'}` : '',
    capabilities.docs.length ? `${capabilities.docs.length} doc file${capabilities.docs.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const ignored = capabilities.hooks.map((hook) => `${hook.kind} hook: ${hook.path}`);
  const warnings = [
    ...(ecosystem === 'unknown' ? ['Plugin ecosystem could not be detected.'] : []),
    ...(capabilities.hooks.length ? ['Hook files are indexed but not executed until mapped to Neon Pilot lifecycle boundaries.'] : []),
  ];
  const blockers =
    capabilities.skills.length === 0 && capabilities.mcp.length === 0 && capabilities.docs.length === 0
      ? ['No supported plugin capabilities were found.']
      : [];
  return {
    displayName,
    ecosystem,
    capabilities,
    compatibility: { detectedEcosystem: detected, supported, ignored, warnings, blockers },
  };
}

function discoverCapabilities(sourcePath: string): AgentPluginCapabilities {
  const files = walkFiles(sourcePath, 5);
  return {
    skills: files
      .filter((file) => basename(file) === 'SKILL.md')
      .map((file) => ({ id: skillIdFromPath(file), path: relativePath(sourcePath, file) })),
    mcp: files.filter((file) => basename(file) === 'mcp.json').map((file) => ({ path: relativePath(sourcePath, file) })),
    hooks: files
      .filter((file) => file.includes('/hooks/') || file.includes('/.claude/hooks/') || file.includes('/.codex-plugin/hooks/'))
      .map((file) => ({ path: relativePath(sourcePath, file), kind: basename(dirname(file)) })),
    docs: files
      .filter((file) => ['AGENTS.md', 'CLAUDE.md', 'README.md'].includes(basename(file)))
      .map((file) => ({ path: relativePath(sourcePath, file) })),
  };
}

async function wrapPluginAsExtension(input: { sourcePath: string; ecosystem: StoredPluginEcosystem; ctx: ExtensionBackendContext }) {
  return installMarketplacePackageAsExtension({
    ecosystem: input.ecosystem,
    packageType: 'agent',
    source: input.sourcePath,
    target: 'local',
    runtimeDir: input.ctx.runtimeDir,
  });
}

async function readRemoteCommit(plugin: AgentPluginRecord, ctx: ExtensionBackendContext): Promise<string | undefined> {
  if (!plugin.source.url) return undefined;
  const ref = plugin.source.ref ?? 'HEAD';
  const result = await ctx.shell.exec({
    command: 'git',
    args: ['ls-remote', plugin.source.url, ref],
    timeoutMs: 60_000,
    maxBuffer: 512 * 1024,
  });
  const line = result.stdout.trim().split('\n')[0];
  return line ? line.split(/\s+/)[0] : undefined;
}

async function readHeadCommit(cwd: string, ctx: ExtensionBackendContext): Promise<string> {
  const result = await ctx.shell.exec({ command: 'git', args: ['rev-parse', 'HEAD'], cwd, timeoutMs: 30_000, maxBuffer: 64 * 1024 });
  return result.stdout.trim();
}

function readPluginManifest(sourcePath: string, ecosystem: StoredPluginEcosystem): { name?: string; title?: string } {
  const candidates = [
    ecosystem === 'claude' ? join(sourcePath, '.claude-plugin', 'plugin.json') : join(sourcePath, '.codex-plugin', 'plugin.json'),
    join(sourcePath, 'plugin.json'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      return asRecord(JSON.parse(readFileSync(candidate, 'utf-8'))) as { name?: string; title?: string };
    } catch {
      return {};
    }
  }
  return {};
}

function detectEcosystem(sourcePath: string): StoredPluginEcosystem {
  if (existsSync(join(sourcePath, '.codex-plugin', 'plugin.json')) || existsSync(join(sourcePath, '.codex-plugin'))) return 'codex';
  if (existsSync(join(sourcePath, '.claude-plugin', 'plugin.json')) || existsSync(join(sourcePath, '.claude-plugin'))) return 'claude';
  return 'unknown';
}

function normalizeRequestedEcosystem(value: unknown): PluginEcosystem {
  return value === 'codex' || value === 'claude' ? value : 'auto';
}

function normalizeStoredEcosystem(value: unknown): StoredPluginEcosystem {
  return value === 'codex' || value === 'claude' ? value : 'unknown';
}

function pluginsRoot(ctx: ExtensionBackendContext): string {
  return join(ctx.runtimeDir, 'plugins');
}

function pluginRoot(ctx: ExtensionBackendContext, ecosystem: StoredPluginEcosystem, id: string): string {
  return join(pluginsRoot(ctx), ecosystem, id, 'source');
}

function registryPath(ctx: ExtensionBackendContext): string {
  return join(pluginsRoot(ctx), REGISTRY_FILE);
}

function pluginIdFor(pathOrUrl: string, source: string, ecosystem: StoredPluginEcosystem): string {
  return `${ecosystem}-${slugify(basename(pathOrUrl.replace(/\.git$/, '').replace(/\/$/, '')) || 'plugin')}-${hashSource(source)}`;
}

function skillIdFromPath(path: string): string {
  const parent = basename(dirname(path));
  return slugify(parent || basename(path, '.md'));
}

function walkFiles(root: string, maxDepth: number): string[] {
  if (maxDepth < 0 || !existsSync(root) || !statSync(root).isDirectory()) return [];
  const entries = readdirSafe(root);
  return entries.flatMap((entry) => {
    const path = join(root, entry);
    if (['.git', 'node_modules', 'dist', 'build'].includes(entry)) return [];
    const stat = statSync(path);
    if (stat.isDirectory()) return walkFiles(path, maxDepth - 1);
    return stat.isFile() ? [path] : [];
  });
}

function readdirSafe(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function relativePath(root: string, path: string): string {
  return path.slice(root.length).replace(/^\/+/, '');
}

function mutatePlugin(
  ctx: ExtensionBackendContext,
  id: string,
  updater: (plugin: AgentPluginRecord) => AgentPluginRecord,
): AgentPluginRegistry {
  const registry = readRegistry(ctx);
  const next = { version: 1 as const, plugins: registry.plugins.map((plugin) => (plugin.id === id ? updater(plugin) : plugin)) };
  if (!registry.plugins.some((plugin) => plugin.id === id)) throw new Error(`Unknown agent plugin: ${id}`);
  writeRegistry(ctx, next);
  return next;
}

function updatePluginRecord(registry: AgentPluginRegistry, id: string, patch: Partial<AgentPluginRecord>): AgentPluginRegistry {
  return { version: 1, plugins: registry.plugins.map((plugin) => (plugin.id === id ? { ...plugin, ...patch } : plugin)) };
}

function requirePluginId(input: Record<string, unknown>): string {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) throw new Error('Plugin id is required.');
  return id;
}

function isPluginRecord(value: unknown): value is AgentPluginRecord {
  const body = asRecord(value);
  return typeof body.id === 'string' && typeof body.displayName === 'string' && body.source !== undefined;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'plugin'
  );
}

function hashSource(source: string): string {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

function now(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
