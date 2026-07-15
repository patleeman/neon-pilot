import type { ApplicationNavigationRegistration, ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import { type LauncherPin, launcherPinKey, type LauncherPinSnapshot, type LauncherPinTarget, normalizeLauncherPins } from './launcherPins';

export interface ApplicationViewState {
  id: string;
  applicationId: string;
  route: string;
  title: string;
  lastActiveAt: string;
}

export interface ApplicationWorkspaceState {
  pinnedApplicationIds: string[];
  launcherPins?: LauncherPin[];
  pinsInitialized: boolean;
  openViews: ApplicationViewState[];
  activeViewId: string | null;
}

export const EMPTY_APPLICATION_WORKSPACE: ApplicationWorkspaceState = {
  pinnedApplicationIds: [],
  launcherPins: [],
  pinsInitialized: false,
  openViews: [],
  activeViewId: null,
};

const APPLICATION_WORKSPACE_STORAGE_KEY = 'neon-pilot:application-workspace:v1';

export function readStoredApplicationWorkspace(): ApplicationWorkspaceState {
  if (typeof window === 'undefined') return EMPTY_APPLICATION_WORKSPACE;
  try {
    return normalizeApplicationWorkspace(JSON.parse(window.localStorage.getItem(APPLICATION_WORKSPACE_STORAGE_KEY) ?? 'null'));
  } catch {
    return EMPTY_APPLICATION_WORKSPACE;
  }
}

export function writeStoredApplicationWorkspace(workspace: ApplicationWorkspaceState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPLICATION_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // The shell remains usable when browser storage is unavailable.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeView(value: unknown): ApplicationViewState | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const applicationId = typeof value.applicationId === 'string' ? value.applicationId.trim() : '';
  const route = typeof value.route === 'string' ? value.route.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const lastActiveAt =
    typeof value.lastActiveAt === 'string' && Number.isFinite(Date.parse(value.lastActiveAt))
      ? new Date(value.lastActiveAt).toISOString()
      : new Date(0).toISOString();
  if (!id || !applicationId || !route || !title) return null;
  return { id, applicationId, route, title, lastActiveAt };
}

export function normalizeApplicationWorkspace(value: unknown): ApplicationWorkspaceState {
  if (!isRecord(value)) return EMPTY_APPLICATION_WORKSPACE;
  const pinnedApplicationIds = uniqueStrings(value.pinnedApplicationIds);
  const openViews = Array.isArray(value.openViews)
    ? value.openViews.map(normalizeView).filter((view): view is ApplicationViewState => view !== null)
    : [];
  const openViewIds = new Set(openViews.map((view) => view.id));
  const activeViewId = typeof value.activeViewId === 'string' && openViewIds.has(value.activeViewId) ? value.activeViewId : null;
  return {
    pinnedApplicationIds,
    launcherPins: normalizeLauncherPins(value.launcherPins),
    pinsInitialized: typeof value.pinsInitialized === 'boolean' ? value.pinsInitialized : pinnedApplicationIds.length > 0,
    openViews,
    activeViewId,
  };
}

function routeMatchesPrefix(pathname: string, route: string): boolean {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(route.endsWith('/') ? route : `${route}/`);
}

export function resolveApplicationForRoute(
  pathname: string,
  applications: readonly ApplicationRegistration[],
  navigation: readonly ApplicationNavigationRegistration[],
): ApplicationRegistration | null {
  const availableById = new Map(
    applications.filter((application) => application.available).map((application) => [application.id, application]),
  );
  const candidates = [
    ...navigation.map((item) => ({ applicationId: item.applicationId, route: item.route })),
    ...applications.flatMap((application) =>
      (application.routes ?? [application.startRoute]).map((route) => ({ applicationId: application.id, route })),
    ),
  ]
    .filter((candidate) => availableById.has(candidate.applicationId) && routeMatchesPrefix(pathname, candidate.route))
    .sort((left, right) => right.route.length - left.route.length);
  return candidates.length > 0 ? (availableById.get(candidates[0]!.applicationId) ?? null) : null;
}

export function focusApplicationRoute(
  current: ApplicationWorkspaceState,
  application: ApplicationRegistration,
  route: string,
  now = new Date().toISOString(),
  viewPolicy: 'internal' | 'singleton' | 'resource' = 'internal',
): ApplicationWorkspaceState {
  const multiple = application.instancePolicy === 'multiple' || viewPolicy === 'resource';
  const existing = current.openViews.find((view) =>
    multiple ? view.applicationId === application.id && view.route === route : view.id === application.id,
  );
  const viewId = existing?.id ?? (!multiple ? application.id : `${application.id}:${encodeURIComponent(route)}`);
  const nextView: ApplicationViewState = {
    id: viewId,
    applicationId: application.id,
    route,
    title: multiple ? resourceViewTitle(application.title, route) : application.title,
    lastActiveAt: now,
  };
  const openViews = existing
    ? current.openViews.map((view) => (view.id === existing.id ? { ...nextView, id: existing.id } : view))
    : [...current.openViews, nextView];
  return { ...current, openViews, activeViewId: existing?.id ?? viewId };
}

function resourceViewTitle(applicationTitle: string, route: string): string {
  try {
    const pathname = new URL(route, 'https://neon-pilot.local').pathname;
    const resource = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '').trim();
    return resource && resource !== 'new' ? `${applicationTitle} · ${resource}` : applicationTitle;
  } catch {
    return applicationTitle;
  }
}

export function toggleApplicationPinned(
  current: ApplicationWorkspaceState,
  applicationId: string,
  snapshot: LauncherPinSnapshot = { title: applicationId },
): ApplicationWorkspaceState {
  const pinned = current.pinnedApplicationIds.includes(applicationId);
  const target = { kind: 'application', applicationId } as const;
  const key = launcherPinKey(target);
  const launcherPins = current.launcherPins ?? [];
  return {
    ...current,
    pinsInitialized: true,
    pinnedApplicationIds: pinned
      ? current.pinnedApplicationIds.filter((id) => id !== applicationId)
      : [...current.pinnedApplicationIds, applicationId],
    launcherPins: pinned ? launcherPins.filter((pin) => pin.key !== key) : [...launcherPins, { key, target, snapshot }],
  };
}

export function toggleLauncherPin(
  current: ApplicationWorkspaceState,
  target: LauncherPinTarget,
  snapshot: LauncherPinSnapshot,
): ApplicationWorkspaceState {
  if (target.kind === 'application') {
    return toggleApplicationPinned(current, target.applicationId, snapshot);
  }
  const key = launcherPinKey(target);
  const launcherPins = current.launcherPins ?? [];
  const pinned = launcherPins.some((pin) => pin.key === key);
  return {
    ...current,
    launcherPins: pinned ? launcherPins.filter((pin) => pin.key !== key) : [...launcherPins, { key, target, snapshot }],
  };
}

export function closeApplicationView(current: ApplicationWorkspaceState, viewId: string): ApplicationWorkspaceState {
  const openViews = current.openViews.filter((view) => view.id !== viewId);
  return {
    ...current,
    openViews,
    activeViewId: current.activeViewId === viewId ? (openViews.at(-1)?.id ?? null) : current.activeViewId,
  };
}

export function reconcileApplicationWorkspace(
  current: ApplicationWorkspaceState,
  applications: readonly ApplicationRegistration[],
): ApplicationWorkspaceState {
  const retainedPins = current.pinnedApplicationIds;
  const defaultPins = applications
    .filter((application) => application.available && application.defaultPinned)
    .map((application) => application.id);
  const pinnedApplicationIds = current.pinsInitialized ? retainedPins : [...new Set([...retainedPins, ...defaultPins])];
  const applicationsById = new Map(applications.map((application) => [application.id, application]));
  const existingApplicationPinsByKey = new Map(
    (current.launcherPins ?? []).filter((pin) => pin.target.kind === 'application').map((pin) => [pin.key, pin]),
  );
  const nonApplicationPins = (current.launcherPins ?? []).filter((pin) => pin.target.kind !== 'application');
  const applicationPins = pinnedApplicationIds.map((applicationId) => {
    const application = applicationsById.get(applicationId);
    const target = { kind: 'application', applicationId } as const;
    const key = launcherPinKey(target);
    const existingSnapshot = existingApplicationPinsByKey.get(key)?.snapshot;
    return {
      key,
      target,
      snapshot: application
        ? {
            title: application.title,
            ...(application.icon ? { icon: application.icon } : {}),
          }
        : (existingSnapshot ?? { title: applicationId }),
    } satisfies LauncherPin;
  });
  const openViews = current.openViews;
  const openViewIds = new Set(openViews.map((view) => view.id));
  return {
    pinnedApplicationIds,
    launcherPins: [...applicationPins, ...nonApplicationPins],
    pinsInitialized: current.pinsInitialized,
    openViews,
    activeViewId: current.activeViewId && openViewIds.has(current.activeViewId) ? current.activeViewId : (openViews.at(-1)?.id ?? null),
  };
}

export function fallbackApplication(
  workspace: ApplicationWorkspaceState,
  applications: readonly ApplicationRegistration[],
): ApplicationRegistration | null {
  const availableById = new Map(
    applications.filter((application) => application.available).map((application) => [application.id, application]),
  );
  for (const id of workspace.pinnedApplicationIds) {
    const application = availableById.get(id);
    if (application) return application;
  }
  return applications.find((application) => application.available) ?? null;
}
