import type { App } from 'electron';

export interface DesktopSingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  on(event: 'second-instance', listener: (_event: unknown, argv: string[], workingDirectory: string) => void): App;
  exit(code?: number): void;
}

const DESKTOP_INITIAL_ROUTE_ARG = '--neon-pilot-initial-route=';

function normalizeDesktopInitialRoute(route: string | undefined): string | null {
  const normalized = route?.trim();
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return null;
  }
  return normalized;
}

export function readDesktopInitialRoute(env: NodeJS.ProcessEnv, argv: readonly string[] = process.argv): string {
  for (const arg of argv) {
    if (arg.startsWith(DESKTOP_INITIAL_ROUTE_ARG)) {
      return normalizeDesktopInitialRoute(arg.slice(DESKTOP_INITIAL_ROUTE_ARG.length)) ?? '/';
    }
  }

  return normalizeDesktopInitialRoute(env.NEON_PILOT_DESKTOP_INITIAL_ROUTE) ?? '/';
}

export function readDesktopProtocolRoute(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'neon-pilot:' || parsed.hostname !== 'app') {
      return null;
    }

    return normalizeDesktopInitialRoute(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return null;
  }
}

export function claimDesktopSingleInstance(
  app: DesktopSingleInstanceApp,
  onSecondInstance: (_event: unknown, argv: string[], workingDirectory: string) => void,
): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.exit(0);
    return false;
  }

  app.on('second-instance', onSecondInstance);
  return true;
}
