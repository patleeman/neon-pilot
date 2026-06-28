/**
 * Runtime state path resolution
 *
 * Provides canonical writable paths for auth data, session data, and cache data.
 * All paths are rooted outside managed repository files by default.
 *
 * Environment variables for override:
 * - NEON_PILOT_STATE_ROOT: Override the base state directory
 * - NEON_PILOT_KNOWLEDGE_ROOT: Override the durable knowledge root
 * - NEON_PILOT_AUTH_PATH: Override auth directory
 * - NEON_PILOT_SESSION_PATH: Override session directory
 * - NEON_PILOT_CACHE_PATH: Override cache directory
 */

import { existsSync, mkdirSync, readFileSync, realpathSync } from 'fs';
import { homedir } from 'os';
import { basename, dirname, join, resolve } from 'path';

import { resolveNeonPilotRuntimeChannelConfig } from '../runtime-channel.js';

/**
 * Default state root directory (outside repo)
 * Uses XDG_STATE_HOME or falls back to ~/.local/state/neon-pilot
 */
export function getDefaultStateRoot(): string {
  const xdgStateHome = process.env.XDG_STATE_HOME;
  if (xdgStateHome) {
    return join(xdgStateHome, 'neon-pilot');
  }
  return join(homedir(), '.local', 'state', 'neon-pilot');
}

function expandHomePath(pathValue: string): string {
  if (pathValue === '~') {
    return homedir();
  }

  if (pathValue.startsWith('~/')) {
    return join(homedir(), pathValue.slice(2));
  }

  return pathValue;
}

/**
 * Get the configured state root directory
 */
export function getStateRoot(): string {
  const explicit = process.env.NEON_PILOT_STATE_ROOT;
  if (explicit && explicit.trim().length > 0) {
    return expandHomePath(explicit.trim());
  }

  const defaultStateRoot = getDefaultStateRoot();
  const { stateRootSuffix } = resolveNeonPilotRuntimeChannelConfig();
  return stateRootSuffix ? join(dirname(defaultStateRoot), `${basename(defaultStateRoot)}${stateRootSuffix}`) : defaultStateRoot;
}

export function getPiAgentStateDir(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'pi-agent');
}

export function getPiAgentRuntimeDir(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'neon-pilot-runtime');
}

export function resolveNeutralChatCwd(profile: string, stateRoot: string = getStateRoot()): string {
  const safeProfile = profile.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'default';
  const cwd = join(getPiAgentRuntimeDir(stateRoot), 'chat-workspaces', safeProfile);
  mkdirSync(cwd, { recursive: true });
  return cwd;
}

/**
 * Default config root directory.
 *
 * The canonical config home now lives under the runtime state root so mutable
 * application state is colocated under a single home.
 */
export function getDefaultConfigRoot(): string {
  return join(getStateRoot(), 'config');
}

/**
 * Get the configured config root directory.
 */
export function getConfigRoot(): string {
  const explicit = process.env.NEON_PILOT_CONFIG_ROOT;
  return explicit && explicit.trim().length > 0 ? expandHomePath(explicit.trim()) : getDefaultConfigRoot();
}

interface RuntimePathMachineConfigOptions {
  configRoot?: string;
  stateRoot?: string;
}

function getMachineConfigFilePathForRuntimePaths(options: RuntimePathMachineConfigOptions = {}): string {
  const explicit = process.env.NEON_PILOT_CONFIG_FILE;
  if (explicit && explicit.trim().length > 0) {
    return resolve(expandHomePath(explicit.trim()));
  }

  if (options.configRoot) {
    return join(resolve(options.configRoot), 'config.json');
  }

  return join(resolve(getConfigRoot()), 'config.json');
}

function readMachineConfigRuntimeOverrides(options: RuntimePathMachineConfigOptions = {}): {
  knowledgeRoot?: string;
} {
  const filePath = getMachineConfigFilePathForRuntimePaths(options);
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const record = parsed as { knowledgeRoot?: unknown };
    const knowledgeRoot =
      typeof record.knowledgeRoot === 'string' && record.knowledgeRoot.trim().length > 0
        ? expandHomePath(record.knowledgeRoot.trim())
        : undefined;
    return {
      ...(knowledgeRoot ? { knowledgeRoot } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Default durable knowledge root directory.
 *
 * Durable notes, projects, and skills live in the external knowledge root by default.
 * Mutable profile config lives separately under machine-local config.
 */
export function getDefaultKnowledgeRoot(): string {
  return join(homedir(), 'Documents', 'neon-pilot');
}

/**
 * Get the configured durable knowledge root directory.
 */
export function getKnowledgeRoot(options: RuntimePathMachineConfigOptions = {}): string {
  const explicit = process.env.NEON_PILOT_KNOWLEDGE_ROOT;
  if (explicit && explicit.trim().length > 0) {
    return expandHomePath(explicit.trim());
  }

  const configured = readMachineConfigRuntimeOverrides(options);
  return configured.knowledgeRoot ?? getDefaultKnowledgeRoot();
}

/**
 * Default mutable runtime config root directory.
 */
export function getDefaultRuntimeConfigRoot(): string {
  return getDurableRuntimeConfigRoot();
}

/**
 * Get the configured mutable runtime config root directory.
 */
export function getRuntimeConfigRoot(): string {
  return getDefaultRuntimeConfigRoot();
}

/**
 * Root directory for git-backed synced durable state.
 */
export function getSyncRoot(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'sync');
}

export function getDurablePiAgentDir(stateRoot: string = getStateRoot()): string {
  return join(getSyncRoot(stateRoot), 'pi-agent');
}

export function getDurableSessionsDir(stateRoot: string = getStateRoot()): string {
  return join(getDurablePiAgentDir(stateRoot), 'sessions');
}

export function getDurableConversationAttentionDir(stateRoot: string = getStateRoot()): string {
  return join(getDurablePiAgentDir(stateRoot), 'state', 'conversation-attention');
}

export function getDurableRuntimeConfigRoot(configRoot: string = getConfigRoot()): string {
  return join(configRoot, 'runtime');
}

export function getDurableAgentFilePath(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'AGENTS.md');
}

export function getDurableMemoryRoot(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'memory');
}

export function getDurableMemorySystemFilePath(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(getDurableMemoryRoot(knowledgeRoot), 'system.md');
}

export function getDurableMemoryScopesDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(getDurableMemoryRoot(knowledgeRoot), 'scopes');
}

export function getDurableMemorySkillsDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(getDurableMemoryRoot(knowledgeRoot), 'skills');
}

export function getDurableRuntimeScopeDir(runtimeScope: string, runtimeConfigRoot: string = getDurableRuntimeConfigRoot()): string {
  return join(runtimeConfigRoot, runtimeScope);
}

export function getDurableRuntimeScopeSettingsFilePath(
  runtimeScope: string,
  runtimeConfigRoot: string = getDurableRuntimeConfigRoot(),
): string {
  return join(getDurableRuntimeScopeDir(runtimeScope, runtimeConfigRoot), 'settings.json');
}

export function getDurableRuntimeScopeModelsFilePath(
  runtimeScope: string,
  runtimeConfigRoot: string = getDurableRuntimeConfigRoot(),
): string {
  return join(getDurableRuntimeScopeDir(runtimeScope, runtimeConfigRoot), 'models.json');
}

export function getDurableSettingsDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'settings');
}

export function getDurableModelsDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'models');
}

export function getDurableSkillsDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'skills');
}

export function getDurableNodesDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'nodes');
}

export function getDurableNotesDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'notes');
}

export function getDurableMemoryDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return getDurableNotesDir(knowledgeRoot);
}

export function getDurableTasksDir(syncRoot: string = getSyncRoot()): string {
  return join(syncRoot, 'tasks');
}

export function getDurableProjectsDir(knowledgeRoot: string = getKnowledgeRoot()): string {
  return join(knowledgeRoot, 'projects');
}

/**
 * Default local overlay directory.
 */
export function getDefaultLocalRuntimeConfigDir(): string {
  return join(getConfigRoot(), 'local');
}

/**
 * Get the configured local overlay directory.
 */
export function getLocalRuntimeConfigDir(): string {
  return getDefaultLocalRuntimeConfigDir();
}

/**
 * Runtime state paths configuration
 */
export interface RuntimeStatePaths {
  /** Base state directory */
  root: string;
  /** Auth data directory (tokens, credentials) */
  auth: string;
  /** Session data directory (active sessions, state) */
  session: string;
  /** Cache directory (temporary computed data) */
  cache: string;
}

/**
 * Resolve runtime state paths
 * Returns canonical paths for auth, session, and cache data
 */
export function resolveStatePaths(): RuntimeStatePaths {
  const root = getStateRoot();

  return {
    root,
    auth: process.env.NEON_PILOT_AUTH_PATH ?? join(root, 'auth'),
    session: process.env.NEON_PILOT_SESSION_PATH ?? join(root, 'session'),
    cache: process.env.NEON_PILOT_CACHE_PATH ?? join(root, 'cache'),
  };
}

/**
 * Check if a path is within the repository
 * Used to prevent accidental state storage in managed files
 */
function canonicalizePath(path: string): string {
  const absolutePath = resolve(path);

  if (existsSync(absolutePath)) {
    try {
      return realpathSync(absolutePath);
    } catch {
      return absolutePath;
    }
  }

  const missingSegments: string[] = [];
  let current = absolutePath;

  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return absolutePath;
    }

    missingSegments.unshift(basename(current));
    current = parent;
  }

  let canonicalBase = current;

  try {
    canonicalBase = realpathSync(current);
  } catch {
    // Keep non-canonical existing base when realpath resolution fails.
  }

  return missingSegments.reduce((acc, segment) => join(acc, segment), canonicalBase);
}

export function isPathInRepo(targetPath: string, repoRoot: string = process.cwd()): boolean {
  const normalizedTarget = canonicalizePath(targetPath).replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedRepo = canonicalizePath(repoRoot).replace(/\\/g, '/').replace(/\/$/, '');

  return normalizedTarget === normalizedRepo || normalizedTarget.startsWith(`${normalizedRepo}/`);
}

/**
 * Validate that state paths are outside the repository
 * Throws if any path would store mutable state in managed repo files
 */
export function validateStatePathsOutsideRepo(paths: RuntimeStatePaths, repoRoot: string = process.cwd()): void {
  const violations: string[] = [];

  if (isPathInRepo(paths.root, repoRoot)) {
    violations.push(`State root "${paths.root}" is inside repository`);
  }

  if (isPathInRepo(paths.auth, repoRoot)) {
    violations.push(`Auth path "${paths.auth}" is inside repository`);
  }
  if (isPathInRepo(paths.session, repoRoot)) {
    violations.push(`Session path "${paths.session}" is inside repository`);
  }
  if (isPathInRepo(paths.cache, repoRoot)) {
    violations.push(`Cache path "${paths.cache}" is inside repository`);
  }

  if (violations.length > 0) {
    throw new Error(
      `Runtime state paths must be outside repository:\n${violations.join('\n')}\n\n` +
        `Set NEON_PILOT_STATE_ROOT to a directory outside the repo, or ` +
        `configure individual paths via NEON_PILOT_AUTH_PATH, ` +
        `NEON_PILOT_SESSION_PATH, NEON_PILOT_CACHE_PATH`,
    );
  }
}
