import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import type { ExtensionInstallSummary } from '@neon-pilot/extensions/data';
import { api, EXTENSION_REGISTRY_CHANGED_EVENT, notifyExtensionRegistryChanged } from '@neon-pilot/extensions/data';
import {
  Button,
  PanelMessage,
  ResourceList,
  ResourceListRow,
  TextInput,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedDialog,
  WindowedEmptyState,
  WindowedKeyValueList,
  WindowedLoadingState,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedSegmentedControl,
  WindowedStateBlock,
  WindowedTextInput,
  WindowedToggle,
  WindowedToolbar,
} from '@neon-pilot/extensions/ui';
import { getDesktopBridge } from '@neon-pilot/extensions/workbench-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
  sourceRepo?: { owner: string; repo: string };
  bundleUrl?: string;
  packageSource?: string;
  defaultEnabled?: boolean;
  source?: 'github-release';
  installed: boolean;
  installedVersion?: string;
  enabled?: boolean;
  availableVersion?: string;
  compatibilityWarning?: string;
  unavailableReason?: string;
  updateAvailable?: boolean;
  permissions?: string[];
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
    owner?: string;
    repo?: string;
  }>;
  sourceErrors?: Array<{ sourceId: string; message: string }>;
  extensions: InstallableExtensionCatalogItem[];
  packages?: InstallableExtensionCatalogItem[];
}

interface ExtensionCatalogSource {
  id: string;
  type: 'github';
  owner: string;
  repo: string;
  enabled: boolean;
  name?: string;
}

type ExtensionFilter = 'all' | 'platform' | 'attention';
type ExtensionActionBridge = ExtensionSurfaceProps['pa']['extensions'];
type ExtensionManagerNotice = { type: 'info' | 'success' | 'error'; message: string; details?: string };
type WindowedStatusTone = 'neutral' | 'positive' | 'warning' | 'danger';

function extensionResourceId(extensionId: string): string {
  return `extension:${extensionId}`;
}

function formatPermissionLabel(permission: string): string {
  const labels: Record<string, string> = {
    'agent:run': 'Run agent',
    'agent:conversations': 'Agent conversations',
    'executions:read': 'Read executions',
    'executions:start': 'Start executions',
    'executions:cancel': 'Cancel executions',
    'automations:read': 'Read automations',
    'automations:write': 'Write automations',
    'automations:readwrite': 'Manage automations',
    'automations:run': 'Run automations',
    'runtimes:read': 'Read runtimes',
    'attention:read': 'Read attention events',
    'attention:write': 'Write attention events',
    'storage:read': 'Read storage',
    'storage:write': 'Write storage',
    'storage:readwrite': 'Manage storage',
    'settings:read': 'Read settings',
    'settings:write': 'Write settings',
    'settings:readwrite': 'Manage settings',
    'workspace:read': 'Read workspace',
    'workspace:write': 'Write workspace',
    'workspace:readwrite': 'Manage workspace',
    'filesystem:read': 'Read file system',
    'filesystem:write': 'Write file system',
    'filesystem:readwrite': 'Manage file system',
    'shell:execute': 'Execute shell commands',
    'commands:read': 'Read commands',
    'commands:execute': 'Execute commands',
    'browser:read': 'Read browser',
    'browser:control': 'Control browser',
    'desktop:control': 'Control desktop',
    'git:read': 'Read Git repos',
    'secrets:read': 'Read secrets',
    'extensions:read': 'Read extensions',
    'extensions:write': 'Manage extensions',
    'models:read': 'Read AI models',
    'models:write': 'Write AI models',
    'models:readwrite': 'Manage AI models',
    'images:read': 'Read images',
    'images:write': 'Write images',
    'videos:read': 'Read videos',
    'audio:read': 'Read audio',
    'documents:read': 'Read documents',
    'documents:write': 'Write documents',
    'documents:readwrite': 'Manage documents',
    'knowledge:read': 'Read knowledge',
    'knowledge:write': 'Write knowledge',
    'knowledge:readwrite': 'Manage knowledge',
    'mcp:read': 'Read MCP tools',
    'mcp:write': 'Write MCP tools',
    'network:read': 'Read network',
    'conversations:read': 'Read conversations',
    'conversations:write': 'Write conversations',
    'conversations:readwrite': 'Manage conversations',
    'network:listen': 'Listen on network',
    'telemetry:read': 'Read telemetry',
    'telemetry:write': 'Write telemetry',
    'ui:confirm': 'Show confirm dialog',
    'ui:invalidate': 'Invalidate UI',
    'ui:notify': 'Show notification',
  };
  return labels[permission] ?? permission;
}

function formatPermissionsSummary(permissions: string[]): string[] {
  if (!permissions.length) return ['No special capabilities declared'];
  const labels = permissions.map((p) => formatPermissionLabel(p));
  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length <= 3) return uniqueLabels;
  return [...uniqueLabels.slice(0, 3), `+${uniqueLabels.length - 3} more`];
}

function formatPermissionsDetail(permissions: string[]): string {
  if (!permissions.length) return 'No special capabilities declared.';
  return permissions.map((p) => `  • ${formatPermissionLabel(p)} (${p})`).join('\n');
}

function permissionsForCatalogAction(catalogItem?: InstallableExtensionCatalogItem, extension?: ExtensionInstallSummary): string[] {
  return catalogItem?.permissions !== undefined ? catalogItem.permissions : (extension?.permissions ?? []);
}

function isExtensionSelection(value: unknown): value is { resource: { type: 'extension'; id: string; data?: { extensionId?: string } } } {
  if (!value || typeof value !== 'object') return false;
  const resource = (value as { resource?: unknown }).resource;
  return Boolean(resource && typeof resource === 'object' && (resource as { type?: unknown }).type === 'extension');
}

const BUILD_EXTENSION_PROMPT = `I want to build a Neon Pilot app package. Use the local-extension-development skill to guide me through the package/runtime details.

Start by interviewing me before you write code. Ask focused questions until you understand the workflow I want, who it is for, what the first version should do, where it should live in Neon Pilot, and what empty, loading, error, and success states it needs.

Then write a short UX brief. If the app has UI, make a quick visual prototype or artifact using Neon Pilot's UI patterns so I can react before implementation.

After I approve the direction, build the app package, reload it, test the real app path, and keep iterating with me until it feels right.`;
const COMPOSER_DRAFT_RETRY_MS = 100;
const COMPOSER_DRAFT_MAX_ATTEMPTS = 20;

function WindowedExtensionNoticeBox({ notice }: { notice: ExtensionManagerNotice }) {
  const tone = notice.type === 'error' ? 'danger' : notice.type === 'success' ? 'positive' : 'neutral';
  return (
    <WindowedStateBlock tone={tone} title={notice.message}>
      {notice.details}
    </WindowedStateBlock>
  );
}

function draftComposerTextWhenReady(text: string, attempt = 0): void {
  const textarea = document.querySelector('textarea');
  const currentValue = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
  if (currentValue.includes(text)) {
    window.dispatchEvent(new CustomEvent('neon-pilot:composer-focus'));
    return;
  }

  if (textarea) {
    window.dispatchEvent(new CustomEvent('neon-pilot:composer-clear'));
    window.dispatchEvent(new CustomEvent('neon-pilot:composer-append-text', { detail: { text } }));
    window.dispatchEvent(new CustomEvent('neon-pilot:composer-focus'));
    return;
  }

  if (attempt + 1 < COMPOSER_DRAFT_MAX_ATTEMPTS) {
    window.setTimeout(() => draftComposerTextWhenReady(text, attempt + 1), COMPOSER_DRAFT_RETRY_MS);
  }
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
      return 'Tab rail';
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
          kind: detail && !wrongLocation ? 'Tab rail + workbench detail' : 'Tab rail',
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
        ...(view.location === 'workbench' ? { warning: 'Orphan workbench detail view; no tab rail view points at it' } : {}),
      },
    ];
  });
  return [...legacySurfaces, ...nativeSurfaces];
}

const FALLBACK_LOCKED_EXTENSION_IDS = [
  'system-extension-manager',
  'system-prompt-assembly',
  'system-runs',
  'system-settings',
  'system-terminal',
];

function canDeleteExtension(extension: ExtensionInstallSummary): boolean {
  return extension.uninstallable === true || extension.packageType !== 'system';
}

function isLocked(extension: ExtensionInstallSummary): boolean {
  return extension.required === true || FALLBACK_LOCKED_EXTENSION_IDS.includes(extension.id);
}

function isQuarantined(extension: ExtensionInstallSummary): boolean {
  return Boolean(
    extension.diagnostics?.some((message) => {
      const normalized = message.toLowerCase();
      return normalized.includes('disabled by circuit breaker') || normalized.includes('disabled by startup safe mode');
    }),
  );
}

function extensionSortLabel(extension: ExtensionInstallSummary): string {
  return `${extension.name || extension.id} ${extension.id}`.toLowerCase();
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

function firstRoute(extension: ExtensionInstallSummary): string | null {
  return extension.routes[0]?.route ?? extension.manifest?.contributes?.views?.find((view) => view.location === 'main')?.route ?? null;
}

function formatToolSummary(extension: ExtensionInstallSummary): string {
  return extension.tools?.length ? extension.tools.map((tool) => tool.name).join(', ') : '';
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

function extensionSettingsTarget(extension: ExtensionInstallSummary): string {
  return `/settings/apps/${encodeURIComponent(extension.id)}`;
}

function formatAppearsInSummary(extension: ExtensionInstallSummary): string {
  const surfaces = getLogicalSurfaces(extension);
  const labels = [
    surfaces.some((surface) => surface.kind.includes('Main page')) ? 'Page' : null,
    surfaces.some((surface) => surface.kind.includes('Tab rail')) ? 'Tab rail' : null,
    surfaces.some((surface) => surface.kind.includes('Workbench')) ? 'Workbench' : null,
    extension.tools?.length ? 'Chat tool' : null,
    extension.skills?.length ? 'Skill' : null,
    extension.manifest?.contributes?.commands?.length ? 'Command' : null,
    hasExtensionSettings(extension) ? 'Settings' : null,
  ].filter(Boolean);
  return labels.length ? labels.join(' · ') : 'Background capability';
}

function extensionStatusLabel(extension: ExtensionInstallSummary, unavailableCatalogItem = false): string {
  if (unavailableCatalogItem) return 'Unavailable';
  if (isLocked(extension)) return 'Required';
  if (isQuarantined(extension)) return 'Quarantined';
  if (extension.status === 'invalid') return 'Invalid';
  return extension.enabled ? 'Enabled' : 'Disabled';
}

function extensionStatusTone(extension: ExtensionInstallSummary, unavailableCatalogItem = false): WindowedStatusTone {
  const label = extensionStatusLabel(extension, unavailableCatalogItem);
  if (label === 'Enabled' || label === 'Required') return 'positive';
  if (label === 'Invalid' || label === 'Quarantined') return 'danger';
  if (label === 'Unavailable') return 'warning';
  return 'neutral';
}

function parseGithubCatalogSource(value: string): ExtensionCatalogSource | null {
  const trimmed = value.trim();
  const shorthand = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  const repo = shorthand
    ? { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, '') }
    : (() => {
        try {
          const url = new URL(trimmed);
          if (url.hostname !== 'github.com') return null;
          const [owner, repoName] = url.pathname.replace(/^\/+/, '').split('/');
          if (!owner || !repoName) return null;
          return { owner, repo: repoName.replace(/\.git$/, '') };
        } catch {
          return null;
        }
      })();
  if (!repo) return null;
  return {
    id: `${repo.owner.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${repo.repo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'github',
    owner: repo.owner,
    repo: repo.repo,
    enabled: true,
  };
}

function repoKey(source: Pick<ExtensionCatalogSource, 'owner' | 'repo'>): string {
  return `${source.owner.toLowerCase()}/${source.repo.toLowerCase()}`;
}

function sourceLabel(source: ExtensionCatalogSource): string {
  return source.name ?? `${source.owner}/${source.repo}`;
}

async function readExtensionSources(extensions: ExtensionActionBridge): Promise<ExtensionCatalogSource[]> {
  if (!extensions?.callAction) return [];
  const result = (await extensions.callAction('system-extension-manager', 'readExtensionSources', {})) as {
    sources?: ExtensionCatalogSource[];
  };
  return Array.isArray(result.sources) ? result.sources : [];
}

async function writeExtensionSources(extensions: ExtensionActionBridge, sources: ExtensionCatalogSource[]): Promise<void> {
  if (!extensions?.callAction) throw new Error('App repository management is unavailable.');
  await extensions.callAction('system-extension-manager', 'updateExtensionSources', { sources });
}

function ExtensionRepositoriesControl({
  sources,
  sourceErrors = [],
  input,
  busyId,
  onInputChange,
  onAdd,
  onRemove,
}: {
  sources: ExtensionCatalogSource[];
  sourceErrors?: Array<{ sourceId: string; message: string }>;
  input: string;
  busyId: string | null;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (source: ExtensionCatalogSource) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <TextInput
          className="min-w-0 bg-base"
          value={input}
          onChange={(event) => onInputChange(event.currentTarget.value)}
          placeholder="GitHub URL or owner/name"
        />
        <Button variant="action" disabled={busyId === 'extension-source'} onClick={onAdd}>
          <span aria-hidden="true">+</span>
          {busyId === 'extension-source' ? 'Adding...' : 'Add source'}
        </Button>
      </div>
      <ResourceList>
        {sources.map((source) => (
          <ResourceListRow
            key={source.id}
            title={sourceLabel(source)}
            detail={
              <>
                {source.owner}/{source.repo}
                {source.enabled ? '' : ' · disabled'}
              </>
            }
            titleClassName="text-[12px]"
            actions={
              source.id !== 'neon-pilot' ? (
                <Button
                  variant="action"
                  tone="danger"
                  className="px-3 py-1.5 text-[12px]"
                  disabled={busyId === `extension-source:${source.id}`}
                  onClick={() => onRemove(source)}
                >
                  <span aria-hidden="true">-</span>
                  Remove
                </Button>
              ) : null
            }
          />
        ))}
      </ResourceList>
      {sourceErrors.length ? (
        <div className="space-y-1 text-[12px] text-danger">
          {sourceErrors.map((error) => (
            <p key={`${error.sourceId}:${error.message}`}>
              {error.sourceId}: {error.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ExtensionRepositoriesSettingsPanel({ pa }: ExtensionSurfaceProps) {
  const [sources, setSources] = useState<ExtensionCatalogSource[]>([]);
  const [input, setInput] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setError(null);
    try {
      setSources(await readExtensionSources(pa.extensions));
    } catch (err) {
      setSources([]);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pa.extensions]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const showError = useCallback(
    (message: string, details?: string) => {
      setError(details ? `${message}: ${details}` : message);
      pa.ui.notify?.({ message, details, type: 'error', source: 'system-extension-manager' });
    },
    [pa.ui],
  );

  const addSource = useCallback(async () => {
    const parsed = parseGithubCatalogSource(input);
    if (!parsed) {
      showError('App repository source must be a GitHub URL or owner/name.');
      return;
    }
    const nextSources = [...sources.filter((source) => repoKey(source) !== repoKey(parsed)), parsed];
    setBusyId('extension-source');
    setNotice(null);
    setError(null);
    try {
      await writeExtensionSources(pa.extensions, nextSources);
      setInput('');
      setNotice(`Added ${parsed.owner}/${parsed.repo}.`);
      await loadSources();
    } catch (err) {
      showError('Failed to add app repository', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }, [input, loadSources, pa.extensions, showError, sources]);

  const removeSource = useCallback(
    async (source: ExtensionCatalogSource) => {
      if (source.id === 'neon-pilot') return;
      setBusyId(`extension-source:${source.id}`);
      setNotice(null);
      setError(null);
      try {
        await writeExtensionSources(
          pa.extensions,
          sources.filter((candidate) => candidate.id !== source.id),
        );
        setNotice(`Removed ${source.owner}/${source.repo}.`);
        await loadSources();
      } catch (err) {
        showError('Failed to remove app repository', err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [loadSources, pa.extensions, showError, sources],
  );

  return (
    <div className="space-y-3">
      <ExtensionRepositoriesControl
        sources={sources}
        input={input}
        busyId={busyId}
        onInputChange={setInput}
        onAdd={() => void addSource()}
        onRemove={(source) => void removeSource(source)}
      />
      {notice ? <p className="text-[12px] text-accent">{notice}</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

function installedCatalogItemToSummary(item: InstallableExtensionCatalogItem): ExtensionInstallSummary {
  const enabled = item.enabled ?? false;
  return {
    id: item.id,
    name: item.name,
    packageType: 'user',
    enabled,
    status: enabled ? 'enabled' : 'disabled',
    ...(item.description ? { description: item.description } : {}),
    ...((item.installedVersion ?? item.version) ? { version: item.installedVersion ?? item.version } : {}),
    uninstallable: true,
    manifest: {
      schemaVersion: 2,
      id: item.id,
      name: item.name,
      packageType: 'user',
      ...(item.description ? { description: item.description } : {}),
      ...((item.installedVersion ?? item.version) ? { version: item.installedVersion ?? item.version } : {}),
    },
    permissions: [],
    surfaces: [],
    backendActions: [],
    services: [],
    subscriptions: [],
    dependsOn: [],
    skills: [],
    mentions: [],
    tools: [],
    modelProfiles: [],
    routes: [],
  } as ExtensionInstallSummary;
}

export function ExtensionManagerPage({ pa }: ExtensionSurfaceProps & { embedded?: boolean }) {
  const [extensions, setExtensions] = useState<ExtensionInstallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ExtensionManagerNotice | null>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExtensionFilter>('all');
  const location = useLocation();
  const navigate = useNavigate();
  const [detailsExtensionId, setDetailsExtensionId] = useState<string | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<InstallableExtensionCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSources, setCatalogSources] = useState<ExtensionCatalogSource[]>([]);
  const [catalogSourceInput, setCatalogSourceInput] = useState('');
  const loadSequenceRef = useRef(0);
  const catalogLoadSequenceRef = useRef(0);

  const load = useCallback(async (options: { showLoading?: boolean } = {}) => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    if (options.showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const items = await api.extensionInstallations();
      if (loadSequenceRef.current !== sequence) {
        return;
      }
      setExtensions(items);
      setLoading(false);
    } catch (err) {
      if (loadSequenceRef.current !== sequence) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, []);

  const showActionError = useCallback(
    (message: string, details?: string) => {
      setNotice({ type: 'error', message, details });
      pa.ui.notify({ message, details, type: 'error', source: 'system-extension-manager' });
    },
    [pa],
  );

  const loadCatalog = useCallback(() => {
    const sequence = catalogLoadSequenceRef.current + 1;
    catalogLoadSequenceRef.current = sequence;
    setCatalogError(null);
    if (!pa.extensions?.callAction) {
      setCatalog({ ok: true, version: '', tag: '', extensions: [] });
      setCatalogSources([]);
      return;
    }
    void pa.extensions
      .callAction('system-extension-manager', 'listInstallableExtensions', {})
      .then((result) => {
        if (catalogLoadSequenceRef.current === sequence) {
          setCatalog(result as InstallableExtensionCatalogResponse);
        }
      })
      .catch((err) => {
        if (catalogLoadSequenceRef.current === sequence) {
          setCatalogError(err instanceof Error ? err.message : String(err));
        }
      });
    void readExtensionSources(pa.extensions)
      .then((sources) => {
        if (catalogLoadSequenceRef.current === sequence) {
          setCatalogSources(sources);
        }
      })
      .catch(() => {
        if (catalogLoadSequenceRef.current === sequence) {
          setCatalogSources([]);
        }
      });
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
    const catalogRefreshInterval = window.setInterval(loadCatalog, 30 * 60 * 1000);
    return () => {
      window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(catalogRefreshInterval);
    };
  }, [load, loadCatalog]);

  useEffect(() => {
    if (!pa.selection) return;
    const subscription = pa.selection.subscribe((selection) => {
      if (!isExtensionSelection(selection)) {
        setDetailsExtensionId(null);
        return;
      }
      setDetailsExtensionId(selection.resource.data?.extensionId ?? selection.resource.id.replace(/^extension:/, ''));
    });
    return () => subscription.unsubscribe();
  }, [pa]);

  const installCatalogExtension = useCallback(
    async (item: InstallableExtensionCatalogItem) => {
      if (item.packageType && item.packageType !== 'extension') {
        showActionError('Agent capability packages are installed from Settings → Agent capability packages.');
        return;
      }
      const permissionsDetail = item.permissions?.length
        ? `\n\nThis app can:\n${formatPermissionsDetail(item.permissions)}`
        : '\n\nThis app declares no special capabilities.';
      const confirmed = await pa.ui.confirm({
        title: `Install ${item.name}`,
        message: `Install ${item.name}${item.description ? ` — ${item.description}` : ''} from ${item.marketplaceSourceId ?? item.tag}?${permissionsDetail}`,
      });
      if (!confirmed) return;

      setBusyId(item.id);
      setNotice({ type: 'info', message: `Installing ${item.name} from ${item.marketplaceSourceId ?? item.tag}...` });
      try {
        await pa.extensions.callAction('system-extension-manager', 'installCatalogExtension', { id: item.id });
        setNotice({ type: 'success', message: `Installed ${item.name}. Enable it from the app list when you're ready.` });
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

  const addCatalogSource = useCallback(async () => {
    const parsed = parseGithubCatalogSource(catalogSourceInput);
    if (!parsed) {
      showActionError('App repository source must be a GitHub URL or owner/name.');
      return;
    }
    const nextSources = [...catalogSources.filter((source) => repoKey(source) !== repoKey(parsed)), parsed];
    setBusyId('extension-source');
    try {
      await writeExtensionSources(pa.extensions, nextSources);
      setCatalogSourceInput('');
      setNotice({ type: 'success', message: `Added ${parsed.owner}/${parsed.repo} to app repositories.` });
      loadCatalog();
    } catch (err) {
      showActionError('Failed to add app repository', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }, [catalogSourceInput, catalogSources, loadCatalog, pa, showActionError]);

  const removeCatalogSource = useCallback(
    async (source: ExtensionCatalogSource) => {
      if (source.id === 'neon-pilot') return;
      const nextSources = catalogSources.filter((candidate) => candidate.id !== source.id);
      setBusyId(`extension-source:${source.id}`);
      try {
        await writeExtensionSources(pa.extensions, nextSources);
        setNotice({ type: 'success', message: `Removed ${source.owner}/${source.repo} from app repositories.` });
        loadCatalog();
      } catch (err) {
        showActionError('Failed to remove app repository', err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [catalogSources, loadCatalog, pa, showActionError],
  );

  const toggleExtension = useCallback(
    (extension: ExtensionInstallSummary) => {
      setNotice(null);
      if (extension.status === 'invalid') {
        showActionError('App package manifest is invalid.', extension.errors?.[0]);
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
            navigate('/apps', { replace: true });
          }
        })
        .catch((err: Error) => {
          setExtensions((items) => items.map((item) => (item.id === extension.id ? extension : item)));
          showActionError(`Failed to ${nextEnabled ? 'enable' : 'disable'} ${extension.name}`, err.message);
        })
        .finally(() => setBusyId(null));
    },
    [location.pathname, navigate, showActionError],
  );

  const deleteExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.uninstallable !== true && extension.packageType === 'system') return;
      const confirmed = await pa.ui.confirm({
        title: 'Delete app',
        message: `Delete ${extension.name}? This removes the app package from disk.`,
      });
      if (!confirmed) return;
      setBusyId(extension.id);
      setNotice(null);
      try {
        await api.deleteExtension(extension.id);
        setExtensions((items) => items.filter((item) => item.id !== extension.id));
        setCatalog((current) => {
          if (!current) return current;
          const markUninstalled = (item: InstallableExtensionCatalogItem) =>
            item.id === extension.id ? { ...item, installed: false, enabled: false, installedVersion: undefined } : item;
          return {
            ...current,
            extensions: current.extensions.map(markUninstalled),
            ...(current.packages ? { packages: current.packages.map(markUninstalled) } : {}),
          };
        });
        notifyExtensionRegistryChanged();
        if (extension.routes.some((route) => location.pathname === route.route || location.pathname.startsWith(`${route.route}/`))) {
          navigate('/apps', { replace: true });
        }
      } catch (err) {
        showActionError(`Failed to delete ${extension.name}`, err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [location.pathname, navigate, pa.ui, showActionError],
  );

  const togglePermission = useCallback(
    async (extension: ExtensionInstallSummary, permission: string, granted: boolean) => {
      setBusyId(`permission:${extension.id}`);
      setNotice(null);
      try {
        await pa.extensions.callAction('system-extension-manager', 'togglePermission', {
          extensionId: extension.id,
          permission,
          granted,
        });
        setNotice({ type: 'success', message: `${granted ? 'Granted' : 'Revoked'} permission ${permission} for ${extension.name}.` });
        await load();
      } catch (err) {
        showActionError(
          `Failed to ${granted ? 'grant' : 'revoke'} permission ${permission} for ${extension.name}`,
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setBusyId(null);
      }
    },
    [load, pa.extensions, showActionError],
  );

  const reinstallExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.uninstallable !== true && extension.packageType === 'system') return;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      if (!catalogItem) return;
      const permissions = permissionsForCatalogAction(catalogItem, extension);
      const permissionsDetail = permissions.length
        ? `\n\nThis app can:\n${formatPermissionsDetail(permissions)}`
        : '\n\nThis app declares no special capabilities.';
      const confirmed = await pa.ui.confirm({
        title: 'Reinstall app',
        message: `Reinstall ${extension.name}? This removes the current app package and installs it again from ${catalogItem.tag}.${permissionsDetail}`,
      });
      if (!confirmed) return;
      setBusyId(extension.id);
      setNotice(null);
      try {
        await pa.extensions.callAction('system-extension-manager', 'updateCatalogExtension', { id: extension.id });
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

  const updateExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.packageType === 'system') return;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      if (!catalogItem?.updateAvailable) return;
      const targetVersion = catalogItem.availableVersion ?? catalogItem.version;
      const permissions = permissionsForCatalogAction(catalogItem, extension);
      const permissionsDetail = permissions.length
        ? `\n\nThis app can:\n${formatPermissionsDetail(permissions)}`
        : '\n\nThis app declares no special capabilities.';
      const confirmed = await pa.ui.confirm({
        title: 'Update app',
        message: `Update ${extension.name} from ${extension.version ?? 'installed'} to ${targetVersion} using ${catalogItem.tag}?${permissionsDetail}`,
      });
      if (!confirmed) return;
      setBusyId(extension.id);
      setNotice({ type: 'info', message: `Updating ${extension.name}...` });
      try {
        await pa.extensions.callAction('system-extension-manager', 'updateCatalogExtension', { id: extension.id });
        setNotice({ type: 'success', message: `Updated ${extension.name} to ${targetVersion}.` });
        await load();
        await loadCatalog();
        notifyExtensionRegistryChanged();
      } catch (err) {
        showActionError(`Failed to update ${extension.name}`, err instanceof Error ? err.message : String(err));
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
      setNotice({ type: 'info', message: extension.packageRoot });
      return;
    }
    void bridge.openPath(extension.packageRoot).then((result) => {
      if (!result.opened) {
        setNotice({ type: 'error', message: result.error ?? extension.packageRoot ?? 'Could not open app package folder.' });
      }
    });
  }, []);

  const diagnoseExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      setBusyId(extension.id);
      setNotice(null);
      try {
        const validationResult = (await pa.extensions.callAction('system-extension-manager', 'validateExtension', {
          id: extension.id,
          packageRoot: extension.packageRoot,
        })) as {
          ok: boolean;
          findings?: Array<{ severity: string; message: string; path?: string; fix?: string }>;
          summary?: { errors: number; warnings: number; info: number };
        };

        const hasErrors = (validationResult.summary?.errors ?? 0) > 0;
        const errors = (validationResult.findings ?? []).filter((f) => f.severity === 'error');
        const warnings = (validationResult.findings ?? []).filter((f) => f.severity === 'warning');

        if (hasErrors) {
          setNotice({
            type: 'error',
            message: `Validation failed for ${extension.name}`,
            details: errors.map((e) => e.message).join('\n') || 'Check the app package manifest for errors.',
          });
          return;
        }

        const smokeResult = (await pa.extensions.callAction('system-extension-manager', 'smokeExtension', {
          extensionId: extension.id,
        })) as {
          ok: boolean;
          checks?: Array<{ name: string; ok: boolean; error?: string }>;
          text?: string;
        };

        if (!smokeResult.ok) {
          const failedChecks = (smokeResult.checks ?? []).filter((c) => !c.ok);
          setNotice({
            type: 'error',
            message: `Smoke checks failed for ${extension.name}`,
            details:
              failedChecks.map((c) => `${c.name}: ${c.error || 'Failed'}`).join('\n') || smokeResult.text || 'Unknown smoke failure.',
          });
          return;
        }

        const warningDetails =
          warnings.length > 0
            ? `Validation warnings:\n${warnings.map((w) => w.message).join('\n')}`
            : 'Validation and smoke checks passed.';

        setNotice({
          type: 'success',
          message: `${extension.name} is healthy.`,
          details: warningDetails,
        });
      } catch (err) {
        showActionError(`Could not diagnose ${extension.name}`, err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [pa.extensions, showActionError],
  );

  const selectExtension = useCallback(
    (extension: ExtensionInstallSummary) => {
      setDetailsExtensionId(extension.id);
      pa.selection?.set({
        kind: 'resource',
        resource: {
          type: 'extension',
          id: extensionResourceId(extension.id),
          label: extension.name,
          source: 'system-extension-manager',
          data: { extensionId: extension.id },
        },
      });
    },
    [pa],
  );

  const catalogIds = useMemo(() => new Set(catalog?.extensions.map((item) => item.id) ?? []), [catalog]);
  const catalogById = useMemo(() => new Map(catalog?.extensions.map((item) => [item.id, item]) ?? []), [catalog]);

  const installedExtensions = useMemo(() => {
    const byId = new Map(extensions.map((extension) => [extension.id, extension]));
    for (const item of catalog?.extensions ?? []) {
      if (!item.installed || byId.has(item.id)) continue;
      byId.set(item.id, installedCatalogItemToSummary(item));
    }
    return [...byId.values()];
  }, [catalog, extensions]);

  const updatableExtensions = useMemo(() => {
    return installedExtensions
      .map((extension) => ({
        extension,
        catalogItem: catalog?.extensions.find((item) => item.id === extension.id && item.updateAvailable),
      }))
      .filter(
        (item): item is { extension: ExtensionInstallSummary; catalogItem: InstallableExtensionCatalogItem } =>
          item.extension.packageType !== 'system' && Boolean(item.catalogItem),
      );
  }, [catalog, installedExtensions]);

  const updateAllExtensions = useCallback(async () => {
    if (updatableExtensions.length === 0) return;
    const permissionedCount = updatableExtensions.filter(
      ({ catalogItem, extension }) => permissionsForCatalogAction(catalogItem, extension).length > 0,
    ).length;
    const permissionsNote =
      permissionedCount > 0
        ? `\n\n${permissionedCount} of these apps declare capabilities. Review individual app permissions in Details before updating.`
        : '';
    const confirmed = await pa.ui.confirm({
      title: 'Update apps',
      message: `Update ${updatableExtensions.length} app${updatableExtensions.length === 1 ? '' : 's'} now?${permissionsNote}`,
    });
    if (!confirmed) return;

    setBusyId('update-all');
    setNotice({
      type: 'info',
      message: `Updating ${updatableExtensions.length} app${updatableExtensions.length === 1 ? '' : 's'}...`,
    });

    const failures: string[] = [];
    let updatedCount = 0;
    for (const { extension } of updatableExtensions) {
      try {
        await pa.extensions.callAction('system-extension-manager', 'updateCatalogExtension', { id: extension.id });
        updatedCount += 1;
      } catch (err) {
        failures.push(`${extension.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
      await load();
      await loadCatalog();
    } finally {
      setBusyId(null);
    }

    if (updatedCount > 0) {
      notifyExtensionRegistryChanged();
    }

    if (failures.length) {
      showActionError(`Updated ${updatedCount} app${updatedCount === 1 ? '' : 's'}; ${failures.length} failed.`, failures.join('\n'));
      return;
    }

    setNotice({ type: 'success', message: `Updated ${updatedCount} app${updatedCount === 1 ? '' : 's'}.` });
  }, [load, loadCatalog, pa.extensions, pa.ui, showActionError, updatableExtensions]);

  const extensionHasIssue = useCallback(
    (extension: ExtensionInstallSummary) => {
      const catalogItem = catalogById.get(extension.id);
      const unavailableCatalogItem =
        extension.packageType !== 'system' && extension.id.startsWith('system-') && Boolean(catalog) && !catalogIds.has(extension.id);
      return Boolean(
        extension.status === 'invalid' ||
        extension.healthError ||
        extension.buildError ||
        extension.diagnostics?.length ||
        catalogItem?.updateAvailable ||
        unavailableCatalogItem,
      );
    },
    [catalog, catalogById, catalogIds],
  );

  const visibleExtensions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return installedExtensions
      .filter((extension) => {
        if (activeFilter === 'platform' && !isLocked(extension)) return false;
        if (activeFilter === 'all' && isLocked(extension)) return false;
        if (activeFilter === 'attention' && !extensionHasIssue(extension)) return false;
        if (!normalizedQuery) return true;
        return `${extension.name} ${extension.id} ${extension.description ?? ''} ${(extension.skills ?? [])
          .map((skill) => `${skill.name} ${skill.description ?? ''}`)
          .join(' ')}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftRank = extensionHasIssue(left) ? 0 : left.enabled ? 2 : 1;
        const rightRank = extensionHasIssue(right) ? 0 : right.enabled ? 2 : 1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return extensionSortLabel(left).localeCompare(extensionSortLabel(right));
      });
  }, [activeFilter, extensionHasIssue, installedExtensions, query]);

  const visibleCatalogExtensions = useMemo(() => {
    const installedIds = new Set(extensions.map((extension) => extension.id));
    const items = catalog?.extensions ?? [];
    return items.filter((item) => {
      if (installedIds.has(item.id) || item.installed) return false;
      if (item.packageType && item.packageType !== 'extension') return false;
      return true;
    });
  }, [catalog, extensions]);

  const visiblePlatformExtensionCount = installedExtensions.filter(isLocked).length;
  const sectionSummary = [
    `${visibleExtensions.length} installed`,
    `${visibleExtensions.filter((extension) => extension.enabled).length} enabled`,
    activeFilter === 'platform' && visiblePlatformExtensionCount ? `${visiblePlatformExtensionCount} platform` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const hasSearchQuery = query.trim().length > 0;
  const emptyVisibleExtensionsTitle = hasSearchQuery
    ? 'No matching apps'
    : activeFilter === 'platform'
      ? 'No platform apps'
      : activeFilter === 'attention'
        ? 'No apps need attention'
        : 'No matching apps';
  const emptyVisibleExtensionsBody = hasSearchQuery
    ? 'Clear search to show all installed apps.'
    : activeFilter === 'platform'
      ? 'Required platform surfaces appear here when they are installed.'
      : activeFilter === 'attention'
        ? 'Diagnostics, updates, invalid state, and catalog drift will appear here.'
        : 'Clear search to show all installed apps.';

  const startExtensionBuildConversation = useCallback(() => {
    navigate('/conversations/new', { state: { suppressOnboardingAutoStart: true } });
    window.setTimeout(() => draftComposerTextWhenReady(BUILD_EXTENSION_PROMPT), 0);
  }, [navigate]);

  const selectedExtension = detailsExtensionId
    ? (visibleExtensions.find((extension) => extension.id === detailsExtensionId) ?? null)
    : null;
  const selectedExtensionCatalogItem = selectedExtension ? catalog?.extensions.find((item) => item.id === selectedExtension.id) : undefined;
  const selectedExtensionBusy = selectedExtension ? busyId === selectedExtension.id : false;

  const filterItems: Array<{ id: ExtensionFilter; label: string; meta: string }> = [
    { id: 'all', label: 'Installed', meta: `${installedExtensions.filter((extension) => !isLocked(extension)).length}` },
    { id: 'platform', label: 'Platform', meta: `${visiblePlatformExtensionCount}` },
    { id: 'attention', label: 'Attention', meta: `${installedExtensions.filter(extensionHasIssue).length}` },
  ];

  return (
    <>
      <WindowedPageShell layout="standard" className="extension-manager-page-windowed">
        <WindowedPageMain
          title="App Manager"
          actions={
            <>
              <WindowedSegmentedControl
                ariaLabel="App view"
                accent="extensions"
                value={activeFilter}
                options={filterItems.map((item) => ({ id: item.id, label: `${item.label} ${item.meta}` }))}
                onChange={(value) => setActiveFilter(value as ExtensionFilter)}
              />
              <WindowedPageButton
                disabled={busyId === 'update-all'}
                onClick={() => {
                  notifyExtensionRegistryChanged();
                  void load();
                  loadCatalog();
                }}
              >
                Reload
              </WindowedPageButton>
              {updatableExtensions.length ? (
                <WindowedPageButton disabled={busyId !== null} onClick={() => void updateAllExtensions()}>
                  {busyId === 'update-all' ? 'Updating' : `Update all (${updatableExtensions.length})`}
                </WindowedPageButton>
              ) : null}
              <WindowedPageButton
                tone="accent"
                disabled={busyId === 'update-all'}
                data-onboarding-target="build-extension"
                onClick={startExtensionBuildConversation}
              >
                Build with agent
              </WindowedPageButton>
              <WindowedPageButton aria-label="Install app" disabled={busyId === 'update-all'} onClick={() => setInstallModalOpen(true)}>
                Install app
              </WindowedPageButton>
            </>
          }
        >
          <WindowedPageSection title="Sources" meta={`${catalogSources.length} sources`}>
            <WindowedKeyValueList
              items={[
                { label: 'Catalog', value: catalogError ? 'Unavailable' : catalog ? 'Loaded' : 'Loading' },
                { label: 'Available', value: `${visibleCatalogExtensions.length}` },
                { label: 'Visible', value: sectionSummary },
              ]}
            />
          </WindowedPageSection>

          <WindowedPageSection>
            <WindowedToolbar>
              <WindowedTextInput
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search apps…"
                aria-label="Search apps"
              />
            </WindowedToolbar>
          </WindowedPageSection>

          {notice ? (
            <WindowedPageSection>
              <WindowedExtensionNoticeBox notice={notice} />
            </WindowedPageSection>
          ) : null}

          {error ? (
            <WindowedPageSection>
              <WindowedStateBlock tone="danger">{error}</WindowedStateBlock>
            </WindowedPageSection>
          ) : null}

          {catalogError ? (
            <WindowedPageSection>
              <WindowedStateBlock tone="danger" title="Could not load installable apps">
                {catalogError}
              </WindowedStateBlock>
            </WindowedPageSection>
          ) : null}

          <WindowedPageSection title="Installed" meta={sectionSummary}>
            {loading ? (
              <WindowedLoadingState label="Loading apps" />
            ) : extensions.length === 0 ? (
              <WindowedEmptyState title="Add capabilities to Neon Pilot.">
                Apps add native pages, tools, settings, skills, and workflow surfaces.
              </WindowedEmptyState>
            ) : visibleExtensions.length === 0 ? (
              <WindowedEmptyState title={emptyVisibleExtensionsTitle}>{emptyVisibleExtensionsBody}</WindowedEmptyState>
            ) : (
              <WindowedDataTable
                columns={[{ label: 'App' }, { label: 'Status' }, { label: 'Controls', align: 'right' }]}
                columnTemplate="minmax(16rem, 1fr) minmax(8rem, 0.42fr) minmax(14rem, 0.72fr)"
              >
                {visibleExtensions.map((extension) => {
                  const route = firstRoute(extension);
                  const busy = busyId === extension.id;
                  const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
                  const unavailableCatalogItem =
                    extension.packageType !== 'system' && extension.id.startsWith('system-') && Boolean(catalog) && !catalogItem;
                  const showEnablement = activeFilter !== 'platform' && extension.status !== 'invalid';
                  return (
                    <WindowedDataRow
                      key={extension.id}
                      name={extension.name}
                      meta={`${extensionSourceLabel(extension)} · ${formatAppearsInSummary(extension)}`}
                      status={
                        <span className="wos-status-stack">
                          <WindowedBadge tone={extensionStatusTone(extension, unavailableCatalogItem)}>
                            {extensionStatusLabel(extension, unavailableCatalogItem)}
                          </WindowedBadge>
                          {unavailableCatalogItem ? (
                            <span className="wos-status-note" data-tone="danger">
                              Unavailable
                            </span>
                          ) : catalogItem?.updateAvailable ? (
                            <span className="wos-status-note" data-tone="accent">
                              Update available: {catalogItem.installedVersion ?? extension.version ?? 'installed'}
                              {' -> '}
                              {catalogItem.availableVersion ?? catalogItem.version}
                            </span>
                          ) : (extension.healthError ?? extension.buildError ?? extension.diagnostics?.[0]) ? (
                            <span className="wos-status-note" data-tone="danger">
                              {extension.healthError ?? extension.buildError ?? extension.diagnostics?.[0]}
                            </span>
                          ) : null}
                        </span>
                      }
                      action={
                        <span className="wos-inline-actions">
                          {showEnablement ? (
                            <WindowedToggle
                              checked={extension.enabled}
                              disabled={busy || isLocked(extension)}
                              label={`${extension.enabled ? 'Disable' : 'Enable'} ${extension.name}`}
                              accent="extensions"
                              onChange={() => toggleExtension(extension)}
                            />
                          ) : null}
                          <WindowedPageButton
                            aria-label={`Details for ${extension.name}`}
                            title={`Details for ${extension.name}`}
                            density="icon"
                            onClick={() => selectExtension(extension)}
                          >
                            <DetailsIcon />
                          </WindowedPageButton>
                          {route && extension.enabled ? (
                            <WindowedPageButton
                              aria-label={`Open ${extension.name}`}
                              title={`Open ${extension.name}`}
                              density="icon"
                              onClick={() => navigate(route)}
                            >
                              <OpenIcon />
                            </WindowedPageButton>
                          ) : null}
                        </span>
                      }
                      selected={selectedExtension?.id === extension.id}
                      accent="extensions"
                      onSelect={() => selectExtension(extension)}
                    />
                  );
                })}
              </WindowedDataTable>
            )}
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowedPageShell>

      {installModalOpen ? (
        <WindowedInstallExtensionDialog
          catalogItems={visibleCatalogExtensions}
          catalogSources={catalogSources}
          catalogSourceInput={catalogSourceInput}
          catalogSourceErrors={catalog?.sourceErrors ?? []}
          catalogBusyId={busyId}
          onCatalogSourceInputChange={setCatalogSourceInput}
          onInstallCatalog={(item) => void installCatalogExtension(item)}
          onAddCatalogSource={() => void addCatalogSource()}
          onRemoveCatalogSource={(source) => void removeCatalogSource(source)}
          onClose={() => setInstallModalOpen(false)}
        />
      ) : null}

      {selectedExtension ? (
        <WindowedDialog
          title={selectedExtension.name}
          meta={`${extensionStatusLabel(selectedExtension)} · ${extensionSourceLabel(selectedExtension)}`}
          accent="extensions"
          parentWindowTitle="App Manager"
          onClose={() => setDetailsExtensionId(null)}
          actions={
            <>
              {selectedExtensionBusy ? <span className="wos-app-detail-busy">Working</span> : null}
              {firstRoute(selectedExtension) && selectedExtension.enabled ? (
                <WindowedPageButton
                  disabled={selectedExtensionBusy}
                  onClick={() => {
                    navigate(firstRoute(selectedExtension)!);
                    setDetailsExtensionId(null);
                  }}
                >
                  Open
                </WindowedPageButton>
              ) : null}
              {hasExtensionSettings(selectedExtension) ? (
                <WindowedPageButton
                  disabled={selectedExtensionBusy}
                  onClick={() => {
                    navigate(extensionSettingsTarget(selectedExtension));
                    setDetailsExtensionId(null);
                  }}
                >
                  Settings
                </WindowedPageButton>
              ) : null}
              {selectedExtension.packageRoot ? (
                <WindowedPageButton disabled={selectedExtensionBusy} onClick={() => openFolder(selectedExtension)}>
                  Folder
                </WindowedPageButton>
              ) : null}
              {selectedExtension.packageType !== 'system' && pa.extensions?.callAction ? (
                <WindowedPageButton disabled={selectedExtensionBusy} onClick={() => void diagnoseExtension(selectedExtension)}>
                  Diagnose
                </WindowedPageButton>
              ) : null}
              {selectedExtensionCatalogItem?.updateAvailable && selectedExtension.packageType !== 'system' ? (
                <WindowedPageButton disabled={selectedExtensionBusy} onClick={() => void updateExtension(selectedExtension)}>
                  Update
                </WindowedPageButton>
              ) : null}
              {selectedExtensionCatalogItem && selectedExtension.packageType !== 'system' ? (
                <WindowedPageButton disabled={selectedExtensionBusy} onClick={() => void reinstallExtension(selectedExtension)}>
                  Reinstall
                </WindowedPageButton>
              ) : null}
              {canDeleteExtension(selectedExtension) ? (
                <WindowedPageButton tone="danger" disabled={selectedExtensionBusy} onClick={() => void deleteExtension(selectedExtension)}>
                  Delete
                </WindowedPageButton>
              ) : null}
            </>
          }
        >
          <div className="wos-app-detail-grid">
            <WindowedKeyValueList
              items={[
                { label: 'State', value: extensionStatusLabel(selectedExtension) },
                { label: 'Source', value: extensionSourceLabel(selectedExtension) },
                { label: 'Version', value: selectedExtension.version ? `v${selectedExtension.version}` : 'Unknown' },
                { label: 'Settings', value: hasExtensionSettings(selectedExtension) ? 'Configurable' : 'None' },
              ]}
            />
            <WindowedKeyValueList
              items={[
                { label: 'Appears in', value: formatAppearsInSummary(selectedExtension) },
                { label: 'Skills', value: formatSkillSummary(selectedExtension) || 'None' },
                { label: 'Tools', value: formatToolSummary(selectedExtension) || 'None' },
              ]}
            />
            {selectedExtension.description ? <p className="wos-app-detail-description">{selectedExtension.description}</p> : null}
            {selectedExtension.permissionState && selectedExtension.permissionState.length > 0 ? (
              <div className="wos-app-detail-permissions">
                <span className="wos-field-label">Permissions</span>
                <WindowedDataTable
                  columns={[{ label: 'Permission' }, { label: 'State' }, { label: '', align: 'right' }]}
                  columnTemplate="minmax(12rem, 1fr) minmax(6rem, 0.35fr) minmax(10rem, 0.5fr)"
                >
                  {selectedExtension.permissionState.map((ps) => {
                    const busy = selectedExtensionBusy || busyId === `permission:${selectedExtension.id}`;
                    return (
                      <WindowedDataRow
                        key={ps.permission}
                        name={formatPermissionLabel(ps.permission)}
                        meta={ps.permission}
                        status={
                          <WindowedBadge tone={ps.granted ? 'positive' : 'neutral'}>{ps.granted ? 'Granted' : 'Revoked'}</WindowedBadge>
                        }
                        action={
                          ps.locked ? (
                            <span className="text-dim text-[11px]">Required by system</span>
                          ) : (
                            <WindowedToggle
                              checked={ps.granted}
                              disabled={busy}
                              accent="extensions"
                              label={`${ps.granted ? 'Revoke' : 'Grant'} ${ps.permission}`}
                              onChange={() => togglePermission(selectedExtension, ps.permission, !ps.granted)}
                            />
                          )
                        }
                      />
                    );
                  })}
                </WindowedDataTable>
              </div>
            ) : null}
          </div>
        </WindowedDialog>
      ) : null}
    </>
  );
}
function WindowedInstallExtensionDialog({
  catalogItems,
  catalogSources,
  catalogSourceInput,
  catalogSourceErrors,
  catalogBusyId,
  onCatalogSourceInputChange,
  onInstallCatalog,
  onAddCatalogSource,
  onRemoveCatalogSource,
  onClose,
}: {
  catalogItems: InstallableExtensionCatalogItem[];
  catalogSources: ExtensionCatalogSource[];
  catalogSourceInput: string;
  catalogSourceErrors: Array<{ sourceId: string; message: string }>;
  catalogBusyId: string | null;
  onCatalogSourceInputChange: (source: string) => void;
  onInstallCatalog: (item: InstallableExtensionCatalogItem) => void;
  onAddCatalogSource: () => void;
  onRemoveCatalogSource: (source: ExtensionCatalogSource) => void;
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

  return (
    <WindowedDialog
      title="Install app"
      meta={`${catalogItems.length} available · ${catalogSources.length} sources`}
      accent="extensions"
      parentWindowTitle="App Manager"
      className="wos-app-install-dialog"
      onClose={onClose}
    >
      <div className="wos-app-install">
        <WindowedPageSection title="Repositories" meta={`${catalogSources.length}`}>
          <WindowedToolbar>
            <WindowedTextInput
              value={catalogSourceInput}
              onChange={(event) => onCatalogSourceInputChange(event.currentTarget.value)}
              placeholder="GitHub URL or owner/name"
              aria-label="App repository"
            />
            <WindowedPageButton disabled={catalogBusyId === 'extension-source'} onClick={onAddCatalogSource}>
              {catalogBusyId === 'extension-source' ? 'Adding' : 'Add'}
            </WindowedPageButton>
          </WindowedToolbar>
          {catalogSources.length > 0 ? (
            <WindowedDataTable
              columns={[{ label: 'Source' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}
              columnTemplate="minmax(15rem, 1fr) minmax(6.5rem, 0.38fr) minmax(6rem, 0.34fr)"
            >
              {catalogSources.map((source) => (
                <WindowedDataRow
                  key={source.id}
                  name={sourceLabel(source)}
                  meta={`${source.owner}/${source.repo}`}
                  status={
                    <WindowedBadge tone={source.enabled ? 'positive' : 'neutral'}>{source.enabled ? 'Enabled' : 'Disabled'}</WindowedBadge>
                  }
                  action={
                    source.id !== 'neon-pilot' ? (
                      <WindowedPageButton
                        disabled={catalogBusyId === `extension-source:${source.id}`}
                        onClick={() => onRemoveCatalogSource(source)}
                      >
                        Remove
                      </WindowedPageButton>
                    ) : (
                      <span aria-hidden="true" />
                    )
                  }
                />
              ))}
            </WindowedDataTable>
          ) : (
            <PanelMessage className="py-2">No repositories configured.</PanelMessage>
          )}
          {catalogSourceErrors.length ? (
            <div className="wos-app-install__errors">
              {catalogSourceErrors.map((error) => (
                <p key={`${error.sourceId}:${error.message}`}>
                  {error.sourceId}: {error.message}
                </p>
              ))}
            </div>
          ) : null}
        </WindowedPageSection>

        <WindowedPageSection title="Available apps" meta={`${visibleCatalogItems.length}`}>
          <WindowedTextInput
            value={marketplaceQuery}
            onChange={(event) => setMarketplaceQuery(event.currentTarget.value)}
            placeholder="Search apps"
            aria-label="Search available apps"
          />
          {catalogItems.length ? (
            <WindowedDataTable
              columns={[{ label: 'App' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}
              columnTemplate="minmax(16rem, 1fr) minmax(7rem, 0.38fr) minmax(6rem, 0.34fr)"
            >
              {visibleCatalogItems.map((item) => {
                const itemBusy = catalogBusyId === item.id;
                const plannedPackage = Boolean(item.packageType && item.packageType !== 'extension' && !item.packageSource);
                const unavailablePackage = plannedPackage || Boolean(item.unavailableReason);
                const state = itemBusy
                  ? 'Installing'
                  : item.installed
                    ? 'Installed'
                    : item.unavailableReason
                      ? 'Unavailable'
                      : plannedPackage
                        ? 'Planned'
                        : 'Available';
                const tone: 'neutral' | 'positive' | 'warning' =
                  item.installed || itemBusy ? 'positive' : unavailablePackage ? 'warning' : 'neutral';
                const itemMeta = [
                  item.description || item.id,
                  item.compatibilityWarning,
                  item.unavailableReason,
                  item.permissions?.length ? `Capabilities: ${formatPermissionsSummary(item.permissions).join(', ')}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <WindowedDataRow
                    key={item.id}
                    name={item.name}
                    meta={itemMeta}
                    status={<WindowedBadge tone={tone}>{state}</WindowedBadge>}
                    action={
                      <WindowedPageButton
                        disabled={item.installed || itemBusy || unavailablePackage}
                        onClick={() => onInstallCatalog(item)}
                      >
                        {state === 'Available' ? 'Install' : state}
                      </WindowedPageButton>
                    }
                  />
                );
              })}
            </WindowedDataTable>
          ) : (
            <PanelMessage className="py-2">No installable apps found.</PanelMessage>
          )}
          {catalogItems.length > 0 && visibleCatalogItems.length === 0 ? (
            <PanelMessage className="py-2">No app matches.</PanelMessage>
          ) : null}
        </WindowedPageSection>
      </div>
    </WindowedDialog>
  );
}
