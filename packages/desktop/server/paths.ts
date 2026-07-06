import { type DesktopRootLayout, resolveStatePaths } from '@neon-pilot/core';
import { createHash } from 'crypto';
import { mkdirSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { dirname, join, resolve } from 'path';

import type { DaemonPaths } from './daemon/types.js';

const DAEMON_SOCKET_FILE_NAME = 'neon-pilotd.sock';
const DAEMON_PID_FILE_NAME = 'neon-pilotd.pid';

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

// macOS limits sun_path to 104 bytes including the null terminator (103 usable chars).
// Exceeding this limit causes the kernel to silently truncate the path, which results
// in EADDRINUSE when the truncated path collides with an existing directory entry.
const UNIX_SOCKET_PATH_MAX = 103;

function createShortSocketPath(stateRoot: string, daemonDirName: string): string {
  const digest = createHash('sha256').update(`${stateRoot}\0${daemonDirName}`).digest('hex').slice(0, 16);
  return join(tmpdir(), `neon-pilotd-${digest}.sock`);
}

export function resolveDaemonPaths(
  explicitSocketPath?: string,
  namespace = process.env.NEON_PILOT_DAEMON_NAMESPACE,
  layout?: DesktopRootLayout,
): DaemonPaths {
  const statePaths = resolveStatePaths();
  const normalizedNamespace = explicitSocketPath ? undefined : normalizeDaemonNamespace(namespace);

  let root: string;
  let logDir: string;
  let logFile: string;
  let socketPath: string;

  if (layout && !explicitSocketPath) {
    root = normalizedNamespace ? `${layout.systemDaemon}-${normalizedNamespace}` : layout.systemDaemon;
    logDir = layout.logsDaemon;
    logFile = join(layout.logsDaemon, 'daemon.log');

    const defaultSocketPath = join(root, DAEMON_SOCKET_FILE_NAME);
    socketPath = defaultSocketPath.length > UNIX_SOCKET_PATH_MAX ? createShortSocketPath(statePaths.root, root) : defaultSocketPath;
  } else {
    const daemonDirName = normalizedNamespace ? `daemon-${normalizedNamespace}` : 'daemon';
    const defaultSocketPath = join(statePaths.root, daemonDirName, DAEMON_SOCKET_FILE_NAME);
    socketPath = explicitSocketPath
      ? resolve(expandHome(explicitSocketPath))
      : defaultSocketPath.length > UNIX_SOCKET_PATH_MAX
        ? createShortSocketPath(statePaths.root, daemonDirName)
        : defaultSocketPath;
    root = explicitSocketPath ? dirname(socketPath) : join(statePaths.root, daemonDirName);
    logDir = join(root, 'logs');
    logFile = join(root, 'logs', 'daemon.log');
  }

  if (socketPath.length > UNIX_SOCKET_PATH_MAX) {
    throw new Error(
      `Daemon socket path exceeds the Unix socket path limit (${UNIX_SOCKET_PATH_MAX} chars): ` +
        `${socketPath} (${String(socketPath.length)} chars). ` +
        `Shorten NEON_PILOT_DAEMON_NAMESPACE or set NEON_PILOT_DAEMON_SOCKET_PATH to an explicit short path.`,
    );
  }

  return {
    stateRoot: statePaths.root,
    root,
    socketPath,
    pidFile: join(root, DAEMON_PID_FILE_NAME),
    logDir,
    logFile,
  };
}

export function ensureDaemonDirectories(paths: DaemonPaths): void {
  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(paths.socketPath), { recursive: true, mode: 0o700 });
  mkdirSync(paths.logDir, { recursive: true, mode: 0o700 });
}
