import { dirname, join } from 'node:path';

import { type DesktopRootLayout, getDurableSessionsDir } from '@neon-pilot/core';

let getDesktopRootLayoutFn: (() => DesktopRootLayout) | null = null;

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
      // Fall through to legacy default
    }
  }
  return getDurableSessionsDir();
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
