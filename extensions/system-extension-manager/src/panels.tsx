import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import type { ExtensionInstallSummary } from '@neon-pilot/extensions/data';
import { api, EXTENSION_REGISTRY_CHANGED_EVENT, notifyExtensionRegistryChanged } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  CardBody,
  CodeBlock,
  CompactCard,
  cx,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Dialog,
  DialogBody,
  DialogHeader,
  Disclosure,
  EmptyState,
  ErrorState,
  IconButton,
  IconLink,
  KeyValueItem,
  KeyValueList,
  LoadingState,
  MenuItem,
  MenuShell,
  Notice,
  PanelMessage,
  ResourceList,
  ResourceListRow,
  SearchInput,
  SectionLabel,
  Stat,
  StatGrid,
  StatusDot,
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
  compatibilityWarning?: string;
  unavailableReason?: string;
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

type ExtensionFilter = 'all' | 'platform' | 'attention';
type ExtensionActionBridge = ExtensionSurfaceProps['pa']['extensions'];
type ExtensionManagerNotice = { type: 'info' | 'success' | 'error'; message: string; details?: string };

const ACTIONS_MENU_VIEWPORT_MARGIN = 8;
const ACTIONS_MENU_BUTTON_GAP = 8;
const BUILD_EXTENSION_PROMPT = `I want to build a Neon Pilot extension. Use the local-extension-development skill to guide me through it.

Start by interviewing me before you write code. Ask focused questions until you understand the workflow I want, who it is for, what the first version should do, where it should live in Neon Pilot, and what empty, loading, error, and success states it needs.

Then write a short UX brief. If the extension has UI, make a quick visual prototype or artifact using Neon Pilot's UI patterns so I can react before implementation.

After I approve the direction, build the extension, reload it, test the real app path, and keep iterating with me until it feels right.`;
const COMPOSER_DRAFT_RETRY_MS = 100;
const COMPOSER_DRAFT_MAX_ATTEMPTS = 20;

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
  const canDelete = extension.uninstallable === true || extension.packageType !== 'system';
  const hasActions = Boolean(extension.packageRoot || onUpdate || onReinstall || canDelete);

  if (!hasActions) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative flex h-7 w-7 shrink-0 items-center justify-center" onClick={(event) => event.stopPropagation()}>
      <IconButton
        ref={buttonRef}
        compact
        className="h-7 w-7 shrink-0"
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
                bottom: 'auto',
                left: 'auto',
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
                  Delete
                </MenuItem>
              ) : null}
            </MenuShell>,
            document.body,
          )
        : null}
    </div>
  );
}

const FALLBACK_LOCKED_EXTENSION_IDS = [
  'system-extension-manager',
  'system-prompt-assembly',
  'system-runs',
  'system-settings',
  'system-terminal',
];

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

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 1.8 9.3 5.9 13.2 8 9.3 10.1 8 14.2 6.7 10.1 2.8 8 6.7 5.9 8 1.8Z" />
      <path d="M13 1.8v3" />
      <path d="M11.5 3.3h3" />
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

function extensionSettingsSectionId(_extension: ExtensionInstallSummary): string {
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
  return labels.length ? labels.join(' · ') : 'Background capability';
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
          placeholder="GitHub URL or owner/name"
        />
        <Button variant="action" className="px-3 py-2 text-[13px]" disabled={busyId === 'extension-source'} onClick={onAdd}>
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
                  className="px-3 py-1.5 text-[12px]"
                  disabled={busyId === `extension-source:${source.id}`}
                  onClick={() => onRemove(source)}
                >
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
      showError('Extension source must be a GitHub URL or owner/name.');
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
  const [compactExtensionsLayout, setCompactExtensionsLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 1024,
  );
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
    const updateLayout = () => setCompactExtensionsLayout(window.innerWidth < 1024);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const installCatalogExtension = useCallback(
    async (item: InstallableExtensionCatalogItem) => {
      setBusyId(item.id);
      setNotice({ type: 'info', message: `Installing ${item.name} from ${item.marketplaceSourceId ?? item.tag}...` });
      try {
        if (item.packageType && item.packageType !== 'extension') {
          throw new Error('Agent capability packages are installed from Settings → Agent capability packages.');
        }
        await pa.extensions.callAction('system-extension-manager', 'installCatalogExtension', { id: item.id });
        setNotice({ type: 'success', message: `Installed ${item.name}. Enable it from the extensions list when you're ready.` });
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
      showActionError('Extension source must be a GitHub URL or owner/name.');
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
        showActionError('Extension manifest is invalid.', extension.errors?.[0]);
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
      if (extension.uninstallable !== true && extension.packageType === 'system') return;
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

  const sectionTitle = activeFilter === 'attention' ? 'Needs Attention' : activeFilter === 'platform' ? 'Platform' : 'Extensions';
  const hasSearchQuery = query.trim().length > 0;
  const emptyVisibleExtensionsTitle = hasSearchQuery
    ? 'No matching extensions'
    : activeFilter === 'platform'
      ? 'No platform extensions'
      : activeFilter === 'attention'
        ? 'No extensions need attention'
        : 'No matching extensions';
  const emptyVisibleExtensionsBody = hasSearchQuery
    ? 'Clear search to show all installed extensions.'
    : activeFilter === 'platform'
      ? 'Required platform surfaces appear here when they are installed.'
      : activeFilter === 'attention'
        ? 'Diagnostics, updates, invalid state, and catalog drift will appear here.'
        : 'Clear search to show all installed extensions.';

  const renderExtensionActions = (
    extension: ExtensionInstallSummary,
    busy: boolean,
    catalogItem: InstallableExtensionCatalogItem | undefined,
    route: string | null,
  ) => (
    <DataTableActionGroup className="min-w-[9rem] shrink-0">
      {busy ? <span className="shrink-0 text-[11px] text-dim">Working…</span> : null}
      {route && extension.enabled ? (
        <IconLink
          compact
          className="h-7 w-7 shrink-0"
          href={route}
          title={`Open ${extension.name}`}
          aria-label={`Open ${extension.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            navigate(route);
          }}
        >
          <OpenIcon />
        </IconLink>
      ) : null}
      {hasExtensionSettings(extension) ? (
        <IconLink
          compact
          className="h-7 w-7 shrink-0"
          href={`/settings#${extensionSettingsSectionId(extension)}`}
          title={`Configure ${extension.name} in Settings`}
          aria-label={`Configure ${extension.name} in Settings`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            navigate(`/settings#${extensionSettingsSectionId(extension)}`);
          }}
        >
          <GearIcon />
        </IconLink>
      ) : null}
      <IconButton
        compact
        className="h-7 w-7 shrink-0"
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
        onUpdate={catalogItem?.updateAvailable && extension.packageType !== 'system' ? () => void updateExtension(extension) : undefined}
        onReinstall={catalogItem && extension.packageType !== 'system' ? () => void reinstallExtension(extension) : undefined}
      />
    </DataTableActionGroup>
  );

  const renderExtensionRows = (items: ExtensionInstallSummary[], options: { showEnablement: boolean }) =>
    items.map((extension) => {
      const route = firstRoute(extension);
      const busy = busyId === extension.id;
      const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
      const unavailableCatalogItem =
        extension.packageType !== 'system' && extension.id.startsWith('system-') && Boolean(catalog) && !catalogItem;
      const selected = detailsExtensionId === extension.id;
      return (
        <DataTableRow
          key={`installed:${extension.id}`}
          className={cx('group cursor-default', selected && 'ui-selected-row-accent')}
          onClick={() => setDetailsExtensionId(extension.id)}
        >
          <DataTableCell className="min-w-0 py-3 pl-0 pr-6">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <TextButton className="truncate text-left text-[14px] font-semibold" onClick={() => setDetailsExtensionId(extension.id)}>
                  {extension.name}
                </TextButton>
                <span className="shrink-0 text-[11px] text-dim">{extensionSourceLabel(extension)}</span>
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
              {catalogItem?.updateAvailable ? (
                <div className="mt-1 text-[12px] text-accent">
                  Update available: {catalogItem.installedVersion ?? extension.version ?? 'installed'}
                  {' -> '}
                  {catalogItem.availableVersion ?? catalogItem.version}
                </div>
              ) : null}
            </div>
          </DataTableCell>
          <DataTableCell className="whitespace-nowrap py-3 text-[12px]">
            <span className={extensionStatusClass(extension, unavailableCatalogItem)}>
              {extensionStatusLabel(extension, unavailableCatalogItem)}
            </span>
          </DataTableCell>
          <DataTableCell className="py-3 text-[12px] leading-5 text-secondary">{formatAppearsInSummary(extension)}</DataTableCell>
          {options.showEnablement ? (
            <DataTableCell className="whitespace-nowrap py-3">
              {extension.status === 'invalid' ? (
                <span className="text-[12px] text-danger">Invalid</span>
              ) : (
                <StatusToggle extension={extension} busy={busy} onToggle={() => toggleExtension(extension)} />
              )}
            </DataTableCell>
          ) : null}
          <DataTableCell className="w-40 min-w-40 py-3 pr-0 text-right">
            {renderExtensionActions(extension, busy, catalogItem, route)}
          </DataTableCell>
        </DataTableRow>
      );
    });

  const renderExtensionCards = (items: ExtensionInstallSummary[], options: { showEnablement: boolean }) => (
    <div className="divide-y divide-border-subtle border-y border-border-subtle lg:hidden">
      {items.map((extension) => {
        const route = firstRoute(extension);
        const busy = busyId === extension.id;
        const catalogItem = catalog?.extensions.find((item) => item.id === extension.id);
        const unavailableCatalogItem =
          extension.packageType !== 'system' && extension.id.startsWith('system-') && Boolean(catalog) && !catalogItem;
        const selected = detailsExtensionId === extension.id;
        return (
          <div
            key={`installed-card:${extension.id}`}
            className={cx('space-y-3 py-4', selected && 'ui-selected-row-accent px-3')}
            onClick={() => setDetailsExtensionId(extension.id)}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <TextButton className="text-left text-[14px] font-semibold" onClick={() => setDetailsExtensionId(extension.id)}>
                    {extension.name}
                  </TextButton>
                  <span className="text-[11px] text-dim">{extensionSourceLabel(extension)}</span>
                </div>
              </div>
              <span className={cx('shrink-0 text-[12px]', extensionStatusClass(extension, unavailableCatalogItem))}>
                {extensionStatusLabel(extension, unavailableCatalogItem)}
              </span>
            </div>
            {extension.status === 'invalid' || extension.healthError || extension.buildError || extension.diagnostics?.length ? (
              <div className="text-[12px] text-danger">
                {extension.status === 'invalid'
                  ? (extension.errors?.[0] ?? 'Invalid extension manifest.')
                  : (extension.healthError ?? extension.buildError ?? extension.diagnostics?.[0])}
              </div>
            ) : null}
            {unavailableCatalogItem ? (
              <div className="text-[12px] text-warning">No longer available from the installable extension catalog.</div>
            ) : null}
            {catalogItem?.updateAvailable ? (
              <div className="text-[12px] text-accent">
                Update available: {catalogItem.installedVersion ?? extension.version ?? 'installed'}
                {' -> '}
                {catalogItem.availableVersion ?? catalogItem.version}
              </div>
            ) : null}
            <div
              className={cx(
                'grid gap-3 sm:items-center',
                options.showEnablement ? 'sm:grid-cols-[minmax(0,1fr)_auto_auto]' : 'sm:grid-cols-[minmax(0,1fr)_auto]',
              )}
            >
              <div className="min-w-0 text-[12px] leading-5 text-secondary">{formatAppearsInSummary(extension)}</div>
              {options.showEnablement ? (
                <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                  {extension.status === 'invalid' ? (
                    <span className="text-[12px] text-danger">Invalid</span>
                  ) : (
                    <StatusToggle extension={extension} busy={busy} onToggle={() => toggleExtension(extension)} />
                  )}
                </div>
              ) : null}
              <div className="flex justify-start sm:justify-end" onClick={(event) => event.stopPropagation()}>
                {renderExtensionActions(extension, busy, catalogItem, route)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderExtensionTable = (items: ExtensionInstallSummary[], options: { showEnablement?: boolean } = {}) => {
    const showEnablement = options.showEnablement !== false;
    return compactExtensionsLayout ? (
      renderExtensionCards(items, { showEnablement })
    ) : (
      <DataTable className="overflow-auto" tableClassName="min-w-[58rem] table-fixed">
        <colgroup>
          <col className="w-[44%]" />
          <col className="w-[9rem]" />
          <col />
          {showEnablement ? <col className="w-[8rem]" /> : null}
          <col className="w-40" />
        </colgroup>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell className="pl-0">Extension</DataTableHeaderCell>
            <DataTableHeaderCell>Status</DataTableHeaderCell>
            <DataTableHeaderCell>Appears in</DataTableHeaderCell>
            {showEnablement ? <DataTableHeaderCell>Enabled</DataTableHeaderCell> : null}
            <DataTableHeaderCell className="pr-0 text-right">Actions</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>{renderExtensionRows(items, { showEnablement })}</DataTableBody>
      </DataTable>
    );
  };

  const startExtensionBuildConversation = useCallback(() => {
    navigate('/conversations/new', { state: { suppressOnboardingAutoStart: true } });
    window.setTimeout(() => draftComposerTextWhenReady(BUILD_EXTENSION_PROMPT), 0);
  }, [navigate]);

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
            shellClassName={embedded ? 'max-w-none px-0 py-0' : undefined}
            contentClassName={embedded ? 'space-y-6' : 'flex flex-col gap-7'}
          >
            {!embedded ? (
              <AppPageIntro
                title="Extensions"
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
                        className="min-h-9 px-3 py-2 text-[13px]"
                        disabled={busyId !== null}
                        onClick={() => void updateAllExtensions()}
                      >
                        {busyId === 'update-all' ? 'Updating...' : `Update all (${updatableExtensions.length})`}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      data-onboarding-target="build-extension"
                      className="min-h-9 px-3 py-2 text-[13px]"
                      disabled={busyId === 'update-all'}
                      onClick={startExtensionBuildConversation}
                    >
                      <span className="inline-flex items-center gap-2">
                        <SparkIcon />
                        Build with agent
                      </span>
                    </Button>
                    <Button
                      variant="action"
                      tone="accent"
                      className="min-h-9 px-3 py-2 text-[13px]"
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
                  ['platform', 'Platform'],
                  ['attention', 'Attention'],
                ] as const
              ).map(([id, label]) => (
                <TabButton key={id} active={activeFilter === id} onClick={() => setActiveFilter(id)}>
                  {label}
                </TabButton>
              ))}
            </TabList>

            {notice ? (
              <div className="sticky top-0 z-20 bg-base py-2">
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
                  <Button className="min-h-9 px-3 py-2 text-[13px]" disabled={busyId !== null} onClick={() => void updateAllExtensions()}>
                    {busyId === 'update-all' ? 'Updating...' : `Update all (${updatableExtensions.length})`}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  data-onboarding-target="build-extension"
                  className="min-h-9 px-3 py-2 text-[13px]"
                  disabled={busyId === 'update-all'}
                  onClick={startExtensionBuildConversation}
                >
                  <span className="inline-flex items-center gap-2">
                    <SparkIcon />
                    Build with agent
                  </span>
                </Button>
                <Button
                  variant="action"
                  tone="accent"
                  className="min-h-9 px-3 py-2 text-[13px]"
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
                  {activeFilter === 'all' ? null : <h2 className="text-[18px] font-semibold leading-tight text-primary">{sectionTitle}</h2>}
                  <p className={cx(activeFilter === 'all' ? 'text-[12px] text-secondary' : 'mt-1 text-[12px] text-secondary')}>
                    {sectionSummary}
                  </p>
                </div>
              </div>
              {extensions.length === 0 ? (
                <EmptyState title="No extensions installed" body="Install one from a source, or ask an agent to build one." />
              ) : visibleExtensions.length === 0 ? (
                <EmptyState title={emptyVisibleExtensionsTitle} body={emptyVisibleExtensionsBody} />
              ) : (
                renderExtensionTable(visibleExtensions, { showEnablement: activeFilter !== 'platform' })
              )}
            </section>
          </AppPageLayout>
        </div>
      </div>

      {installModalOpen ? (
        <InstallExtensionModal
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
      {selectedExtension ? <ExtensionDetailsModal extensionId={selectedExtension.id} onClose={() => setDetailsExtensionId(null)} /> : null}
    </>
  );
}

function InstallExtensionModal({
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
    <Dialog
      aria-label="Install extension"
      className="max-w-3xl bg-base"
      onClose={onClose}
      style={{
        width: 'min(52rem, calc(100vw - var(--neon-pilot-sidebar-offset, 0px) - 2rem))',
        maxHeight: 'min(44rem, calc(100vh - 7.5rem))',
        marginBlock: '2rem',
        marginInlineStart: 'var(--neon-pilot-sidebar-offset, 0px)',
        alignSelf: 'flex-start',
      }}
    >
      <DialogHeader
        title="Install Extension"
        description="Install native Neon Pilot extensions from configured extension repositories."
        className="px-6 py-4"
        actions={
          <IconButton type="button" onClick={onClose} aria-label="Close install dialog" title="Close">
            <CloseIcon />
          </IconButton>
        }
      />

      <DialogBody className="space-y-5 px-6 py-5">
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
              <SectionLabel>Available extensions</SectionLabel>
              <SearchInput
                className="h-8 min-w-0 bg-base text-[12px] sm:w-72"
                value={marketplaceQuery}
                onChange={(event) => setMarketplaceQuery(event.currentTarget.value)}
                placeholder="Search extensions"
              />
            </div>
            <ResourceList>
              {visibleCatalogItems.map((item) => {
                const itemBusy = catalogBusyId === item.id;
                const plannedPackage = Boolean(item.packageType && item.packageType !== 'extension' && !item.packageSource);
                const unavailablePackage = plannedPackage || Boolean(item.unavailableReason);
                return (
                  <ResourceListRow
                    key={item.id}
                    title={item.name}
                    detail={
                      <>
                        {item.description || 'Neon Pilot extension'}
                        {item.compatibilityWarning ? <span className="block text-warning">{item.compatibilityWarning}</span> : null}
                        {item.unavailableReason ? <span className="block text-warning">{item.unavailableReason}</span> : null}
                      </>
                    }
                    titleClassName="text-[13px]"
                    detailClassName="text-[12px] font-sans text-secondary"
                    actions={
                      <Button
                        variant="action"
                        className="px-3 py-1.5 text-[12px]"
                        disabled={item.installed || itemBusy || unavailablePackage}
                        onClick={() => onInstallCatalog(item)}
                      >
                        {itemBusy
                          ? 'Installing...'
                          : item.installed
                            ? 'Installed'
                            : item.unavailableReason
                              ? 'Unavailable'
                              : plannedPackage
                                ? 'Planned'
                                : 'Install'}
                      </Button>
                    }
                  />
                );
              })}
            </ResourceList>
            {visibleCatalogItems.length === 0 ? <PanelMessage className="py-2">No extension matches.</PanelMessage> : null}
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
    <Dialog
      aria-label="Extension details"
      className="max-w-3xl bg-base"
      onClose={onClose}
      style={{
        width: 'min(48rem, calc(100vw - var(--neon-pilot-sidebar-offset, 0px) - 2rem))',
        maxHeight: 'min(44rem, calc(100vh - 7.5rem))',
        marginBlock: '2rem',
        marginInlineStart: 'var(--neon-pilot-sidebar-offset, 0px)',
        alignSelf: 'flex-start',
      }}
    >
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
              <StatusDot tone={extension.status === 'invalid' ? 'danger' : extension.enabled ? 'success' : 'muted'} size="xs" />
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
                <Notice key={message} tone="danger" className="py-2">
                  {message}
                </Notice>
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

      <Disclosure summary="Raw manifest">
        <CodeBlock compact className="max-h-[22rem] overflow-auto">
          {JSON.stringify(extension.manifest, null, 2)}
        </CodeBlock>
      </Disclosure>
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
