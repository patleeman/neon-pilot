import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import type { ExtensionInstallSummary } from '@neon-pilot/extensions/data';
import { api, EXTENSION_REGISTRY_CHANGED_EVENT, notifyExtensionRegistryChanged } from '@neon-pilot/extensions/data';
import { type UnifiedSettingsEntry, useApi } from '@neon-pilot/extensions/settings';
import {
  AppPageIntro,
  AppPageLayout,
  cx,
  EmptyState,
  ErrorState,
  type ExtensionSettingsPanelRegistration,
  LoadingState,
  SettingsPanelHost,
} from '@neon-pilot/extensions/ui';
import { getDesktopBridge } from '@neon-pilot/extensions/workbench-browser';
import { type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type NativeViewContribution = NonNullable<NonNullable<NonNullable<ExtensionInstallSummary['manifest']>['contributes']>['views']>[number];

interface InstallableExtensionCatalogItem {
  id: string;
  name: string;
  description?: string;
  version: string;
  tag: string;
  packageType?: 'extension' | 'skill' | 'instruction-pack' | 'agent' | 'template';
  ecosystem?: 'neon-pilot' | 'codex' | 'claude';
  marketplaceSourceId?: string;
  bundleUrl?: string;
  packageSource?: string;
  defaultEnabled?: boolean;
  source?: 'github-release';
  installed: boolean;
  installedVersion?: string;
  enabled?: boolean;
}

interface InstallableExtensionCatalogResponse {
  ok: true;
  version: string;
  tag: string;
  marketplaceSources?: Array<{
    id: string;
    name: string;
    ecosystem: string;
    description: string;
    supportedPackageTypes: string[];
    installStatus: 'supported' | 'planned';
  }>;
  extensions: InstallableExtensionCatalogItem[];
  packages?: InstallableExtensionCatalogItem[];
}

type MarketplaceBehaviorPackageType = 'skill' | 'instruction-pack' | 'agent' | 'template';
type MarketplaceBehaviorEcosystem = 'codex' | 'claude';
type ExtensionFilter = 'add-ons' | 'built-in' | 'available' | 'attention';

interface LogicalSurfaceSummary {
  id: string;
  title: string;
  kind: string;
  detail?: NativeViewContribution;
  warning?: string;
}

function formatSurfaceKind(location: string): string {
  switch (location) {
    case 'main':
      return 'Main page';
    case 'rightRail':
      return 'Right rail';
    case 'workbench':
      return 'Workbench detail';
    default:
      return location;
  }
}

function getLogicalSurfaces(extension: ExtensionInstallSummary): LogicalSurfaceSummary[] {
  const legacySurfaces = (extension.surfaces ?? []).map((surface) => ({
    id: surface.id,
    title: surface.title ?? surface.label ?? surface.id,
    kind: `${surface.placement} ${surface.kind}`,
  }));
  const views = extension.manifest?.contributes?.views ?? [];
  const viewsById = new Map(views.map((view) => [view.id, view] as const));
  const pairedDetailIds = new Set<string>();
  const pairedDetails = views
    .filter((view) => view.location === 'rightRail' && view.detailView)
    .map((view) => viewsById.get(view.detailView!))
    .filter((view): view is NativeViewContribution => Boolean(view));
  for (const detail of pairedDetails) {
    pairedDetailIds.add(detail.id);
  }

  const nativeSurfaces = views.flatMap((view): LogicalSurfaceSummary[] => {
    if (view.location === 'rightRail' && view.detailView) {
      const detail = viewsById.get(view.detailView);
      const wrongLocation = detail && detail.location !== 'workbench';
      return [
        {
          id: view.id,
          title: view.title,
          kind: detail && !wrongLocation ? 'Right rail + workbench detail' : 'Right rail',
          ...(detail && !wrongLocation ? { detail } : {}),
          ...(detail
            ? wrongLocation
              ? { warning: `Detail view ${view.detailView} is ${formatSurfaceKind(detail.location)}, expected Workbench detail` }
              : {}
            : { warning: `Missing detail view: ${view.detailView}` }),
        },
      ];
    }
    if (pairedDetailIds.has(view.id)) return [];
    return [
      {
        id: view.id,
        title: view.title,
        kind: formatSurfaceKind(view.location),
        ...(view.location === 'workbench' ? { warning: 'Orphan workbench detail view; no right rail view points at it' } : {}),
      },
    ];
  });
  return [...legacySurfaces, ...nativeSurfaces];
}

function ExtensionActionsMenu({
  extension,
  busy,
  onOpenFolder,
  onDelete,
  onReinstall,
}: {
  extension: ExtensionInstallSummary;
  busy: boolean;
  onOpenFolder: () => void;
  onDelete: () => void;
  onReinstall?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const run = useCallback((event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    setOpen(false);
    action();
  }, []);
  const menuButtonClass =
    'w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-secondary hover:bg-base hover:text-primary disabled:cursor-not-allowed disabled:opacity-50';
  const canDelete = extension.packageType !== 'system';

  return (
    <div ref={rootRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="ui-icon-button ui-icon-button-compact"
        title={busy ? 'Working…' : 'More actions'}
        aria-label={busy ? 'Working…' : 'More actions'}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-40 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-xl" role="menu">
          {extension.packageRoot ? (
            <button className={menuButtonClass} disabled={busy} onClick={(event) => run(event, onOpenFolder)}>
              Open folder
            </button>
          ) : null}
          {onReinstall ? (
            <button className={menuButtonClass} disabled={busy} onClick={(event) => run(event, onReinstall)}>
              Reinstall
            </button>
          ) : null}
          {canDelete ? (
            <button
              className={`${menuButtonClass} text-danger hover:text-danger`}
              disabled={busy}
              onClick={(event) => run(event, onDelete)}
            >
              Uninstall
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const LOCKED_EXTENSION_IDS = ['system-extension-manager', 'system-prompt-assembly', 'system-runs', 'system-settings'];

function isLocked(extension: ExtensionInstallSummary): boolean {
  return LOCKED_EXTENSION_IDS.includes(extension.id);
}

function isQuarantined(extension: ExtensionInstallSummary): boolean {
  return Boolean(extension.diagnostics?.some((message) => message.toLowerCase().includes('disabled by circuit breaker')));
}

function StatusToggle({ extension, busy, onToggle }: { extension: ExtensionInstallSummary; busy: boolean; onToggle: () => void }) {
  const locked = isLocked(extension);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-[12px] text-secondary transition-colors hover:text-primary disabled:opacity-50"
      disabled={busy || locked}
      onClick={(event) => {
        if (locked) return;
        event.stopPropagation();
        onToggle();
      }}
      aria-label={`${extension.enabled ? 'Disable' : 'Enable'} ${extension.name}`}
      title={locked ? 'This extension is required by the application.' : undefined}
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full border transition-colors',
          locked
            ? 'border-border-subtle bg-surface/40'
            : extension.enabled
              ? 'border-success/40 bg-success/20'
              : 'border-border-subtle bg-surface/60',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[left,background-color]',
            locked ? 'left-[18px] bg-dim' : extension.enabled ? 'left-[18px] bg-success' : 'left-1 bg-dim',
          )}
        />
      </span>
    </button>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="13" cy="8" r="1.2" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 4h6v6" />
      <path d="M12 4 5 11" />
      <path d="M3.5 6.5v6h6" />
    </svg>
  );
}

function DetailsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.5v3.5" />
      <circle cx="8" cy="5.5" r=".75" fill="currentColor" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 7a5 5 0 0 0-8.5-3.2L3 5.3" />
      <path d="M3 2.8v2.5h2.5" />
      <path d="M3 9a5 5 0 0 0 8.5 3.2L13 10.7" />
      <path d="M13 13.2v-2.5h-2.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}

function firstRoute(extension: ExtensionInstallSummary): string | null {
  return extension.routes[0]?.route ?? extension.manifest?.contributes?.views?.find((view) => view.location === 'main')?.route ?? null;
}

function formatPermissionSummary(extension: ExtensionInstallSummary): string {
  return extension.permissions?.length ? extension.permissions.join(', ') : '';
}

function formatBackendActionSummary(extension: ExtensionInstallSummary): string {
  return extension.backendActions?.length ? extension.backendActions.map((action) => `${action.id} → ${action.handler}`).join(', ') : '';
}

function formatServiceSummary(extension: ExtensionInstallSummary): string {
  return extension.services?.length
    ? extension.services
        .map((service) => {
          const status = extension.serviceStatuses?.find((candidate) => candidate.id === service.id);
          const state = status
            ? status.running
              ? `running${status.startedAt ? ` since ${status.startedAt}` : ''}`
              : 'stopped'
            : 'declared';
          return `${service.id} → ${service.handler}${service.restart ? ` (${service.restart})` : ''} · ${state}`;
        })
        .join(', ')
    : '';
}

function formatProtocolSummary(extension: ExtensionInstallSummary): string {
  const protocolEntrypoints = extension.manifest?.backend?.protocolEntrypoints ?? [];
  return protocolEntrypoints.length ? protocolEntrypoints.map((entrypoint) => `${entrypoint.id} → ${entrypoint.handler}`).join(', ') : '';
}

function formatSubscriptionSummary(extension: ExtensionInstallSummary): string {
  return extension.subscriptions?.length
    ? extension.subscriptions
        .map((subscription) => `${subscription.id}: ${subscription.source}${subscription.pattern ? `:${subscription.pattern}` : ''}`)
        .join(', ')
    : '';
}

function formatDependencySummary(extension: ExtensionInstallSummary): string {
  return extension.dependsOn?.length
    ? extension.dependsOn
        .map((dependency) => (typeof dependency === 'string' ? dependency : `${dependency.id}${dependency.optional ? ' (optional)' : ''}`))
        .join(', ')
    : '';
}

function formatAgentHookSummary(extension: ExtensionInstallSummary): string {
  return extension.manifest?.backend?.agentExtension ?? '';
}

function formatToolSummary(extension: ExtensionInstallSummary): string {
  return extension.tools?.length ? extension.tools.map((tool) => tool.name).join(', ') : '';
}

function formatModelProfileSummary(extension: ExtensionInstallSummary): string {
  return extension.modelProfiles?.length
    ? extension.modelProfiles.map((profile) => `${profile.id} (${profile.match.join(', ')})`).join('; ')
    : '';
}

function formatKeybindingSummary(extension: ExtensionInstallSummary): string {
  const keybindings = extension.manifest?.contributes?.keybindings ?? [];
  return keybindings.length ? keybindings.map((keybinding) => `${keybinding.title}: ${keybinding.keys.join(' / ')}`).join(', ') : '';
}

function formatSkillSummary(extension: ExtensionInstallSummary): string {
  return extension.skills?.length ? extension.skills.map((skill) => skill.name).join(', ') : '';
}

function extensionSourceLabel(extensionOrPackageType?: ExtensionInstallSummary | string): string {
  const packageType = typeof extensionOrPackageType === 'string' ? extensionOrPackageType : extensionOrPackageType?.packageType;
  return packageType === 'system' ? 'Built-in' : 'Installed';
}

const EXTENSIONS_WITH_GLOBAL_APP_SETTINGS = new Set(['system-settings']);

function hasExtensionSettings(extension: ExtensionInstallSummary): boolean {
  if (EXTENSIONS_WITH_GLOBAL_APP_SETTINGS.has(extension.id)) return false;
  const settings = extension.manifest?.contributes?.settings;
  const hasSchemaSettings = Boolean(
    settings && typeof settings === 'object' && !Array.isArray(settings) && Object.keys(settings).length > 0,
  );
  return hasSchemaSettings || Boolean(extension.manifest?.contributes?.settingsComponent);
}

function formatAppearsInSummary(extension: ExtensionInstallSummary): string {
  const surfaces = getLogicalSurfaces(extension);
  const labels = [
    surfaces.some((surface) => surface.kind.includes('Main page')) ? 'Page' : null,
    surfaces.some((surface) => surface.kind.includes('Right rail')) ? 'Right rail' : null,
    surfaces.some((surface) => surface.kind.includes('Workbench')) ? 'Workbench' : null,
    extension.tools?.length ? 'Chat tool' : null,
    extension.skills?.length ? 'Skill' : null,
    extension.manifest?.contributes?.commands?.length ? 'Command' : null,
    hasExtensionSettings(extension) ? 'Settings' : null,
  ].filter(Boolean);
  return labels.length ? labels.join(' · ') : 'Runtime';
}

function extensionStatusLabel(extension: ExtensionInstallSummary, unavailableCatalogItem = false): string {
  if (unavailableCatalogItem) return 'Unavailable';
  if (isLocked(extension)) return 'Required';
  if (isQuarantined(extension)) return 'Quarantined';
  if (extension.status === 'invalid') return 'Invalid';
  return extension.enabled ? 'Enabled' : 'Disabled';
}

function extensionStatusClass(extension: ExtensionInstallSummary, unavailableCatalogItem = false): string {
  const label = extensionStatusLabel(extension, unavailableCatalogItem);
  if (label === 'Enabled' || label === 'Required') return 'text-success';
  if (label === 'Invalid' || label === 'Quarantined') return 'text-danger';
  if (label === 'Unavailable') return 'text-warning';
  return 'text-dim';
}

function formatFrontendSummary(extension: ExtensionInstallSummary): string {
  return extension.manifest?.frontend?.entry ?? '';
}

function formatLabeledSummary(parts: Array<[string, string]>): string {
  return parts
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`)
    .join(' · ');
}

function packageKindLabel(item: InstallableExtensionCatalogItem): string {
  if (!item.packageType || item.packageType === 'extension') return 'Extension';
  if (item.ecosystem === 'codex' || item.ecosystem === 'claude') return `Agent plugin ${item.packageType}`;
  return item.packageType;
}

function formatExtensionDiagnostics(extension: ExtensionInstallSummary): string {
  return JSON.stringify(
    {
      id: extension.id,
      name: extension.name,
      status: extension.status ?? (extension.enabled ? 'enabled' : 'disabled'),
      packageType: extension.packageType ?? 'user',
      packageRoot: extension.packageRoot ?? null,
      errors: extension.errors ?? [],
      diagnostics: extension.diagnostics ?? [],
      buildError: extension.buildError ?? null,
      skills: extension.skills ?? [],
      manifest: extension.manifest,
    },
    null,
    2,
  );
}

export function ExtensionManagerPage({ pa, embedded = false }: ExtensionSurfaceProps & { embedded?: boolean }) {
  const [extensions, setExtensions] = useState<ExtensionInstallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExtensionFilter>('add-ons');
  const location = useLocation();
  const navigate = useNavigate();
  const [detailsExtensionId, setDetailsExtensionId] = useState<string | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<InstallableExtensionCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [marketplaceSource, setMarketplaceSource] = useState('');
  const [marketplacePackageType, setMarketplacePackageType] = useState<MarketplaceBehaviorPackageType>('skill');
  const marketplaceEcosystem: MarketplaceBehaviorEcosystem = 'codex';

  const load = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const items = await api.extensionInstallations();
      setExtensions(items);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, []);

  const showActionError = useCallback(
    (message: string, details?: string) => {
      setNotice(message);
      pa.ui.notify({ message, details, type: 'error', source: 'system-extension-manager' });
    },
    [pa],
  );

  const loadCatalog = useCallback(() => {
    setCatalogError(null);
    if (!pa.extensions?.callAction) {
      setCatalog({ ok: true, version: '', tag: '', extensions: [] });
      return;
    }
    void pa.extensions
      .callAction('system-extension-manager', 'listInstallableExtensions', {})
      .then((result) => setCatalog(result as InstallableExtensionCatalogResponse))
      .catch((err) => setCatalogError(err instanceof Error ? err.message : String(err)));
  }, [pa]);

  useEffect(() => {
    void load({ showLoading: true });
    loadCatalog();
    const refresh = () => {
      void load({ showLoading: false });
      loadCatalog();
    };
    window.addEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, loadCatalog]);

  const installCatalogExtension = useCallback(
    async (item: InstallableExtensionCatalogItem) => {
      setBusyId(item.id);
      setNotice(`Installing ${item.name} from ${item.marketplaceSourceId ?? item.tag}…`);
      try {
        if (item.packageType && item.packageType !== 'extension') {
          await pa.extensions.callAction('system-extension-manager', 'installMarketplacePackage', {
            source: item.packageSource,
            ecosystem: item.ecosystem,
            packageType: item.packageType,
          });
          setNotice(`Installed ${item.name} as an extension-backed package.`);
        } else {
          await pa.extensions.callAction('system-extension-manager', 'installCatalogExtension', { id: item.id });
          setNotice(`Installed ${item.name}. Enable it from Installed Extensions when you're ready.`);
        }
        notifyExtensionRegistryChanged();
        await load();
        loadCatalog();
      } catch (err) {
        showActionError(`Failed to install ${item.name}`, err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [load, loadCatalog, pa, showActionError],
  );

  const installMarketplaceSource = useCallback(async () => {
    const source = marketplaceSource.trim();
    if (!source) {
      showActionError('Marketplace package source is required');
      return;
    }
    setBusyId('marketplace-source');
    setNotice('Importing agent plugin package as a Neon Pilot extension...');
    try {
      await pa.extensions.callAction('system-extension-manager', 'installMarketplacePackage', {
        source,
        ecosystem: marketplaceEcosystem,
        packageType: marketplacePackageType,
      });
      setNotice('Installed agent plugin package as a Neon Pilot extension.');
      setMarketplaceSource('');
      notifyExtensionRegistryChanged();
      await load();
      loadCatalog();
    } catch (err) {
      showActionError('Failed to install marketplace package', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }, [load, loadCatalog, marketplaceEcosystem, marketplacePackageType, marketplaceSource, pa, showActionError]);

  const toggleExtension = useCallback(
    (extension: ExtensionInstallSummary) => {
      setNotice(null);
      if (extension.status === 'invalid') {
        setError(extension.errors?.[0] ?? 'Extension manifest is invalid.');
        return;
      }
      setBusyId(extension.id);
      const nextEnabled = !extension.enabled;
      setExtensions((items) =>
        items.map((item) =>
          item.id === extension.id ? { ...item, enabled: nextEnabled, status: nextEnabled ? 'enabled' : 'disabled' } : item,
        ),
      );
      api
        .updateExtension(extension.id, { enabled: nextEnabled })
        .then((result) => {
          if (result.extension) {
            setExtensions((items) => items.map((item) => (item.id === result.extension?.id ? result.extension : item)));
          }
          notifyExtensionRegistryChanged();
          const actionResult = result.actionResult?.result as { conversationId?: string } | undefined;
          if (nextEnabled && actionResult?.conversationId) {
            navigate(`/conversations/${encodeURIComponent(actionResult.conversationId)}`);
          }
          if (
            !nextEnabled &&
            extension.routes.some((route) => location.pathname === route.route || location.pathname.startsWith(`${route.route}/`))
          ) {
            navigate('/extensions', { replace: true });
          }
        })
        .catch((err: Error) => {
          setExtensions((items) => items.map((item) => (item.id === extension.id ? extension : item)));
          setError(err.message);
        })
        .finally(() => setBusyId(null));
    },
    [load, location.pathname, navigate],
  );

  const deleteExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.packageType === 'system') return;
      const confirmed = window.confirm(`Delete ${extension.name}? This removes the extension package from disk.`);
      if (!confirmed) return;
      setBusyId(extension.id);
      setNotice(null);
      try {
        await api.deleteExtension(extension.id);
        setExtensions((items) => items.filter((item) => item.id !== extension.id));
        notifyExtensionRegistryChanged();
        if (extension.routes.some((route) => location.pathname === route.route || location.pathname.startsWith(`${route.route}/`))) {
          navigate('/extensions', { replace: true });
        }
      } catch (err) {
        showActionError(`Failed to delete ${extension.name}`, err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [location.pathname, navigate, showActionError],
  );

  const reinstallExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.packageType === 'system') return;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      if (!catalogItem) return;
      const confirmed = window.confirm(
        `Reinstall ${extension.name}? This removes the current package and installs it again from ${catalogItem.tag}.`,
      );
      if (!confirmed) return;
      setBusyId(extension.id);
      setNotice(null);
      try {
        await api.deleteExtension(extension.id);
        await pa.extensions.callAction('system-extension-manager', 'installCatalogExtension', { id: extension.id });
        await load();
        await loadCatalog();
        notifyExtensionRegistryChanged();
      } catch (err) {
        showActionError(`Failed to reinstall ${extension.name}`, err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [catalog, load, loadCatalog, pa, showActionError],
  );

  const openFolder = useCallback((extension: ExtensionInstallSummary) => {
    if (!extension.packageRoot) return;
    const bridge = getDesktopBridge();
    if (!bridge) {
      setNotice(extension.packageRoot);
      return;
    }
    void bridge.openPath(extension.packageRoot).then((result) => {
      if (!result.opened) {
        setNotice(result.error ?? extension.packageRoot ?? 'Could not open extension folder.');
      }
    });
  }, []);

  const selectedExtension = useMemo(
    () => extensions.find((extension) => extension.id === detailsExtensionId) ?? null,
    [detailsExtensionId, extensions],
  );

  useEffect(() => {
    if (detailsExtensionId && !selectedExtension && extensions.length) {
      setDetailsExtensionId(null);
    }
  }, [detailsExtensionId, extensions.length, selectedExtension]);

  const catalogIds = useMemo(() => new Set(catalog?.extensions.map((item) => item.id) ?? []), [catalog]);

  const visibleExtensions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return extensions.filter((extension) => {
      const unavailableCatalogItem =
        extension.packageType !== 'system' && extension.id.startsWith('system-') && catalog && !catalogIds.has(extension.id);
      if (activeFilter === 'add-ons' && extension.packageType === 'system') return false;
      if (activeFilter === 'built-in' && extension.packageType !== 'system') return false;
      if (
        activeFilter === 'attention' &&
        !(
          extension.status === 'invalid' ||
          extension.healthError ||
          extension.buildError ||
          extension.diagnostics?.length ||
          unavailableCatalogItem
        )
      ) {
        return false;
      }
      if (activeFilter === 'available') return false;
      if (!normalizedQuery) return true;
      return `${extension.name} ${extension.id} ${extension.description ?? ''} ${(extension.skills ?? [])
        .map((skill) => `${skill.name} ${skill.description ?? ''}`)
        .join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeFilter, catalog, catalogIds, extensions, query]);

  const visibleCatalogExtensions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const installedIds = new Set(extensions.map((extension) => extension.id));
    const items = catalog?.packages ?? catalog?.extensions ?? [];
    return items.filter((item) => {
      if (installedIds.has(item.id)) return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.id} ${item.description ?? ''} ${item.ecosystem ?? ''} ${item.packageType ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [catalog, extensions, query]);

  const renderExtensionRows = (items: ExtensionInstallSummary[]) =>
    items.map((extension) => {
      const route = firstRoute(extension);
      const busy = busyId === extension.id;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      const unavailableCatalogItem =
        extension.packageType !== 'system' && extension.id.startsWith('system-') && Boolean(catalog) && !catalogItem;
      const selected = detailsExtensionId === extension.id;
      return (
        <tr
          key={`installed:${extension.id}`}
          className={cx(
            'group cursor-default border-t border-border-subtle/70 transition-colors hover:bg-surface/30',
            selected ? 'bg-accent/10' : '',
          )}
          onClick={() => setDetailsExtensionId(extension.id)}
        >
          <td className="min-w-0 py-4 pr-6 align-middle">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="truncate text-left text-[14px] font-semibold text-primary transition-colors hover:text-accent"
                  onClick={() => setDetailsExtensionId(extension.id)}
                >
                  {extension.name}
                </button>
                <span className="shrink-0 text-[11px] text-dim">{extensionSourceLabel(extension)}</span>
              </div>
              <div className="mt-0.5 max-w-[42rem] whitespace-normal break-words text-[12px] leading-5 text-secondary">
                {extension.description || 'No description provided.'}
              </div>
              {extension.status === 'invalid' || extension.healthError || extension.buildError || extension.diagnostics?.length ? (
                <div className="mt-1 text-[12px] text-danger">
                  {extension.status === 'invalid'
                    ? (extension.errors?.[0] ?? 'Invalid extension manifest.')
                    : (extension.healthError ?? extension.buildError ?? extension.diagnostics?.[0])}
                </div>
              ) : null}
              {unavailableCatalogItem ? (
                <div className="mt-1 text-[12px] text-warning">No longer available from the installable extension catalog.</div>
              ) : null}
            </div>
          </td>
          <td className="whitespace-nowrap px-3 py-4 align-middle text-[12px]">
            <span className={extensionStatusClass(extension, unavailableCatalogItem)}>
              {extensionStatusLabel(extension, unavailableCatalogItem)}
            </span>
          </td>
          <td className="px-3 py-4 align-middle text-[12px] leading-5 text-secondary">{formatAppearsInSummary(extension)}</td>
          <td className="whitespace-nowrap px-3 py-4 align-middle">
            {extension.status === 'invalid' ? (
              <span className="text-[12px] text-danger">Invalid</span>
            ) : (
              <StatusToggle extension={extension} busy={busy} onToggle={() => toggleExtension(extension)} />
            )}
          </td>
          <td className="py-4 pl-3 align-middle">
            <div className="flex items-center justify-end gap-1.5">
              {busy ? <span className="text-[11px] text-dim">Working…</span> : null}
              {route && extension.enabled ? (
                <Link
                  className="ui-icon-button ui-icon-button-compact"
                  to={route}
                  title={`Open ${extension.name}`}
                  aria-label={`Open ${extension.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <OpenIcon />
                </Link>
              ) : null}
              <button
                type="button"
                className="ui-icon-button ui-icon-button-compact"
                title={`Details for ${extension.name}`}
                aria-label={`Details for ${extension.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setDetailsExtensionId(extension.id);
                }}
              >
                <DetailsIcon />
              </button>
              <ExtensionActionsMenu
                extension={extension}
                busy={busy}
                onOpenFolder={() => openFolder(extension)}
                onDelete={() => void deleteExtension(extension)}
                onReinstall={catalogItem && extension.packageType !== 'system' ? () => void reinstallExtension(extension) : undefined}
              />
            </div>
          </td>
        </tr>
      );
    });

  const renderExtensionTable = (items: ExtensionInstallSummary[]) => (
    <section className="min-w-0 overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
          <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
            <th className="py-2 pr-4 font-semibold">Extension</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Appears in</th>
            <th className="py-2 px-3 font-semibold">Enabled</th>
            <th className="py-2 pl-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>{renderExtensionRows(items)}</tbody>
      </table>
    </section>
  );

  const renderCatalogList = (items: InstallableExtensionCatalogItem[]) => (
    <section className="min-w-0 border-y border-border-subtle/70">
      <div className="divide-y divide-border-subtle/70">
        {items.map((item) => {
          const busy = busyId === item.id;
          return (
            <div key={`catalog:${item.id}`} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-[14px] font-semibold text-primary">{item.name}</div>
                  <span className="shrink-0 text-[11px] text-dim">{packageKindLabel(item)}</span>
                </div>
                <div className="mt-0.5 max-w-[42rem] whitespace-normal break-words text-[12px] leading-5 text-secondary">
                  {item.description || 'No description provided.'}
                </div>
              </div>
              <button
                type="button"
                className="self-center rounded-lg bg-surface px-3 py-1.5 text-[12px] text-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || Boolean(item.packageType && item.packageType !== 'extension' && !item.packageSource)}
                onClick={() => void installCatalogExtension(item)}
              >
                {busy ? 'Installing…' : item.packageType && item.packageType !== 'extension' && !item.packageSource ? 'Planned' : 'Install'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  if (loading) {
    return <LoadingState label="Loading extensions…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <>
      <div className={embedded ? 'min-w-0' : 'h-full overflow-y-auto'}>
        <div className="min-w-0">
          <AppPageLayout
            shellClassName={embedded ? 'max-w-none px-0 py-0' : 'max-w-[74rem]'}
            contentClassName={embedded ? 'space-y-6' : 'flex flex-col gap-7'}
          >
            {!embedded ? (
              <AppPageIntro
                title="Extensions"
                summary="Manage add-ons and built-in capabilities."
                actions={
                  <div className="flex min-w-[26rem] items-center gap-2">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search extensions…"
                      className="h-9 w-72 rounded-md border border-border-subtle bg-elevated px-3 text-[13px] text-primary shadow-none outline-none transition-colors placeholder:text-dim focus:border-accent/50 focus:bg-surface"
                    />
                    <button
                      type="button"
                      aria-label="Reload extensions"
                      title="Reload extensions"
                      className="ui-icon-button"
                      onClick={() => {
                        notifyExtensionRegistryChanged();
                        void load();
                        loadCatalog();
                      }}
                    >
                      <RefreshIcon />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-[13px] font-medium text-accent hover:bg-accent/20"
                      onClick={() => setInstallModalOpen(true)}
                    >
                      Install
                    </button>
                  </div>
                }
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-5 border-b border-border-subtle/70 text-[12px]">
              {(
                [
                  ['add-ons', 'Add-ons'],
                  ['built-in', 'Built-in'],
                  ['available', 'Available'],
                  ['attention', 'Attention'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cx(
                    'border-b-2 px-0 py-2 font-medium transition-colors',
                    activeFilter === id
                      ? 'border-accent text-primary'
                      : 'border-transparent text-secondary hover:border-border-subtle hover:text-primary',
                  )}
                  onClick={() => setActiveFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {notice ? (
              <div className="sticky top-0 z-20 border-b border-border-subtle/60 bg-base/95 py-2 text-[13px] text-secondary backdrop-blur">
                {notice}
              </div>
            ) : null}

            {catalogError ? <ErrorState title="Could not load installable extensions" message={catalogError} /> : null}

            {embedded ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search extensions…"
                  className="w-full rounded-md border border-border-subtle bg-elevated px-3 py-2 text-[13px] text-primary shadow-none outline-none transition-colors placeholder:text-dim focus:border-accent/50 focus:bg-surface md:w-80"
                />
                <button
                  type="button"
                  aria-label="Reload extensions"
                  title="Reload extensions"
                  className="ui-icon-button"
                  onClick={() => {
                    notifyExtensionRegistryChanged();
                    void load();
                    loadCatalog();
                  }}
                >
                  <RefreshIcon />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-[13px] font-medium text-accent hover:bg-accent/20"
                  onClick={() => setInstallModalOpen(true)}
                >
                  Install
                </button>
              </div>
            ) : null}

            <section className="space-y-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[24px] font-semibold leading-tight text-primary">
                    {activeFilter === 'available'
                      ? 'Available Add-ons'
                      : activeFilter === 'built-in'
                        ? 'Built-in Extensions'
                        : activeFilter === 'attention'
                          ? 'Needs Attention'
                          : 'Installed Add-ons'}
                  </h2>
                  <p className="mt-1 text-[12px] text-secondary">
                    {extensions.length} installed · {extensions.filter((extension) => extension.enabled).length} enabled
                  </p>
                </div>
              </div>
              {activeFilter === 'available' ? (
                visibleCatalogExtensions.length === 0 ? (
                  <EmptyState title="No available add-ons" body="Installed add-ons and marketplace packages are hidden from this list." />
                ) : (
                  renderCatalogList(visibleCatalogExtensions)
                )
              ) : extensions.length === 0 ? (
                <EmptyState title="No extensions installed" body="Ask an agent to create one under the runtime extensions directory." />
              ) : visibleExtensions.length === 0 ? (
                <EmptyState title="No matching extensions" body="Clear search to show all installed extensions." />
              ) : (
                renderExtensionTable(visibleExtensions)
              )}
            </section>
          </AppPageLayout>
        </div>
      </div>

      {installModalOpen ? (
        <InstallExtensionModal
          source={marketplaceSource}
          packageType={marketplacePackageType}
          busy={busyId === 'marketplace-source'}
          catalogItems={visibleCatalogExtensions}
          catalogBusyId={busyId}
          onSourceChange={setMarketplaceSource}
          onPackageTypeChange={setMarketplacePackageType}
          onInstall={() => void installMarketplaceSource()}
          onInstallCatalog={(item) => void installCatalogExtension(item)}
          onClose={() => setInstallModalOpen(false)}
        />
      ) : null}
      {selectedExtension ? (
        <ExtensionDetailsModal
          extensionId={selectedExtension.id}
          onClose={() => setDetailsExtensionId(null)}
          onOpenSettings={(extension) => navigate(settingsSectionTarget(extension))}
        />
      ) : null}
    </>
  );
}

function InstallExtensionModal({
  source,
  packageType,
  busy,
  catalogItems,
  catalogBusyId,
  onSourceChange,
  onPackageTypeChange,
  onInstall,
  onInstallCatalog,
  onClose,
}: {
  source: string;
  packageType: MarketplaceBehaviorPackageType;
  busy: boolean;
  catalogItems: InstallableExtensionCatalogItem[];
  catalogBusyId: string | null;
  onSourceChange: (source: string) => void;
  onPackageTypeChange: (packageType: MarketplaceBehaviorPackageType) => void;
  onInstall: () => void;
  onInstallCatalog: (item: InstallableExtensionCatalogItem) => void;
  onClose: () => void;
}) {
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const visibleCatalogItems = useMemo(() => {
    const normalizedQuery = marketplaceQuery.trim().toLowerCase();
    if (!normalizedQuery) return catalogItems;
    return catalogItems.filter((item) =>
      `${item.name} ${item.id} ${item.description ?? ''} ${item.ecosystem ?? ''} ${item.packageType ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [catalogItems, marketplaceQuery]);

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-16 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install extension"
        className="relative w-full max-w-3xl rounded-2xl border border-border-subtle bg-base shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-primary">Install Extension</h2>
            <p className="mt-1 text-[12px] text-secondary">
              Install a Neon Pilot extension or import an agent plugin as a Neon Pilot extension.
            </p>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-button" aria-label="Close install dialog" title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <input
              className="min-w-0 rounded-lg border border-border-subtle bg-base px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
              value={source}
              onChange={(event) => onSourceChange(event.currentTarget.value)}
              placeholder="Extension, agent plugin, marketplace package, URL, or local path"
            />
            <select
              className="rounded-lg border border-border-subtle bg-base px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
              value={packageType}
              onChange={(event) => onPackageTypeChange(event.currentTarget.value as MarketplaceBehaviorPackageType)}
              aria-label="Package type"
            >
              <option value="skill">Plugin</option>
              <option value="instruction-pack">Instructions</option>
              <option value="agent">Agent</option>
              <option value="template">Template</option>
            </select>
            <button
              type="button"
              className="rounded-lg bg-surface px-3 py-2 text-[13px] font-medium text-primary hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={onInstall}
            >
              {busy ? 'Installing...' : 'Install'}
            </button>
          </div>
          <p className="text-[12px] leading-5 text-dim">
            Neon Pilot extensions install directly. Agent plugins, including Codex and Claude-style packages, are imported as extensions.
          </p>

          {catalogItems.length ? (
            <section className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Marketplace</h3>
                <input
                  className="h-8 min-w-0 rounded-lg border border-border-subtle bg-base px-3 text-[12px] text-primary outline-none placeholder:text-dim focus:border-accent sm:w-72"
                  value={marketplaceQuery}
                  onChange={(event) => setMarketplaceQuery(event.currentTarget.value)}
                  placeholder="Search marketplace"
                />
              </div>
              <div className="max-h-[28rem] overflow-y-auto border-y border-border-subtle/70">
                <div className="divide-y divide-border-subtle/70">
                  {visibleCatalogItems.map((item) => {
                    const itemBusy = catalogBusyId === item.id;
                    return (
                      <div key={item.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-primary">{item.name}</div>
                          <div className="mt-0.5 text-[12px] text-secondary">{item.description || packageKindLabel(item)}</div>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg bg-surface px-3 py-1.5 text-[12px] text-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={itemBusy || Boolean(item.packageType && item.packageType !== 'extension' && !item.packageSource)}
                          onClick={() => onInstallCatalog(item)}
                        >
                          {itemBusy
                            ? 'Installing...'
                            : item.packageType && item.packageType !== 'extension' && !item.packageSource
                              ? 'Planned'
                              : 'Install'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {visibleCatalogItems.length === 0 ? <p className="py-2 text-[12px] text-dim">No marketplace matches.</p> : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExtensionSettingsBlock({ extension }: { extension: ExtensionInstallSummary }) {
  const { data: values } = useApi<Record<string, unknown>>(api.settings as never);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const entries = useMemo(() => extensionSettingsEntries(extension), [extension]);
  const settingsComponent = extension.manifest?.contributes?.settingsComponent;

  useEffect(() => {
    if (values) {
      setDraft((prev) => {
        const merged = { ...values };
        for (const [key, value] of Object.entries(prev)) {
          if (value !== values[key]) merged[key] = value;
        }
        return merged;
      });
    }
  }, [values]);

  // Debounced auto-save — queues latest changes after edits settle.
  // Uses a ref to accumulate changes incrementally so edits made during
  // an in-flight save are not lost.
  const pendingChangesRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!values || !draft) return;

    // Accumulate incremental changes rather than re-diffing against values
    // so edits made during an in-flight save are preserved.
    for (const [key, value] of Object.entries(draft)) {
      if (value !== values[key]) {
        if (!pendingChangesRef.current) pendingChangesRef.current = {};
        pendingChangesRef.current[key] = value;
      }
    }

    const pending = pendingChangesRef.current;
    if (!pending || Object.keys(pending).length === 0) return;

    if (saving) {
      // Save is in-flight; accumulated changes will be picked up when it
      // completes via the saving dependency change.
      return;
    }

    const timeout = window.setTimeout(async () => {
      const changes = pendingChangesRef.current;
      if (!changes || Object.keys(changes).length === 0) return;
      pendingChangesRef.current = null;

      setSaving(true);
      setSaveError(null);
      try {
        await api.updateSettings(changes);
        setSaveNotice('Saved.');
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : String(err));
        // Re-queue failed changes so they can be retried.
        pendingChangesRef.current = changes;
      } finally {
        setSaving(false);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [draft, values, saving]);

  if (entries.length === 0 && !settingsComponent) return null;

  entries.sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-border-subtle/70 rounded-xl border border-border-subtle/70 text-[12px]">
        {settingsComponent ? <ExtensionSettingsComponentPanel extension={extension} settingsComponent={settingsComponent} /> : null}
        {entries.map((entry) => (
          <ExtensionSettingRow
            key={entry.key}
            entry={entry}
            value={draft[entry.key]}
            onChange={(val) => {
              setDraft((prev) => ({ ...prev, [entry.key]: val }));
              setSaveNotice(null);
              setSaveError(null);
            }}
          />
        ))}
      </dl>
      {saving ? <p className="text-[12px] text-dim">Saving…</p> : null}
      {saveNotice ? <p className="text-[12px] text-success">{saveNotice}</p> : null}
      {saveError ? <p className="text-[12px] text-danger">{saveError}</p> : null}
    </div>
  );
}

function ExtensionSettingsComponentPanel({
  extension,
  settingsComponent,
}: {
  extension: ExtensionInstallSummary;
  settingsComponent: NonNullable<NonNullable<ExtensionInstallSummary['manifest']>['contributes']>['settingsComponent'];
}) {
  const registration: ExtensionSettingsPanelRegistration = {
    extensionId: extension.id,
    id: settingsComponent.id,
    component: settingsComponent.component,
    sectionId: settingsComponent.sectionId,
    label: settingsComponent.label,
    ...(settingsComponent.description ? { description: settingsComponent.description } : {}),
    ...(typeof settingsComponent.order === 'number' ? { order: settingsComponent.order } : {}),
    ...(extension.manifest?.frontend?.entry ? { frontendEntry: extension.manifest.frontend.entry } : {}),
  };
  return (
    <div className="px-3 py-3">
      <SettingsPanelHost registration={registration} />
    </div>
  );
}

const settingControlClass =
  'w-full rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50 focus:bg-surface';

function formatSettingLabel(key: string): string {
  return key
    .split('.')
    .pop()!
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extensionSettingsEntries(extension: ExtensionInstallSummary): UnifiedSettingsEntry[] {
  const contributes = extension.manifest?.contributes?.settings;
  const rawSettings = contributes && typeof contributes === 'object' && !Array.isArray(contributes) ? contributes : {};
  return Object.entries(rawSettings).map(([key, value]) => {
    const s = value as Record<string, unknown>;
    return {
      extensionId: extension.id,
      key,
      type: (s.type as string) ?? 'string',
      default: s.default,
      description: (s.description as string) ?? undefined,
      group: (s.group as string) ?? 'General',
      enum: Array.isArray(s.enum) ? (s.enum as string[]) : undefined,
      placeholder: (s.placeholder as string) ?? undefined,
      order: (s.order as number) ?? 0,
    };
  });
}

function hasInlineRailSettings(extension: ExtensionInstallSummary): boolean {
  if (extension.manifest?.contributes?.settingsComponent) return false;
  const entries = extensionSettingsEntries(extension);
  return (
    entries.length > 0 &&
    entries.length <= 3 &&
    entries.every((entry) => ['boolean', 'number', 'string'].includes(entry.type) || entry.enum?.length)
  );
}

function settingsSectionTarget(extension: ExtensionInstallSummary): string {
  const settingsComponent = extension.manifest?.contributes?.settingsComponent;
  return settingsComponent?.sectionId ? `/settings#${settingsComponent.sectionId}` : '/settings';
}

function ExtensionSettingRow({
  entry,
  value,
  onChange,
}: {
  entry: UnifiedSettingsEntry;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const currentValue = value ?? entry.default;
  return (
    <div className="grid gap-3 px-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-[12px] font-medium text-primary">{formatSettingLabel(entry.key)}</dt>
      <dd className="min-w-0 space-y-2">
        {entry.description ? <p className="text-[12px] leading-5 text-secondary">{entry.description}</p> : null}
        {renderExtensionSettingControl(entry, currentValue, onChange)}
      </dd>
    </div>
  );
}

function renderExtensionSettingControl(entry: UnifiedSettingsEntry, value: unknown, onChange: (value: unknown) => void) {
  if (entry.enum?.length) {
    return (
      <select className={settingControlClass} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        {entry.enum.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (entry.type === 'boolean') {
    return (
      <label className="inline-flex items-center gap-2 text-[13px] text-primary">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-subtle bg-elevated accent-accent"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        Enabled
      </label>
    );
  }

  if (entry.type === 'number') {
    return (
      <input
        type="number"
        className={settingControlClass}
        value={typeof value === 'number' ? value : ''}
        placeholder={entry.placeholder}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      />
    );
  }

  return (
    <input
      type="text"
      className={settingControlClass}
      value={typeof value === 'string' ? value : ''}
      placeholder={entry.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ExtensionDetailsModal({
  extensionId,
  onClose,
  onOpenSettings,
}: {
  extensionId: string;
  onClose: () => void;
  onOpenSettings?: (extension: ExtensionInstallSummary) => void;
}) {
  const [extensions, setExtensions] = useState<ExtensionInstallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .extensionInstallations()
      .then((items) => {
        setExtensions(items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoading(false);
        window.dispatchEvent(
          new CustomEvent('neon-pilot-notification', {
            detail: {
              type: 'error',
              message: 'Failed to load extensions',
              details: err instanceof Error ? err.message : String(err),
              source: 'system-extension-manager',
            },
          }),
        );
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
    return () => window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
  }, [load]);

  const openPath = useCallback((path: string) => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setNotice(path);
      return;
    }
    void bridge.openPath(path).then((result) => {
      if (!result.opened) {
        setNotice(result.error ?? path);
      }
    });
  }, []);

  const copyExtensionDiagnostics = useCallback(async (extension: ExtensionInstallSummary) => {
    const diagnostics = formatExtensionDiagnostics(extension);
    try {
      await navigator.clipboard.writeText(diagnostics);
      setNotice(`Copied diagnostics for ${extension.name}.`);
    } catch {
      setNotice(diagnostics);
    }
  }, []);

  const extension = extensions.find((e) => e.id === extensionId) ?? null;

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-10"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Extension details"
        className="relative w-full max-w-3xl rounded-xl border border-border-subtle bg-base shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-border-subtle bg-base/95 px-6 py-4">
          <h2 className="text-[16px] font-semibold text-primary">Extension details</h2>
          <button type="button" onClick={onClose} className="ui-icon-button" aria-label="Close details" title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <LoadingState label="Loading extension details…" />
          ) : !extension ? (
            <p className="text-[13px] text-dim">Extension not found.</p>
          ) : (
            <ExtensionDetailsContent
              extension={extension}
              notice={notice}
              onCopyDiagnostics={copyExtensionDiagnostics}
              onOpenPath={openPath}
              onOpenSettings={onOpenSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ExtensionDetailsContent({
  extension,
  notice,
  compact = false,
  onCopyDiagnostics,
  onOpenPath,
  onOpenSettings,
}: {
  extension: ExtensionInstallSummary;
  notice: string | null;
  compact?: boolean;
  onCopyDiagnostics: (extension: ExtensionInstallSummary) => Promise<void>;
  onOpenPath: (path: string) => void;
  onOpenSettings?: (extension: ExtensionInstallSummary) => void;
}) {
  const surfaces = getLogicalSurfaces(extension);
  const hasSettings = hasExtensionSettings(extension);
  const healthLabel = isLocked(extension)
    ? 'Required'
    : isQuarantined(extension)
      ? 'Quarantined'
      : extension.status === 'invalid'
        ? 'Invalid'
        : extension.enabled
          ? 'Enabled'
          : 'Disabled';
  const includeRows = [
    ['Skills', formatSkillSummary(extension)],
    ['Tools', formatToolSummary(extension)],
    [
      'UI',
      surfaces.length
        ? surfaces.map((surface) => `${surface.title} (${surface.kind})`).join(', ')
        : formatLabeledSummary([['Frontend', formatFrontendSummary(extension)]]),
    ],
    [
      'Backend',
      formatLabeledSummary([
        ['Actions', formatBackendActionSummary(extension)],
        ['Services', formatServiceSummary(extension)],
        ['Protocols', formatProtocolSummary(extension)],
      ]),
    ],
    [
      'Agent',
      formatLabeledSummary([
        ['Model profiles', formatModelProfileSummary(extension)],
        ['Hook', formatAgentHookSummary(extension)],
      ]),
    ],
    ['Shortcuts', formatKeybindingSummary(extension)],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;
  const informationRows = [
    ['Permissions', formatPermissionSummary(extension)],
    ['Subscriptions', formatSubscriptionSummary(extension)],
    ['Dependencies', formatDependencySummary(extension)],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  return (
    <div className="space-y-6 pb-4">
      {notice ? <p className="text-[12px] leading-5 text-secondary">{notice}</p> : null}

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[20px] font-semibold tracking-tight text-primary">{extension.name}</h3>
              <span
                className={cx(
                  'h-1.5 w-1.5 rounded-full',
                  extension.status === 'invalid' ? 'bg-danger' : extension.enabled ? 'bg-success' : 'bg-dim',
                )}
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-dim">{extension.id}</p>
          </div>
        </div>
        {extension.description ? <p className="text-[13px] leading-6 text-secondary">{extension.description}</p> : null}
        <div className={cx('grid gap-2 text-[12px] text-secondary', compact ? 'grid-cols-2' : 'sm:grid-cols-4')}>
          <MetaItem label="Source" value={extensionSourceLabel(extension)} />
          <MetaItem label="Status" value={healthLabel} />
          <MetaItem label="Version" value={extension.version ? `v${extension.version}` : 'Unknown'} />
          <MetaItem label="Settings" value={hasSettings ? 'Configurable' : ''} />
        </div>
      </header>

      {hasSettings ? (
        <DetailBlock
          title="Settings"
          action={
            !hasInlineRailSettings(extension) && onOpenSettings ? (
              <button
                type="button"
                className="text-[11px] text-secondary transition-colors hover:text-primary"
                onClick={() => onOpenSettings(extension)}
              >
                Open Settings
              </button>
            ) : undefined
          }
        >
          {hasInlineRailSettings(extension) || !compact ? (
            <ExtensionSettingsBlock extension={extension} />
          ) : (
            <div className="rounded-xl border border-border-subtle/70 px-3 py-3 text-[12px] leading-5 text-secondary">
              This extension has a full settings surface. Open Settings to configure it without losing this list.
            </div>
          )}
        </DetailBlock>
      ) : null}

      {extension.status === 'invalid' || extension.diagnostics?.length || extension.buildError ? (
        <DetailBlock
          title="Diagnostics"
          action={
            <button
              type="button"
              className="text-[11px] text-secondary transition-colors hover:text-primary"
              onClick={() => void onCopyDiagnostics(extension)}
            >
              Copy diagnostics
            </button>
          }
        >
          <div className="space-y-2">
            {[...(extension.errors ?? []), ...(extension.diagnostics ?? []), extension.buildError ?? null]
              .filter(Boolean)
              .map((message) => (
                <p key={message} className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] leading-5 text-danger">
                  {message}
                </p>
              ))}
          </div>
        </DetailBlock>
      ) : null}

      {includeRows.length ? (
        <DetailBlock title="Includes">
          <div className="divide-y divide-border-subtle/70 rounded-xl border border-border-subtle/70">
            {includeRows.map(([label, value]) => (
              <IncludedCapability key={label} label={label} value={value} />
            ))}
          </div>
        </DetailBlock>
      ) : null}

      {informationRows.length || extension.packageRoot ? (
        <DetailBlock title="Information">
          <dl className="divide-y divide-border-subtle/70 rounded-xl border border-border-subtle/70 text-[12px]">
            {informationRows.map(([label, value]) => (
              <DetailTableRow key={label} label={label} value={value} />
            ))}
            {extension.packageRoot ? (
              <DetailTableRow
                label="Package"
                value={extension.packageRoot}
                action={
                  <button
                    type="button"
                    className="text-[11px] text-secondary transition-colors hover:text-primary"
                    onClick={() => onOpenPath(extension.packageRoot!)}
                  >
                    Open
                  </button>
                }
              />
            ) : null}
          </dl>
        </DetailBlock>
      ) : null}

      <details>
        <summary className="cursor-pointer select-none text-[12px] text-dim transition-colors hover:text-secondary">Raw manifest</summary>
        <pre className="mt-3 max-h-[22rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-secondary">
          {JSON.stringify(extension.manifest, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</div>
      <div className="mt-1 truncate text-primary">{value}</div>
    </div>
  );
}

function IncludedCapability({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 px-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-[12px] font-medium text-primary">{label}</dt>
      <dd className="break-words text-[12px] leading-5 text-secondary">{value}</dd>
    </div>
  );
}

function DetailTableRow({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="grid gap-2 px-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
      <dt className="text-dim">{label}</dt>
      <dd className="break-words text-secondary">{value}</dd>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function DetailBlock({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
