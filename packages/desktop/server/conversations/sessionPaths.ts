import { dirname, join } from 'node:path';

import { type DesktopRootLayout, getDurableSessionsDir, getRuntimeSessionsIndexFilePath } from '@neon-pilot/core';

let getDesktopRootLayoutFn: (() => DesktopRootLayout) | null = null;

/**
 * Environment variable key that the parent desktop process sets to propagate
 * the layout-derived system sessions directory to worker threads that cannot
 * access getDesktopRootLayout directly.
 */
export const SYSTEM_SESSIONS_DIR_ENV_KEY = 'NEON_PILOT_SYSTEM_SESSIONS_DIR';

/**
 * Environment variable key that the parent desktop process sets to propagate
 * the layout-derived system sessions index file path to worker threads that
 * cannot access getDesktopRootLayout directly.
 */
export const SYSTEM_SESSIONS_INDEX_FILE_ENV_KEY = 'NEON_PILOT_SYSTEM_SESSIONS_INDEX_FILE';

/**
 * Override the DesktopRootLayout resolver used by session directory path
 * resolution. Routes through the existing ServerRouteContext.getDesktopRootLayout
 * when set; falls back to resolving from defaults if never called.
 */
export function setSessionPathsContext(input: { getDesktopRootLayout?: () => DesktopRootLayout }): void {
  getDesktopRootLayoutFn = input.getDesktopRootLayout ?? null;
}

/**
 * Resolve the system sessions directory.
 *
 * When a DesktopRootLayout is available (desktop mode), returns the layout-derived
 * path `<desktop-root>/system/conversations/sessions`. Falls back to the legacy
 * durable sessions directory from the state root.
 */
export function resolveSystemSessionsDir(layout?: DesktopRootLayout): string {
  if (layout) {
    return layout.systemSessions;
  }
  if (getDesktopRootLayoutFn) {
    try {
      return getDesktopRootLayoutFn().systemSessions;
    } catch {
      // Fall through to env/legacy default
    }
  }
  // Environment fallback for worker-thread compatibility when layout context
  // is not available but the parent process has propagated the resolved path.
  const envDir = process.env[SYSTEM_SESSIONS_DIR_ENV_KEY];
  if (envDir) {
    return envDir;
  }
  return getDurableSessionsDir();
}

/**
 * Resolve the system session metadata index file.
 *
 * When a DesktopRootLayout is available (desktop mode), returns the layout-derived
 * path `<desktop-root>/system/conversations/session-meta-index.json`. Falls back
 * to the legacy runtime directory.
 */
export function resolveSystemSessionsIndexFile(layout?: DesktopRootLayout): string {
  if (layout) {
    return getRuntimeSessionsIndexFilePath(layout);
  }
  if (getDesktopRootLayoutFn) {
    try {
      return getRuntimeSessionsIndexFilePath(getDesktopRootLayoutFn());
    } catch {
      // Fall through to env/legacy default
    }
  }
  // Environment fallback for worker-thread compatibility when layout context
  // is not available but the parent process has propagated the resolved path.
  const envFile = process.env[SYSTEM_SESSIONS_INDEX_FILE_ENV_KEY];
  if (envFile) {
    return envFile;
  }
  return getRuntimeSessionsIndexFilePath();
}

export function resolvePersistentSessionDir(cwd: string, options?: { sessionsDir?: string }): string {
  const safePath = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
  const sessionsDir = options?.sessionsDir ?? resolveSystemSessionsDir();
  return join(sessionsDir, safePath);
}

export function resolveSessionsDir(input: { envSessionsDir?: string; defaultSessionsDir: string }): string {
  return input.envSessionsDir ?? input.defaultSessionsDir;
}

export function resolveSessionsIndexFile(input: {
  envSessionsIndexFile?: string;
  envSessionsDir?: string;
  defaultSessionsIndexFile: string;
}): string {
  if (input.envSessionsIndexFile) {
    return input.envSessionsIndexFile;
  }

  if (input.envSessionsDir) {
    return join(dirname(input.envSessionsDir), 'session-meta-index.json');
  }

  return input.defaultSessionsIndexFile;
}
