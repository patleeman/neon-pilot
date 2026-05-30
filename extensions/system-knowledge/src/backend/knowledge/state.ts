import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export type KnowledgeBaseSyncStatus = 'disabled' | 'idle' | 'syncing' | 'error';

export interface KnowledgeBaseGitStatus {
  localChangeCount: number;
  aheadCount: number;
  behindCount: number;
}

export interface KnowledgeBaseState {
  repoUrl: string;
  branch: string;
  configured: boolean;
  directories: string[];
  effectiveRoots: string[];
  effectiveRoot: string;
  managedRoot: string;
  usesManagedRoot: boolean;
  syncStatus: KnowledgeBaseSyncStatus;
  lastSyncAt?: string;
  lastError?: string;
  gitStatus?: KnowledgeBaseGitStatus | null;
  recoveredEntryCount: number;
  recoveryDir: string;
}

interface StoredKnowledgeConfig {
  repoUrl?: string;
  branch?: string;
  directories?: string[];
  lastSyncAt?: string;
  lastError?: string;
  syncStatus?: KnowledgeBaseSyncStatus;
}

const CONFIG_KEY = 'knowledge-base/config';
const DEFAULT_BRANCH = 'main';
const GIT_TIMEOUT_MS = 30_000;
const COMMIT_AUTHOR_NAME = 'Neon Pilot';
const COMMIT_AUTHOR_EMAIL = 'kb@neon-pilot.local';

function stateRoot(ctx: ExtensionBackendContext): string {
  return basename(ctx.runtimeDir) === 'neon-pilot-runtime' ? dirname(ctx.runtimeDir) : dirname(resolve(ctx.runtimeDir));
}

function knowledgeStateDir(ctx: ExtensionBackendContext): string {
  return join(stateRoot(ctx), 'knowledge-base');
}

function managedRoot(ctx: ExtensionBackendContext): string {
  return join(knowledgeStateDir(ctx), 'repo');
}

function recoveryDir(ctx: ExtensionBackendContext): string {
  return join(knowledgeStateDir(ctx), 'recovered');
}

function defaultKnowledgeRoot(): string {
  return join(homedir(), 'Documents', 'neon-pilot');
}

function expandHome(value: string): string {
  if (value === '~') return homedir();
  if (value.startsWith('~/')) return join(homedir(), value.slice(2));
  return value;
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function legacyMachineConfigPath(ctx: ExtensionBackendContext): string {
  return join(stateRoot(ctx), 'config', 'config.json');
}

function readConfiguredKnowledgeRoot(ctx: ExtensionBackendContext): string | null {
  const parsed = readJsonFile(ctx.runtimeSettingsFilePath) ?? readJsonFile(legacyMachineConfigPath(ctx));
  const knowledgeRoot = parsed?.knowledgeRoot;
  return typeof knowledgeRoot === 'string' && knowledgeRoot.trim() ? expandHome(knowledgeRoot.trim()) : null;
}

function readLegacyKnowledgeConfig(ctx: ExtensionBackendContext): Pick<StoredKnowledgeConfig, 'repoUrl' | 'branch'> | null {
  const parsed = readJsonFile(legacyMachineConfigPath(ctx));
  const repoUrl = typeof parsed?.knowledgeBaseRepoUrl === 'string' ? parsed.knowledgeBaseRepoUrl.trim() : '';
  if (!repoUrl) return null;
  const branch =
    typeof parsed?.knowledgeBaseBranch === 'string' && parsed.knowledgeBaseBranch.trim()
      ? parsed.knowledgeBaseBranch.trim()
      : DEFAULT_BRANCH;
  return { repoUrl, branch };
}

function sourceOverrideRoot(): string | null {
  const explicit = process.env.NEON_PILOT_KNOWLEDGE_ROOT;
  return explicit && explicit.trim() ? expandHome(explicit.trim()) : null;
}

export function effectiveKnowledgeRoot(ctx: ExtensionBackendContext, config?: Pick<StoredKnowledgeConfig, 'repoUrl'>): string {
  const override = sourceOverrideRoot();
  if (override) return override;
  if ((config?.repoUrl ?? '').trim()) return managedRoot(ctx);
  return readConfiguredKnowledgeRoot(ctx) ?? defaultKnowledgeRoot();
}

function normalizeDirectoryList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const directories = value
    .flatMap((item) => (typeof item === 'string' ? [expandHome(item.trim())] : []))
    .filter(Boolean)
    .map((item) => resolve(item));
  return Array.from(new Set(directories));
}

export function effectiveKnowledgeRoots(
  ctx: ExtensionBackendContext,
  config?: Pick<StoredKnowledgeConfig, 'repoUrl' | 'directories'>,
): string[] {
  const override = sourceOverrideRoot();
  if (override) return [resolve(override)];

  const roots = [...((config?.repoUrl ?? '').trim() ? [managedRoot(ctx)] : []), ...normalizeDirectoryList(config?.directories)];
  if (roots.length > 0) return Array.from(new Set(roots.map((item) => resolve(item))));
  return [resolve(readConfiguredKnowledgeRoot(ctx) ?? defaultKnowledgeRoot())];
}

export async function readEffectiveKnowledgeRoot(ctx: ExtensionBackendContext): Promise<string> {
  const config = await readConfig(ctx);
  return effectiveKnowledgeRoots(ctx, config)[0] ?? effectiveKnowledgeRoot(ctx, config);
}

export async function readEffectiveKnowledgeRoots(ctx: ExtensionBackendContext): Promise<string[]> {
  const config = await readConfig(ctx);
  return effectiveKnowledgeRoots(ctx, config);
}

function normalizeRepoUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBranch(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || DEFAULT_BRANCH;
}

function toIso(): string {
  return new Date().toISOString();
}

async function readConfig(
  ctx: ExtensionBackendContext,
): Promise<Required<Pick<StoredKnowledgeConfig, 'repoUrl' | 'branch'>> & StoredKnowledgeConfig> {
  const stored = (await ctx.storage.get<StoredKnowledgeConfig>(CONFIG_KEY)) ?? {};
  const legacy = normalizeRepoUrl(stored.repoUrl) ? null : readLegacyKnowledgeConfig(ctx);
  const config = legacy ? { ...stored, ...legacy } : stored;
  if (legacy) {
    await writeConfig(ctx, { ...config, syncStatus: config.syncStatus ?? 'idle' });
  }
  return {
    ...config,
    repoUrl: normalizeRepoUrl(config.repoUrl),
    branch: normalizeBranch(config.branch),
    directories: normalizeDirectoryList(config.directories),
    syncStatus: config.syncStatus ?? (config.repoUrl ? 'idle' : 'disabled'),
  };
}

async function writeConfig(ctx: ExtensionBackendContext, config: StoredKnowledgeConfig): Promise<void> {
  await ctx.storage.put(CONFIG_KEY, {
    repoUrl: normalizeRepoUrl(config.repoUrl),
    branch: normalizeBranch(config.branch),
    directories: normalizeDirectoryList(config.directories),
    ...(config.lastSyncAt ? { lastSyncAt: config.lastSyncAt } : {}),
    ...(config.lastError ? { lastError: config.lastError } : {}),
    ...(config.syncStatus ? { syncStatus: config.syncStatus } : {}),
  });
}

async function git(
  ctx: ExtensionBackendContext,
  cwd: string,
  args: string[],
  options: { allowFailure?: boolean; maxBuffer?: number } = {},
) {
  try {
    return await ctx.shell.exec({
      command: 'git',
      args: ['-c', 'core.fsmonitor=false', ...args],
      cwd,
      timeoutMs: GIT_TIMEOUT_MS,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
    });
  } catch (error) {
    if (options.allowFailure) {
      return { command: 'git', args, cwd, stdout: '', stderr: '', executionWrappers: [] };
    }
    throw error;
  }
}

async function gitText(
  ctx: ExtensionBackendContext,
  cwd: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<string> {
  return (await git(ctx, cwd, args, options)).stdout;
}

async function refExists(ctx: ExtensionBackendContext, cwd: string, ref: string): Promise<boolean> {
  await git(ctx, cwd, ['rev-parse', '--verify', '--quiet', ref], { allowFailure: true });
  const output = await gitText(ctx, cwd, ['rev-parse', '--verify', '--quiet', ref], { allowFailure: true });
  return output.trim().length > 0;
}

async function readGitStatus(ctx: ExtensionBackendContext, root: string, branch: string): Promise<KnowledgeBaseGitStatus | null> {
  if (!existsSync(join(root, '.git'))) return null;
  const status = (await gitText(ctx, root, ['status', '--porcelain=v1', '--untracked-files=all'], { allowFailure: true })).trim();
  const localChangeCount = status ? status.split(/\r?\n/u).filter(Boolean).length : 0;
  let aheadCount = 0;
  let behindCount = 0;
  const remoteRef = `refs/remotes/origin/${branch}`;
  if (await refExists(ctx, root, 'HEAD')) {
    // Use cached remote refs only — skip `git fetch` so readState is fast
    // and doesn't block on network I/O. The explicit sync action handles
    // remote updates.
    if (await refExists(ctx, root, remoteRef)) {
      const counts = (
        await gitText(ctx, root, ['rev-list', '--left-right', '--count', `HEAD...${remoteRef}`], { allowFailure: true })
      ).trim();
      const [aheadRaw, behindRaw] = counts.split(/\s+/u);
      aheadCount = Number.parseInt(aheadRaw ?? '0', 10) || 0;
      behindCount = Number.parseInt(behindRaw ?? '0', 10) || 0;
    }
  }
  return { localChangeCount, aheadCount, behindCount };
}

function archiveManagedRoot(ctx: ExtensionBackendContext, reason: string): void {
  const root = managedRoot(ctx);
  if (!existsSync(root)) return;
  const safeReason = reason.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archive';
  const archiveDir = join(knowledgeStateDir(ctx), 'archives');
  mkdirSync(archiveDir, { recursive: true });
  renameSync(root, join(archiveDir, `${toIso().replace(/[:.]/g, '-')}-${safeReason}`));
}

async function ensureCheckout(ctx: ExtensionBackendContext, repoUrl: string, branch: string): Promise<string> {
  const root = managedRoot(ctx);
  const parent = dirname(root);
  mkdirSync(parent, { recursive: true });

  if (!existsSync(join(root, '.git'))) {
    if (existsSync(root)) archiveManagedRoot(ctx, 'non-git-root');
    await git(ctx, parent, ['clone', repoUrl, root]);
  }

  const currentRemote = (await gitText(ctx, root, ['remote', 'get-url', 'origin'], { allowFailure: true })).trim();
  if (currentRemote && currentRemote !== repoUrl) {
    archiveManagedRoot(ctx, 'repo-change');
    await git(ctx, parent, ['clone', repoUrl, root]);
  } else if (!currentRemote) {
    await git(ctx, root, ['remote', 'add', 'origin', repoUrl], { allowFailure: true });
  }

  await git(ctx, root, ['fetch', 'origin'], { allowFailure: true });
  const remoteBranch = `origin/${branch}`;
  const hasRemoteBranch = await refExists(ctx, root, `refs/remotes/${remoteBranch}`);
  const hasLocalBranch = await refExists(ctx, root, `refs/heads/${branch}`);
  if (hasLocalBranch) {
    await git(ctx, root, ['checkout', branch]);
  } else if (hasRemoteBranch) {
    await git(ctx, root, ['checkout', '-B', branch, remoteBranch]);
  } else {
    await git(ctx, root, ['checkout', '-B', branch]);
  }
  await git(ctx, root, ['config', '--replace-all', `branch.${branch}.remote`, 'origin'], { allowFailure: true });
  await git(ctx, root, ['config', '--replace-all', `branch.${branch}.merge`, `refs/heads/${branch}`], { allowFailure: true });
  return root;
}

async function commitLocalChanges(ctx: ExtensionBackendContext, root: string, branch: string, timestamp: string): Promise<void> {
  const status = (await gitText(ctx, root, ['status', '--porcelain=v1', '--untracked-files=all'], { allowFailure: true })).trim();
  if (!status) return;
  await git(ctx, root, ['add', '--all']);
  await git(ctx, root, [
    '-c',
    `user.name=${COMMIT_AUTHOR_NAME}`,
    '-c',
    `user.email=${COMMIT_AUTHOR_EMAIL}`,
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    `kb sync ${timestamp}`,
  ]);
  await git(ctx, root, ['push', 'origin', `HEAD:refs/heads/${branch}`], { allowFailure: true });
}

export async function readKnowledgeState(ctx: ExtensionBackendContext): Promise<KnowledgeBaseState> {
  const config = await readConfig(ctx);
  const configured = config.repoUrl.length > 0;
  const root = managedRoot(ctx);
  const usesManagedRoot = configured && !sourceOverrideRoot();
  const gitStatus = configured ? await readGitStatus(ctx, root, config.branch) : null;
  const effectiveRoots = effectiveKnowledgeRoots(ctx, config);
  return {
    repoUrl: config.repoUrl,
    branch: config.branch,
    configured,
    directories: config.directories,
    effectiveRoots,
    effectiveRoot: effectiveRoots[0] ?? effectiveKnowledgeRoot(ctx, config),
    managedRoot: root,
    usesManagedRoot,
    syncStatus: configured ? (config.syncStatus ?? 'idle') : 'disabled',
    ...(config.lastSyncAt ? { lastSyncAt: config.lastSyncAt } : {}),
    ...(config.lastError ? { lastError: config.lastError } : {}),
    ...(gitStatus ? { gitStatus } : {}),
    recoveredEntryCount: 0,
    recoveryDir: recoveryDir(ctx),
  };
}

export async function updateKnowledgeState(
  input: { repoUrl?: string | null; branch?: string | null; directories?: string[] | null },
  ctx: ExtensionBackendContext,
): Promise<KnowledgeBaseState> {
  const current = await readConfig(ctx);
  const nextRepoUrl = input.repoUrl === undefined ? current.repoUrl : normalizeRepoUrl(input.repoUrl);
  const nextBranch = input.branch === undefined ? current.branch : normalizeBranch(input.branch);
  const nextDirectories =
    input.directories === undefined || input.directories === null ? current.directories : normalizeDirectoryList(input.directories);
  if (current.repoUrl && nextRepoUrl && current.repoUrl !== nextRepoUrl) archiveManagedRoot(ctx, 'repo-change');
  await writeConfig(ctx, {
    repoUrl: nextRepoUrl,
    branch: nextBranch,
    directories: nextDirectories,
    syncStatus: nextRepoUrl ? 'idle' : 'disabled',
  });
  const next = nextRepoUrl ? await syncKnowledgeState(ctx) : await readKnowledgeState(ctx);
  ctx.ui.invalidate('knowledgeBase');
  return next;
}

export async function syncKnowledgeState(ctx: ExtensionBackendContext): Promise<KnowledgeBaseState> {
  const config = await readConfig(ctx);
  if (!config.repoUrl) {
    await writeConfig(ctx, { ...config, syncStatus: 'disabled', lastError: undefined });
    return readKnowledgeState(ctx);
  }

  await writeConfig(ctx, { ...config, syncStatus: 'syncing', lastError: undefined });
  try {
    const timestamp = toIso();
    const root = await ensureCheckout(ctx, config.repoUrl, config.branch);
    await commitLocalChanges(ctx, root, config.branch, timestamp);
    await git(ctx, root, ['pull', '--rebase', 'origin', config.branch], { allowFailure: true });
    await git(ctx, root, ['push', 'origin', `HEAD:refs/heads/${config.branch}`], { allowFailure: true });
    await writeConfig(ctx, { ...config, syncStatus: 'idle', lastSyncAt: timestamp, lastError: undefined });
  } catch (error) {
    await writeConfig(ctx, { ...config, syncStatus: 'error', lastError: error instanceof Error ? error.message : String(error) });
  }
  ctx.ui.invalidate('knowledgeBase');
  return readKnowledgeState(ctx);
}
