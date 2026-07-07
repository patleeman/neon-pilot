import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { type MachineConfigOptions, readMachineConfig } from '../machine-config.js';
import { getPiAgentRuntimeDir } from './paths.js';

export interface DesktopRootLayout {
  root: string;
  apps: string;
  data: string;
  dataApps: string;
  dataDocuments: string;
  dataExports: string;
  documents: string;
  agents: string;
  soulDoc: string;
  logs: string;
  logsDesktop: string;
  logsDaemon: string;
  logsTelemetry: string;
  system: string;
  systemAgents: string;
  systemApps: string;
  systemCache: string;
  systemConfig: string;
  systemConversations: string;
  systemConversationsIndex: string;
  systemSessions: string;
  systemDaemon: string;
  systemElectron: string;
  systemElectronUserData: string;
  systemObservability: string;
  systemRuntime: string;
  systemSecrets: string;
  systemState: string;
}

export interface DesktopRootOptions extends MachineConfigOptions {
  root?: string;
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

function normalizeConfiguredRoot(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? resolve(expandHomePath(trimmed)) : undefined;
}

export function getDefaultDesktopRoot(): string {
  return join(homedir(), 'Documents', 'neon-pilot-desktop');
}

export function getDesktopRootDir(options: DesktopRootOptions = {}): string {
  const explicit = normalizeConfiguredRoot(options.root);
  if (explicit) {
    return explicit;
  }

  const configured = normalizeConfiguredRoot(readMachineConfig(options).desktopRoot);
  return configured ?? getDefaultDesktopRoot();
}

export function resolveDesktopRootLayout(options: DesktopRootOptions = {}): DesktopRootLayout {
  const root = getDesktopRootDir(options);
  const data = join(root, 'data');
  const logs = join(root, 'logs');
  const system = join(root, 'system');
  const systemConversations = join(system, 'conversations');
  const systemElectron = join(system, 'electron');

  const agents = join(root, 'agents');

  return {
    root,
    apps: join(root, 'apps'),
    data,
    dataApps: join(data, 'apps'),
    dataDocuments: join(data, 'documents'),
    dataExports: join(data, 'exports'),
    documents: join(root, 'documents'),
    agents,
    soulDoc: join(agents, 'soul.md'),
    logs,
    logsDesktop: join(logs, 'desktop'),
    logsDaemon: join(logs, 'daemon'),
    logsTelemetry: join(logs, 'telemetry'),
    system,
    systemAgents: join(system, 'agents'),
    systemApps: join(system, 'apps'),
    systemCache: join(system, 'cache'),
    systemConfig: join(system, 'config'),
    systemConversations,
    systemConversationsIndex: join(systemConversations, 'session-meta-index.json'),
    systemSessions: join(systemConversations, 'sessions'),
    systemDaemon: join(system, 'daemon'),
    systemElectron,
    systemElectronUserData: join(systemElectron, 'user-data'),
    systemObservability: join(system, 'observability'),
    systemRuntime: join(system, 'runtime'),
    systemSecrets: join(system, 'secrets'),
    systemState: join(system, 'state'),
  };
}

/**
 * Resolve the runtime models.json file path.
 *
 * When a desktop root layout is available, returns the layout-derived path
 * `<desktop-root>/system/runtime/models.json`. Otherwise falls back to
 * the legacy `<state-root>/neon-pilot-runtime/models.json`.
 */
export function getRuntimeModelsFilePath(layout?: DesktopRootLayout): string {
  if (layout) {
    return join(layout.systemRuntime, 'models.json');
  }
  return join(getPiAgentRuntimeDir(), 'models.json');
}

/**
 * Resolve the conversation session metadata index file path.
 *
 * When a desktop root layout is available, returns the layout-derived path
 * `<desktop-root>/system/conversations/session-meta-index.json`. Otherwise
 * falls back to the legacy `<state-root>/neon-pilot-runtime/session-meta-index.json`.
 */
export function getRuntimeSessionsIndexFilePath(layout?: DesktopRootLayout): string {
  if (layout) {
    return layout.systemConversationsIndex;
  }
  return join(getPiAgentRuntimeDir(), 'session-meta-index.json');
}

/**
 * Resolve the runtime auth.json file path.
 *
 * When a desktop root layout is available, returns the layout-derived path
 * `<desktop-root>/system/runtime/auth.json`. Otherwise falls back to the
 * legacy `<state-root>/neon-pilot-runtime/auth.json`.
 */
export function getRuntimeAuthFilePath(layout?: DesktopRootLayout): string {
  if (layout) {
    return join(layout.systemRuntime, 'auth.json');
  }
  return join(getPiAgentRuntimeDir(), 'auth.json');
}

const DEFAULT_SOUL_DOC_CONTENT = `\
# Neon Pilot Persona

You are an AI coding assistant working inside the Neon Pilot environment.
Follow these identity instructions as your behavioral baseline.
`;

export function ensureDesktopRootDir(options?: DesktopRootOptions): string {
  const root = getDesktopRootDir(options);
  mkdirSync(root, { recursive: true, mode: 0o700 });

  const layout = resolveDesktopRootLayout({ root });
  mkdirSync(layout.agents, { recursive: true, mode: 0o700 });

  if (!existsSync(layout.soulDoc)) {
    writeFileSync(layout.soulDoc, DEFAULT_SOUL_DOC_CONTENT, { encoding: 'utf-8', mode: 0o600 });
  }

  return root;
}

export function resolveDesktopAppDataDir(appId: string, options: DesktopRootOptions = {}): string {
  const normalizedAppId = appId.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  if (!normalizedAppId) {
    throw new Error('Desktop app id must not be empty.');
  }

  return join(resolveDesktopRootLayout(options).dataApps, normalizedAppId);
}
