import type { ExtensionSurfaceProps, NativeExtensionClient } from '@neon-pilot/extensions';
import type { ExtensionInstallSummary } from '@neon-pilot/extensions/data';
import { api, EXTENSION_REGISTRY_CHANGED_EVENT, notifyExtensionRegistryChanged } from '@neon-pilot/extensions/data';
import { SettingsField, type UnifiedSettingsEntry, useApi } from '@neon-pilot/extensions/settings';
import {
  AppPageIntro,
  AppPageLayout,
  cx,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import { getDesktopBridge } from '@neon-pilot/extensions/workbench-browser';
import { type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type NativeViewContribution = NonNullable<NonNullable<NonNullable<ExtensionInstallSummary['manifest']>['contributes']>['views']>[number];

type ExtensionTemplate = 'main-page' | 'right-rail' | 'workbench-detail';

interface ExtensionCreateDraft {
  name: string;
  id: string;
  template: ExtensionTemplate;
}

interface CommandInspectorEntry {
  id?: string;
  surfaceId?: string;
  extensionId?: string;
  title?: string;
  category?: string;
  action?: string;
  args?: unknown;
  argsSchema?: unknown;
  enablement?: string;
}

interface KeybindingInspectorEntry {
  extensionId: string;
  surfaceId: string;
  title: string;
  keys: string[];
  defaultKeys: string[];
  command: string;
  enabled: boolean;
}

interface InstallableExtensionCatalogItem {
  id: string;
  name: string;
  description?: string;
  version: string;
  tag: string;
  bundleUrl: string;
  installed: boolean;
  installedVersion?: string;
  enabled?: boolean;
}

interface InstallableExtensionCatalogResponse {
  ok: true;
  version: string;
  tag: string;
  extensions: InstallableExtensionCatalogItem[];
}

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
  const legacySurfaces = extension.surfaces.map((surface) => ({
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

function contributionCounts(extension: ExtensionInstallSummary) {
  const views = extension.manifest?.contributes?.views ?? [];
  return {
    pages: views.filter((view) => view.location === 'main').length,
    rails: views.filter((view) => view.location === 'rightRail').length,
    workbench: views.filter((view) => view.location === 'workbench').length,
    tools: extension.tools?.length ?? 0,
    modelProfiles: extension.modelProfiles?.length ?? 0,
    keybindings: extension.manifest?.contributes?.keybindings?.length ?? 0,
    backend: extension.backendActions?.length ?? 0,
    skills: extension.skills?.length ?? 0,
    agentHooks: extension.manifest?.backend?.agentExtension ? 1 : 0,
  };
}

function CompactCount({ icon, count, title }: { icon: ReactNode; count: number; title: string }) {
  if (count === 0) return null;
  return (
    <span title={title} className="inline-flex items-center gap-1 text-[12px] text-secondary">
      <span className="grid h-4 w-4 place-items-center text-dim">{icon}</span>
      <span>{count}</span>
    </span>
  );
}

function ExtensionActionsMenu({
  extension,
  busy,
  onOpenFolder,
}: {
  extension: ExtensionInstallSummary;
  busy: boolean;
  onOpenFolder: () => void;
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
        </div>
      ) : null}
    </div>
  );
}

const LOCKED_EXTENSION_IDS = ['system-extension-manager'];

function isLocked(extension: ExtensionInstallSummary): boolean {
  return LOCKED_EXTENSION_IDS.includes(extension.id);
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
      <span>{locked ? 'Always on' : extension.enabled ? 'Enabled' : 'Disabled'}</span>
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

function PageIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      <path d="M5 6h6M5 8.5h4" />
    </svg>
  );
}

function RailIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M10.5 3v10" />
    </svg>
  );
}

function WorkbenchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M3 8h10M3 12h10" />
      <path d="M6 4v8" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5.5 2.8 3.6 4.7l2.1 2.1 1.9-1.9" />
      <path d="M7 5.5 12.5 11a1.4 1.4 0 1 1-2 2L5 7.5" />
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

function BackendIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2.5 13 5v6l-5 2.5L3 11V5l5-2.5Z" />
      <path d="M3 5l5 2.5L13 5M8 7.5v6" />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2.5 9.5 6 13 7.5 9.5 9 8 12.5 6.5 9 3 7.5 6.5 6 8 2.5Z" />
    </svg>
  );
}

function KeybindingIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
      <path d="M4.5 6.5h1M7.5 6.5h1M10.5 6.5h1M4.5 9.5h7" />
    </svg>
  );
}

function AgentHookIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2" />
      <circle cx="8" cy="8" r="3.2" />
      <path d="M6.8 7.2h.1M9.1 7.2h.1M6.7 9.2c.8.6 1.8.6 2.6 0" />
    </svg>
  );
}

function firstRoute(extension: ExtensionInstallSummary): string | null {
  return extension.routes[0]?.route ?? extension.manifest?.contributes?.views?.find((view) => view.location === 'main')?.route ?? null;
}

function formatPermissionSummary(extension: ExtensionInstallSummary): string {
  return extension.permissions?.length ? extension.permissions.join(', ') : 'None declared';
}

function formatBackendActionSummary(extension: ExtensionInstallSummary): string {
  return extension.backendActions?.length
    ? extension.backendActions.map((action) => `${action.id} → ${action.handler}`).join(', ')
    : 'None';
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
    : 'None';
}

function formatProtocolSummary(extension: ExtensionInstallSummary): string {
  const protocolEntrypoints = extension.manifest?.backend?.protocolEntrypoints ?? [];
  return protocolEntrypoints.length
    ? protocolEntrypoints.map((entrypoint) => `${entrypoint.id} → ${entrypoint.handler}`).join(', ')
    : 'None';
}

function formatSubscriptionSummary(extension: ExtensionInstallSummary): string {
  return extension.subscriptions?.length
    ? extension.subscriptions
        .map((subscription) => `${subscription.id}: ${subscription.source}${subscription.pattern ? `:${subscription.pattern}` : ''}`)
        .join(', ')
    : 'None';
}

function formatDependencySummary(extension: ExtensionInstallSummary): string {
  return extension.dependsOn?.length
    ? extension.dependsOn
        .map((dependency) => (typeof dependency === 'string' ? dependency : `${dependency.id}${dependency.optional ? ' (optional)' : ''}`))
        .join(', ')
    : 'None';
}

function formatAgentHookSummary(extension: ExtensionInstallSummary): string {
  return extension.manifest?.backend?.agentExtension ?? 'None';
}

function formatToolSummary(extension: ExtensionInstallSummary): string {
  return extension.tools?.length ? extension.tools.map((tool) => tool.name).join(', ') : 'None';
}

function formatModelProfileSummary(extension: ExtensionInstallSummary): string {
  return extension.modelProfiles?.length
    ? extension.modelProfiles.map((profile) => `${profile.id} (${profile.match.join(', ')})`).join('; ')
    : 'None';
}

function formatKeybindingSummary(extension: ExtensionInstallSummary): string {
  const keybindings = extension.manifest?.contributes?.keybindings ?? [];
  return keybindings.length ? keybindings.map((keybinding) => `${keybinding.title}: ${keybinding.keys.join(' / ')}`).join(', ') : 'None';
}

function formatSkillSummary(extension: ExtensionInstallSummary): string {
  return extension.skills?.length ? extension.skills.map((skill) => skill.name).join(', ') : 'None';
}

function formatFrontendSummary(extension: ExtensionInstallSummary): string {
  return extension.manifest?.frontend?.entry ?? 'None';
}

function slugifyExtensionId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
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

export function ExtensionManagerPage({ pa }: ExtensionSurfaceProps) {
  const [extensions, setExtensions] = useState<ExtensionInstallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'extensions' | 'available' | 'commands'>('extensions');
  const [filter, setFilter] = useState<'all' | 'system' | 'user' | 'enabled' | 'disabled'>('all');
  const [query, setQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [detailsExtensionId, setDetailsExtensionId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<ExtensionCreateDraft | null>(null);
  const [importDraft, setImportDraft] = useState(false);
  const [commands, setCommands] = useState<CommandInspectorEntry[]>([]);
  const [keybindings, setKeybindings] = useState<KeybindingInspectorEntry[]>([]);
  const [catalog, setCatalog] = useState<InstallableExtensionCatalogResponse | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [commandArgsDraft, setCommandArgsDraft] = useState<Record<string, string>>({});
  const [keybindingDraft, setKeybindingDraft] = useState<Record<string, string>>({});

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

  const showActionNotice = useCallback(
    (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
      setNotice(message);
      if (type !== 'info') {
        pa.ui.notify({ message, type, source: 'system-extension-manager' });
      }
    },
    [pa],
  );

  const showActionError = useCallback(
    (message: string, details?: string) => {
      setNotice(message);
      pa.ui.notify({ message, details, type: 'error', source: 'system-extension-manager' });
    },
    [pa],
  );

  const loadCommandInspector = useCallback(() => {
    void pa.commands
      .list()
      .then((items) => setCommands(items as CommandInspectorEntry[]))
      .catch(() => setCommands([]));
    void api
      .extensionKeybindings()
      .then((items) => setKeybindings(items as KeybindingInspectorEntry[]))
      .catch(() => setKeybindings([]));
  }, [pa]);

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
    loadCommandInspector();
    loadCatalog();
    const refresh = () => {
      void load({ showLoading: false });
      loadCommandInspector();
      loadCatalog();
    };
    window.addEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, refresh);
  }, [load, loadCatalog, loadCommandInspector]);

  const executeInspectorCommand = useCallback(
    async (command: CommandInspectorEntry) => {
      const id =
        command.extensionId && command.surfaceId ? `${command.extensionId}.${command.surfaceId}` : (command.id ?? command.surfaceId);
      if (!id) return;
      try {
        const raw = commandArgsDraft[id]?.trim();
        const args = raw ? JSON.parse(raw) : (command.args ?? {});
        const handled = await pa.commands.execute(id, args);
        showActionNotice(`${handled ? 'Handled' : 'Did not handle'} ${id}`);
      } catch (err) {
        showActionError(`Failed to execute ${id}`, err instanceof Error ? err.message : String(err));
      }
    },
    [commandArgsDraft, pa, showActionError, showActionNotice],
  );

  const saveKeybinding = useCallback(
    async (keybinding: KeybindingInspectorEntry) => {
      const key = `${keybinding.extensionId}:${keybinding.surfaceId}`;
      const keys = (keybindingDraft[key] ?? keybinding.keys.join(', '))
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      try {
        await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, { keys });
        setKeybindingDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        showActionNotice(`Updated ${keybinding.title}`);
        notifyExtensionRegistryChanged();
        loadCommandInspector();
      } catch (err) {
        showActionError(`Failed to update ${keybinding.title}`, err instanceof Error ? err.message : String(err));
      }
    },
    [keybindingDraft, loadCommandInspector, showActionError, showActionNotice],
  );

  const toggleKeybinding = useCallback(
    async (keybinding: KeybindingInspectorEntry) => {
      try {
        await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, { enabled: !keybinding.enabled });
        notifyExtensionRegistryChanged();
        loadCommandInspector();
      } catch (err) {
        showActionError(`Failed to toggle ${keybinding.title}`, err instanceof Error ? err.message : String(err));
      }
    },
    [loadCommandInspector, showActionError],
  );

  const resetKeybinding = useCallback(
    async (keybinding: KeybindingInspectorEntry) => {
      try {
        await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, { reset: true });
        notifyExtensionRegistryChanged();
        loadCommandInspector();
      } catch (err) {
        showActionError(`Failed to reset ${keybinding.title}`, err instanceof Error ? err.message : String(err));
      }
    },
    [loadCommandInspector, showActionError],
  );

  const reload = useCallback(() => {
    setNotice(null);
    pa.extensions
      .callAction('system-extension-manager', 'reloadExtensions', {})
      .then((result) => {
        setNotice((result as { message?: string }).message ?? 'Extension registry reloaded.');
        notifyExtensionRegistryChanged();
        load();
      })
      .catch((err: Error) => setError(err.message));
  }, [load, pa]);

  const createExtension = useCallback(() => {
    setCreateDraft({ name: '', id: '', template: 'main-page' });
  }, []);

  const submitCreateExtension = useCallback(
    async (draft: ExtensionCreateDraft) => {
      setCreateDraft(null);
      setNotice(null);
      try {
        const result = await api.createExtension({
          id: draft.id.trim(),
          name: draft.name.trim(),
          template: draft.template,
        });
        setNotice(`Created ${result.packageRoot}`);
        notifyExtensionRegistryChanged();
        await load();
        setNotice(`Created extension at ${result.packageRoot}. Build it outside the app, then reload.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [load],
  );

  const [importWarningZip, setImportWarningZip] = useState<string | null>(null);

  const importExtension = useCallback(() => {
    setImportDraft(true);
  }, []);

  const confirmImport = useCallback(
    async (zipPath: string) => {
      setImportWarningZip(null);
      setNotice(null);
      try {
        const result = await api.importExtension({ zipPath });
        setNotice(`Imported ${result.packageRoot}`);
        notifyExtensionRegistryChanged();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [load],
  );

  const cancelImport = useCallback(() => {
    setImportWarningZip(null);
  }, []);

  const installCatalogExtension = useCallback(
    async (item: InstallableExtensionCatalogItem) => {
      setBusyId(item.id);
      setNotice(`Installing ${item.name} from ${item.tag}…`);
      try {
        await pa.extensions.callAction('system-extension-manager', 'installCatalogExtension', { id: item.id });
        setNotice(`Installed ${item.name}. Enable it from the extension registry when you're ready.`);
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

  const visibleExtensions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return extensions.filter((extension) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'system' && extension.packageType === 'system') ||
        (filter === 'user' && extension.packageType !== 'system') ||
        (filter === 'enabled' && extension.enabled) ||
        (filter === 'disabled' && !extension.enabled && extension.status !== 'invalid') ||
        (filter === 'disabled' && extension.status === 'invalid');
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return `${extension.name} ${extension.id} ${extension.description ?? ''} ${(extension.skills ?? [])
        .map((skill) => `${skill.name} ${skill.description ?? ''}`)
        .join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [extensions, filter, query]);

  const visibleCatalogExtensions = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLowerCase();
    const items = catalog?.extensions ?? [];
    if (!normalizedQuery) return items;
    return items.filter((item) => `${item.name} ${item.id} ${item.description ?? ''}`.toLowerCase().includes(normalizedQuery));
  }, [catalog, catalogQuery]);

  const renderCatalog = () => (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">Available extensions</div>
          <div className="mt-1 max-w-[44rem] text-[12px] leading-5 text-secondary">
            Optional Neon Pilot extensions are downloaded from the GitHub release for this installed version
            {catalog?.tag ? <span className="font-mono text-dim"> ({catalog.tag})</span> : null}. After install, check the extension
            registry below to enable or inspect them.
          </div>
        </div>
        <input
          value={catalogQuery}
          onChange={(event) => setCatalogQuery(event.target.value)}
          placeholder="Search available extensions…"
          className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
        />
      </div>
      {catalogError ? <ErrorState title="Could not load available extensions" message={catalogError} /> : null}
      {!catalog && !catalogError ? <LoadingState label="Loading available extensions…" /> : null}
      {catalog && visibleCatalogExtensions.length === 0 ? (
        <EmptyState title="No matching extensions" body="Adjust the search query." />
      ) : null}
      {visibleCatalogExtensions.length ? (
        <div className="divide-y divide-border-subtle/70">
          {visibleCatalogExtensions.map((item) => {
            const busy = busyId === item.id;
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[14px] font-semibold text-primary">{item.name}</div>
                    <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-dim">{item.id}</span>
                    {item.installed ? (
                      <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
                        Installed
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 max-w-[48rem] text-[12px] leading-5 text-secondary">
                    {item.description || 'No description provided.'}
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-dim">{item.bundleUrl}</div>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-surface px-3 py-1.5 text-[12px] text-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || item.installed}
                  onClick={() => void installCatalogExtension(item)}
                >
                  {busy ? 'Installing…' : item.installed ? 'Installed' : 'Install'}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  const renderExtensionRows = (items: ExtensionInstallSummary[]) =>
    items.map((extension) => {
      const route = firstRoute(extension);
      const counts = contributionCounts(extension);
      const busy = busyId === extension.id;
      return (
        <tr key={extension.id} className="group border-t border-border-subtle/70 transition-colors hover:bg-surface/30">
          <td className="min-w-0 py-3 pr-4 align-middle">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-[14px] font-semibold text-primary">{extension.name}</div>
                <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dim">
                  {extension.packageType ?? 'user'}
                </span>
              </div>
              <div className="mt-0.5 max-w-[44rem] whitespace-normal break-words text-[12px] leading-5 text-secondary">
                {extension.description || 'No description provided.'}
              </div>
            </div>
          </td>
          <td className="px-3 py-3 align-middle">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CompactCount icon={<PageIcon />} count={counts.pages} title="Pages" />
              <CompactCount icon={<RailIcon />} count={counts.rails} title="Right rail panels" />
              <CompactCount icon={<WorkbenchIcon />} count={counts.workbench} title="Workbench details" />
              <CompactCount icon={<ToolIcon />} count={counts.tools} title="Agent tools" />
              <CompactCount icon={<AgentHookIcon />} count={counts.modelProfiles} title="Model profiles" />
              <CompactCount icon={<KeybindingIcon />} count={counts.keybindings} title="Keyboard shortcuts" />
              <CompactCount icon={<AgentHookIcon />} count={counts.agentHooks} title="Agent lifecycle hooks" />
              <CompactCount icon={<BackendIcon />} count={counts.backend} title="Backend actions" />
              <CompactCount icon={<SkillIcon />} count={counts.skills} title="Skills" />
              {extension.diagnostics?.length ? <span className="text-[12px] text-danger">!</span> : null}
              {extension.buildError ? (
                <span className="text-[12px] text-danger" title={extension.buildError}>
                  Build failed
                </span>
              ) : null}
              {Object.values(counts).every((count) => count === 0) && !extension.diagnostics?.length && !extension.buildError ? (
                <span className="text-dim">—</span>
              ) : null}
            </div>
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-middle">
            {extension.status === 'invalid' ? (
              <span className="text-[12px] text-danger">Invalid</span>
            ) : (
              <StatusToggle extension={extension} busy={busy} onToggle={() => toggleExtension(extension)} />
            )}
          </td>
          <td className="py-3 pl-3 align-middle">
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
              <ExtensionActionsMenu extension={extension} busy={busy} onOpenFolder={() => openFolder(extension)} />
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
            <th className="py-2 pr-4 font-semibold">Name</th>
            <th className="py-2 px-3 font-semibold">Contributes</th>
            <th className="py-2 px-3 font-semibold">Status</th>
            <th className="py-2 pl-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>{renderExtensionRows(items)}</tbody>
      </table>
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
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
          <AppPageIntro
            title="Extensions"
            summary="Install, enable, and inspect local product modules."
            actions={
              activeTab === 'extensions' ? (
                <div className="flex flex-wrap gap-2">
                  <ToolbarButton onClick={createExtension}>Create</ToolbarButton>
                  <ToolbarButton onClick={importExtension}>Import</ToolbarButton>
                  <IconButton title="Reload all extensions" aria-label="Reload all extensions" onClick={reload}>
                    ↻
                  </IconButton>
                </div>
              ) : null
            }
          />

          {notice ? (
            <div className="sticky top-0 z-20 border-b border-border-subtle/60 bg-base/95 py-2 text-[13px] text-secondary backdrop-blur">
              {notice}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1 border-b border-border-subtle/70 pb-5">
            {(['extensions', 'available', 'commands'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={cx(
                  'rounded-lg px-3 py-1.5 text-[13px] capitalize transition-colors',
                  activeTab === tab ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'available' ? (
            renderCatalog()
          ) : activeTab === 'commands' ? (
            <section className="space-y-4">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">Commands</div>
                <div className="mt-1 text-[12px] text-secondary">{commands.length} host and extension commands registered.</div>
              </div>
              <div className="space-y-4">
                <div className="overflow-auto rounded-xl bg-surface/30 p-2">
                  <table className="w-full border-collapse text-left text-[12px]">
                    <thead className="text-[10px] uppercase tracking-[0.14em] text-dim">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Command</th>
                        <th className="px-2 py-1.5 font-semibold">Source</th>
                        <th className="px-2 py-1.5 font-semibold">Action</th>
                        <th className="px-2 py-1.5 font-semibold">Args / Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commands.map((command) => {
                        const id = command.id ?? command.surfaceId ?? 'unknown';
                        const commandId = command.extensionId ? `${command.extensionId}.${id}` : id;
                        const source = command.extensionId ?? 'host';
                        return (
                          <tr key={`${source}:${id}`} className="border-t border-border-subtle/60 text-secondary align-top">
                            <td className="px-2 py-1.5 text-primary">
                              <div>{command.title ?? id}</div>
                              <div className="font-mono text-[11px] text-dim">{commandId}</div>
                              {command.enablement ? (
                                <div className="mt-1 font-mono text-[11px] text-dim">when {command.enablement}</div>
                              ) : null}
                              {command.argsSchema ? <div className="mt-1 font-mono text-[11px] text-dim">args schema available</div> : null}
                            </td>
                            <td className="px-2 py-1.5">{source}</td>
                            <td className="px-2 py-1.5 font-mono text-[11px]">{command.action ?? 'host'}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex min-w-64 gap-1.5">
                                <input
                                  value={commandArgsDraft[commandId] ?? (command.args ? JSON.stringify(command.args) : '')}
                                  onChange={(event) => setCommandArgsDraft((current) => ({ ...current, [commandId]: event.target.value }))}
                                  placeholder="JSON args"
                                  className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-base px-2 py-1 font-mono text-[11px] text-primary outline-none focus:border-accent/50"
                                />
                                <button
                                  type="button"
                                  className="rounded-lg bg-surface px-2 py-1 text-[11px] text-secondary hover:text-primary"
                                  onClick={() => void executeInspectorCommand(command)}
                                >
                                  Run
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-auto rounded-xl bg-surface/30 p-2">
                  <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Keybindings</div>
                  <table className="w-full border-collapse text-left text-[12px]">
                    <tbody>
                      {keybindings.map((keybinding) => {
                        const key = `${keybinding.extensionId}:${keybinding.surfaceId}`;
                        return (
                          <tr key={key} className="border-t border-border-subtle/60 text-secondary">
                            <td className="px-2 py-1.5 text-primary">
                              <div>{keybinding.title}</div>
                              <div className="font-mono text-[11px] text-dim">{keybinding.command}</div>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={keybindingDraft[key] ?? keybinding.keys.join(', ')}
                                onChange={(event) => setKeybindingDraft((current) => ({ ...current, [key]: event.target.value }))}
                                className="w-64 rounded-lg border border-border-subtle bg-base px-2 py-1 font-mono text-[11px] text-primary outline-none focus:border-accent/50"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                className="px-2 py-1 text-[11px] text-secondary hover:text-primary"
                                onClick={() => void saveKeybinding(keybinding)}
                              >
                                Save
                              </button>
                              <button
                                className="px-2 py-1 text-[11px] text-secondary hover:text-primary"
                                onClick={() => void toggleKeybinding(keybinding)}
                              >
                                {keybinding.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                className="px-2 py-1 text-[11px] text-secondary hover:text-primary"
                                onClick={() => void resetKeybinding(keybinding)}
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : extensions.length === 0 ? (
            <EmptyState title="No extensions installed" body="Ask an agent to create one under the runtime extensions directory." />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-surface/40 p-1">
                  {(['all', 'system', 'user', 'enabled', 'disabled'] as const).map((nextFilter) => (
                    <button
                      key={nextFilter}
                      type="button"
                      className={cx(
                        'rounded-lg px-3 py-1.5 text-[12px] capitalize transition-colors',
                        filter === nextFilter ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
                      )}
                      onClick={() => setFilter(nextFilter)}
                    >
                      {nextFilter}
                    </button>
                  ))}
                </div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search extensions…"
                  className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
                />
              </div>
              {visibleExtensions.length === 0 ? (
                <EmptyState title="No matching extensions" body="Adjust the filter or search query." />
              ) : (
                renderExtensionTable(visibleExtensions)
              )}
            </div>
          )}
        </AppPageLayout>
      </div>

      {detailsExtensionId ? <ExtensionDetailsModal extensionId={detailsExtensionId} onClose={() => setDetailsExtensionId(null)} /> : null}
      {createDraft ? (
        <CreateExtensionModal draft={createDraft} onCancel={() => setCreateDraft(null)} onSubmit={submitCreateExtension} />
      ) : null}
      {importDraft ? (
        <ExtensionTextInputModal
          title="Import extension"
          label="Path to extension .zip bundle"
          confirmLabel="Review import"
          onCancel={() => setImportDraft(false)}
          onSubmit={(zipPath) => {
            setImportDraft(false);
            setImportWarningZip(zipPath.trim());
          }}
        />
      ) : null}
      {importWarningZip ? <ImportWarningModal zipPath={importWarningZip} onConfirm={confirmImport} onCancel={cancelImport} /> : null}
    </>
  );
}

function ExtensionSettingsBlock({ extension }: { extension: ExtensionInstallSummary }) {
  const { data: values } = useApi<Record<string, unknown>>(api.settings as never);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const contributes = extension.manifest?.contributes?.settings;
  const rawSettings = contributes && typeof contributes === 'object' && !Array.isArray(contributes) ? contributes : {};

  const entries: UnifiedSettingsEntry[] = useMemo(
    () =>
      Object.entries(rawSettings).map(([key, value]) => {
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
      }),
    [rawSettings, extension.id],
  );

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

  if (Object.keys(rawSettings).length === 0) return null;

  entries.sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <SettingsField
          key={entry.key}
          entry={entry}
          value={draft[entry.key]}
          onChange={(key, val) => {
            setDraft((prev) => ({ ...prev, [key]: val }));
            setSaveNotice(null);
            setSaveError(null);
          }}
        />
      ))}
      {saving ? <p className="text-[12px] text-dim">Saving…</p> : null}
      {saveNotice ? <p className="text-[12px] text-success">{saveNotice}</p> : null}
      {saveError ? <p className="text-[12px] text-danger">{saveError}</p> : null}
    </div>
  );
}

function ExtensionDetailsModal({ extensionId, onClose }: { extensionId: string; onClose: () => void }) {
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
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-10 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Extension details"
        className="relative w-full max-w-2xl rounded-3xl border border-border-subtle bg-base shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-border-subtle bg-base/95 px-6 py-4 backdrop-blur">
          <h2 className="text-[16px] font-semibold text-primary">Extension details</h2>
          <button type="button" onClick={onClose} className="ui-icon-button" aria-label="Close details" title="Close">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {loading ? (
            <LoadingState label="Loading extension details…" />
          ) : !extension ? (
            <p className="text-[13px] text-dim">Extension not found.</p>
          ) : (
            <div className="space-y-5 pb-4">
              {notice ? <p className="text-[12px] leading-5 text-secondary">{notice}</p> : null}

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[18px] font-semibold tracking-tight text-primary">{extension.name}</h3>
                  <span
                    className={cx(
                      'h-1.5 w-1.5 rounded-full',
                      extension.status === 'invalid' ? 'bg-danger' : extension.enabled ? 'bg-success' : 'bg-dim',
                    )}
                  />
                </div>
                <p className="mt-1 font-mono text-[11px] text-dim">{extension.id}</p>
                {extension.description ? <p className="mt-3 text-[13px] leading-6 text-secondary">{extension.description}</p> : null}
              </div>

              {extension.status === 'invalid' ? (
                <DetailBlock
                  title="Validation errors"
                  action={
                    <button
                      type="button"
                      className="text-[11px] text-secondary transition-colors hover:text-primary"
                      onClick={() => void copyExtensionDiagnostics(extension)}
                    >
                      Copy diagnostics
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {(extension.errors ?? ['Extension manifest is invalid.']).map((message) => (
                      <p
                        key={message}
                        className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] leading-5 text-danger"
                      >
                        {message}
                      </p>
                    ))}
                  </div>
                </DetailBlock>
              ) : null}

              {extension.diagnostics?.length ? (
                <DetailBlock
                  title="Diagnostics"
                  action={
                    <button
                      type="button"
                      className="text-[11px] text-secondary transition-colors hover:text-primary"
                      onClick={() => void copyExtensionDiagnostics(extension)}
                    >
                      Copy diagnostics
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {extension.diagnostics.map((message) => (
                      <p
                        key={message}
                        className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] leading-5 text-danger"
                      >
                        {message}
                      </p>
                    ))}
                  </div>
                </DetailBlock>
              ) : null}

              {extension.buildError ? (
                <DetailBlock title="Build error">
                  <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
                    <p className="whitespace-pre-wrap break-words text-[12px] leading-5 text-danger">{extension.buildError}</p>
                  </div>
                </DetailBlock>
              ) : null}

              <DetailBlock title="Surfaces">
                {getLogicalSurfaces(extension).length ? (
                  <div className="space-y-2">
                    {getLogicalSurfaces(extension).map((surface) => (
                      <div key={surface.id}>
                        <div className="text-[13px] font-medium text-primary">{surface.title}</div>
                        <div className="text-[12px] text-secondary">
                          {surface.kind}
                          {surface.detail ? ` · detail: ${surface.detail.title}` : ''}
                        </div>
                        {surface.warning ? <div className="text-[12px] text-danger">{surface.warning}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-dim">No surfaces.</p>
                )}
              </DetailBlock>

              {extension.modelProfiles?.length ? (
                <DetailBlock title="Model Profiles">
                  <div className="space-y-3 text-[12px]">
                    {extension.modelProfiles.map((profile) => (
                      <div key={`${profile.extensionId}-${profile.id}`}>
                        <div className="font-medium text-primary">{profile.title ?? profile.id}</div>
                        <div className="text-secondary">{profile.match.join(', ')}</div>
                        {profile.description ? <div className="mt-1 text-dim">{profile.description}</div> : null}
                      </div>
                    ))}
                  </div>
                </DetailBlock>
              ) : null}

              <DetailBlock title="Capabilities">
                <dl className="space-y-3 text-[12px]">
                  <DetailRow label="UI" value={`Frontend: ${formatFrontendSummary(extension)}`} />
                  <DetailRow
                    label="Agent"
                    value={`Tools: ${formatToolSummary(extension)} · Model profiles: ${formatModelProfileSummary(extension)} · Hook: ${formatAgentHookSummary(extension)} · Skills: ${formatSkillSummary(extension)}`}
                  />
                  <DetailRow label="Shortcuts" value={formatKeybindingSummary(extension)} />
                  <DetailRow
                    label="Backend"
                    value={`Actions: ${formatBackendActionSummary(extension)} · Services: ${formatServiceSummary(extension)} · Protocols: ${formatProtocolSummary(extension)}`}
                  />
                  <DetailRow label="Subscriptions" value={formatSubscriptionSummary(extension)} />
                  <DetailRow label="Dependencies" value={formatDependencySummary(extension)} />
                  <DetailRow label="Permissions" value={formatPermissionSummary(extension)} />
                </dl>
              </DetailBlock>

              <DetailBlock title="Settings">
                <ExtensionSettingsBlock extension={extension} />
              </DetailBlock>

              <DetailBlock title="Skills">
                {extension.skills?.length ? (
                  <div className="space-y-3">
                    {extension.skills.map((skill) => (
                      <div key={skill.name} className="group/skill">
                        <button
                          type="button"
                          className="text-left text-[13px] font-medium text-primary transition-colors hover:text-accent"
                          onClick={() => openPath(skill.path)}
                        >
                          {skill.title ?? skill.name}
                        </button>
                        <div className="font-mono text-[11px] text-dim">{skill.name}</div>
                        {skill.description ? <p className="mt-1 text-[12px] leading-5 text-secondary">{skill.description}</p> : null}
                        <p className="mt-1 break-all font-mono text-[11px] leading-5 text-dim">{skill.path}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-dim">No skills.</p>
                )}
              </DetailBlock>

              {extension.packageRoot ? (
                <DetailBlock title="Package">
                  <p className="break-all font-mono text-[11px] leading-5 text-secondary">{extension.packageRoot}</p>
                </DetailBlock>
              ) : null}

              <details>
                <summary className="cursor-pointer select-none text-[12px] text-dim transition-colors hover:text-secondary">
                  Raw manifest
                </summary>
                <pre className="mt-3 max-h-[22rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-secondary">
                  {JSON.stringify(extension.manifest, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-dim">{label}</dt>
      <dd className="mt-0.5 break-words text-secondary">{value}</dd>
    </div>
  );
}

function ExtensionTextInputModal({
  title,
  label,
  initialValue = '',
  confirmLabel = 'Continue',
  onCancel,
  onSubmit,
}: {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm" onClick={onCancel}>
      <form
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-base p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onSubmit(value);
        }}
      >
        <h2 className="text-[16px] font-semibold text-primary">{title}</h2>
        <label className="mt-4 block text-[12px] font-medium text-secondary">
          {label}
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
            autoFocus
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-[13px] text-secondary hover:bg-surface hover:text-primary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="rounded-xl border border-accent/50 bg-accent/15 px-4 py-2 text-[13px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateExtensionModal({
  draft,
  onCancel,
  onSubmit,
}: {
  draft: ExtensionCreateDraft;
  onCancel: () => void;
  onSubmit: (draft: ExtensionCreateDraft) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [id, setId] = useState(draft.id);
  const [template, setTemplate] = useState<ExtensionTemplate>(draft.template);
  const normalizedName = name.trim();
  const normalizedId = id.trim() || slugifyExtensionId(normalizedName);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm" onClick={onCancel}>
      <form
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-base p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (normalizedName && normalizedId) onSubmit({ name: normalizedName, id: normalizedId, template });
        }}
      >
        <h2 className="text-[16px] font-semibold text-primary">Create extension</h2>
        <label className="mt-4 block text-[12px] font-medium text-secondary">
          Extension name
          <input
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              setId((current) => (current.trim() ? current : slugifyExtensionId(nextName)));
            }}
            className="mt-2 w-full rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none focus:border-accent/50"
            autoFocus
          />
        </label>
        <label className="mt-3 block text-[12px] font-medium text-secondary">
          Extension id
          <input
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder={slugifyExtensionId(name) || 'my-extension'}
            className="mt-2 w-full rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none focus:border-accent/50"
          />
        </label>
        <label className="mt-3 block text-[12px] font-medium text-secondary">
          Template
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as ExtensionTemplate)}
            className="mt-2 w-full rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none focus:border-accent/50"
          >
            <option value="main-page">Main page</option>
            <option value="right-rail">Right rail</option>
            <option value="workbench-detail">Workbench detail</option>
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-[13px] text-secondary hover:bg-surface hover:text-primary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!normalizedName || !normalizedId}
            className="rounded-xl border border-accent/50 bg-accent/15 px-4 py-2 text-[13px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function ImportWarningModal({
  zipPath,
  onConfirm,
  onCancel,
}: {
  zipPath: string;
  onConfirm: (zipPath: string) => void;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [cleanRoomStatus, setCleanRoomStatus] = useState<'idle' | 'starting' | 'started' | 'error'>('idle');
  const [cleanRoomRunId, setCleanRoomRunId] = useState<string | null>(null);
  const [cleanRoomError, setCleanRoomError] = useState<string | null>(null);
  const confirmed = confirmText === 'I UNDERSTAND THE RISKS';

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onCancel();
      }
    },
    [onCancel],
  );

  const startCleanRoomAnalysis = useCallback(async () => {
    setCleanRoomStatus('starting');
    setCleanRoomError(null);
    try {
      const result = await api.cleanRoomImport({ zipPath });
      setCleanRoomRunId(result.runId);
      setCleanRoomStatus('started');
    } catch (err) {
      setCleanRoomError(err instanceof Error ? err.message : String(err));
      setCleanRoomStatus('error');
    }
  }, [zipPath]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-10 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Dangerous import warning"
        className="relative w-full max-w-lg rounded-3xl border-2 border-danger/60 bg-base shadow-2xl shadow-danger/10"
      >
        {/* Top danger bar */}
        <div className="flex items-center gap-2.5 rounded-t-3xl border-b border-danger/30 bg-danger/15 px-6 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danger/20 text-[15px] font-bold text-danger">!</span>
          <h2 className="text-[16px] font-bold tracking-tight text-danger">DANGEROUS OPERATION</h2>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-3">
            <p className="text-[13px] font-semibold leading-6 text-primary">
              You are about to import a pre-built extension from:{' '}
              <code className="break-all font-mono text-[12px] text-secondary">{zipPath}</code>
            </p>

            <div className="rounded-xl border border-danger/30 bg-danger/[0.07] px-4 py-3">
              <p className="text-[13px] font-semibold leading-6 text-danger">Why this is dangerous</p>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-5 text-secondary">
                <li>
                  Extensions have full access to your agent&apos;s tools, including file system read/write, shell execution, network access,
                  and AI model invocation.
                </li>
                <li>
                  An imported extension could exfiltrate data, modify your knowledge base, inject prompts, or spawn background processes —
                  all without your knowledge.
                </li>
                <li>There is no sandbox. The code runs with the same privileges as your agent runtime.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3">
              <p className="text-[13px] font-semibold leading-6 text-accent">Recommended alternative</p>
              <p className="mt-1.5 text-[12px] leading-5 text-secondary">
                Instead of importing an untrusted binary bundle, ask an agent to do a <strong>clean-room re-implementation</strong>. A
                stripped-down agent with only web tools can fetch the plugin&apos;s repository, generate a specification from the source,
                and scan that spec for vulnerabilities. The sanitized spec can then be handed to a full agent for implementation — no blind
                code execution.
              </p>
            </div>
          </div>

          {cleanRoomStatus === 'starting' ? (
            <div className="rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3">
              <p className="text-[13px] text-accent">Starting clean-room analysis…</p>
            </div>
          ) : cleanRoomStatus === 'started' ? (
            <div className="rounded-xl border border-success/30 bg-success/[0.06] px-4 py-3">
              <p className="text-[13px] font-medium text-success">Clean-room analysis started</p>
              <p className="mt-1 text-[12px] text-secondary">
                Run ID: <code className="font-mono">{cleanRoomRunId}</code>
              </p>
              <p className="mt-1 text-[12px] text-secondary">
                Track progress from the inline background work cards. The analysis agent will generate a specification with security
                findings.
              </p>
            </div>
          ) : cleanRoomStatus === 'error' ? (
            <div className="rounded-xl border border-danger/30 bg-danger/[0.07] px-4 py-3">
              <p className="text-[13px] font-semibold text-danger">Failed to start analysis</p>
              <p className="mt-1 text-[12px] text-secondary">{cleanRoomError}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
              Type <span className="font-mono">I UNDERSTAND THE RISKS</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type I UNDERSTAND THE RISKS to enable import"
              className="w-full rounded-xl border border-danger/40 bg-base px-4 py-2.5 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-danger"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-[13px] font-medium text-secondary transition-colors hover:bg-surface hover:text-primary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-accent/60 bg-accent/15 px-4 py-2 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={cleanRoomStatus === 'starting' || cleanRoomStatus === 'started'}
              onClick={startCleanRoomAnalysis}
            >
              {cleanRoomStatus === 'starting' ? 'Starting…' : cleanRoomStatus === 'started' ? 'Analysis running' : 'Clean-room analysis'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-danger/60 bg-danger/15 px-5 py-2 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!confirmed}
              onClick={() => onConfirm(zipPath)}
            >
              {confirmed ? 'Import anyway' : 'Confirm to enable'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExtensionManagerSettingsPanel({ pa }: { pa: NativeExtensionClient }) {
  return <ExtensionManagerPage pa={pa as ExtensionSurfaceProps['pa']} />;
}
