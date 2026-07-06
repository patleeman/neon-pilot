/**
 * Public extension backend seam for Neon Pilot's semantic desktop state.
 *
 * This exposes semantic agent-visible access to the Windowed OS desktop:
 * read-only state and a narrow control bridge whose commands are executed by
 * the renderer's existing window actions.
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
  agentTouched?: boolean;
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

export type DesktopControlAction = 'open' | 'focus' | 'move' | 'resize' | 'snap' | 'minimize' | 'restore' | 'close';
export type DesktopControlSnapTarget = 'left' | 'right' | 'top' | 'bottom' | 'maximize';

export interface DesktopControlBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopControlInput {
  action: DesktopControlAction;
  windowId?: string;
  appId?: string;
  route?: string;
  bounds?: DesktopControlBounds;
  snapTarget?: DesktopControlSnapTarget;
  timeoutMs?: number;
}

export interface DesktopControlResult {
  ok: boolean;
  commandId: string;
  action: DesktopControlAction;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
}

export const controlDesktop = (..._args: unknown[]): unknown => hostResolved();
export const readDesktopState = (..._args: unknown[]): unknown => hostResolved();
