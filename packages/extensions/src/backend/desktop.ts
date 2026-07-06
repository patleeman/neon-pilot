/**
 * Public extension backend seam for Neon Pilot's semantic desktop state.
 *
 * This is read-only agent-visible state about the Windowed OS desktop: window
 * ids, routes, bounds, focus, z-order, and app metadata. It intentionally does
 * not expose screenshots, DOM snapshots, pixels, or control verbs.
 */

function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/desktop must be resolved by the Neon Pilot host runtime.');
}

export type DesktopStateWindowKind = 'chat' | 'route' | 'terminal' | 'browser' | 'files';

export interface DesktopStateWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopStateWindowRouteMetadata {
  appId?: string;
  sessionId?: string;
  singleton?: boolean;
}

export interface DesktopStateWindow {
  id: string;
  kind: DesktopStateWindowKind;
  title: string;
  route: string;
  bounds: DesktopStateWindowBounds;
  focused: boolean;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  parentWindowId?: string;
  parentWindowTitle?: string;
  workspaceCwd?: string | null;
  routeMetadata?: DesktopStateWindowRouteMetadata;
}

export interface DesktopStateListResult {
  windows: DesktopStateWindow[];
  focusedWindowId: string | null;
  theme: 'light' | 'dark' | null;
  publishedAt: string | null;
  revision: number | null;
  publisherId: string | null;
}

export const readDesktopState = (..._args: unknown[]): unknown => hostResolved();
