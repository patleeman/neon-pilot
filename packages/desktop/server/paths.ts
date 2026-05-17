import { resolveStatePaths } from '@personal-agent/core';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';

import type { DaemonPaths } from './daemon/types.js';

const DAEMON_SOCKET_FILE_NAME = 'personal-agentd.sock';
const DAEMON_PID_FILE_NAME = 'personal-agentd.pid';

function normalizeDaemonNamespace(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return (
    normalized
      .replace(/[^a-zA-Z0-9._-]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 80) || undefined
  );
}

function expandHome(path: string): string {
  if (path === '~') {
    return homedir();
  }

  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }

  return path;
}

export function resolveDaemonPaths(explicitSocketPath?: string, namespace = process.env.PERSONAL_AGENT_DAEMON_NAMESPACE): DaemonPaths {
  const statePaths = resolveStatePaths();
  const normalizedNamespace = explicitSocketPath ? undefined : normalizeDaemonNamespace(namespace);
  const daemonDirName = normalizedNamespace ? `daemon-${normalizedNamespace}` : 'daemon';
  const socketPath = explicitSocketPath
    ? resolve(expandHome(explicitSocketPath))
    : join(statePaths.root, daemonDirName, DAEMON_SOCKET_FILE_NAME);
  const root = explicitSocketPath ? dirname(socketPath) : join(statePaths.root, daemonDirName);

  return {
    stateRoot: statePaths.root,
    root,
    socketPath,
    pidFile: join(root, DAEMON_PID_FILE_NAME),
    logDir: join(root, 'logs'),
    logFile: join(root, 'logs', 'daemon.log'),
  };
}

export function ensureDaemonDirectories(paths: DaemonPaths): void {
  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  mkdirSync(paths.logDir, { recursive: true, mode: 0o700 });
}
