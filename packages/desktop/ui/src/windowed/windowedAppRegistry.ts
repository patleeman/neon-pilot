import { type AppAccent, CANONICAL_WINDOWED_DESKTOP_APPS, type WindowedDesktopAppDefinition } from '@neon-pilot/windowed-os-ui';

import type { ExtensionRegistryState } from '../extensions/useExtensionRegistry';

export type WindowedAppSource = 'core' | 'app-package';
export type WindowedLauncherKind = 'chat' | 'route' | 'browser' | 'files' | 'terminal';

export interface WindowedAppRuntimeOwner {
  packageId?: string;
  packageType?: 'core' | 'extension';
}

export interface WindowedAppRegistration {
  id: string;
  title: string;
  route: string;
  kind: WindowedLauncherKind;
  source: WindowedAppSource;
  sourcePackageId?: string;
  owner: WindowedAppRuntimeOwner;
  accent: AppAccent;
  aliases?: readonly string[];
  routeAliases?: readonly string[];
  window: {
    allowMultiple: boolean;
    singleton: boolean;
  };
}

const CORE_WINDOWED_APP_IDS = new Set(['chat', 'settings']);
const CANONICAL_WINDOWED_APP_BY_TITLE: ReadonlyMap<string, WindowedDesktopAppDefinition> = new Map(
  CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => [app.title, app]),
);
const CANONICAL_LAUNCHER_ORDER: readonly string[] = CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => app.title);

const CANONICAL_WINDOWED_APP_ROUTES: Readonly<Record<(typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]['id'], string>> = {
  chat: '/conversations/new',
  browser: '/browser',
  files: '/files',
  terminal: '/terminal',
  automations: '/automations',
  'app-manager': '/apps',
  settings: '/settings',
};

const CANONICAL_WINDOWED_APP_ROUTE_ALIASES: Readonly<
  Partial<Record<(typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]['id'], readonly string[]>>
> = {
  'app-manager': ['/extensions'],
};

const CANONICAL_WINDOWED_APP_OWNER_PACKAGES: Readonly<Partial<Record<(typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]['id'], string>>> = {
  browser: 'system-browser',
  files: 'system-files',
  terminal: 'system-terminal',
  automations: 'system-automations',
  'app-manager': 'system-extension-manager',
};

export function canonicalWindowedAppForTitle(title: string): WindowedDesktopAppDefinition | undefined {
  return CANONICAL_WINDOWED_APP_BY_TITLE.get(title);
}

export function canonicalWindowedAppAliases(title: string): readonly string[] | undefined {
  return canonicalWindowedAppForTitle(title)?.aliases;
}

export function canonicalWindowedAppRoute(appId: (typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]['id']): string {
  return CANONICAL_WINDOWED_APP_ROUTES[appId];
}

export function buildWindowedAppRegistry(extensionRegistry: ExtensionRegistryState): WindowedAppRegistration[] {
  const enabledExtensionIds = new Set(
    extensionRegistry.extensions.filter((extension) => extension.enabled).map((extension) => extension.id),
  );
  const seenRoutes = new Set<string>();
  const seenTitles = new Set<string>();

  const canonicalApps = CANONICAL_WINDOWED_DESKTOP_APPS.flatMap((app): WindowedAppRegistration[] => {
    const ownerPackageId = CANONICAL_WINDOWED_APP_OWNER_PACKAGES[app.id];
    if (ownerPackageId && !enabledExtensionIds.has(ownerPackageId)) return [];
    const registration = createCanonicalWindowedAppRegistration(app, ownerPackageId);
    seenRoutes.add(registration.route);
    for (const alias of registration.routeAliases ?? []) {
      seenRoutes.add(alias);
    }
    seenTitles.add(registration.title);
    return [registration];
  });

  const dynamicApps = extensionRegistry.extensions
    .filter((extension) => extension.enabled)
    .flatMap((extension) => {
      const navItems = (extension.contributes?.nav ?? []).flatMap((item): WindowedAppRegistration[] => {
        if (!item.route || seenRoutes.has(item.route) || seenTitles.has(item.label)) return [];
        if (!isTopLevelRoute(item.route)) return [];
        const app = createAppPackageWindowedAppRegistration({
          packageId: extension.id,
          id: item.id,
          title: item.label,
          route: item.route,
        });
        seenRoutes.add(app.route);
        seenTitles.add(app.title);
        return [app];
      });

      const mainViewItems = (extension.contributes?.views ?? []).flatMap((view): WindowedAppRegistration[] => {
        if (view.location !== 'main' || !view.route || !isTopLevelRoute(view.route)) return [];
        if (seenRoutes.has(view.route) || seenTitles.has(view.title)) return [];
        const app = createAppPackageWindowedAppRegistration({
          packageId: extension.id,
          id: view.id,
          title: view.title,
          route: view.route,
        });
        seenRoutes.add(app.route);
        seenTitles.add(app.title);
        return [app];
      });

      return [...navItems, ...mainViewItems];
    })
    .sort(compareWindowedApps);

  return [...canonicalApps, ...dynamicApps].sort(compareWindowedApps);
}

function createCanonicalWindowedAppRegistration(
  app: (typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number],
  ownerPackageId: string | undefined,
): WindowedAppRegistration {
  const isCore = CORE_WINDOWED_APP_IDS.has(app.id);
  return {
    id: app.id,
    title: app.title,
    route: CANONICAL_WINDOWED_APP_ROUTES[app.id],
    kind: app.id === 'chat' ? 'chat' : app.id === 'browser' || app.id === 'files' || app.id === 'terminal' ? app.id : 'route',
    source: isCore ? 'core' : 'app-package',
    ...(ownerPackageId ? { sourcePackageId: ownerPackageId } : {}),
    owner: ownerPackageId ? { packageId: ownerPackageId, packageType: 'extension' } : { packageType: 'core' },
    accent: app.accent,
    aliases: app.aliases,
    routeAliases: CANONICAL_WINDOWED_APP_ROUTE_ALIASES[app.id],
    window: { allowMultiple: app.id === 'chat', singleton: app.id !== 'chat' },
  };
}

function createAppPackageWindowedAppRegistration(input: {
  packageId: string;
  id: string;
  title: string;
  route: string;
}): WindowedAppRegistration {
  return {
    id: `${input.packageId}:${input.id}`,
    title: input.title,
    route: input.route,
    kind: 'route',
    source: 'app-package',
    sourcePackageId: input.packageId,
    owner: { packageId: input.packageId, packageType: 'extension' },
    accent: accentForTitle(input.title),
    window: { allowMultiple: false, singleton: true },
  };
}

function compareWindowedApps(left: WindowedAppRegistration, right: WindowedAppRegistration): number {
  const leftRank = CANONICAL_LAUNCHER_ORDER.indexOf(left.title);
  const rightRank = CANONICAL_LAUNCHER_ORDER.indexOf(right.title);
  const extensionAppRank = Math.max(0, CANONICAL_LAUNCHER_ORDER.length - 1);
  const normalizedLeftRank = leftRank >= 0 ? leftRank : extensionAppRank;
  const normalizedRightRank = rightRank >= 0 ? rightRank : extensionAppRank;
  return normalizedLeftRank - normalizedRightRank || left.title.localeCompare(right.title);
}

export function accentForTitle(title: string): AppAccent {
  const canonicalApp = CANONICAL_WINDOWED_APP_BY_TITLE.get(title);
  if (canonicalApp) return canonicalApp.accent;

  const normalized = title.toLowerCase();
  if (normalized.includes('chat') || normalized.includes('conversation')) return 'chat';
  if (normalized.includes('workflow')) return 'workflows';
  if (normalized.includes('routine')) return 'routines';
  if (normalized.includes('automation')) return 'automations';
  if (normalized.includes('gateway')) return 'gateways';
  if (normalized.includes('skill')) return 'skills';
  if (normalized.includes('extension') || normalized.includes('app manager')) return 'apps';
  if (normalized.includes('diagnostic')) return 'diagnostics';
  if (normalized.includes('telemetry') || normalized.includes('run')) return 'telemetry';
  return 'settings';
}

function routePathname(route: string): string {
  try {
    return new URL(route, window.location.origin).pathname;
  } catch {
    return route.split(/[?#]/, 1)[0] || route;
  }
}

function isTopLevelRoute(route: string): boolean {
  const pathname = routePathname(route).replace(/\/+$/, '');
  if (!pathname || pathname === '/') return false;
  return pathname.split('/').filter(Boolean).length === 1;
}
