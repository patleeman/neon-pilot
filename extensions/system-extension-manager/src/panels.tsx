import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import type { ExtensionInstallSummary } from '@neon-pilot/extensions/data';
import { api, EXTENSION_REGISTRY_CHANGED_EVENT, notifyExtensionRegistryChanged } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  CardBody,
  CompactCard,
  cx,
  Dialog,
  DialogBody,
  DialogHeader,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  MenuItem,
  MenuShell,
  Notice,
  PanelMessage,
  SearchInput,
  SectionLabel,
  Select,
  KeyValueItem,
  KeyValueList,
  Stat,
  StatGrid,
  Switch,
  TabButton,
  TabList,
  TextButton,
  TextInput,
} from '@neon-pilot/extensions/ui';
import { getDesktopBridge } from '@neon-pilot/extensions/workbench-browser';
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
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
  sourceRepo?: { owner: string; repo: string };
  bundleUrl?: string;
  packageSource?: string;
  defaultEnabled?: boolean;
  source?: 'github-release';
  installed: boolean;
  installedVersion?: string;
  enabled?: boolean;
  availableVersion?: string;
  updateAvailable?: boolean;
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

type MarketplaceBehaviorPackageType = 'skill' | 'instruction-pack' | 'agent' | 'template';
type MarketplaceBehaviorEcosystem = 'codex' | 'claude';
type ExtensionFilter = 'all' | 'attention';
type ExtensionActionBridge = ExtensionSurfaceProps['pa']['extensions'];
type ExtensionManagerNotice = { type: 'info' | 'success' | 'error'; message: string; details?: string };

const ACTIONS_MENU_VIEWPORT_MARGIN = 8;
const ACTIONS_MENU_BUTTON_GAP = 8;

interface ActionsMenuPosition {
  top: number;
  right: number;
  maxHeight: number;
  visibility?: CSSProperties['visibility'];
}

function ExtensionNoticeBox({ notice }: { notice: ExtensionManagerNotice }) {
  return (
    <Notice tone={notice.type === 'error' ? 'danger' : notice.type} title={notice.message}>
      {notice.details}
    </Notice>
  );
}

function calculateActionsMenuPosition({
  buttonRect,
  menuHeight,
  viewportWidth,
  viewportHeight,
}: {
  buttonRect: DOMRect;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}): ActionsMenuPosition {
  const margin = ACTIONS_MENU_VIEWPORT_MARGIN;
  const gap = ACTIONS_MENU_BUTTON_GAP;
  const availableBelow = viewportHeight - buttonRect.bottom - margin - gap;
  const availableAbove = buttonRect.top - margin - gap;
  const openAbove = menuHeight > availableBelow && availableAbove > availableBelow;
  const preferredTop = openAbove ? buttonRect.top - gap - menuHeight : buttonRect.bottom + gap;
  const maxHeight = Math.max(80, Math.floor(openAbove ? availableAbove : availableBelow));

  return {
    top: Math.max(margin, Math.min(preferredTop, viewportHeight - margin - Math.min(menuHeight, maxHeight))),
    right: Math.max(margin, viewportWidth - buttonRect.right),
    maxHeight,
  };
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

function ExtensionActionsMenu({
  extension,
  busy,
  onOpenFolder,
  onDelete,
  onUpdate,
  onReinstall,
}: {
  extension: ExtensionInstallSummary;
  busy: boolean;
  onOpenFolder: () => void;
  onDelete: () => void;
  onUpdate?: () => void;
  onReinstall?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<ActionsMenuPosition | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
      setMenuPosition({
        ...calculateActionsMenuPosition({
          buttonRect: rect,
          menuHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
        ...(menuHeight ? {} : { visibility: 'hidden' as const }),
      });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || menuPosition?.visibility !== 'hidden') return;
    const rect = buttonRef.current?.getBoundingClientRect();
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    if (!rect || !menuHeight) return;
    setMenuPosition(
      calculateActionsMenuPosition({
        buttonRect: rect,
        menuHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    );
  }, [open, menuPosition?.visibility]);

  const run = useCallback((event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    setOpen(false);
    action();
  }, []);
  const canDelete = extension.packageType !== 'system';

  return (
    <div ref={rootRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <IconButton
        ref={buttonRef}
        compact
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
      </IconButton>
      {open && menuPosition
        ? createPortal(
            <MenuShell
              ref={menuRef}
              className="fixed bottom-auto left-auto right-auto top-auto z-[70] mb-0 w-40"
              style={{
                top: menuPosition.top,
                right: menuPosition.right,
                maxHeight: menuPosition.maxHeight,
                overflowY: 'auto',
                visibility: menuPosition.visibility,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {extension.packageRoot ? (
                <MenuItem disabled={busy} onClick={(event) => run(event, onOpenFolder)}>
                  Open folder
                </MenuItem>
              ) : null}
              {onUpdate ? (
                <MenuItem disabled={busy} onClick={(event) => run(event, onUpdate)}>
                  Update
                </MenuItem>
              ) : null}
              {onReinstall ? (
                <MenuItem disabled={busy} onClick={(event) => run(event, onReinstall)}>
                  Reinstall
                </MenuItem>
              ) : null}
              {canDelete ? (
                <MenuItem tone="danger" disabled={busy} onClick={(event) => run(event, onDelete)}>
                  Uninstall
                </MenuItem>
              ) : null}
            </MenuShell>,
            document.body,
          )
        : null}
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
    <span
      className="inline-flex"
      onClick={(event) => {
        event.stopPropagation();
      }}
      title={locked ? 'This extension is required by the application.' : undefined}
    >
      <Switch
        checked={extension.enabled}
        disabled={busy || locked}
        onClick={onToggle}
        aria-label={`${extension.enabled ? 'Disable' : 'Enable'} ${extension.name}`}
        label={locked ? 'Always on' : undefined}
      />
    </span>
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

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.8v2" />
      <path d="M8 12.2v2" />
      <path d="m3.6 3.6 1.4 1.4" />
      <path d="m11 11 1.4 1.4" />
      <path d="M1.8 8h2" />
      <path d="M12.2 8h2" />
      <path d="m3.6 12.4 1.4-1.4" />
      <path d="m11 5 1.4-1.4" />
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

function extensionSettingsSectionId(extension: ExtensionInstallSummary): string {
  return 'settings-extensions';
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
  if (!extensions?.callAction) throw new Error('Extension source management is unavailable.');
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
          placeholder="GitHub repo URL or owner/repo"
        />
        <Button variant="action" className="px-3 py-2 text-[13px]" disabled={busyId === 'extension-source'} onClick={onAdd}>
          {busyId === 'extension-source' ? 'Adding...' : 'Add repo'}
        </Button>
      </div>
      <div className="divide-y divide-border-subtle/70 border-y border-border-subtle/70">
        {sources.map((source) => (
          <div key={source.id} className="flex items-center justify-between gap-3 py-2 text-[12px]">
            <div className="min-w-0">
              <div className="truncate font-medium text-primary">{sourceLabel(source)}</div>
              <div className="truncate text-dim">
                {source.owner}/{source.repo}
                {source.enabled ? '' : ' · disabled'}
              </div>
            </div>
            {source.id !== 'neon-pilot' ? (
              <Button
                variant="action"
                className="px-3 py-1.5 text-[12px]"
                disabled={busyId === `extension-source:${source.id}`}
                onClick={() => onRemove(source)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ))}
      </div>
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
      showError('Extension repository must be a GitHub repo URL or owner/repo.');
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
      showError('Failed to add extension repository', err instanceof Error ? err.message : String(err));
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
        showError('Failed to remove extension repository', err instanceof Error ? err.message : String(err));
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
      setNotice({ type: 'error', message, details });
      pa.ui.notify({ message, details, type: 'error', source: 'system-extension-manager' });
    },
    [pa],
  );

  const loadCatalog = useCallback(() => {
    setCatalogError(null);
    if (!pa.extensions?.callAction) {
      setCatalog({ ok: true, version: '', tag: '', extensions: [] });
      setCatalogSources([]);
      return;
    }
    void pa.extensions
      .callAction('system-extension-manager', 'listInstallableExtensions', {})
      .then((result) => setCatalog(result as InstallableExtensionCatalogResponse))
      .catch((err) => setCatalogError(err instanceof Error ? err.message : String(err)));
    void readExtensionSources(pa.extensions)
      .then((sources) => setCatalogSources(sources))
      .catch(() => setCatalogSources([]));
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

  const installCatalogExtension = useCallback(
    async (item: InstallableExtensionCatalogItem) => {
      setBusyId(item.id);
      setNotice({ type: 'info', message: `Installing ${item.name} from ${item.marketplaceSourceId ?? item.tag}...` });
      try {
        if (item.packageType && item.packageType !== 'extension') {
          await pa.extensions.callAction('system-extension-manager', 'installMarketplacePackage', {
            source: item.packageSource,
            ecosystem: item.ecosystem,
            packageType: item.packageType,
          });
          setNotice({ type: 'success', message: `Installed ${item.name} as an extension-backed package.` });
        } else {
          await pa.extensions.callAction('system-extension-manager', 'installCatalogExtension', { id: item.id });
          setNotice({ type: 'success', message: `Installed ${item.name}. Enable it from the extensions list when you're ready.` });
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
    setNotice({ type: 'info', message: 'Importing agent plugin package as a Neon Pilot extension...' });
    try {
      await pa.extensions.callAction('system-extension-manager', 'installMarketplacePackage', {
        source,
        ecosystem: marketplaceEcosystem,
        packageType: marketplacePackageType,
      });
      setNotice({ type: 'success', message: 'Installed agent plugin package as a Neon Pilot extension.' });
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

  const addCatalogSource = useCallback(async () => {
    const parsed = parseGithubCatalogSource(catalogSourceInput);
    if (!parsed) {
      showActionError('Extension repository must be a GitHub repo URL or owner/repo.');
      return;
    }
    const nextSources = [...catalogSources.filter((source) => repoKey(source) !== repoKey(parsed)), parsed];
    setBusyId('extension-source');
    try {
      await writeExtensionSources(pa.extensions, nextSources);
      setCatalogSourceInput('');
      setNotice({ type: 'success', message: `Added ${parsed.owner}/${parsed.repo} to extension repositories.` });
      loadCatalog();
    } catch (err) {
      showActionError('Failed to add extension repository', err instanceof Error ? err.message : String(err));
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
        setNotice({ type: 'success', message: `Removed ${source.owner}/${source.repo} from extension repositories.` });
        loadCatalog();
      } catch (err) {
        showActionError('Failed to remove extension repository', err instanceof Error ? err.message : String(err));
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
      const confirmed = await pa.ui.confirm({
        title: 'Delete extension',
        message: `Delete ${extension.name}? This removes the extension package from disk.`,
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
          navigate('/extensions', { replace: true });
        }
      } catch (err) {
        showActionError(`Failed to delete ${extension.name}`, err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [location.pathname, navigate, pa.ui, showActionError],
  );

  const reinstallExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.packageType === 'system') return;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      if (!catalogItem) return;
      const confirmed = await pa.ui.confirm({
        title: 'Reinstall extension',
        message: `Reinstall ${extension.name}? This removes the current package and installs it again from ${catalogItem.tag}.`,
      });
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

  const updateExtension = useCallback(
    async (extension: ExtensionInstallSummary) => {
      if (extension.packageType === 'system') return;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      if (!catalogItem?.updateAvailable) return;
      const targetVersion = catalogItem.availableVersion ?? catalogItem.version;
      const confirmed = await pa.ui.confirm({
        title: 'Update extension',
        message: `Update ${extension.name} from ${extension.version ?? 'installed'} to ${targetVersion} using ${catalogItem.tag}?`,
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
        setNotice({ type: 'error', message: result.error ?? extension.packageRoot ?? 'Could not open extension folder.' });
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
    const confirmed = await pa.ui.confirm({
      title: 'Update extensions',
      message: `Update ${updatableExtensions.length} extension${updatableExtensions.length === 1 ? '' : 's'} now?`,
    });
    if (!confirmed) return;

    setBusyId('update-all');
    setNotice({
      type: 'info',
      message: `Updating ${updatableExtensions.length} extension${updatableExtensions.length === 1 ? '' : 's'}...`,
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
      showActionError(`Updated ${updatedCount} extension${updatedCount === 1 ? '' : 's'}; ${failures.length} failed.`, failures.join('\n'));
      return;
    }

    setNotice({ type: 'success', message: `Updated ${updatedCount} extension${updatedCount === 1 ? '' : 's'}.` });
  }, [load, loadCatalog, pa.extensions, pa.ui, showActionError, updatableExtensions]);

  const visibleExtensions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return installedExtensions.filter((extension) => {
      const unavailableCatalogItem =
        extension.packageType !== 'system' && extension.id.startsWith('system-') && catalog && !catalogIds.has(extension.id);
      if (
        activeFilter === 'attention' &&
        !(
          extension.status === 'invalid' ||
          extension.healthError ||
          extension.buildError ||
          extension.diagnostics?.length ||
          catalog?.extensions.find((item) => item.id === extension.id)?.updateAvailable ||
          unavailableCatalogItem
        )
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return `${extension.name} ${extension.id} ${extension.description ?? ''} ${(extension.skills ?? [])
        .map((skill) => `${skill.name} ${skill.description ?? ''}`)
        .join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeFilter, catalog, catalogIds, installedExtensions, query]);

  const visibleCatalogExtensions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const installedIds = new Set(extensions.map((extension) => extension.id));
    const items = catalog?.packages ?? catalog?.extensions ?? [];
    return items.filter((item) => {
      if (installedIds.has(item.id) || item.installed) return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.id} ${item.description ?? ''} ${item.ecosystem ?? ''} ${item.packageType ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [catalog, extensions, query]);

  const sectionSummary = `${visibleExtensions.length} installed · ${visibleExtensions.filter((extension) => extension.enabled).length} enabled`;

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
              <CardBody as="div" className="mt-0.5 max-w-[42rem] whitespace-normal break-words">
                {extension.description || 'No description provided.'}
              </CardBody>
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
              {catalogItem?.updateAvailable ? (
                <div className="mt-1 text-[12px] text-accent">
                  Update available: {catalogItem.installedVersion ?? extension.version ?? 'installed'}
                  {' -> '}
                  {catalogItem.availableVersion ?? catalogItem.version}
                </div>
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
              {hasExtensionSettings(extension) ? (
                <Link
                  className="ui-icon-button ui-icon-button-compact"
                  to={`/settings#${extensionSettingsSectionId(extension)}`}
                  title={`Configure ${extension.name} in Settings`}
                  aria-label={`Configure ${extension.name} in Settings`}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <GearIcon />
                </Link>
              ) : null}
              <IconButton
                compact
                title={`Details for ${extension.name}`}
                aria-label={`Details for ${extension.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setDetailsExtensionId(extension.id);
                }}
              >
                <DetailsIcon />
              </IconButton>
              <ExtensionActionsMenu
                extension={extension}
                busy={busy}
                onOpenFolder={() => openFolder(extension)}
                onDelete={() => void deleteExtension(extension)}
                onUpdate={
                  catalogItem?.updateAvailable && extension.packageType !== 'system' ? () => void updateExtension(extension) : undefined
                }
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
                summary="Manage installed extensions and built-in capabilities."
                actions={
                  <div className="flex min-w-[26rem] items-center gap-2">
                    <SearchInput
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search extensions…"
                      className="h-9 w-72"
                    />
                    <IconButton
                      type="button"
                      aria-label="Reload extensions"
                      title="Reload extensions"
                      disabled={busyId === 'update-all'}
                      onClick={() => {
                        notifyExtensionRegistryChanged();
                        void load();
                        loadCatalog();
                      }}
                    >
                      <RefreshIcon />
                    </IconButton>
                    {updatableExtensions.length ? (
                      <Button
                        className="min-h-9 rounded-lg px-3 py-2 text-[13px]"
                        disabled={busyId !== null}
                        onClick={() => void updateAllExtensions()}
                      >
                        {busyId === 'update-all' ? 'Updating...' : `Update all (${updatableExtensions.length})`}
                      </Button>
                    ) : null}
                    <Button
                      variant="action"
                      tone="accent"
                      className="min-h-9 rounded-lg border-accent/40 bg-accent/15 px-3 py-2 text-[13px] hover:bg-accent/20"
                      disabled={busyId === 'update-all'}
                      onClick={() => setInstallModalOpen(true)}
                    >
                      Install
                    </Button>
                  </div>
                }
              />
            ) : null}

            <TabList ariaLabel="Extension filters" variant="underline">
              {(
                [
                  ['all', 'All'],
                  ['attention', 'Attention'],
                ] as const
              ).map(([id, label]) => (
                <TabButton key={id} active={activeFilter === id} onClick={() => setActiveFilter(id)}>
                  {label}
                </TabButton>
              ))}
            </TabList>

            {notice ? (
              <div className="sticky top-0 z-20 bg-base/95 py-2 backdrop-blur">
                <ExtensionNoticeBox notice={notice} />
              </div>
            ) : null}

            {catalogError ? <ErrorState title="Could not load installable extensions" message={catalogError} /> : null}

            {embedded ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SearchInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search extensions…"
                  className="w-full md:w-80"
                />
                <IconButton
                  type="button"
                  aria-label="Reload extensions"
                  title="Reload extensions"
                  disabled={busyId === 'update-all'}
                  onClick={() => {
                    notifyExtensionRegistryChanged();
                    void load();
                    loadCatalog();
                  }}
                >
                  <RefreshIcon />
                </IconButton>
                {updatableExtensions.length ? (
                  <Button
                    className="min-h-9 rounded-lg px-3 py-2 text-[13px]"
                    disabled={busyId !== null}
                    onClick={() => void updateAllExtensions()}
                  >
                    {busyId === 'update-all' ? 'Updating...' : `Update all (${updatableExtensions.length})`}
                  </Button>
                ) : null}
                <Button
                  variant="action"
                  tone="accent"
                  className="min-h-9 rounded-lg border-accent/40 bg-accent/15 px-3 py-2 text-[13px] hover:bg-accent/20"
                  disabled={busyId === 'update-all'}
                  onClick={() => setInstallModalOpen(true)}
                >
                  Install
                </Button>
              </div>
            ) : null}

            <section className="space-y-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[24px] font-semibold leading-tight text-primary">
                    {activeFilter === 'attention' ? 'Needs Attention' : 'Extensions'}
                  </h2>
                  <p className="mt-1 text-[12px] text-secondary">{sectionSummary}</p>
                </div>
              </div>
              {extensions.length === 0 ? (
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
          catalogSources={catalogSources}
          catalogSourceInput={catalogSourceInput}
          catalogSourceErrors={catalog?.sourceErrors ?? []}
          catalogBusyId={busyId}
          onSourceChange={setMarketplaceSource}
          onCatalogSourceInputChange={setCatalogSourceInput}
          onPackageTypeChange={setMarketplacePackageType}
          onInstall={() => void installMarketplaceSource()}
          onInstallCatalog={(item) => void installCatalogExtension(item)}
          onAddCatalogSource={() => void addCatalogSource()}
          onRemoveCatalogSource={(source) => void removeCatalogSource(source)}
          onClose={() => setInstallModalOpen(false)}
        />
      ) : null}
      {selectedExtension ? <ExtensionDetailsModal extensionId={selectedExtension.id} onClose={() => setDetailsExtensionId(null)} /> : null}
    </>
  );
}

function InstallExtensionModal({
  source,
  packageType,
  busy,
  catalogItems,
  catalogSources,
  catalogSourceInput,
  catalogSourceErrors,
  catalogBusyId,
  onSourceChange,
  onCatalogSourceInputChange,
  onPackageTypeChange,
  onInstall,
  onInstallCatalog,
  onAddCatalogSource,
  onRemoveCatalogSource,
  onClose,
}: {
  source: string;
  packageType: MarketplaceBehaviorPackageType;
  busy: boolean;
  catalogItems: InstallableExtensionCatalogItem[];
  catalogSources: ExtensionCatalogSource[];
  catalogSourceInput: string;
  catalogSourceErrors: Array<{ sourceId: string; message: string }>;
  catalogBusyId: string | null;
  onSourceChange: (source: string) => void;
  onCatalogSourceInputChange: (source: string) => void;
  onPackageTypeChange: (packageType: MarketplaceBehaviorPackageType) => void;
  onInstall: () => void;
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
    <Dialog
      aria-label="Install extension"
      className="max-w-3xl bg-base"
      onClose={onClose}
      style={{ marginBlock: '4rem', alignSelf: 'flex-start' }}
    >
      <DialogHeader
        title="Install Extension"
        description="Install a Neon Pilot extension or import an agent plugin as a Neon Pilot extension."
        className="px-6 py-4"
        actions={
          <IconButton type="button" onClick={onClose} aria-label="Close install dialog" title="Close">
            <CloseIcon />
          </IconButton>
        }
      />

      <DialogBody className="space-y-5 px-6 py-5">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <TextInput
            className="min-w-0 bg-base"
            value={source}
            onChange={(event) => onSourceChange(event.currentTarget.value)}
            placeholder="Extension, agent plugin, marketplace package, URL, or local path"
          />
          <Select
            className="bg-base"
            value={packageType}
            onChange={(event) => onPackageTypeChange(event.currentTarget.value as MarketplaceBehaviorPackageType)}
            aria-label="Package type"
          >
            <option value="skill">Plugin</option>
            <option value="instruction-pack">Instructions</option>
            <option value="agent">Agent</option>
            <option value="template">Template</option>
          </Select>
          <Button variant="action" className="px-3 py-2 text-[13px]" disabled={busy} onClick={onInstall}>
            {busy ? 'Installing...' : 'Install'}
          </Button>
        </div>
        <p className="text-[12px] leading-5 text-dim">
          Neon Pilot extensions install directly. Agent plugins, including Codex and Claude-style packages, are imported as extensions.
        </p>

        <section className="space-y-2">
          <SectionLabel>Extension repositories</SectionLabel>
          <ExtensionRepositoriesControl
            sources={catalogSources}
            sourceErrors={catalogSourceErrors}
            input={catalogSourceInput}
            busyId={catalogBusyId}
            onInputChange={onCatalogSourceInputChange}
            onAdd={onAddCatalogSource}
            onRemove={onRemoveCatalogSource}
          />
        </section>

        {catalogItems.length ? (
          <section className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SectionLabel>Marketplace</SectionLabel>
              <SearchInput
                className="h-8 min-w-0 bg-base text-[12px] sm:w-72"
                value={marketplaceQuery}
                onChange={(event) => setMarketplaceQuery(event.currentTarget.value)}
                placeholder="Search marketplace"
              />
            </div>
            <div className="max-h-[28rem] overflow-y-auto border-y border-border-subtle/70">
              <div className="divide-y divide-border-subtle/70">
                {visibleCatalogItems.map((item) => {
                  const itemBusy = catalogBusyId === item.id;
                  const unavailablePackage = Boolean(item.packageType && item.packageType !== 'extension' && !item.packageSource);
                  return (
                    <div key={item.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-primary">{item.name}</div>
                        <CardBody as="div" className="mt-0.5">
                          {item.description || packageKindLabel(item)}
                        </CardBody>
                      </div>
                      <Button
                        variant="action"
                        className="px-3 py-1.5 text-[12px]"
                        disabled={item.installed || itemBusy || unavailablePackage}
                        onClick={() => onInstallCatalog(item)}
                      >
                        {itemBusy ? 'Installing...' : item.installed ? 'Installed' : unavailablePackage ? 'Planned' : 'Install'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            {visibleCatalogItems.length === 0 ? <PanelMessage className="py-2">No marketplace matches.</PanelMessage> : null}
          </section>
        ) : null}
      </DialogBody>
    </Dialog>
  );
}

function extensionSettingsEntries(extension: ExtensionInstallSummary): Array<{ key: string; order: number }> {
  const contributes = extension.manifest?.contributes?.settings;
  const rawSettings = contributes && typeof contributes === 'object' && !Array.isArray(contributes) ? contributes : {};
  return Object.entries(rawSettings).map(([key, value]) => {
    const s = value as Record<string, unknown>;
    return {
      key,
      order: (s.order as number) ?? 0,
    };
  });
}

function ExtensionSettingsPointer({ extension }: { extension: ExtensionInstallSummary }) {
  const entries = extensionSettingsEntries(extension).sort((a, b) => a.order - b.order);
  const settingsComponent = extension.manifest?.contributes?.settingsComponent;
  const target = `/settings#${extensionSettingsSectionId(extension)}`;
  return (
    <CompactCard className="py-3" tone="surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardBody as="span">
          Configure {extension.name} from Settings{settingsComponent ? ` (${settingsComponent.label})` : ''}.
        </CardBody>
        <Link className="text-accent transition-colors hover:text-primary" to={target}>
          Open settings
        </Link>
      </div>
      {entries.length ? <div className="mt-2 font-mono text-[11px] text-dim">{entries.map((entry) => entry.key).join(', ')}</div> : null}
    </CompactCard>
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

  return (
    <Dialog aria-label="Extension details" className="max-w-3xl bg-base" onClose={onClose}>
      <DialogHeader
        title="Extension details"
        className="px-6 py-4"
        actions={
          <IconButton type="button" onClick={onClose} aria-label="Close details" title="Close">
            <CloseIcon />
          </IconButton>
        }
      />

      <DialogBody className="max-h-[72vh] px-6 py-5">
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
          />
        )}
      </DialogBody>
    </Dialog>
  );
}

function ExtensionDetailsContent({
  extension,
  notice,
  compact = false,
  onCopyDiagnostics,
  onOpenPath,
}: {
  extension: ExtensionInstallSummary;
  notice: string | null;
  compact?: boolean;
  onCopyDiagnostics: (extension: ExtensionInstallSummary) => Promise<void>;
  onOpenPath: (path: string) => void;
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
      {notice ? <CardBody>{notice}</CardBody> : null}

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
        <StatGrid compact={compact}>
          <Stat label="Source" value={extensionSourceLabel(extension)} />
          <Stat label="Status" value={healthLabel} />
          <Stat label="Version" value={extension.version ? `v${extension.version}` : 'Unknown'} />
          <Stat label="Settings" value={hasSettings ? 'Configurable' : 'None'} />
        </StatGrid>
      </header>

      {hasSettings ? (
        <DetailBlock title="Settings">
          <ExtensionSettingsPointer extension={extension} />
        </DetailBlock>
      ) : null}

      {extension.status === 'invalid' || extension.diagnostics?.length || extension.buildError ? (
        <DetailBlock
          title="Diagnostics"
          action={<TextButton onClick={() => void onCopyDiagnostics(extension)}>Copy diagnostics</TextButton>}
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
          <KeyValueList>
            {includeRows.map(([label, value]) => (
              <KeyValueItem key={label} label={label} value={value} />
            ))}
          </KeyValueList>
        </DetailBlock>
      ) : null}

      {informationRows.length || extension.packageRoot ? (
        <DetailBlock title="Information">
          <KeyValueList>
            {informationRows.map(([label, value]) => (
              <KeyValueItem key={label} label={label} value={value} />
            ))}
            {extension.packageRoot ? (
              <KeyValueItem
                label="Package"
                value={extension.packageRoot}
                action={<TextButton onClick={() => onOpenPath(extension.packageRoot!)}>Open</TextButton>}
              />
            ) : null}
          </KeyValueList>
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

function DetailBlock({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        {action}
      </div>
      {children}
    </section>
  );
}
