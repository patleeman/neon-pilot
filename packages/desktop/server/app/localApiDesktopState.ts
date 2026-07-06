// localApiDesktopState.ts
//
// Read-only windowed desktop semantic state slice for agents.
//
// The renderer (`WindowedLayout`) owns the canonical window model and publishes
// a sanitized semantic snapshot of the desktop to `POST /api/desktop/state`
// whenever the window stack changes. This module stores the most recent
// snapshot in process-local state and exposes readback through
// `GET /api/desktop/state`. The slice is intentionally read-only: no control
// verbs, no screenshots, no per-pixel data. Agents get a backend-readable
// view of the current windowed desktop: ids / kind / title / route / bounds /
// z-order / focus / minimized / maximized-ish state / parent window ids /
// route metadata.

const MAX_DESKTOP_STATE_WINDOWS = 256;
const MAX_DESKTOP_STATE_TITLE_LENGTH = 256;
const MAX_DESKTOP_STATE_ROUTE_LENGTH = 2048;
const MAX_DESKTOP_STATE_WORKSPACE_CWD_LENGTH = 4096;
const MAX_DESKTOP_STATE_PUBLISHER_ID_LENGTH = 128;

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

export interface DesktopStateSnapshotInput {
  windows: unknown;
  focusedWindowId?: unknown;
  theme?: unknown;
  publishedAt?: unknown;
  revision?: unknown;
  publisherId?: unknown;
}

export interface DesktopStateListResult {
  windows: DesktopStateWindow[];
  focusedWindowId: string | null;
  theme: 'light' | 'dark' | null;
  publishedAt: string | null;
  revision: number | null;
  publisherId: string | null;
}

const WINDOW_KINDS = new Set<DesktopStateWindowKind>(['chat', 'route', 'terminal', 'browser', 'files']);

interface StoredDesktopStateSnapshot {
  windows: DesktopStateWindow[];
  focusedWindowId: string | null;
  theme: 'light' | 'dark' | null;
  publishedAt: string;
  revision: number | null;
  publisherId: string | null;
}

let storedSnapshot: StoredDesktopStateSnapshot | null = null;

export class DesktopStateValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DesktopStateValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.normalize();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function sanitizeBounds(value: unknown): DesktopStateWindowBounds | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function sanitizeRouteMetadata(value: unknown): DesktopStateWindowRouteMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const metadata: DesktopStateWindowRouteMetadata = {};
  const appId = sanitizeString(value.appId, 256);
  if (appId) metadata.appId = appId;
  const sessionId = sanitizeString(value.sessionId, 256);
  if (sessionId) metadata.sessionId = sessionId;
  if (value.singleton === true) metadata.singleton = true;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function sanitizeWindow(value: unknown): DesktopStateWindow | null {
  if (!isRecord(value)) return null;
  const id = sanitizeString(value.id, 256);
  if (!id) return null;
  const kind = value.kind;
  if (typeof kind !== 'string' || !WINDOW_KINDS.has(kind as DesktopStateWindowKind)) return null;
  const title = sanitizeString(value.title, MAX_DESKTOP_STATE_TITLE_LENGTH) ?? 'Untitled';
  const route = sanitizeString(value.route, MAX_DESKTOP_STATE_ROUTE_LENGTH) ?? '';
  const bounds = sanitizeBounds(value.bounds);
  if (!bounds) return null;
  const focused = value.focused === true;
  const minimized = value.minimized === true;
  const maximized = value.maximized === true;
  const rawZIndex = value.zIndex;
  const zIndex = isFiniteNumber(rawZIndex) ? Math.max(0, Math.round(rawZIndex)) : 0;
  const windowRecord: DesktopStateWindow = {
    id,
    kind: kind as DesktopStateWindowKind,
    title,
    route,
    bounds,
    focused,
    minimized,
    maximized: minimized ? false : maximized,
    zIndex: minimized ? 0 : zIndex,
  };
  if (value.agentTouched === true) windowRecord.agentTouched = true;
  const parentWindowId = sanitizeString(value.parentWindowId, 256);
  if (parentWindowId) windowRecord.parentWindowId = parentWindowId;
  const parentWindowTitle = sanitizeString(value.parentWindowTitle, MAX_DESKTOP_STATE_TITLE_LENGTH);
  if (parentWindowTitle) windowRecord.parentWindowTitle = parentWindowTitle;
  const workspaceCwdRaw = value.workspaceCwd;
  if (typeof workspaceCwdRaw === 'string') {
    const workspaceCwd = sanitizeString(workspaceCwdRaw, MAX_DESKTOP_STATE_WORKSPACE_CWD_LENGTH);
    if (workspaceCwd) windowRecord.workspaceCwd = workspaceCwd;
  } else if (workspaceCwdRaw === null) {
    windowRecord.workspaceCwd = null;
  }
  const routeMetadata = sanitizeRouteMetadata(value.routeMetadata);
  if (routeMetadata) windowRecord.routeMetadata = routeMetadata;
  return windowRecord;
}

function sanitizeFocusedWindowId(value: unknown): string | null {
  const id = sanitizeString(value, 256);
  return id ?? null;
}

function sanitizeTheme(value: unknown): 'light' | 'dark' | null {
  return value === 'dark' ? 'dark' : value === 'light' ? 'light' : null;
}

function sanitizePublishedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  // Validate ISO-8601-ish shape without requiring a Date implementation that
  // rejects invalid input across environments; this guard rejects obviously
  // non-timestamp strings while remaining cheap.
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeRevision(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function timestampMs(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeWindowFocus(windows: DesktopStateWindow[], focusedWindowId: string | null): DesktopStateWindow[] {
  return windows.map((windowEntry) => ({
    ...windowEntry,
    focused: focusedWindowId !== null && windowEntry.id === focusedWindowId && !windowEntry.minimized,
  }));
}

function cloneDesktopStateWindow(windowEntry: DesktopStateWindow): DesktopStateWindow {
  return {
    ...windowEntry,
    bounds: { ...windowEntry.bounds },
    ...(windowEntry.routeMetadata ? { routeMetadata: { ...windowEntry.routeMetadata } } : {}),
  };
}

function cloneDesktopStateSnapshot(snapshot: StoredDesktopStateSnapshot): StoredDesktopStateSnapshot {
  return {
    windows: snapshot.windows.map(cloneDesktopStateWindow),
    focusedWindowId: snapshot.focusedWindowId,
    theme: snapshot.theme,
    publishedAt: snapshot.publishedAt,
    revision: snapshot.revision,
    publisherId: snapshot.publisherId,
  };
}

export interface SanitizeDesktopStateResult {
  ok: boolean;
  snapshot?: StoredDesktopStateSnapshot;
  error?: string;
}

export function sanitizeDesktopStateSnapshot(input: DesktopStateSnapshotInput): SanitizeDesktopStateResult {
  if (!isRecord(input)) {
    return { ok: false, error: 'Desktop state snapshot must be an object.' };
  }
  if (!Array.isArray(input.windows)) {
    return { ok: false, error: 'Desktop state snapshot windows must be an array.' };
  }
  if (input.windows.length > MAX_DESKTOP_STATE_WINDOWS) {
    return { ok: false, error: `Desktop state snapshot exceeds ${MAX_DESKTOP_STATE_WINDOWS} windows.` };
  }
  const seenIds = new Set<string>();
  const windows: DesktopStateWindow[] = [];
  for (const rawWindow of input.windows) {
    const sanitizedWindow = sanitizeWindow(rawWindow);
    if (!sanitizedWindow) continue;
    if (seenIds.has(sanitizedWindow.id)) continue;
    seenIds.add(sanitizedWindow.id);
    windows.push(sanitizedWindow);
  }
  const rawFocusedWindowId = sanitizeFocusedWindowId(input.focusedWindowId);
  const focusedWindowId = rawFocusedWindowId && seenIds.has(rawFocusedWindowId) ? rawFocusedWindowId : null;
  const normalizedWindows = normalizeWindowFocus(windows, focusedWindowId);
  const theme = sanitizeTheme(input.theme);
  const publishedAt = sanitizePublishedAt(input.publishedAt) ?? new Date().toISOString();
  const revision = sanitizeRevision(input.revision);
  const publisherId = sanitizeString(input.publisherId, MAX_DESKTOP_STATE_PUBLISHER_ID_LENGTH) ?? null;
  return {
    ok: true,
    snapshot: { windows: normalizedWindows, focusedWindowId, theme, publishedAt, revision, publisherId },
  };
}

export function storeDesktopStateSnapshot(input: DesktopStateSnapshotInput): {
  ok: true;
  windows: DesktopStateWindow[];
  focusedWindowId: string | null;
  theme: 'light' | 'dark' | null;
  publishedAt: string;
  revision: number | null;
  publisherId: string | null;
  ignored?: true;
} {
  const result = sanitizeDesktopStateSnapshot(input);
  if (!result.ok || !result.snapshot) {
    throw new DesktopStateValidationError(result.error ?? 'Invalid desktop state snapshot.');
  }
  if (
    storedSnapshot !== null &&
    storedSnapshot.publisherId !== null &&
    result.snapshot.publisherId !== null &&
    storedSnapshot.publisherId === result.snapshot.publisherId &&
    storedSnapshot.revision !== null &&
    result.snapshot.revision !== null &&
    result.snapshot.revision < storedSnapshot.revision
  ) {
    return { ok: true, ...cloneDesktopStateSnapshot(storedSnapshot), ignored: true };
  }
  if (
    storedSnapshot !== null &&
    storedSnapshot.publisherId !== null &&
    result.snapshot.publisherId !== null &&
    storedSnapshot.publisherId !== result.snapshot.publisherId
  ) {
    const storedPublishedAt = timestampMs(storedSnapshot.publishedAt);
    const incomingPublishedAt = timestampMs(result.snapshot.publishedAt);
    if (storedPublishedAt !== null && incomingPublishedAt !== null && incomingPublishedAt < storedPublishedAt) {
      return { ok: true, ...cloneDesktopStateSnapshot(storedSnapshot), ignored: true };
    }
  }
  storedSnapshot = cloneDesktopStateSnapshot(result.snapshot);
  return { ok: true, ...cloneDesktopStateSnapshot(storedSnapshot) };
}

export function readDesktopStateSnapshot(): DesktopStateListResult {
  if (!storedSnapshot) {
    return { windows: [], focusedWindowId: null, theme: null, publishedAt: null, revision: null, publisherId: null };
  }
  const { windows, focusedWindowId, theme, publishedAt, revision, publisherId } = cloneDesktopStateSnapshot(storedSnapshot);
  return {
    windows,
    focusedWindowId,
    theme,
    publishedAt,
    revision,
    publisherId,
  };
}

export function resetDesktopStateSnapshotForTests(): void {
  storedSnapshot = null;
}
