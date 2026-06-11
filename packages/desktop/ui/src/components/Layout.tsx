import { Component, type ReactNode, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import { OPEN_COMMAND_PALETTE_EVENT, type OpenCommandPaletteDetail } from '../commands/commandPaletteEvents';
import { COMPANION_CHAT_CLOSE_EVENT, COMPANION_CHAT_OPEN_EVENT, type CompanionChatOpenDetail } from '../companion/companionEvents';
import { getConversationArtifactIdFromSearch, setConversationArtifactIdInSearch } from '../conversation/conversationArtifacts';
import { readConversationIdFromPathname } from '../conversation/conversationRoutes';
import { DRAFT_CONVERSATION_ROUTE } from '../conversation/draftConversation';
import { startNewConversation } from '../conversation/newConversationNavigation';
import { DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT, isDesktopShell, readDesktopEnvironment } from '../desktop/desktopBridge';
import { DesktopChromeContext, type DesktopRightRailControl } from '../desktop/desktopChromeContext';
import { canExecuteExtensionCommand, executeExtensionCommand, setExtensionCommandContext } from '../extensions/commands';
import { EXTENSION_MODAL_CLOSE_COMMAND_EVENT } from '../extensions/extensionModalCommands';
import { EXTENSION_REGISTRY_CHANGED_EVENT } from '../extensions/extensionRegistryEvents';
import { findMatchingExtensionKeybinding } from '../extensions/keybindings';
import { NativeExtensionSurfaceHost } from '../extensions/NativeExtensionSurfaceHost';
import {
  type ExtensionCommandRegistration,
  type ExtensionKeybindingRegistration,
  type ExtensionRightToolPanelSurface,
  type ExtensionSurfaceSummary,
  getExtensionViewPlacement,
  isExtensionRightToolPanelSurface,
  isNativeExtensionPageSurface,
  isNativeExtensionRightRailSurface,
  isNativeExtensionWorkbenchSurface,
  type NativeExtensionViewSummary,
} from '../extensions/types';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { primeDesktopConversationStateCache, primeReservedDesktopConversationStateCache } from '../hooks/useDesktopConversationState';
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../local/localSettings';
import { type BrowserTabsState, readBrowserTabsState } from '../local/workbenchBrowserTabs';
import { attemptLazyRouteRecovery, isRecoverableLazyRouteError, lazyRouteWithRecovery } from '../navigation/lazyRouteRecovery';
import { routeIsKnowledge, routeMatchesPrefix, routeSupportsWorkbench } from '../navigation/routeRegistry';
import { readConversationLayout } from '../session/sessionTabs';
import type { DesktopEnvironmentState, SessionMeta } from '../shared/types';
import { useAllSessions, useSession } from '../store';
import { useRouteTelemetry } from '../telemetry/appTelemetry';
import { APP_LAYOUT_MODE_CHANGED_EVENT, type AppLayoutMode, readAppLayoutMode, writeAppLayoutMode } from '../ui-state/appLayoutMode';
import { clampPanelWidth, getRailInitialWidth, getRailLayoutPrefs, getRailMaxWidth } from '../ui-state/layoutSizing';
import { ARTIFACT_MODAL_COMMAND_EVENT, type ArtifactModalCommand } from './artifactModalCommands';
import {
  COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT,
} from './chat/composerAttachmentCommands';
import { registerPendingSideChatSession } from './chat/sideChatSessionReadiness';
import { useConversationArtifactSummaries } from './conversationArtifactHooks';
import { APP_NAVIGATION_COMMAND_EVENT, DesktopTopBar } from './DesktopTopBar';
import {
  CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT,
  CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT,
  CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT,
  CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT,
  CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT,
} from './conversation/conversationActivityCommands';
import {
  CONVERSATION_OPEN_ACTIVE_CHECKPOINT_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_CHECKPOINT_COMMAND_EVENT,
  CONVERSATION_SCROLL_FIRST_CHECKPOINT_FILE_COMMAND_EVENT,
} from './conversation/checkpointCommands';
import {
  DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT,
  DRAWING_PICKER_CLOSE_COMMAND_EVENT,
  DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT,
} from './conversation/drawingPickerCommands';
import { COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, COMPOSER_OPEN_SETTINGS_COMMAND_EVENT } from './conversation/composerSettingsCommands';
import { COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT } from './conversation/composerPreferenceCommands';
import { CONVERSATION_CANCEL_GOAL_COMMAND_EVENT } from './conversation/conversationGoalCommands';
import { CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT } from './conversation/conversationQueueCommands';
import { DRAFT_WORKSPACE_PICKER_CLOSE_COMMAND_EVENT } from './conversation/draftWorkspacePickerCommands';
import {
  IMAGE_PREVIEW_CLOSE_COMMAND_EVENT,
  IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT,
  IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT,
  type ImagePreviewCommandDetail,
} from './chat/imagePreviewCommands';
import { MESSAGE_ACTION_COMMAND_EVENT, type MessageActionCommandDetail } from './chat/messageActionCommands';
import { MESSAGE_EDIT_COMMAND_EVENT, type MessageEditCommand } from './chat/messageEditCommands';
import { WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT } from './workspaceQuickSelectCommands';
import {
  extensionToolPanelMode,
  findExtensionToolPanelBySlot,
  inferSurfaceToolSlot,
  isArtifactsRailMode,
  isNewWorkbenchTabMode,
  isSinglePaneWorkbenchMode,
  parseExtensionToolPanelMode,
  resolveActiveExtensionWorkbenchSurface,
  type WorkbenchRailMode,
} from './layout/workbenchRailModel';
import { NotificationBell } from './notifications/NotificationBell';
import { addNotification, NotificationProvider, useNotificationStore } from './notifications/notificationStore';
import {
  ActionTile,
  CenteredMessage,
  cx,
  IconButton,
  PanelMessage,
  SectionLabel,
  WorkbenchTab,
  WorkbenchTabButton,
  WorkbenchTabCloseButton,
} from './ui';
import { iconGlyphForExtensionSurface, labelForExtensionToolPanel, shouldRenderWorkbenchToolInNav } from './workbenchNav';

const DESKTOP_SHORTCUT_EVENT = 'neon-pilot-desktop-shortcut';
const DESKTOP_NAVIGATE_EVENT = 'neon-pilot-desktop-navigate';
const CommandPalette = lazyRouteWithRecovery('layout-command-palette', () =>
  import('./CommandPalette').then((module) => ({ default: module.CommandPalette })),
);
const WORKBENCH_CLOSE_ACTIVE_FILE_EVENT = 'pa:workbench-close-active-file';
const WORKBENCH_REFRESH_ACTIVE_FILE_EVENT = 'pa:workbench-refresh-active-file';
const WORKBENCH_TOGGLE_DIFF_EVENT = 'pa:workbench-toggle-diff';
const WORKBENCH_BROWSER_COMMAND_EVENT = 'neon-pilot-workbench-browser-command';
const NOTIFICATIONS_MARK_ALL_READ_EVENT = 'neon-pilot-notifications-mark-all-read';
const NOTIFICATIONS_DISMISS_ALL_EVENT = 'neon-pilot-notifications-dismiss-all';
const NOTIFICATIONS_CLOSE_EVENT = 'neon-pilot-notifications-close';

const WorkspaceExplorer = lazyRouteWithRecovery('layout-workspace-explorer', () =>
  import('./workspace/WorkspaceExplorer').then((module) => ({ default: module.WorkspaceExplorer })),
);
const ConversationArtifactRailContent = lazyRouteWithRecovery('layout-artifact-rail', () =>
  import('./ConversationArtifactWorkbench').then((module) => ({ default: module.ConversationArtifactRailContent })),
);
const ConversationArtifactWorkbenchPane = lazyRouteWithRecovery('layout-artifact-workbench', () =>
  import('./ConversationArtifactWorkbench').then((module) => ({ default: module.ConversationArtifactWorkbenchPane })),
);
const Sidebar = lazyRouteWithRecovery('layout-sidebar', () => import('./Sidebar').then((module) => ({ default: module.Sidebar })));
const ChatRail = lazyRouteWithRecovery('layout-chat-rail', () =>
  import('./chat/ChatRail').then((module) => ({ default: module.ChatRail })),
);

const ExtensionModalHost = lazyRouteWithRecovery('layout-extension-modal-host', () =>
  import('../extensions/ExtensionModalHost').then((module) => ({ default: module.ExtensionModalHost })),
);

function NotificationCommandBridge({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, unreadCount, markAllRead, dismissAll } = useNotificationStore();
  const hasVisible = notifications.some((notification) => !notification.dismissed);

  useEffect(() => {
    setExtensionCommandContext('notifications.open', open);
    setExtensionCommandContext('notifications.hasUnread', unreadCount > 0);
    setExtensionCommandContext('notifications.hasVisible', hasVisible);
    return () => {
      setExtensionCommandContext('notifications.open', null);
      setExtensionCommandContext('notifications.hasUnread', null);
      setExtensionCommandContext('notifications.hasVisible', null);
    };
  }, [hasVisible, open, unreadCount]);

  useEffect(() => {
    function handleMarkAllRead() {
      markAllRead();
    }

    function handleDismissAll() {
      dismissAll();
    }

    function handleClose() {
      onClose();
    }

    window.addEventListener(NOTIFICATIONS_MARK_ALL_READ_EVENT, handleMarkAllRead);
    window.addEventListener(NOTIFICATIONS_DISMISS_ALL_EVENT, handleDismissAll);
    window.addEventListener(NOTIFICATIONS_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(NOTIFICATIONS_MARK_ALL_READ_EVENT, handleMarkAllRead);
      window.removeEventListener(NOTIFICATIONS_DISMISS_ALL_EVENT, handleDismissAll);
      window.removeEventListener(NOTIFICATIONS_CLOSE_EVENT, handleClose);
    };
  }, [dismissAll, markAllRead, onClose]);

  return null;
}
const NotificationCenter = lazyRouteWithRecovery('layout-notification-center', () =>
  import('./notifications/NotificationCenter').then((module) => ({ default: module.NotificationCenter })),
);
const NotificationToaster = lazyRouteWithRecovery('layout-notification-toaster', () =>
  import('./notifications/NotificationToaster').then((module) => ({ default: module.NotificationToaster })),
);
const PageSearchBar = lazyRouteWithRecovery('layout-page-search-bar', () =>
  import('./PageSearchBar').then((module) => ({ default: module.PageSearchBar })),
);

const WORKBENCH_DOCUMENT_WIDTH_STORAGE_KEY = 'pa:workbench-document-width';
const WORKBENCH_EXPLORER_WIDTH_STORAGE_KEY = 'pa:workbench-explorer-width';
const WORKBENCH_EXPLORER_OPEN_STORAGE_KEY = 'pa:workbench-explorer-open';
const WORKBENCH_OPEN_TOOL_TAB_EVENT = 'pa:workbench-open-tool-tab';
const WORKBENCH_OPEN_ARTIFACT_TAB_EVENT = 'pa:workbench-open-artifact-tab';
const WORKBENCH_OPEN_WORKSPACE_FILE_EVENT = 'pa:workbench-open-workspace-file';
const WORKBENCH_CLOSE_TAB_EVENT = 'pa:workbench-close-tab';
const BROWSER_TABS_CHANGED_EVENT = 'pa:system-browser-tabs-changed';
const DESKTOP_SHORTCUT_ACTIONS = {
  closeConversation: 'close-conversation',
  reopenClosedConversation: 'reopen-closed-conversation',
  toggleConversationPin: 'toggle-conversation-pin',
  toggleConversationArchive: 'toggle-conversation-archive',
  renameConversation: 'rename-conversation',
  saveConversationTitle: 'save-conversation-title',
  cancelConversationTitleEdit: 'cancel-conversation-title-edit',
  editConversationCwd: 'edit-working-directory',
  saveConversationCwd: 'save-working-directory',
  cancelConversationCwdEdit: 'cancel-working-directory-edit',
} as const;

interface WorkbenchTabInstance {
  id: string;
  mode: WorkbenchRailMode;
  artifactId?: string | null;
  conversationId?: string | null;
}

function createWorkbenchTabInstance(
  mode: WorkbenchRailMode,
  options?: { id?: string; artifactId?: string | null; conversationId?: string | null },
): WorkbenchTabInstance {
  const conversationId = options?.conversationId ?? (mode === 'chat' ? (options?.id ?? null) : null);
  return {
    id: options?.id ?? crypto.randomUUID(),
    mode,
    artifactId: options?.artifactId,
    conversationId,
  };
}

function isBrowserWorkbenchMode(mode: WorkbenchRailMode): boolean {
  return mode === 'browser';
}

function getDisplayFileName(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? trimmed;
}

function FileDocumentBar({
  filePath,
  railOpen,
  canToggleRail,
  collapseLabel = 'Collapse file tree',
  expandLabel = 'Show file tree',
  onRailOpenChange,
}: {
  filePath: string;
  railOpen: boolean;
  canToggleRail: boolean;
  collapseLabel?: string;
  expandLabel?: string;
  onRailOpenChange: (open: boolean) => void;
}) {
  const railLabel = railOpen ? collapseLabel : expandLabel;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2 text-secondary">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12px] text-secondary" title={filePath}>
          {filePath}
        </div>
      </div>
      {canToggleRail ? (
        <IconButton compact className="shrink-0" title={railLabel} aria-label={railLabel} onClick={() => onRailOpenChange(!railOpen)}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 5h16v14H4z" />
            <path d="M15 5v14" />
            <path d={railOpen ? 'm10 9-3 3 3 3' : 'm8 9 3 3-3 3'} />
          </svg>
        </IconButton>
      ) : null}
      <IconButton
        compact
        className="shrink-0"
        title="Refresh file and tree"
        aria-label="Refresh file and tree"
        onClick={() => window.dispatchEvent(new CustomEvent(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT))}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </IconButton>
    </div>
  );
}

type DesktopLayoutShortcutAction =
  | 'toggle-sidebar'
  | 'toggle-right-rail'
  | 'toggle-layout-mode'
  | 'show-conversation-mode'
  | 'show-workbench-mode'
  | 'new-workbench-tab'
  | 'close-workbench-tab'
  | 'close-workbench-file'
  | 'refresh-workbench-file'
  | 'toggle-workbench-explorer'
  | 'toggle-workbench-diff';

function isDesktopLayoutShortcutAction(value: unknown): value is DesktopLayoutShortcutAction {
  return (
    value === 'toggle-sidebar' ||
    value === 'toggle-right-rail' ||
    value === 'toggle-layout-mode' ||
    value === 'show-conversation-mode' ||
    value === 'show-workbench-mode' ||
    value === 'new-workbench-tab' ||
    value === 'close-workbench-tab' ||
    value === 'close-workbench-file' ||
    value === 'refresh-workbench-file' ||
    value === 'toggle-workbench-explorer' ||
    value === 'toggle-workbench-diff'
  );
}

function desktopLayoutShortcutCommand(action: DesktopLayoutShortcutAction): { command: string; args?: Record<string, unknown> } {
  switch (action) {
    case 'toggle-sidebar':
      return { command: 'layout.toggleSidebar' };
    case 'toggle-right-rail':
      return { command: 'layout.toggleRightRail' };
    case 'toggle-layout-mode':
      return { command: 'layout.toggle' };
    case 'show-conversation-mode':
      return { command: 'layout.set', args: { mode: 'compact' } };
    case 'show-workbench-mode':
      return { command: 'layout.set', args: { mode: 'workbench' } };
    case 'new-workbench-tab':
      return { command: 'workbench.newTab' };
    case 'close-workbench-tab':
      return { command: 'workbench.closeActiveTab' };
    case 'close-workbench-file':
      return { command: 'workbench.closeActiveFile' };
    case 'refresh-workbench-file':
      return { command: 'workbench.refreshActiveFile' };
    case 'toggle-workbench-explorer':
      return { command: 'workbench.toggleExplorer' };
    case 'toggle-workbench-diff':
      return { command: 'workbench.toggleDiff' };
  }
}

function dispatchDesktopShortcutAction(action: string): void {
  window.dispatchEvent(new CustomEvent(DESKTOP_SHORTCUT_EVENT, { detail: { action } }));
}

function isDesktopNavigateDetail(value: unknown): value is { route: string; replace?: boolean } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const route = (value as { route?: unknown }).route;
  if (typeof route !== 'string' || !route.startsWith('/')) {
    return false;
  }

  const replace = (value as { replace?: unknown }).replace;
  return replace === undefined || typeof replace === 'boolean';
}

export function resolveActiveWorkspaceCwd(
  sessions: SessionMeta[] | null | undefined,
  activeConversationId: string | null | undefined,
): string | null {
  if (!activeConversationId) {
    return null;
  }

  const session = sessions?.find((entry) => entry.id === activeConversationId) ?? null;
  return session?.cwd ?? null;
}

function hasBlockingOverlayOpen(): boolean {
  return document.querySelector('.ui-overlay-backdrop') !== null;
}

function resolveRouteContentBoundaryErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message.length > 0 ? message : null;
  }

  if (typeof error === 'string') {
    const message = error.trim();
    return message.length > 0 ? message : null;
  }

  return null;
}

// ── Resize hook ───────────────────────────────────────────────────────────────

interface ResizeOptions {
  initial: number;
  min: number;
  max: number;
  storageKey: string;
  side: 'left' | 'right'; // which side of the handle the panel is on
}

export function readStoredPanelWidth(
  storageKey: string,
  initial: number,
  min: number,
  storage: Pick<Storage, 'getItem'> = localStorage,
): number {
  try {
    const stored = storage.getItem(storageKey);
    if (stored) {
      const normalized = stored.trim();
      const parsed = /^\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : Number.NaN;
      if (Number.isSafeInteger(parsed)) {
        return Math.max(min, parsed);
      }
    }
  } catch {
    /* ignore */
  }

  return Math.max(min, initial);
}

export function readStoredWorkbenchExplorerOpen(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  try {
    return storage.getItem(WORKBENCH_EXPLORER_OPEN_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeStoredWorkbenchExplorerOpen(open: boolean, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(WORKBENCH_EXPLORER_OPEN_STORAGE_KEY, open ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function getFocusableElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex >= 0 && Boolean(element.offsetParent),
  );
}

function moveDocumentFocus(delta: 1 | -1): boolean {
  const elements = getFocusableElements();
  if (elements.length === 0) return false;
  const currentIndex = document.activeElement instanceof HTMLElement ? elements.indexOf(document.activeElement) : -1;
  const next = elements[(currentIndex + delta + elements.length) % elements.length];
  if (!next) return false;
  next.focus();
  return document.activeElement === next;
}

function cycleSelectByLabel(label: string): boolean {
  const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  if (!select || select.disabled || select.options.length === 0) return false;
  select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function shouldResetEmptyArtifactsRail(input: {
  activeTool: WorkbenchRailMode;
  artifactsLoading: boolean;
  artifactCount: number;
  hasArtifactsExtensionSurface: boolean;
}): boolean {
  return (
    isArtifactsRailMode(input.activeTool) && !input.artifactsLoading && input.artifactCount === 0 && !input.hasArtifactsExtensionSurface
  );
}

export function shouldAllowWorkbenchRailSurface(input: {
  activeToolSlot: WorkbenchRailMode | string;
  hasPairedDocument: boolean;
}): boolean {
  if (input.activeToolSlot === 'files') return true;
  if (input.activeToolSlot === 'knowledge') return true;
  return input.hasPairedDocument;
}

export function clearWorkbenchOnlySearchParamsForCompact(search: string): string {
  const next = new URLSearchParams(search);
  next.delete('checkpoint');
  next.delete('run');
  return next.toString();
}

function useResize({ initial, min, max, storageKey, side }: ResizeOptions) {
  const [desiredWidth, setDesiredWidth] = useState(() => readStoredPanelWidth(storageKey, initial, min));

  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const width = clampPanelWidth(desiredWidth, min, max);

  const persistWidth = useCallback(
    (nextWidth: number) => {
      setDesiredWidth(nextWidth);
      try {
        localStorage.setItem(storageKey, String(nextWidth));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    persistWidth(Math.max(min, initial));
  }, [initial, min, persistWidth]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(e: MouseEvent) {
        if (!dragging.current) return;
        const dx = side === 'left' ? e.clientX - startX.current : startX.current - e.clientX;
        const next = clampPanelWidth(startW.current + dx, min, max);
        persistWidth(next);
      }

      function onUp() {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width, min, max, side, persistWidth],
  );

  useEffect(() => {
    setDesiredWidth(readStoredPanelWidth(storageKey, initial, min));
  }, [storageKey, initial, min]);

  return { width, onMouseDown, reset };
}

// ── Resize handle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onMouseDown, onDoubleClick }: { onMouseDown: (e: React.MouseEvent) => void; onDoubleClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex-shrink-0 w-[5px] cursor-col-resize select-none z-10 group"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wider invisible hit area */}
      <div className="absolute inset-y-0 -left-0.5 -right-0.5" />
      {/* Visual line — thickens on hover */}
      <div
        className="absolute inset-y-0 left-[2px] w-[1px] transition-all duration-100"
        style={{
          background: hovered ? 'rgb(var(--color-accent) / 0.5)' : 'rgb(var(--color-border-subtle))',
          width: hovered ? '2px' : '1px',
          left: hovered ? '1.5px' : '2px',
        }}
      />
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

class RouteContentBoundary extends Component<
  {
    resetKey: string;
    pathname: string;
    children: ReactNode;
  },
  {
    hasError: boolean;
    errorMessage: string | null;
  }
> {
  state = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: unknown): {
    hasError: boolean;
    errorMessage: string | null;
  } {
    return {
      hasError: true,
      errorMessage: resolveRouteContentBoundaryErrorMessage(error),
    };
  }

  componentDidCatch(error: unknown, _errorInfo: { componentStack?: string }) {
    if (isRecoverableLazyRouteError(error) && attemptLazyRouteRecovery(`route-boundary:${this.props.resetKey}`)) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('neon-pilot-notification', {
        detail: {
          message: 'A page error was recovered',
          type: 'error',
          details: error instanceof Error ? (error.stack ?? error.message) : String(error ?? ''),
          source: 'core',
        },
      }),
    );
  }

  componentDidUpdate(prevProps: Readonly<{ resetKey: string }>) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        errorMessage: null,
      });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isConversationRoute = routeMatchesPrefix(this.props.pathname, '/conversations');
    const title = isConversationRoute ? 'Conversation unavailable' : 'This page hit an unexpected error';
    const body = isConversationRoute
      ? 'This conversation may be stale, missing, or temporarily broken. Open another conversation or start a new one.'
      : 'Try another page, then come back if needed.';
    const errorMessage = this.state.errorMessage;

    return (
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden select-text">
        <div className="flex h-full items-center justify-center px-8 py-10">
          <div className="max-w-lg rounded-2xl border border-border-subtle bg-surface px-6 py-6 shadow-sm">
            <SectionLabel tone="muted">Recovered from render error</SectionLabel>
            <h1 className="mt-2 text-[22px] font-semibold text-primary">{title}</h1>
            <p className="mt-2 text-[13px] leading-6 text-secondary">{body}</p>
            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
                <SectionLabel tone="muted">Error details</SectionLabel>
                <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-primary">{errorMessage}</p>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/conversations/new" className="ui-action-button">
                New conversation
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }
}

function useViewportWidth() {
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return viewportWidth;
}

function getActiveConversationId(pathname: string): string | null {
  return readConversationIdFromPathname(pathname);
}

function WorkbenchDocumentPane({
  conversationId,
  artifactId,
  knowledgeFileId,
  workspaceFileId,
  activeTool,
  activeTabId,
  activeChatConversationId,
  workspaceCwd,
  extensionWorkbenchSurface,
  extensionRailSurface,
  extensionToolPanels,
  railOpen,
  railWidth,
  onRailResizeMouseDown,
  onRailResizeReset,
  onRailOpenChange,
  onActiveToolChange,
  onCheckpointSelect,
  onWorkspaceFileClear,
  onStartSideChat,
}: {
  conversationId: string | null;
  artifactId: string | null;
  knowledgeFileId: string | null;
  workspaceFileId: string | null;
  activeTool: WorkbenchRailMode;
  activeTabId: string | null;
  activeChatConversationId: string | null;
  workspaceCwd?: string | null;
  extensionWorkbenchSurface: NativeExtensionViewSummary | null;
  extensionRailSurface: ((ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary) | null;
  extensionToolPanels: Array<(ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary>;
  railOpen: boolean;
  railWidth: number;
  onRailResizeMouseDown: (event: React.MouseEvent) => void;
  onRailResizeReset: () => void;
  onRailOpenChange: (open: boolean) => void;
  onActiveToolChange: (mode: WorkbenchRailMode) => void;
  onCheckpointSelect: (checkpointId: string | null) => void;
  onWorkspaceFileClear: () => void;
  onStartSideChat?: () => Promise<string | void>;
}) {
  const location = useLocation();
  const activeExtensionToolPanel = useMemo(() => {
    const parsed = parseExtensionToolPanelMode(activeTool);
    if (!parsed) return findExtensionToolPanelBySlot(extensionToolPanels, activeTool);
    return extensionToolPanels.find((surface) => surface.extensionId === parsed.extensionId && surface.id === parsed.surfaceId) ?? null;
  }, [activeTool, extensionToolPanels]);
  const activeToolSlot = activeExtensionToolPanel ? inferSurfaceToolSlot(activeExtensionToolPanel) : activeTool;
  const extensionSearch =
    artifactId && (activeToolSlot === 'artifacts' || isArtifactsRailMode(activeTool))
      ? setConversationArtifactIdInSearch(location.search, artifactId)
      : location.search;
  const activeFilePath = activeToolSlot === 'knowledge' ? knowledgeFileId : workspaceFileId;
  const showFileBar = Boolean(activeFilePath && (activeToolSlot === 'files' || activeToolSlot === 'knowledge'));

  let mainContent: ReactNode = null;

  if (isNewWorkbenchTabMode(activeTool)) {
    mainContent = (
      <WorkbenchNewTabPage
        extensionToolPanels={extensionToolPanels}
        conversationId={conversationId}
        onActiveToolChange={onActiveToolChange}
        onWorkspaceFileClear={onWorkspaceFileClear}
        onStartSideChat={onStartSideChat}
      />
    );
  } else if (activeTool === 'chat' && activeChatConversationId) {
    mainContent = (
      <Suspense fallback={<PanelMessage>Loading chat...</PanelMessage>}>
        <ChatRail key={activeChatConversationId} conversationId={activeChatConversationId} workspaceCwd={workspaceCwd ?? null} />
      </Suspense>
    );
  } else if (extensionWorkbenchSurface) {
    mainContent = (
      <NativeExtensionSurfaceHost
        key={activeTabId ?? `${extensionWorkbenchSurface.extensionId}:${extensionWorkbenchSurface.id}`}
        surface={extensionWorkbenchSurface}
        pathname={location.pathname}
        search={extensionSearch}
        hash={location.hash}
        conversationId={conversationId}
        cwd={workspaceCwd}
        instanceId={activeTabId}
      />
    );
  } else if (activeExtensionToolPanel && activeToolSlot === 'terminal') {
    mainContent = (
      <NativeExtensionSurfaceHost
        key={activeTabId ?? `${activeExtensionToolPanel.extensionId}:${activeExtensionToolPanel.id}`}
        surface={activeExtensionToolPanel}
        pathname={location.pathname}
        search={extensionSearch}
        hash={location.hash}
        conversationId={conversationId}
        cwd={workspaceCwd}
        instanceId={activeTabId}
      />
    );
  } else if (
    (activeTool === 'files' && !workspaceFileId) ||
    (activeToolSlot === 'files' && !workspaceFileId) ||
    (activeToolSlot === 'knowledge' && !knowledgeFileId) ||
    (isArtifactsRailMode(activeTool) && !artifactId)
  ) {
    mainContent = (
      <WorkbenchKnowledgeRail
        conversationId={conversationId}
        workspaceCwd={workspaceCwd ?? null}
        activeArtifactId={artifactId}
        activeTool={activeTool}
        onActiveToolChange={onActiveToolChange}
        onCheckpointSelect={onCheckpointSelect}
        onWorkspaceFileClear={onWorkspaceFileClear}
        extensionToolPanels={extensionToolPanels}
      />
    );
  } else if (isArtifactsRailMode(activeTool) && conversationId && artifactId) {
    mainContent = (
      <Suspense fallback={<PanelMessage>Loading artifact...</PanelMessage>}>
        <ConversationArtifactWorkbenchPane conversationId={conversationId} artifactId={artifactId} />
      </Suspense>
    );
  } else if (activeTool === 'files') {
    mainContent = (
      <CenteredMessage eyebrow="Workbench" title="Open a file" body="Pick a file from the Files tab to keep it beside the transcript." />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {showFileBar ? (
        <FileDocumentBar
          filePath={activeFilePath ?? ''}
          railOpen={railOpen}
          canToggleRail={Boolean(extensionRailSurface)}
          onRailOpenChange={onRailOpenChange}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">{mainContent}</div>
        {railOpen && extensionRailSurface ? (
          <>
            <ResizeHandle onMouseDown={onRailResizeMouseDown} onDoubleClick={onRailResizeReset} />
            <aside
              style={{ width: railWidth }}
              className="relative z-10 flex-shrink-0 overflow-hidden border-l border-border-subtle bg-panel select-text [&>[data-extension-id]]:bg-panel"
              aria-label={`${extensionRailSurface.title ?? 'Workbench'} sidebar`}
            >
              <NativeExtensionSurfaceHost
                surface={extensionRailSurface}
                pathname={location.pathname}
                search={extensionSearch}
                hash={location.hash}
                conversationId={conversationId}
                cwd={workspaceCwd}
                instanceId={activeTabId}
              />
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}

function WorkbenchPanel({
  width,
  conversationId,
  artifactId,
  knowledgeFileId,
  workspaceFileId,
  activeTool,
  activeTabId,
  activeChatConversationId,
  activeWorkspaceFileId,
  activeKnowledgeFileId,
  workspaceCwd,
  extensionWorkbenchSurface,
  extensionRailSurface,
  extensionToolPanels,
  browserTabsState,
  openTabs,
  railOpen,
  railWidth,
  onRailResizeMouseDown,
  onRailResizeReset,
  onActiveTabChange,
  onCloseTab,
  onOpenNewTab,
  onActiveToolChange,
  onRailOpenChange,
  onWorkspaceFileClear,
  onStartSideChat,
}: {
  width: number;
  conversationId: string | null;
  artifactId: string | null;
  knowledgeFileId: string | null;
  workspaceFileId: string | null;
  activeTool: WorkbenchRailMode;
  activeTabId: string | null;
  activeChatConversationId: string | null;
  activeWorkspaceFileId: string | null;
  activeKnowledgeFileId: string | null;
  workspaceCwd: string | null;
  extensionWorkbenchSurface: NativeExtensionViewSummary | null;
  extensionRailSurface: ((ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary) | null;
  extensionToolPanels: Array<(ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary>;
  browserTabsState: BrowserTabsState;
  openTabs: WorkbenchTabInstance[];
  railOpen: boolean;
  railWidth: number;
  onRailResizeMouseDown: (event: React.MouseEvent) => void;
  onRailResizeReset: () => void;
  onActiveTabChange: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onOpenNewTab: () => void;
  onRailOpenChange: (open: boolean) => void;
  onActiveToolChange: (
    mode: WorkbenchRailMode,
    options?: { artifactId?: string | null; id?: string; conversationId?: string | null; forceNewTab?: boolean },
  ) => void;
  onWorkspaceFileClear: () => void;
  onStartSideChat?: () => Promise<string | void>;
}) {
  return (
    <section
      style={{ width }}
      className="flex flex-shrink-0 flex-col overflow-hidden border-l border-r border-border-subtle bg-base select-text"
      aria-label="Workbench note"
      data-workbench-document-pane="true"
      data-has-open-file={
        knowledgeFileId ||
        workspaceFileId ||
        artifactId ||
        activeTool === 'browser' ||
        activeTool === 'chat' ||
        activeTool === 'terminal' ||
        isNewWorkbenchTabMode(activeTool) ||
        extensionWorkbenchSurface
          ? 'true'
          : 'false'
      }
    >
      <WorkbenchTabStrip
        activeTabId={activeTabId}
        activeTool={activeTool}
        openTabs={openTabs}
        extensionToolPanels={extensionToolPanels}
        browserTabsState={browserTabsState}
        activeWorkspaceFileId={activeWorkspaceFileId}
        activeKnowledgeFileId={activeKnowledgeFileId}
        onActiveTabChange={onActiveTabChange}
        onCloseTab={onCloseTab}
        onOpenNewTab={onOpenNewTab}
        onCheckpointSelect={() => undefined}
        onWorkspaceFileClear={onWorkspaceFileClear}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <WorkbenchDocumentPane
          conversationId={conversationId}
          artifactId={artifactId}
          knowledgeFileId={knowledgeFileId}
          workspaceFileId={workspaceFileId}
          activeTool={activeTool}
          activeTabId={activeTabId}
          activeChatConversationId={activeChatConversationId}
          workspaceCwd={workspaceCwd}
          extensionWorkbenchSurface={extensionWorkbenchSurface}
          extensionRailSurface={extensionRailSurface}
          extensionToolPanels={extensionToolPanels}
          railOpen={railOpen}
          railWidth={railWidth}
          onRailResizeMouseDown={onRailResizeMouseDown}
          onRailResizeReset={onRailResizeReset}
          onRailOpenChange={onRailOpenChange}
          onActiveToolChange={onActiveToolChange}
          onCheckpointSelect={() => undefined}
          onWorkspaceFileClear={onWorkspaceFileClear}
          onStartSideChat={onStartSideChat}
        />
      </div>
    </section>
  );
}

function WorkbenchNewTabPage({
  extensionToolPanels,
  conversationId,
  onActiveToolChange,
  onWorkspaceFileClear,
  onStartSideChat,
}: {
  extensionToolPanels: Array<(ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary>;
  conversationId: string | null;
  onActiveToolChange: (mode: WorkbenchRailMode) => void;
  onWorkspaceFileClear: () => void;
  onStartSideChat?: () => Promise<string | void>;
}) {
  const availableTools = extensionToolPanels.filter((surface) => {
    const slot = inferSurfaceToolSlot(surface);
    return shouldRenderWorkbenchToolInNav(surface) && slot !== 'artifacts' && slot !== 'terminal';
  });
  const systemFilesExtensionSurface = findExtensionToolPanelBySlot(extensionToolPanels, 'files');
  const systemTerminalExtensionSurface = findExtensionToolPanelBySlot(extensionToolPanels, 'terminal');
  const [sideChatStarting, setSideChatStarting] = useState(false);

  function openTool(surface: (ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary) {
    onActiveToolChange(extensionToolPanelMode(surface));
    onWorkspaceFileClear();
  }

  const handleStartSideChat = useCallback(async () => {
    if (!onStartSideChat || !conversationId) return;
    setSideChatStarting(true);
    try {
      await onStartSideChat();
    } finally {
      setSideChatStarting(false);
    }
  }, [onStartSideChat, conversationId]);

  return (
    <div className="flex h-full min-w-0 items-center justify-center px-2 text-center select-text sm:px-4">
      <div className="w-full min-w-0" style={{ maxWidth: 'min(36rem, 100%)' }}>
        <SectionLabel tone="secondary">Workbench</SectionLabel>
        <h2 className="mt-2 text-xl font-semibold text-primary text-balance">Open a tab</h2>
        <div className="ui-workbench-new-tab-grid mt-6 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-2">
          <ActionTile
            icon="□"
            label="File Explorer"
            onClick={() => {
              onActiveToolChange(systemFilesExtensionSurface ? extensionToolPanelMode(systemFilesExtensionSurface) : 'files');
              onWorkspaceFileClear();
            }}
          />
          {onStartSideChat && conversationId ? (
            <ActionTile
              data-workbench-new-tab-action="chat"
              disabled={sideChatStarting}
              icon="◌"
              label={sideChatStarting ? 'Opening...' : 'Chat'}
              onClick={handleStartSideChat}
            />
          ) : null}
          {systemTerminalExtensionSurface ? (
            <ActionTile icon="▸" label="Terminal" onClick={() => openTool(systemTerminalExtensionSurface)} />
          ) : null}
          {availableTools.map((surface) => (
            <ActionTile
              key={`${surface.extensionId}:${surface.id}`}
              icon={iconGlyphForExtensionSurface(surface.icon)}
              label={labelForExtensionToolPanel(surface)}
              onClick={() => openTool(surface)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkbenchTabStrip({
  activeTabId,
  activeTool,
  openTabs,
  extensionToolPanels,
  browserTabsState,
  activeWorkspaceFileId,
  activeKnowledgeFileId,
  onActiveTabChange,
  onCloseTab,
  onOpenNewTab,
  onCheckpointSelect,
  onWorkspaceFileClear,
}: {
  activeTabId: string | null;
  activeTool: WorkbenchRailMode;
  openTabs: WorkbenchTabInstance[];
  extensionToolPanels: Array<(ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary>;
  browserTabsState: BrowserTabsState;
  activeWorkspaceFileId: string | null;
  activeKnowledgeFileId: string | null;
  onActiveTabChange: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onOpenNewTab: () => void;
  onCheckpointSelect: (checkpointId: string | null) => void;
  onWorkspaceFileClear: () => void;
}) {
  const [, setSearchParams] = useSearchParams();
  const sessions = useAllSessions();
  const sessionTitleById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session.title?.trim() || ''] as const).filter(([, title]) => title.length > 0)),
    [sessions],
  );

  function labelForTab(tab: WorkbenchTabInstance): string {
    if (isBrowserWorkbenchMode(tab.mode)) {
      const browserTab = browserTabsState.tabs.find((candidate) => candidate.id === tab.id);
      const title = browserTab?.title?.trim();
      if (title && title !== 'New Tab') return title;
      const url = browserTab?.url?.trim();
      if (url) {
        try {
          return new URL(url).hostname || 'Browser';
        } catch {
          return url;
        }
      }
      return 'Browser';
    }
    if ((isArtifactsRailMode(tab.mode) || tab.mode.startsWith('extension:system-artifacts:')) && tab.artifactId) {
      return `Artifact ${tab.artifactId.slice(0, 8)}`;
    }
    if (tab.mode === 'chat' && tab.conversationId) {
      return sessionTitleById.get(tab.conversationId) ?? `Chat ${tab.conversationId.slice(0, 8)}`;
    }
    return labelForMode(tab.mode);
  }

  function labelForMode(mode: WorkbenchRailMode): string {
    if (mode === 'new') return 'New tab';
    const parsed = parseExtensionToolPanelMode(mode);
    const surface = parsed
      ? extensionToolPanels.find((candidate) => candidate.extensionId === parsed.extensionId && candidate.id === parsed.surfaceId)
      : findExtensionToolPanelBySlot(extensionToolPanels, mode);
    if (surface) return labelForExtensionToolPanel(surface);
    if (mode === 'files') {
      const fileName = getDisplayFileName(activeWorkspaceFileId || activeKnowledgeFileId || '');
      return `File Explorer${fileName ? `: ${fileName}` : ''}`;
    }
    if (mode === 'artifacts') return 'Artifacts';
    if (mode === 'browser') return 'Browser';
    if (mode === 'chat') return 'Chat';
    if (mode === 'terminal') return 'Terminal';
    return 'Workbench';
  }

  function iconForMode(mode: WorkbenchRailMode): string {
    if (mode === 'new') return '+';
    const parsed = parseExtensionToolPanelMode(mode);
    const surface = parsed
      ? extensionToolPanels.find((candidate) => candidate.extensionId === parsed.extensionId && candidate.id === parsed.surfaceId)
      : findExtensionToolPanelBySlot(extensionToolPanels, mode);
    if (surface) return iconGlyphForExtensionSurface(surface.icon);
    if (mode === 'files') return '□';
    if (mode === 'artifacts') return '□';
    if (mode === 'chat') return '◌';
    if (mode === 'terminal') return '▸';
    return '✦';
  }

  const clearWorkbenchSelection = useCallback(() => {
    onWorkspaceFileClear();
    onCheckpointSelect(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('file');
      next.delete('artifact');
      next.delete('checkpoint');
      next.delete('run');
      return next;
    });
  }, [onCheckpointSelect, onWorkspaceFileClear, setSearchParams]);

  const selectTab = useCallback(
    (tabId: string) => {
      onActiveTabChange(tabId);
    },
    [onActiveTabChange],
  );

  const activeTabRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId, openTabs.length]);

  const openNewTab = useCallback(() => {
    onOpenNewTab();
    clearWorkbenchSelection();
  }, [clearWorkbenchSelection, onOpenNewTab]);

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-hidden border-b border-border-subtle bg-base px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {openTabs.map((tab) => (
          <WorkbenchTab
            key={tab.id}
            ref={activeTabId === tab.id ? activeTabRef : undefined}
            active={activeTabId === tab.id}
            title={labelForTab(tab)}
          >
            <WorkbenchTabButton icon={iconForMode(tab.mode)} label={labelForTab(tab)} onClick={() => selectTab(tab.id)} />
            <WorkbenchTabCloseButton
              aria-label={`Close ${labelForTab(tab)}`}
              title={`Close ${labelForTab(tab)}`}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              ×
            </WorkbenchTabCloseButton>
          </WorkbenchTab>
        ))}
      </div>
      <IconButton
        size="sm"
        className={cx('ml-1 h-8 w-8 shrink-0 rounded-md text-[16px]', isNewWorkbenchTabMode(activeTool) && 'bg-surface text-primary')}
        title="New tab"
        aria-label="New tab"
        onClick={openNewTab}
      >
        +
      </IconButton>
    </div>
  );
}

function WorkbenchKnowledgeRail({
  conversationId,
  workspaceCwd,
  activeArtifactId,
  activeTool,
  onActiveToolChange,
  onCheckpointSelect,
  onWorkspaceFileClear,
  extensionToolPanels,
}: {
  conversationId: string | null;
  workspaceCwd: string | null;
  activeArtifactId: string | null;
  activeTool: WorkbenchRailMode;
  onActiveToolChange: (mode: WorkbenchRailMode) => void;
  onCheckpointSelect: (checkpointId: string | null) => void;
  onWorkspaceFileClear: () => void;
  extensionToolPanels: Array<(ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary>;
}) {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const artifactsEnabled = isArtifactsRailMode(activeTool) || activeArtifactId !== null;
  const {
    artifacts,
    loading: artifactsLoading,
    error: artifactsError,
  } = useConversationArtifactSummaries(artifactsEnabled ? conversationId : null);
  const availableExtensionToolPanels = extensionToolPanels;
  const activeExtensionToolPanel = useMemo(() => {
    const parsed = parseExtensionToolPanelMode(activeTool);
    if (!parsed) return findExtensionToolPanelBySlot(availableExtensionToolPanels, activeTool);
    return (
      availableExtensionToolPanels.find((surface) => surface.extensionId === parsed.extensionId && surface.id === parsed.surfaceId) ?? null
    );
  }, [activeTool, availableExtensionToolPanels]);
  const systemArtifactsExtensionSurface = findExtensionToolPanelBySlot(availableExtensionToolPanels, 'artifacts');
  const systemFilesExtensionSurface = findExtensionToolPanelBySlot(availableExtensionToolPanels, 'files');
  const handleArtifactSelect = useCallback(
    (artifactId: string) => {
      onActiveToolChange('artifacts');
      onWorkspaceFileClear();
      onCheckpointSelect(null);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('file');
        next.delete('checkpoint');
        next.delete('run');
        return new URLSearchParams(setConversationArtifactIdInSearch(next.toString(), artifactId));
      });
    },
    [onActiveToolChange, onCheckpointSelect, onWorkspaceFileClear, setSearchParams],
  );

  useEffect(() => {
    if (activeArtifactId && artifacts.length > 0) {
      onActiveToolChange(systemArtifactsExtensionSurface ? extensionToolPanelMode(systemArtifactsExtensionSurface) : 'artifacts');
      onWorkspaceFileClear();
    }
  }, [activeArtifactId, artifacts.length, onActiveToolChange, onWorkspaceFileClear, systemArtifactsExtensionSurface]);

  useEffect(() => {
    const parsed = parseExtensionToolPanelMode(activeTool);
    if (!parsed) return;
    if (activeExtensionToolPanel) return;
    onActiveToolChange('files');
  }, [activeExtensionToolPanel, activeTool, onActiveToolChange]);

  useEffect(() => {
    if (
      shouldResetEmptyArtifactsRail({
        activeTool,
        artifactsLoading,
        artifactCount: artifacts.length,
        hasArtifactsExtensionSurface: systemArtifactsExtensionSurface !== null,
      })
    ) {
      onActiveToolChange('files');
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('artifact');
          return next;
        },
        { replace: true },
      );
    }
  }, [activeTool, artifacts.length, artifactsLoading, onActiveToolChange, setSearchParams, systemArtifactsExtensionSurface]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      {activeTool === 'files' ? (
        <div className="min-h-0 flex-1 overflow-hidden bg-panel [&>[data-extension-id]]:bg-panel">
          {systemFilesExtensionSurface ? (
            <NativeExtensionSurfaceHost
              surface={systemFilesExtensionSurface}
              pathname={location.pathname}
              search={location.search}
              hash={location.hash}
              conversationId={conversationId}
              cwd={workspaceCwd}
            />
          ) : (
            <Suspense fallback={<PanelMessage className="px-3 py-2">Loading files...</PanelMessage>}>
              <WorkspaceExplorer cwd={workspaceCwd} onDraftPrompt={onWorkspaceFileClear} railOnly={true} />
            </Suspense>
          )}
        </div>
      ) : isArtifactsRailMode(activeTool) ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<PanelMessage className="px-3 py-2">Loading artifacts...</PanelMessage>}>
            <ConversationArtifactRailContent
              artifacts={artifacts}
              activeArtifactId={activeArtifactId}
              loading={artifactsLoading}
              error={artifactsError}
              onOpenArtifact={handleArtifactSelect}
            />
          </Suspense>
        </div>
      ) : activeExtensionToolPanel ? (
        <div className="min-h-0 flex-1 overflow-hidden bg-panel [&>[data-extension-id]]:bg-panel">
          {'component' in activeExtensionToolPanel ? (
            <NativeExtensionSurfaceHost
              surface={activeExtensionToolPanel}
              pathname={location.pathname}
              search={location.search}
              hash={location.hash}
              conversationId={conversationId}
              cwd={workspaceCwd}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  useRouteTelemetry();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { versions } = useAppEvents();
  const activeConversationId = getActiveConversationId(location.pathname);
  const activeSessionCwd = useSession(activeConversationId)?.cwd ?? null;
  const [desktopEnvironment, setDesktopEnvironment] = useState<DesktopEnvironmentState | null>(null);
  const [appLayoutMode, setAppLayoutMode] = useState<AppLayoutMode>(() => readAppLayoutMode());
  const [activeWorkbenchTabId, setActiveWorkbenchTabId] = useState<string | null>(null);
  const [openWorkbenchTabs, setOpenWorkbenchTabs] = useState<WorkbenchTabInstance[]>([]);
  const openWorkbenchTabsRef = useRef(openWorkbenchTabs);
  openWorkbenchTabsRef.current = openWorkbenchTabs;
  const [browserTabsState, setBrowserTabsState] = useState<BrowserTabsState>(() => readBrowserTabsState());
  const activeWorkbenchTab = openWorkbenchTabs.find((tab) => tab.id === activeWorkbenchTabId) ?? null;
  const activeWorkbenchTool = activeWorkbenchTab?.mode ?? 'new';
  const activeWorkbenchChatConversationId =
    activeWorkbenchTab?.mode === 'chat' ? (activeWorkbenchTab.conversationId ?? activeWorkbenchTab.id) : null;
  const [selectedToolByConversation, setSelectedToolByConversation] = useState<Record<string, WorkbenchRailMode>>({});
  const [selectedFileByConversation, setSelectedFileByConversation] = useState<Record<string, string | null>>({});
  const [selectedWorkspaceFileByConversation, setSelectedWorkspaceFileByConversation] = useState<Record<string, string | null>>({});
  const selectedWorkspaceFileByConversationRef = useRef(selectedWorkspaceFileByConversation);
  selectedWorkspaceFileByConversationRef.current = selectedWorkspaceFileByConversation;
  const activeWorkbenchWorkspaceFileIdRef = useRef<string | null>(null);
  const [selectedArtifactByConversation, setSelectedArtifactByConversation] = useState<Record<string, string | null>>({});
  const viewportWidth = useViewportWidth();
  const sidebar = useResize({ initial: 224, min: 160, max: 320, storageKey: SIDEBAR_WIDTH_STORAGE_KEY, side: 'left' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const railMinWidth = 160;
  const railMaxWidth = getRailMaxWidth({
    viewportWidth,
    sidebarWidth: sidebar.width,
    railMinWidth,
    mainMinWidth: 320,
  });
  const railPrefs = getRailLayoutPrefs(location.pathname);
  const railInitialWidth = getRailInitialWidth({
    pathname: location.pathname,
    viewportWidth,
    sidebarWidth: sidebar.width,
    railMinWidth,
    railMaxWidth,
  });
  const rail = useResize({
    initial: railInitialWidth,
    min: railMinWidth,
    max: railMaxWidth,
    storageKey: railPrefs.storageKey,
    side: 'right',
  });
  const workbenchExplorer = useResize({
    initial: 276,
    min: 220,
    max: Math.max(220, Math.min(380, viewportWidth - sidebar.width - 760)),
    storageKey: WORKBENCH_EXPLORER_WIDTH_STORAGE_KEY,
    side: 'right',
  });
  const [workbenchExplorerOpen, setWorkbenchExplorerOpen] = useState(() => readStoredWorkbenchExplorerOpen());
  const workbenchMainMinWidth = 260;
  const workbenchDocument = useResize({
    initial: 520,
    min: 220,
    max: Math.max(220, viewportWidth - sidebar.width - (workbenchExplorerOpen ? workbenchExplorer.width : 0) - workbenchMainMinWidth),
    storageKey: WORKBENCH_DOCUMENT_WIDTH_STORAGE_KEY,
    side: 'right',
  });
  const [railOpen, setRailOpen] = useState(true);
  const pageSearchRootRef = useRef<HTMLDivElement | null>(null);
  const [registeredRightRailControl, setRegisteredRightRailControl] = useState<DesktopRightRailControl | null>(null);
  const railWidth = rail.width;
  const extensionRegistry = useExtensionRegistry();
  const [extensionKeybindings, setExtensionKeybindings] = useState<ExtensionKeybindingRegistration[]>([]);
  const [extensionCommands, setExtensionCommands] = useState<ExtensionCommandRegistration[]>([]);
  useEffect(() => {
    let cancelled = false;

    readDesktopEnvironment()
      .then((environment) => {
        if (!cancelled) {
          setDesktopEnvironment(environment);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopEnvironment(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleAppLayoutModeChanged() {
      setAppLayoutMode(readAppLayoutMode());
    }

    window.addEventListener(APP_LAYOUT_MODE_CHANGED_EVENT, handleAppLayoutModeChanged);
    window.addEventListener('storage', handleAppLayoutModeChanged);
    return () => {
      window.removeEventListener(APP_LAYOUT_MODE_CHANGED_EVENT, handleAppLayoutModeChanged);
      window.removeEventListener('storage', handleAppLayoutModeChanged);
    };
  }, []);

  useEffect(() => {
    function handleBrowserTabsChanged(event: Event) {
      const next = (event as CustomEvent<BrowserTabsState>).detail;
      setBrowserTabsState(next ?? readBrowserTabsState());
    }

    window.addEventListener(BROWSER_TABS_CHANGED_EVENT, handleBrowserTabsChanged);
    window.addEventListener('storage', handleBrowserTabsChanged);
    return () => {
      window.removeEventListener(BROWSER_TABS_CHANGED_EVENT, handleBrowserTabsChanged);
      window.removeEventListener('storage', handleBrowserTabsChanged);
    };
  }, []);

  const effectiveSidebarOpen = sidebarOpen;
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--neon-pilot-sidebar-offset');
    root.style.setProperty('--neon-pilot-sidebar-offset', effectiveSidebarOpen ? `${sidebar.width}px` : '0px');
    return () => {
      if (previous) {
        root.style.setProperty('--neon-pilot-sidebar-offset', previous);
      } else {
        root.style.removeProperty('--neon-pilot-sidebar-offset');
      }
    };
  }, [effectiveSidebarOpen, sidebar.width]);

  const showWorkbench = appLayoutMode === 'workbench' && routeSupportsWorkbench(location.pathname, extensionRegistry.surfaces);
  const canToggleWorkbench = routeSupportsWorkbench(location.pathname, extensionRegistry.surfaces);
  const activeWorkbenchKnowledgeFileId = showWorkbench
    ? (searchParams.get('file') ?? (activeConversationId ? selectedFileByConversation[activeConversationId] : null) ?? null)
    : null;
  const activeWorkbenchWorkspaceFileId =
    showWorkbench && activeConversationId
      ? (searchParams.get('workspaceFile') ?? selectedWorkspaceFileByConversation[activeConversationId] ?? null)
      : null;
  activeWorkbenchWorkspaceFileIdRef.current = activeWorkbenchWorkspaceFileId;
  const activeWorkbenchArtifactId =
    showWorkbench && activeConversationId
      ? (activeWorkbenchTab?.artifactId ??
        getConversationArtifactIdFromSearch(location.search) ??
        selectedArtifactByConversation[activeConversationId] ??
        null)
      : null;
  const previousActiveConversationIdRef = useRef<string | null>(activeConversationId);
  const prewarmedLiveSessionWorkspaceCwdsRef = useRef(new Map<string, number>());
  const activeWorkspaceCwd = activeSessionCwd;
  useEffect(() => {
    if (!activeWorkspaceCwd) {
      return;
    }

    const workspaceCwd = activeWorkspaceCwd.trim();
    if (!workspaceCwd) {
      return;
    }

    const lastRequestedAt = prewarmedLiveSessionWorkspaceCwdsRef.current.get(workspaceCwd);
    if (lastRequestedAt !== undefined && performance.now() - lastRequestedAt < 9 * 60_000) {
      return;
    }

    prewarmedLiveSessionWorkspaceCwdsRef.current.set(workspaceCwd, performance.now());
    let requested = false;
    const timeout = window.setTimeout(() => {
      requested = true;
      void api.prewarmLiveSession(workspaceCwd).catch(() => {
        prewarmedLiveSessionWorkspaceCwdsRef.current.delete(workspaceCwd);
      });
    }, 12_000);

    return () => {
      window.clearTimeout(timeout);
      if (!requested) {
        prewarmedLiveSessionWorkspaceCwdsRef.current.delete(workspaceCwd);
      }
    };
  }, [activeWorkspaceCwd]);
  const clearActiveWorkbenchFileSelection = useCallback(() => {
    if (activeConversationId) {
      setSelectedFileByConversation((current) => ({ ...current, [activeConversationId]: null }));
      setSelectedWorkspaceFileByConversation((current) => ({ ...current, [activeConversationId]: null }));
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('file');
      next.delete('workspaceFile');
      return next;
    });
  }, [activeConversationId, setSearchParams]);

  const extensionRightToolPanels = useMemo(
    () =>
      extensionRegistry.surfaces.filter(
        (surface) => isExtensionRightToolPanelSurface(surface) || isNativeExtensionRightRailSurface(surface),
      ),
    [extensionRegistry.surfaces],
  );
  const extensionWorkbenchSurfaces = useMemo(
    () => extensionRegistry.surfaces.filter(isNativeExtensionWorkbenchSurface),
    [extensionRegistry.surfaces],
  );
  const systemBrowserExtensionSurface = useMemo(
    () => findExtensionToolPanelBySlot(extensionRightToolPanels, 'browser'),
    [extensionRightToolPanels],
  );
  const systemKnowledgeExtensionSurface = useMemo(
    () => findExtensionToolPanelBySlot(extensionRightToolPanels, 'knowledge'),
    [extensionRightToolPanels],
  );
  const routePrimaryRailSurface = useMemo(() => {
    if (showWorkbench) return null;
    const pageSurface = extensionRegistry.surfaces.find(
      (surface) => isNativeExtensionPageSurface(surface) && routeMatchesPrefix(location.pathname, surface.route),
    );
    if (!pageSurface) return null;
    return (
      extensionRightToolPanels.find(
        (surface) =>
          surface.extensionId === pageSurface.extensionId &&
          'location' in surface &&
          surface.location === 'rightRail' &&
          getExtensionViewPlacement(surface) === 'primary',
      ) ?? null
    );
  }, [extensionRegistry.surfaces, extensionRightToolPanels, location.pathname, showWorkbench]);
  const showRoutePrimaryRail = routePrimaryRailSurface !== null && railOpen;
  const knowledgeRouteFileId =
    !showWorkbench && routeIsKnowledge(location.pathname, extensionRegistry.surfaces) ? (searchParams.get('file') ?? null) : null;
  const activeExtensionWorkbenchSurface = useMemo(
    () => resolveActiveExtensionWorkbenchSurface({ activeWorkbenchTool, extensionRightToolPanels, extensionWorkbenchSurfaces }),
    [activeWorkbenchTool, extensionRightToolPanels, extensionWorkbenchSurfaces],
  );
  const activeWorkbenchToolPanel = useMemo(() => {
    const parsed = parseExtensionToolPanelMode(activeWorkbenchTool);
    if (!parsed) return findExtensionToolPanelBySlot(extensionRightToolPanels, activeWorkbenchTool);
    return (
      extensionRightToolPanels.find((surface) => surface.extensionId === parsed.extensionId && surface.id === parsed.surfaceId) ?? null
    );
  }, [activeWorkbenchTool, extensionRightToolPanels]);
  const activeWorkbenchToolSlot = activeWorkbenchToolPanel ? inferSurfaceToolSlot(activeWorkbenchToolPanel) : activeWorkbenchTool;
  const activeWorkbenchHasPairedDocument =
    !((activeWorkbenchTool === 'files' || activeWorkbenchToolSlot === 'files') && !activeWorkbenchWorkspaceFileId) &&
    !(activeWorkbenchToolSlot === 'knowledge' && !activeWorkbenchKnowledgeFileId) &&
    !(isArtifactsRailMode(activeWorkbenchTool) && !activeWorkbenchArtifactId);
  const activeWorkbenchAllowsRailSurface = shouldAllowWorkbenchRailSurface({
    activeToolSlot: activeWorkbenchToolSlot,
    hasPairedDocument: activeWorkbenchHasPairedDocument,
  });
  const activeWorkbenchRailSurface =
    showWorkbench &&
    !isNewWorkbenchTabMode(activeWorkbenchTool) &&
    activeWorkbenchAllowsRailSurface &&
    activeExtensionWorkbenchSurface &&
    !isSinglePaneWorkbenchMode(activeWorkbenchTool, activeWorkbenchToolPanel)
      ? activeWorkbenchToolPanel
      : null;
  const effectiveWorkbenchExplorerOpen = workbenchExplorerOpen && activeWorkbenchRailSurface !== null;
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [commandPaletteMounted, setCommandPaletteMounted] = useState(false);
  const [pendingCommandPaletteOpen, setPendingCommandPaletteOpen] = useState<OpenCommandPaletteDetail | null>(null);

  const openWorkbenchToolTab = useCallback(
    (
      tool: WorkbenchRailMode,
      options?: { artifactId?: string | null; id?: string; conversationId?: string | null; forceNewTab?: boolean },
    ) => {
      if (tool === 'new') {
        setActiveWorkbenchTabId(null);
        return;
      }

      // Compute next tabs state and derive next active tab ID from current state.
      const current = openWorkbenchTabsRef.current;
      if (!options?.forceNewTab) {
        const existing =
          tool === 'chat' && options?.conversationId
            ? current.find((tab) => tab.mode === 'chat' && tab.conversationId === options.conversationId)
            : options?.id
              ? current.find((tab) => tab.id === options.id)
              : null;
        if (existing) {
          setActiveWorkbenchTabId(existing.id);
          return;
        }
      }
      const tab = createWorkbenchTabInstance(tool, options);
      setOpenWorkbenchTabs([...current, tab]);
      setActiveWorkbenchTabId(tab.id);

      if (activeConversationId && tool !== 'browser') {
        setSelectedToolByConversation((current) => ({
          ...current,
          [activeConversationId]: tool,
        }));
      }
    },
    [activeConversationId],
  );

  const setActiveConversationTool = useCallback(
    (tool: WorkbenchRailMode) => {
      if (tool === 'new') {
        setActiveWorkbenchTabId(null);
        return;
      }
      const existing = openWorkbenchTabsRef.current.find((tab) => tab.mode === tool);
      if (existing) {
        setActiveWorkbenchTabId(existing.id);
      } else {
        openWorkbenchToolTab(tool);
      }
      if (activeConversationId && tool !== 'browser') {
        setSelectedToolByConversation((current) => ({
          ...current,
          [activeConversationId]: tool,
        }));
      }
    },
    [activeConversationId, openWorkbenchToolTab],
  );

  const openWorkbenchNewTab = useCallback(() => {
    setActiveWorkbenchTabId(null);
  }, []);

  const closeWorkbenchTab = useCallback(
    (tabId: string) => {
      const current = openWorkbenchTabsRef.current;
      const closingIndex = current.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) return;

      const next = current.filter((tab) => tab.id !== tabId);
      const closingTab = current.find((tab) => tab.id === tabId);
      const nextWouldHaveNoTabs = next.length === 0;

      // Derive the next active tab ID.
      let nextActiveTabId: string | null = activeWorkbenchTabId;
      if (activeWorkbenchTabId === tabId) {
        if (next.length === 0) {
          nextActiveTabId = null;
        } else {
          const replacementIndex = Math.min(closingIndex, next.length - 1);
          nextActiveTabId = next[replacementIndex]?.id ?? null;
        }
      }

      setOpenWorkbenchTabs(next);
      setActiveWorkbenchTabId(nextActiveTabId);

      if (nextWouldHaveNoTabs && closingTab?.mode === 'files') {
        clearActiveWorkbenchFileSelection();
      }
    },
    [activeWorkbenchTabId, clearActiveWorkbenchFileSelection],
  );

  useEffect(() => {
    setExtensionCommandContext('route', location.pathname);
    setExtensionCommandContext('layout.mode', appLayoutMode);
    setExtensionCommandContext('conversation.hasActive', Boolean(activeConversationId));
  }, [activeConversationId, appLayoutMode, location.pathname]);

  const creatingNewConversationRef = useRef(false);
  const startNewConversationFromLayout = useCallback(
    async (
      focusComposer = false,
      draft?: {
        initialComposerText?: string | null;
        initialPromptText?: string | null;
        cwd?: string | null;
      },
    ) => {
      if (creatingNewConversationRef.current) {
        return false;
      }

      creatingNewConversationRef.current = true;
      try {
        await startNewConversation({
          navigate,
          focusComposer,
          cwd: draft?.cwd,
          initialComposerText: draft?.initialComposerText,
          initialPromptText: draft?.initialPromptText,
          replace: location.pathname === DRAFT_CONVERSATION_ROUTE,
        });
        return true;
      } catch (error) {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
          source: 'conversation',
        });
        return false;
      } finally {
        creatingNewConversationRef.current = false;
      }
    },
    [location.pathname, navigate],
  );

  const lastWorkbenchRouteRef = useRef<{ pathname: string; search: string }>({ pathname: '/conversations/new', search: '' });

  const handleToggleWorkbenchExplorer = useCallback(() => {
    setWorkbenchExplorerOpen((current) => {
      const next = !current;
      writeStoredWorkbenchExplorerOpen(next);
      return next;
    });
  }, []);

  const activeRightRailControl = showWorkbench
    ? activeWorkbenchRailSurface
      ? {
          railOpen: workbenchExplorerOpen,
          toggleRail: handleToggleWorkbenchExplorer,
        }
      : null
    : routePrimaryRailSurface
      ? {
          railOpen: showRoutePrimaryRail,
          toggleRail: () => setRailOpen((current) => !current),
        }
      : registeredRightRailControl;

  const handleAppLayoutModeChange = useCallback(
    (mode: AppLayoutMode) => {
      const previousMode = appLayoutMode;
      setAppLayoutMode(mode);
      writeAppLayoutMode(mode);

      if (mode === 'compact') {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(clearWorkbenchOnlySearchParamsForCompact(current.toString()));
            next.delete('view');
            return next;
          },
          { replace: true },
        );
        return;
      }

      if (mode === 'workbench' && previousMode === 'compact') {
        setWorkbenchExplorerOpen(true);
        writeStoredWorkbenchExplorerOpen(true);

        if (routeIsKnowledge(location.pathname, extensionRegistry.surfaces)) {
          const nextSearch = new URLSearchParams(lastWorkbenchRouteRef.current.search);
          nextSearch.delete('artifact');
          nextSearch.delete('checkpoint');
          nextSearch.delete('run');
          const activeKnowledgeFileId = searchParams.get('file');
          if (activeKnowledgeFileId) {
            nextSearch.set('file', activeKnowledgeFileId);
          } else {
            nextSearch.delete('file');
          }
          setActiveConversationTool(systemKnowledgeExtensionSurface ? extensionToolPanelMode(systemKnowledgeExtensionSurface) : 'files');
          navigate({
            pathname: lastWorkbenchRouteRef.current.pathname,
            search: nextSearch.toString(),
          });
          return;
        }
      }
    },
    [
      appLayoutMode,
      extensionRegistry.surfaces,
      location.pathname,
      navigate,
      searchParams,
      setActiveConversationTool,
      setSearchParams,
      systemKnowledgeExtensionSurface,
    ],
  );

  const handlePrimarySidebarToggle = useCallback(() => {
    setSidebarOpen((current) => !current);
  }, []);

  const handleWorkbenchToggle = useCallback(() => {
    handleAppLayoutModeChange(showWorkbench ? 'compact' : 'workbench');
  }, [handleAppLayoutModeChange, showWorkbench]);

  const executeCommandOptions = useMemo(
    () => ({
      navigate,
      extensionCommands,
      context: {
        route: location.pathname,
        'layout.mode': appLayoutMode,
        'conversation.hasActive': Boolean(activeConversationId),
      },
      goBack() {
        window.dispatchEvent(new CustomEvent(APP_NAVIGATION_COMMAND_EVENT, { detail: { direction: 'back' } }));
        return true;
      },
      goForward() {
        window.dispatchEvent(new CustomEvent(APP_NAVIGATION_COMMAND_EVENT, { detail: { direction: 'forward' } }));
        return true;
      },
      openNotifications() {
        startTransition(() => setNotificationCenterOpen(true));
        return true;
      },
      closeNotifications() {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CLOSE_EVENT));
        return true;
      },
      markAllNotificationsRead() {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_MARK_ALL_READ_EVENT));
        return true;
      },
      dismissAllNotifications() {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_DISMISS_ALL_EVENT));
        return true;
      },
      openCommandPalette(scope?: string) {
        window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope } }));
      },
      openRightRail(target: string) {
        const surface = extensionRightToolPanels.find((candidate) => `${candidate.extensionId}/${candidate.id}` === target);
        if (!surface) return false;
        const mode = extensionToolPanelMode(surface);
        setAppLayoutMode('workbench');
        writeAppLayoutMode('workbench');
        if (isSinglePaneWorkbenchMode(mode, surface)) {
          openWorkbenchToolTab(mode);
          return true;
        }
        setActiveConversationTool(mode);
        setWorkbenchExplorerOpen(true);
        writeStoredWorkbenchExplorerOpen(true);
        return true;
      },
      setLayout(mode: 'compact' | 'workbench') {
        writeAppLayoutMode(mode);
        setAppLayoutMode(mode);
      },
      toggleLayout() {
        handleAppLayoutModeChange(appLayoutMode === 'workbench' ? 'compact' : 'workbench');
        return true;
      },
      toggleSidebar() {
        handlePrimarySidebarToggle();
        return true;
      },
      toggleRightRail() {
        if (canToggleWorkbench) {
          handleWorkbenchToggle();
          return true;
        }
        activeRightRailControl?.toggleRail();
        return activeRightRailControl !== null;
      },
      findOnPage() {
        dispatchDesktopShortcutAction('find-in-page');
        return true;
      },
      findNextOnPage() {
        dispatchDesktopShortcutCommand('page.findNext');
        return true;
      },
      findPreviousOnPage() {
        dispatchDesktopShortcutCommand('page.findPrevious');
        return true;
      },
      closePageSearch() {
        dispatchDesktopShortcutCommand('page.closeFind');
        return true;
      },
      closeConversation() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.closeConversation);
        return true;
      },
      reopenClosedConversation() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.reopenClosedConversation);
        return true;
      },
      toggleConversationPin() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.toggleConversationPin);
        return true;
      },
      toggleConversationArchive() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.toggleConversationArchive);
        return true;
      },
      renameConversation() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.renameConversation);
        return true;
      },
      saveConversationTitle() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.saveConversationTitle);
        return true;
      },
      cancelConversationTitleEdit() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.cancelConversationTitleEdit);
        return true;
      },
      editConversationCwd() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.editConversationCwd);
        return true;
      },
      saveConversationCwd() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.saveConversationCwd);
        return true;
      },
      cancelConversationCwdEdit() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.cancelConversationCwdEdit);
        return true;
      },
      cancelConversationGoal() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_CANCEL_GOAL_COMMAND_EVENT));
        return true;
      },
      continueDeferredResumes() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT));
        return true;
      },
      toggleBackgroundRunDetails() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT));
        return true;
      },
      toggleDeferredResumeDetails() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT));
        return true;
      },
      toggleScheduledTaskDetails() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT));
        return true;
      },
      openLatestBackgroundRun() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT));
        return true;
      },
      cancelLatestBackgroundRun() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT));
        return true;
      },
      runFirstScheduledTask() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT));
        return true;
      },
      openFirstScheduledTask() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT));
        return true;
      },
      fireFirstDeferredResume() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT));
        return true;
      },
      cancelFirstDeferredResume() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT));
        return true;
      },
      restoreFirstQueuedPrompt() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT));
        return true;
      },
      openActiveCheckpoint() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_ACTIVE_CHECKPOINT_COMMAND_EVENT));
        return true;
      },
      openLatestCheckpoint() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_LATEST_CHECKPOINT_COMMAND_EVENT));
        return true;
      },
      scrollFirstCheckpointFile() {
        window.dispatchEvent(new CustomEvent(CONVERSATION_SCROLL_FIRST_CHECKPOINT_FILE_COMMAND_EVENT));
        return true;
      },
      newWorkbenchTab() {
        openWorkbenchNewTab();
        return true;
      },
      closeActiveWorkbenchTab() {
        if (!activeWorkbenchTabId) return false;
        closeWorkbenchTab(activeWorkbenchTabId);
        return true;
      },
      closeActiveWorkbenchFile() {
        const hasActiveFile = Boolean(
          activeWorkbenchArtifactId || activeWorkbenchKnowledgeFileId || activeWorkbenchWorkspaceFileId,
        );
        if (!hasActiveFile) return false;
        window.dispatchEvent(new CustomEvent(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT));
        return true;
      },
      refreshActiveWorkbenchFile() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT));
        return true;
      },
      toggleWorkbenchExplorer() {
        if (!activeWorkbenchRailSurface) return false;
        handleToggleWorkbenchExplorer();
        return true;
      },
      toggleWorkbenchDiff() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_TOGGLE_DIFF_EVENT));
        return true;
      },
      browserNewTab() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'newTab' } }));
        return true;
      },
      browserReopenTab() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'reopenTab' } }));
        return true;
      },
      browserCloseTab() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'closeTab' } }));
        return true;
      },
      browserGoBack() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'goBack' } }));
        return true;
      },
      browserGoForward() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'goForward' } }));
        return true;
      },
      browserReloadOrStop() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'reloadOrStop' } }));
        return true;
      },
      browserFocusLocation() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'focusLocation' } }));
        return true;
      },
      browserClose() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'close' } }));
        return true;
      },
      artifactCopySource() {
        window.dispatchEvent(new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'copySource' } }));
        return true;
      },
      artifactToggleSource() {
        window.dispatchEvent(new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'toggleSource' } }));
        return true;
      },
      artifactToggleFullscreen() {
        window.dispatchEvent(
          new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'toggleFullscreen' } }),
        );
        return true;
      },
      artifactClose() {
        window.dispatchEvent(new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'close' } }));
        return true;
      },
      closeImagePreview() {
        window.dispatchEvent(new CustomEvent(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT));
        return true;
      },
      inspectFirstImagePreview() {
        window.dispatchEvent(new CustomEvent<ImagePreviewCommandDetail>(IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      loadFirstImagePreview() {
        window.dispatchEvent(new CustomEvent<ImagePreviewCommandDetail>(IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      copyFirstMessageAction() {
        window.dispatchEvent(new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'copyFirst' } }));
        return true;
      },
      editFirstMessageAction() {
        window.dispatchEvent(new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'editFirst' } }));
        return true;
      },
      rewindFirstMessageAction() {
        window.dispatchEvent(new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'rewindFirst' } }));
        return true;
      },
      forkFirstMessageAction() {
        window.dispatchEvent(new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'forkFirst' } }));
        return true;
      },
      saveMessageEdit() {
        window.dispatchEvent(new CustomEvent<MessageEditCommand>(MESSAGE_EDIT_COMMAND_EVENT, { detail: 'save' }));
        return true;
      },
      cancelMessageEdit() {
        window.dispatchEvent(new CustomEvent<MessageEditCommand>(MESSAGE_EDIT_COMMAND_EVENT, { detail: 'cancel' }));
        return true;
      },
      closeDrawingPicker() {
        window.dispatchEvent(new CustomEvent(DRAWING_PICKER_CLOSE_COMMAND_EVENT));
        return true;
      },
      attachFirstDrawingFromPicker() {
        window.dispatchEvent(new CustomEvent(DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT));
        return true;
      },
      toggleFirstDrawingHistory() {
        window.dispatchEvent(new CustomEvent(DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT));
        return true;
      },
      closeDraftWorkspacePicker() {
        window.dispatchEvent(new CustomEvent(DRAFT_WORKSPACE_PICKER_CLOSE_COMMAND_EVENT));
        return true;
      },
      closeWorkspaceQuickSelect() {
        window.dispatchEvent(new CustomEvent(WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT));
        return true;
      },
      closeExtensionModal() {
        window.dispatchEvent(new CustomEvent(EXTENSION_MODAL_CLOSE_COMMAND_EVENT));
        return true;
      },
      focusComposer() {
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Message"]');
        textarea?.focus();
      },
      submitComposer() {
        window.dispatchEvent(new CustomEvent('neon-pilot:composer-submit'));
        return true;
      },
      stopComposer() {
        window.dispatchEvent(new CustomEvent('neon-pilot:composer-stop'));
        return true;
      },
      clearComposer() {
        window.dispatchEvent(new CustomEvent('neon-pilot:composer-clear'));
        return true;
      },
      openComposerSettings() {
        window.dispatchEvent(new CustomEvent(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT));
        return true;
      },
      closeComposerSettings() {
        window.dispatchEvent(new CustomEvent(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT));
        return true;
      },
      openComposerPreferences() {
        window.dispatchEvent(new CustomEvent(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT));
        return true;
      },
      closeComposerPreferences() {
        window.dispatchEvent(new CustomEvent(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT));
        return true;
      },
      previewFirstComposerAttachment() {
        window.dispatchEvent(new CustomEvent(COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT));
        return true;
      },
      removeFirstComposerAttachment() {
        window.dispatchEvent(new CustomEvent(COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT));
        return true;
      },
      previewFirstComposerDrawing() {
        window.dispatchEvent(new CustomEvent(COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT));
        return true;
      },
      editFirstComposerDrawing() {
        window.dispatchEvent(new CustomEvent(COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT));
        return true;
      },
      removeFirstComposerDrawing() {
        window.dispatchEvent(new CustomEvent(COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT));
        return true;
      },
      pageConversation(direction: 'up' | 'down') {
        const scrollShell = document.querySelector<HTMLElement>('.conversation-scroll-shell');
        if (!scrollShell) return false;
        scrollShell.scrollBy({ top: (direction === 'down' ? 1 : -1) * Math.max(240, scrollShell.clientHeight * 0.82), behavior: 'smooth' });
        return true;
      },
      cycleModel() {
        return cycleSelectByLabel('Conversation model');
      },
      cycleThinking() {
        return cycleSelectByLabel('Conversation thinking level');
      },
      newConversation(args?: { initialComposerText?: string | null; initialPromptText?: string | null; cwd?: string | null }) {
        return startNewConversationFromLayout(false, args);
      },
      newConversationAndFocus(args?: { initialComposerText?: string | null; initialPromptText?: string | null; cwd?: string | null }) {
        return startNewConversationFromLayout(true, args);
      },
      toggleDictation() {
        window.dispatchEvent(new CustomEvent('neon-pilot:dictation-toggle'));
        return true;
      },
      focusSidebar() {
        document.querySelector<HTMLElement>('aside a, aside button, nav a, nav button')?.focus();
      },
      focusNext() {
        return moveDocumentFocus(1);
      },
      focusPrevious() {
        return moveDocumentFocus(-1);
      },
      activateSelection() {
        const active = document.activeElement;
        if (
          active instanceof HTMLButtonElement ||
          active instanceof HTMLAnchorElement ||
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          (active instanceof HTMLElement && active.tabIndex >= 0)
        ) {
          active.click();
          return true;
        }
        return false;
      },
      navigateConversation(direction: 'next' | 'previous') {
        if (!activeConversationId) return false;
        const layout = readConversationLayout();
        const conversationIds = [...layout.pinnedSessionIds, ...layout.sessionIds];
        const currentIndex = conversationIds.indexOf(activeConversationId);
        if (currentIndex === -1 || conversationIds.length < 2) return false;
        const delta = direction === 'next' ? 1 : -1;
        const nextId = conversationIds[(currentIndex + delta + conversationIds.length) % conversationIds.length];
        navigate(`/conversations/${encodeURIComponent(nextId)}`);
        return true;
      },
      activeConversationId,
      invokeExtensionCommand(command: ExtensionCommandRegistration, args: unknown) {
        return api.invokeExtensionAction(command.extensionId, command.action, args ?? {});
      },
    }),
    [
      activeRightRailControl,
      activeConversationId,
      activeWorkbenchArtifactId,
      activeWorkbenchKnowledgeFileId,
      activeWorkbenchRailSurface,
      activeWorkbenchTabId,
      activeWorkbenchWorkspaceFileId,
      appLayoutMode,
      canToggleWorkbench,
      closeWorkbenchTab,
      extensionCommands,
      extensionRightToolPanels,
      handleAppLayoutModeChange,
      handlePrimarySidebarToggle,
      handleWorkbenchToggle,
      location.pathname,
      navigate,
      openWorkbenchNewTab,
      openWorkbenchToolTab,
      setActiveConversationTool,
      startNewConversationFromLayout,
      handleToggleWorkbenchExplorer,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([api.extensionKeybindings(), api.extensionCommands()])
        .then(([keybindings, commands]) => {
          if (!cancelled) {
            setExtensionKeybindings(keybindings);
            setExtensionCommands(commands);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setExtensionKeybindings([]);
            setExtensionCommands([]);
          }
        });
    };
    load();
    window.addEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
    };
  }, [versions.extensions]);

  useEffect(() => {
    function handleExtensionKeybinding(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const match = findMatchingExtensionKeybinding(
        event,
        extensionKeybindings.filter((keybinding) => keybinding.enabled && keybinding.scope === 'global'),
        executeCommandOptions.context,
      );
      if (!match) return;
      if (!canExecuteExtensionCommand(match.command, match.args, executeCommandOptions)) return;
      event.preventDefault();
      event.stopPropagation();
      void executeExtensionCommand(match.command, match.args, executeCommandOptions);
    }

    function handleExtensionCommandExecute(event: CustomEvent) {
      const detail = event.detail as { command?: string; args?: unknown; requestId?: string; resolve?: (handled: boolean) => void };
      if (!detail.command) return;
      void executeExtensionCommand(detail.command, detail.args, executeCommandOptions).then((handled) => {
        detail.resolve?.(handled);
        if (detail.requestId) void api.acknowledgeExtensionCommand(detail.requestId, handled).catch(() => undefined);
      });
    }

    window.addEventListener('keydown', handleExtensionKeybinding, true);
    window.addEventListener('neon-pilot-extension-command-execute', handleExtensionCommandExecute as EventListener);
    return () => {
      window.removeEventListener('keydown', handleExtensionKeybinding, true);
      window.removeEventListener('neon-pilot-extension-command-execute', handleExtensionCommandExecute as EventListener);
    };
  }, [executeCommandOptions, extensionKeybindings]);

  useEffect(() => {
    if (!routeSupportsWorkbench(location.pathname, extensionRegistry.surfaces)) {
      return;
    }
    lastWorkbenchRouteRef.current = { pathname: location.pathname, search: location.search };
  }, [extensionRegistry.surfaces, location.pathname, location.search]);

  // Cwd change: clear workspace file if its cwd no longer matches

  // Save/restore per-conversation window state + runs reset when switching conversations
  useEffect(() => {
    const previousConversationId = previousActiveConversationIdRef.current;
    previousActiveConversationIdRef.current = activeConversationId;

    if (previousConversationId === activeConversationId) {
      return;
    }

    // Save outgoing conversation state (skip browser which is global)
    if (previousConversationId) {
      if (activeWorkbenchTool !== 'browser') {
        setSelectedToolByConversation((current) => ({
          ...current,
          [previousConversationId]: activeWorkbenchTool,
        }));
      }
      setSelectedFileByConversation((current) => ({
        ...current,
        [previousConversationId]: activeWorkbenchKnowledgeFileId,
      }));
      setSelectedWorkspaceFileByConversation((current) => ({
        ...current,
        [previousConversationId]: activeWorkbenchWorkspaceFileIdRef.current,
      }));
      setSelectedArtifactByConversation((current) => ({
        ...current,
        [previousConversationId]: activeWorkbenchArtifactId,
      }));
    }

    if (!activeConversationId) {
      return;
    }

    // Restore incoming conversation state
    if (activeWorkbenchTool !== 'browser') {
      // Restore tool: prefer saved per-conversation state unless it would keep
      // stale run detail visible after moving to a different conversation.
      const savedTool = selectedToolByConversation[activeConversationId];
      if (savedTool) {
        setActiveConversationTool(savedTool);
      } else {
        openWorkbenchNewTab();
      }

      const savedWorkspaceFile = selectedWorkspaceFileByConversationRef.current[activeConversationId];
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (savedWorkspaceFile) {
            next.delete('file');
            next.delete('artifact');
            next.delete('checkpoint');
            next.delete('run');
            next.set('workspaceFile', savedWorkspaceFile);
          } else {
            next.delete('workspaceFile');
          }
          return next;
        },
        { replace: true },
      );
    }
  }, [
    activeConversationId,
    activeWorkbenchArtifactId,
    activeWorkbenchKnowledgeFileId,
    activeWorkbenchTool,
    activeWorkspaceCwd,
    openWorkbenchNewTab,
    setActiveConversationTool,
    selectedToolByConversation,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const workspaceFile = new URLSearchParams(location.search).get('workspaceFile');
    if (!workspaceFile) {
      return;
    }

    setSelectedWorkspaceFileByConversation((current) => ({
      ...current,
      [activeConversationId]: workspaceFile,
    }));
    setActiveConversationTool('files');
  }, [activeConversationId, location.search, setActiveConversationTool]);

  useEffect(() => {
    if (!activeWorkbenchKnowledgeFileId) {
      return;
    }

    // Don't override to files when a route-based knowledge file selection is active.
    if (routeIsKnowledge(location.pathname, extensionRegistry.surfaces)) {
      return;
    }

    setActiveConversationTool(systemKnowledgeExtensionSurface ? extensionToolPanelMode(systemKnowledgeExtensionSurface) : 'files');
  }, [activeWorkbenchKnowledgeFileId, setActiveConversationTool, systemKnowledgeExtensionSurface]);

  useEffect(() => {
    function handleWorkbenchCloseActiveFile() {
      if (activeWorkbenchArtifactId) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.delete('artifact');
            return next;
          },
          { replace: true },
        );
        return;
      }

      if (activeWorkbenchKnowledgeFileId || activeWorkbenchWorkspaceFileId) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.delete('file');
            next.delete('workspaceFile');
            return next;
          },
          { replace: true },
        );
        return;
      }
    }

    window.addEventListener(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT, handleWorkbenchCloseActiveFile);
    return () => window.removeEventListener(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT, handleWorkbenchCloseActiveFile);
  }, [activeWorkbenchArtifactId, activeWorkbenchKnowledgeFileId, activeWorkbenchWorkspaceFileId, setSearchParams]);

  useEffect(() => {
    if (commandPaletteMounted) {
      return;
    }

    const timer = window.setTimeout(() => setCommandPaletteMounted(true), 750);
    const mountImmediately = (event: Event) => {
      setPendingCommandPaletteOpen((event as CustomEvent<OpenCommandPaletteDetail>).detail ?? {});
      setCommandPaletteMounted(true);
    };
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, mountImmediately, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, mountImmediately);
    };
  }, [commandPaletteMounted]);

  useEffect(() => {
    if (!commandPaletteMounted || pendingCommandPaletteOpen === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: pendingCommandPaletteOpen }));
      setPendingCommandPaletteOpen(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commandPaletteMounted, pendingCommandPaletteOpen]);

  const handleStartSideChat = useCallback(async () => {
    if (!activeConversationId) return;
    const parentPreferencesPromise = api.conversationModelPreferences(activeConversationId).catch(() => null);
    try {
      const reserved = await api.reserveConversation(activeWorkspaceCwd ?? undefined);
      primeReservedDesktopConversationStateCache(
        {
          conversationId: reserved.id,
          sessionFile: reserved.sessionFile,
          cwd: reserved.cwd,
        },
        { tailBlocks: 400 },
      );
      openWorkbenchToolTab('chat', { conversationId: reserved.id, forceNewTab: true });

      const createdPromise = parentPreferencesPromise.then((parentPreferences) =>
        api.createLiveSession(activeWorkspaceCwd ?? undefined, undefined, {
          workspaceCwd: activeWorkspaceCwd ?? undefined,
          reservedSessionFile: reserved.sessionFile,
          ...(parentPreferences?.currentModel ? { model: parentPreferences.currentModel } : {}),
          ...(parentPreferences?.currentThinkingLevel ? { thinkingLevel: parentPreferences.currentThinkingLevel } : {}),
          ...(parentPreferences?.currentServiceTier ? { serviceTier: parentPreferences.currentServiceTier } : {}),
        }),
      );
      registerPendingSideChatSession(reserved.id, createdPromise);
      void createdPromise
        .then((result) => {
          // Prime the desktop conversation state cache so ChatRail loads instantly
          // instead of waiting for a REST round-trip.
          if (result.bootstrap) {
            primeDesktopConversationStateCache(result.id, result.bootstrap, { tailBlocks: 400 });
          }
        })
        .catch(() => {
          // Chat tab creation failed silently.
        });
      return reserved.id;
    } catch {
      // Chat tab reservation failed silently.
    }
  }, [activeConversationId, activeWorkspaceCwd, openWorkbenchToolTab]);

  useEffect(() => {
    function handleCompanionChatOpen(event: Event) {
      const detail = (event as CustomEvent<CompanionChatOpenDetail>).detail;
      if (!detail?.conversationId) return;
      handleAppLayoutModeChange('workbench');
      openWorkbenchToolTab('chat', { conversationId: detail.conversationId, forceNewTab: detail.forceNewTab });
    }

    function handleCompanionChatClose(event: Event) {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (!detail?.conversationId) return;
      closeWorkbenchTab(detail.conversationId);
    }

    window.addEventListener(COMPANION_CHAT_OPEN_EVENT, handleCompanionChatOpen);
    window.addEventListener(COMPANION_CHAT_CLOSE_EVENT, handleCompanionChatClose);
    return () => {
      window.removeEventListener(COMPANION_CHAT_OPEN_EVENT, handleCompanionChatOpen);
      window.removeEventListener(COMPANION_CHAT_CLOSE_EVENT, handleCompanionChatClose);
    };
  }, [closeWorkbenchTab, handleAppLayoutModeChange, openWorkbenchToolTab]);

  useEffect(() => {
    function handleDesktopShortcut(event: Event) {
      if (hasBlockingOverlayOpen()) {
        return;
      }

      const detail = (event as CustomEvent<{ action?: unknown; command?: unknown; args?: unknown }>).detail;
      if (detail?.action === undefined && typeof detail.command === 'string' && detail.command.trim()) {
        void executeExtensionCommand(detail.command, detail.args, executeCommandOptions);
        return;
      }

      const action = detail?.action;
      if (!isDesktopLayoutShortcutAction(action)) {
        return;
      }

      const { command, args } = desktopLayoutShortcutCommand(action);
      void executeExtensionCommand(command, args, executeCommandOptions);
    }

    function handleDesktopNavigate(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isDesktopNavigateDetail(detail)) {
        return;
      }

      const nextRoute = detail.route.trim();
      const currentRoute = `${location.pathname}${location.search}${location.hash}`;
      if (!nextRoute || nextRoute === currentRoute) {
        return;
      }

      navigate(nextRoute, { replace: detail.replace === true });
    }

    function handleShowWorkbenchBrowser() {
      if (!routeSupportsWorkbench(location.pathname, extensionRegistry.surfaces)) {
        navigate('/conversations/new');
      }
      handleAppLayoutModeChange('workbench');
      openWorkbenchToolTab(systemBrowserExtensionSurface ? extensionToolPanelMode(systemBrowserExtensionSurface) : 'files');
    }

    function handleOpenWorkbenchToolTab(event: Event) {
      const tool = (event as CustomEvent<{ tool?: unknown }>).detail?.tool;
      if (tool !== 'browser') return;
      handleAppLayoutModeChange('workbench');
      openWorkbenchToolTab(systemBrowserExtensionSurface ? extensionToolPanelMode(systemBrowserExtensionSurface) : 'browser');
    }

    function handleOpenWorkbenchArtifactTab(event: Event) {
      const artifactId = (event as CustomEvent<{ artifactId?: unknown }>).detail?.artifactId;
      if (typeof artifactId !== 'string' || artifactId.trim().length === 0) return;
      handleAppLayoutModeChange('workbench');
      const systemArtifactsExtensionSurface = findExtensionToolPanelBySlot(extensionRightToolPanels, 'artifacts');
      openWorkbenchToolTab(systemArtifactsExtensionSurface ? extensionToolPanelMode(systemArtifactsExtensionSurface) : 'artifacts', {
        id: `artifact:${artifactId}`,
        artifactId,
      });
    }

    function handleOpenWorkbenchWorkspaceFile(event: Event) {
      const path = (event as CustomEvent<{ path?: unknown }>).detail?.path;
      if (typeof path !== 'string' || path.trim().length === 0 || !activeConversationId) return;
      const workspaceFile = path.trim().replace(/^\.\/+/, '');
      handleAppLayoutModeChange('workbench');
      setSelectedWorkspaceFileByConversation((current) => ({
        ...current,
        [activeConversationId]: workspaceFile,
      }));
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('file');
        next.delete('artifact');
        next.delete('checkpoint');
        next.delete('run');
        next.set('workspaceFile', workspaceFile);
        return next;
      });
      setActiveConversationTool('files');
    }

    function handleCloseWorkbenchTab(event: Event) {
      const tabId = (event as CustomEvent<{ tabId?: unknown }>).detail?.tabId;
      if (typeof tabId !== 'string' || tabId.trim().length === 0) return;
      closeWorkbenchTab(tabId);
    }

    window.addEventListener(DESKTOP_SHORTCUT_EVENT, handleDesktopShortcut);
    window.addEventListener(DESKTOP_NAVIGATE_EVENT, handleDesktopNavigate);
    window.addEventListener(DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT, handleShowWorkbenchBrowser);
    window.addEventListener(WORKBENCH_OPEN_TOOL_TAB_EVENT, handleOpenWorkbenchToolTab);
    window.addEventListener(WORKBENCH_OPEN_ARTIFACT_TAB_EVENT, handleOpenWorkbenchArtifactTab);
    window.addEventListener(WORKBENCH_OPEN_WORKSPACE_FILE_EVENT, handleOpenWorkbenchWorkspaceFile);
    window.addEventListener(WORKBENCH_CLOSE_TAB_EVENT, handleCloseWorkbenchTab);
    return () => {
      window.removeEventListener(DESKTOP_SHORTCUT_EVENT, handleDesktopShortcut);
      window.removeEventListener(DESKTOP_NAVIGATE_EVENT, handleDesktopNavigate);
      window.removeEventListener(DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT, handleShowWorkbenchBrowser);
      window.removeEventListener(WORKBENCH_OPEN_TOOL_TAB_EVENT, handleOpenWorkbenchToolTab);
      window.removeEventListener(WORKBENCH_OPEN_ARTIFACT_TAB_EVENT, handleOpenWorkbenchArtifactTab);
      window.removeEventListener(WORKBENCH_OPEN_WORKSPACE_FILE_EVENT, handleOpenWorkbenchWorkspaceFile);
      window.removeEventListener(WORKBENCH_CLOSE_TAB_EVENT, handleCloseWorkbenchTab);
    };
  }, [
    activeConversationId,
    closeWorkbenchTab,
    executeCommandOptions,
    handleAppLayoutModeChange,
    location.hash,
    extensionRegistry.surfaces,
    location.pathname,
    location.search,
    navigate,
    openWorkbenchToolTab,
    extensionRightToolPanels,
    systemBrowserExtensionSurface,
    setActiveConversationTool,
    setSearchParams,
  ]);

  return (
    <NotificationProvider>
      <NotificationCommandBridge open={notificationCenterOpen} onClose={() => setNotificationCenterOpen(false)} />
      <DesktopChromeContext.Provider value={{ setRightRailControl: setRegisteredRightRailControl }}>
        <div className="flex h-screen flex-col overflow-hidden bg-base text-primary select-none">
          <DesktopTopBar
            environment={desktopEnvironment}
            sidebarOpen={effectiveSidebarOpen}
            onToggleSidebar={handlePrimarySidebarToggle}
            showRailToggle={canToggleWorkbench || activeRightRailControl !== null}
            railOpen={canToggleWorkbench ? showWorkbench : (activeRightRailControl?.railOpen ?? false)}
            onToggleRail={canToggleWorkbench ? handleWorkbenchToggle : (activeRightRailControl?.toggleRail ?? (() => {}))}
            trailingExtra={
              <NotificationBell
                onClick={() => {
                  startTransition(() => setNotificationCenterOpen((open) => !open));
                }}
              />
            }
          />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {effectiveSidebarOpen ? (
              <div
                style={{ width: sidebar.width }}
                className="relative z-20 flex-shrink-0 flex flex-col overflow-hidden bg-panel border-r border-border-subtle"
              >
                <Suspense fallback={<div className="flex-1 bg-panel" aria-label="Loading sidebar" />}>
                  <Sidebar />
                </Suspense>
              </div>
            ) : null}

            {effectiveSidebarOpen ? <ResizeHandle onMouseDown={sidebar.onMouseDown} /> : null}

            <div ref={pageSearchRootRef} className="relative z-0 flex min-w-0 flex-1 overflow-hidden">
              <RouteContentBoundary resetKey={`${location.pathname}${location.search}`} pathname={location.pathname}>
                {showWorkbench ? (
                  <>
                    <main className="min-w-[260px] flex-1 overflow-y-auto overflow-x-hidden select-text">
                      <Outlet />
                    </main>
                    <ResizeHandle onMouseDown={workbenchDocument.onMouseDown} onDoubleClick={workbenchDocument.reset} />
                    <WorkbenchPanel
                      width={workbenchDocument.width + (effectiveWorkbenchExplorerOpen ? workbenchExplorer.width : 0)}
                      conversationId={activeConversationId}
                      artifactId={activeWorkbenchArtifactId}
                      knowledgeFileId={activeWorkbenchKnowledgeFileId}
                      workspaceFileId={activeWorkbenchWorkspaceFileId}
                      activeTool={activeWorkbenchTool}
                      activeTabId={activeWorkbenchTabId}
                      activeWorkspaceFileId={activeWorkbenchWorkspaceFileId}
                      activeKnowledgeFileId={activeWorkbenchKnowledgeFileId}
                      activeChatConversationId={activeWorkbenchChatConversationId}
                      workspaceCwd={activeWorkspaceCwd}
                      extensionWorkbenchSurface={activeExtensionWorkbenchSurface}
                      extensionRailSurface={activeWorkbenchRailSurface}
                      extensionToolPanels={extensionRightToolPanels}
                      browserTabsState={browserTabsState}
                      openTabs={openWorkbenchTabs}
                      railOpen={effectiveWorkbenchExplorerOpen}
                      railWidth={workbenchExplorer.width}
                      onRailResizeMouseDown={workbenchExplorer.onMouseDown}
                      onRailResizeReset={workbenchExplorer.reset}
                      onActiveTabChange={setActiveWorkbenchTabId}
                      onCloseTab={closeWorkbenchTab}
                      onOpenNewTab={openWorkbenchNewTab}
                      onActiveToolChange={openWorkbenchToolTab}
                      onRailOpenChange={(open) => {
                        setWorkbenchExplorerOpen(open);
                        writeStoredWorkbenchExplorerOpen(open);
                      }}
                      onWorkspaceFileClear={clearActiveWorkbenchFileSelection}
                      onStartSideChat={handleStartSideChat}
                    />
                  </>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    {knowledgeRouteFileId ? (
                      <FileDocumentBar
                        filePath={knowledgeRouteFileId}
                        railOpen={false}
                        canToggleRail={false}
                        onRailOpenChange={setRailOpen}
                      />
                    ) : null}
                    <div className="flex min-h-0 flex-1 overflow-hidden">
                      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden select-text">
                        <Outlet />
                      </main>

                      {showRoutePrimaryRail && routePrimaryRailSurface ? (
                        <>
                          <ResizeHandle onMouseDown={rail.onMouseDown} onDoubleClick={rail.reset} />
                          <aside
                            style={{ width: railWidth }}
                            className="relative z-10 flex-shrink-0 overflow-hidden border-l border-border-subtle bg-panel select-text [&>[data-extension-id]]:bg-panel"
                          >
                            <NativeExtensionSurfaceHost
                              surface={routePrimaryRailSurface}
                              pathname={location.pathname}
                              search={location.search}
                              hash={location.hash}
                              conversationId={activeConversationId}
                              cwd={activeWorkspaceCwd}
                            />
                          </aside>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </RouteContentBoundary>
            </div>
          </div>
        </div>
      </DesktopChromeContext.Provider>

      <Suspense fallback={null}>
        <NotificationToaster />
      </Suspense>
      {notificationCenterOpen ? (
        <Suspense fallback={null}>
          <NotificationCenter onClose={() => setNotificationCenterOpen(false)} />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <ExtensionModalHost />
      </Suspense>
      <Suspense fallback={null}>
        <PageSearchBar rootRef={pageSearchRootRef} desktopShell={desktopEnvironment?.isElectron ?? isDesktopShell()} />
      </Suspense>
      {commandPaletteMounted ? (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      ) : null}
    </NotificationProvider>
  );
}
