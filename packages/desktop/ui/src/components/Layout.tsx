import { Component, type ReactNode, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import { OPEN_COMMAND_PALETTE_EVENT, type OpenCommandPaletteDetail } from '../commands/commandPaletteEvents';
import { DESKTOP_SHORTCUT_EVENT } from '../commands/desktopShortcutEvents';
import { getConversationArtifactIdFromSearch, setConversationArtifactIdInSearch } from '../conversation/conversationArtifacts';
import {
  buildConversationDeeplink,
  buildConversationSurfacePath,
  readConversationIdFromPathname,
} from '../conversation/conversationRoutes';
import {
  DRAFT_CONVERSATION_ROUTE,
  DRAFT_CONVERSATION_STATE_CHANGED_EVENT,
  readDraftConversationCwd,
} from '../conversation/draftConversation';
import { startNewConversation } from '../conversation/newConversationNavigation';
import { writeClipboardText } from '../desktop/clipboard';
import { DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT, isDesktopShell, readDesktopEnvironment } from '../desktop/desktopBridge';
import { DesktopChromeContext, type DesktopRightRailControl } from '../desktop/desktopChromeContext';
import { canExecuteExtensionCommand, executeExtensionCommand, setExtensionCommandContext } from '../extensions/commands';
import { buildExtensionCommandNotification } from '../extensions/extensionCommandNotifications';
import { EXTENSION_MODAL_CLOSE_COMMAND_EVENT } from '../extensions/extensionModalCommands';
import { EXTENSION_REGISTRY_CHANGED_EVENT } from '../extensions/extensionRegistryEvents';
import { findMatchingExtensionKeybinding, isShortcutCaptureActive, isShortcutCaptureEventTarget } from '../extensions/keybindings';
import { NativeExtensionSurfaceHost } from '../extensions/NativeExtensionSurfaceHost';
import { readExtensionSelection, setExtensionSelection } from '../extensions/selection';
import {
  type ExtensionCommandRegistration,
  type ExtensionKeybindingRegistration,
  type ExtensionRightToolPanelSurface,
  type ExtensionSurfaceSummary,
  getExtensionViewPlacement,
  isExtensionRightToolPanelSurface,
  isNativeExtensionRightRailSurface,
  isNativeExtensionWorkbenchSurface,
  type NativeExtensionViewSummary,
} from '../extensions/types';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { primeDesktopConversationStateCache, primeReservedDesktopConversationStateCache } from '../hooks/useDesktopConversationState';
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../local/localSettings';
import {
  BROWSER_TABS_CHANGED_EVENT,
  type BrowserTabsState,
  executeBrowserTabsCommand,
  readBrowserTabsState,
} from '../local/workbenchBrowserTabs';
import { attemptLazyRouteRecovery, isRecoverableLazyRouteError, lazyRouteWithRecovery } from '../navigation/lazyRouteRecovery';
import { routeIsKnowledge, routeMatchesPrefix, routeSupportsWorkbench } from '../navigation/routeRegistry';
import { CONVERSATION_LAYOUT_CHANGED_EVENT, ensureConversationTabOpen, readConversationLayout } from '../session/sessionTabs';
import type { DesktopEnvironmentState, SessionMeta } from '../shared/types';
import { useAllSessions } from '../store';
import { useRouteTelemetry } from '../telemetry/appTelemetry';
import { APP_LAYOUT_MODE_CHANGED_EVENT, type AppLayoutMode, readAppLayoutMode, writeAppLayoutMode } from '../ui-state/appLayoutMode';
import { clampPanelWidth, getRailInitialWidth, getRailLayoutPrefs, getRailMaxWidth } from '../ui-state/layoutSizing';
import { isWindowedShellChild } from '../ui-state/windowedShell';
import {
  WORKBENCH_CHAT_CLOSE_EVENT,
  WORKBENCH_CHAT_OPEN_EVENT,
  WORKBENCH_CHAT_TAB_DRAG_MIME,
  WORKBENCH_PROMOTE_CHAT_EVENT,
  type WorkbenchChatOpenDetail,
} from '../workbench/workbenchChatEvents';
import { ARTIFACT_MODAL_COMMAND_EVENT, type ArtifactModalCommand } from './artifactModalCommands';
import {
  COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT,
} from './chat/composerAttachmentCommands';
import { FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, type FileChangeCommandDetail } from './chat/fileChangeCommands';
import {
  IMAGE_PREVIEW_CLOSE_COMMAND_EVENT,
  IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT,
  IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT,
  type ImagePreviewCommandDetail,
} from './chat/imagePreviewCommands';
import { INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT, type InlineTraceRunCommandDetail } from './chat/inlineTraceRunCommands';
import { MESSAGE_ACTION_COMMAND_EVENT, type MessageActionCommandDetail } from './chat/messageActionCommands';
import { MESSAGE_EDIT_COMMAND_EVENT, type MessageEditCommand } from './chat/messageEditCommands';
import { registerPendingSideChatSession } from './chat/sideChatSessionReadiness';
import { SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, type SubagentBlockCommandDetail } from './chat/subagentBlockCommands';
import { THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, type ThinkingBlockCommandDetail } from './chat/thinkingBlockCommands';
import {
  TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT,
  TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT,
  type ToolBlockCommandDetail,
} from './chat/toolBlockCommands';
import {
  TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT,
  TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT,
  type TraceClusterCommandDetail,
} from './chat/traceClusterCommands';
import {
  CONVERSATION_OPEN_ACTIVE_CHECKPOINT_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_CHECKPOINT_COMMAND_EVENT,
  CONVERSATION_SCROLL_FIRST_CHECKPOINT_FILE_COMMAND_EVENT,
} from './conversation/checkpointCommands';
import { COMPOSER_CREATE_DRAWING_COMMAND_EVENT } from './conversation/composerInputCommands';
import {
  COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT,
  COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT,
  COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT,
} from './conversation/composerPreferenceCommands';
import { COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, COMPOSER_OPEN_SETTINGS_COMMAND_EVENT } from './conversation/composerSettingsCommands';
import {
  CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT,
  CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT,
  CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT,
  CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT,
  CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT,
} from './conversation/conversationActivityCommands';
import { CONVERSATION_CANCEL_GOAL_COMMAND_EVENT } from './conversation/conversationGoalCommands';
import { CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT } from './conversation/conversationQueueCommands';
import {
  DRAFT_WORKSPACE_PICKER_CLOSE_COMMAND_EVENT,
  DRAFT_WORKSPACE_PICKER_OPEN_COMMAND_EVENT,
  DRAFT_WORKSPACE_PICKER_TOGGLE_COMMAND_EVENT,
} from './conversation/draftWorkspacePickerCommands';
import {
  DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT,
  DRAWING_PICKER_CLOSE_COMMAND_EVENT,
  DRAWING_PICKER_OPEN_COMMAND_EVENT,
  DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT,
} from './conversation/drawingPickerCommands';
import { useConversationArtifactSummaries } from './conversationArtifactHooks';
import { APP_NAVIGATION_COMMAND_EVENT, DesktopTopBar } from './DesktopTopBar';
import {
  buildRouteShellNavItems,
  resolveActiveRouteShellNavItem,
  resolveRouteRightSidebarSurface,
  type RouteShellNavItem,
} from './layout/routeShellRegions';
import {
  extensionToolPanelMode,
  findExtensionToolPanelBySlot,
  inferSurfaceToolSlot,
  isArtifactsRailMode,
  isNewWorkbenchTabMode,
  isSinglePaneWorkbenchMode,
  parseExtensionToolPanelMode,
  resolveActiveExtensionWorkbenchSurface,
  shouldKeepActiveToolWhenConversationHasNoSavedSelection,
  shouldOpenRailForWorkbenchTool,
  singletonWorkbenchToolTabId,
  type WorkbenchRailMode,
} from './layout/workbenchRailModel';
import { NotificationBell } from './notifications/NotificationBell';
import { addNotification, NotificationProvider, useNotificationStore } from './notifications/notificationStore';
import { SetupReadinessButton } from './readiness/SetupReadinessButton';
import { useSetupReadiness } from './readiness/useSetupReadiness';
import {
  ActionTile,
  CenteredMessage,
  cx,
  IconButton,
  Notice,
  PanelMessage,
  SectionLabel,
  SurfacePanel,
  WorkbenchTab,
  WorkbenchTabActionButton,
  WorkbenchTabButton,
  WorkbenchTabCloseButton,
} from './ui';
import { iconGlyphForExtensionSurface, labelForExtensionToolPanel, shouldRenderWorkbenchToolInNav } from './workbenchNav';
import { WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT } from './workspaceQuickSelectCommands';

const DESKTOP_NAVIGATE_EVENT = 'neon-pilot-desktop-navigate';
const CommandPalette = lazyRouteWithRecovery('layout-command-palette', () =>
  import('./CommandPalette').then((module) => ({ default: module.CommandPalette })),
);
const WORKBENCH_CLOSE_ACTIVE_FILE_EVENT = 'pa:workbench-close-active-file';
const WORKBENCH_REFRESH_ACTIVE_FILE_EVENT = 'pa:workbench-refresh-active-file';
const WORKBENCH_TOGGLE_DIFF_EVENT = 'pa:workbench-toggle-diff';
const WORKBENCH_DIFF_STATE_EVENT = 'pa:workbench-diff-state';
const WORKBENCH_BROWSER_COMMAND_EVENT = 'neon-pilot-workbench-browser-command';
const NOTIFICATIONS_MARK_ALL_READ_EVENT = 'neon-pilot-notifications-mark-all-read';
const NOTIFICATIONS_DISMISS_ALL_EVENT = 'neon-pilot-notifications-dismiss-all';
const NOTIFICATIONS_CLOSE_EVENT = 'neon-pilot-notifications-close';
const SETUP_READINESS_CLOSE_EVENT = 'neon-pilot-setup-readiness-close';
const SIDEBAR_AUTO_COLLAPSE_WIDTH = 720;
const LEGACY_ROUTE_RIGHT_RAIL_OPEN_STORAGE_KEY_PREFIX = 'pa:right-rail-open:';
const ROUTE_RIGHT_SIDEBAR_OPEN_STORAGE_KEY_PREFIX = 'pa:right-sidebar-open:';

function buildRouteRightRailOpenStorageKey(pathname: string): string {
  return `${ROUTE_RIGHT_SIDEBAR_OPEN_STORAGE_KEY_PREFIX}${encodeURIComponent(pathname || '/')}`;
}

function buildLegacyRouteRightRailOpenStorageKey(pathname: string): string {
  return `${LEGACY_ROUTE_RIGHT_RAIL_OPEN_STORAGE_KEY_PREFIX}${encodeURIComponent(pathname || '/')}`;
}

function readStoredRouteRightRailOpen(pathname: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(buildRouteRightRailOpenStorageKey(pathname));
    if (stored !== null) return stored !== 'closed';
    return window.localStorage.getItem(buildLegacyRouteRightRailOpenStorageKey(pathname)) !== 'closed';
  } catch {
    return true;
  }
}

function writeStoredRouteRightRailOpen(pathname: string, open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildRouteRightRailOpenStorageKey(pathname), open ? 'open' : 'closed');
  } catch {
    // Ignore storage failures; the visible state still updates for this session.
  }
}

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
const SetupReadinessPopover = lazyRouteWithRecovery('layout-setup-readiness-popover', () =>
  import('./readiness/SetupReadinessPopover').then((module) => ({ default: module.SetupReadinessPopover })),
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
const WORKBENCH_TABS_STORAGE_KEY = 'pa:workbench-tabs';
const REMOVED_WORKBENCH_RAIL_MODES = new Set(['scratchpad']);
const WORKBENCH_OPEN_TOOL_TAB_EVENT = 'pa:workbench-open-tool-tab';
const WORKBENCH_OPEN_ARTIFACT_TAB_EVENT = 'pa:workbench-open-artifact-tab';
const WORKBENCH_OPEN_WORKSPACE_FILE_EVENT = 'pa:workbench-open-workspace-file';
const WORKBENCH_CLOSE_TAB_EVENT = 'pa:workbench-close-tab';
const DESKTOP_SHORTCUT_ACTIONS = {
  closeConversation: 'close-conversation',
  reopenClosedConversation: 'reopen-closed-conversation',
  toggleConversationPin: 'toggle-conversation-pin',
  toggleConversationLock: 'toggle-conversation-lock',
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

interface StoredWorkbenchTabsState {
  tabs: WorkbenchTabInstance[];
  activeTabId: string | null;
}

function isStoredWorkbenchRailMode(value: unknown): value is WorkbenchRailMode {
  if (typeof value === 'string' && REMOVED_WORKBENCH_RAIL_MODES.has(value)) return false;
  if (typeof value === 'string' && /^[A-Za-z0-9:_-]{1,200}$/.test(value)) return true;
  return (
    value === 'new' ||
    value === 'files' ||
    value === 'artifacts' ||
    value === 'browser' ||
    value === 'chat' ||
    value === 'terminal' ||
    (typeof value === 'string' && parseExtensionToolPanelMode(value as WorkbenchRailMode) !== null)
  );
}

function normalizeStoredWorkbenchTab(value: unknown): WorkbenchTabInstance | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
  if (!isStoredWorkbenchRailMode(candidate.mode)) return null;
  return {
    id: candidate.id,
    mode: candidate.mode,
    ...(typeof candidate.artifactId === 'string' ? { artifactId: candidate.artifactId } : {}),
    ...(typeof candidate.conversationId === 'string' ? { conversationId: candidate.conversationId } : {}),
  };
}

export function readStoredWorkbenchTabs(storage: Pick<Storage, 'getItem'> = localStorage): StoredWorkbenchTabsState {
  try {
    const raw = storage.getItem(WORKBENCH_TABS_STORAGE_KEY);
    if (!raw) return { tabs: [], activeTabId: null };
    const parsed = JSON.parse(raw) as { tabs?: unknown; activeTabId?: unknown };
    const tabs = Array.isArray(parsed.tabs) ? parsed.tabs.map(normalizeStoredWorkbenchTab).filter((tab) => tab !== null) : [];
    const activeTabId =
      typeof parsed.activeTabId === 'string' && tabs.some((tab) => tab.id === parsed.activeTabId) ? parsed.activeTabId : null;
    return { tabs, activeTabId };
  } catch {
    return { tabs: [], activeTabId: null };
  }
}

function writeStoredWorkbenchTabs(state: StoredWorkbenchTabsState, storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): void {
  if (state.tabs.length === 0 && state.activeTabId === null) {
    storage.removeItem(WORKBENCH_TABS_STORAGE_KEY);
    return;
  }
  storage.setItem(WORKBENCH_TABS_STORAGE_KEY, JSON.stringify(state));
}

export function removeTerminalWorkbenchTabs(
  tabs: WorkbenchTabInstance[],
  activeTabId: string | null,
): { nextTabs: WorkbenchTabInstance[]; nextActiveTabId: string | null; removed: boolean } {
  const nextTabs = tabs.filter((tab) => tab.mode !== 'terminal');
  if (nextTabs.length === tabs.length) {
    return { nextTabs: tabs, nextActiveTabId: activeTabId, removed: false };
  }
  let nextActiveTabId = activeTabId && nextTabs.some((tab) => tab.id === activeTabId) ? activeTabId : null;
  if (!nextActiveTabId && activeTabId) {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (activeIndex !== -1 && nextTabs.length > 0) {
      const nextIds = new Set(nextTabs.map((tab) => tab.id));
      for (let offset = 1; offset <= tabs.length; offset += 1) {
        const right = tabs[activeIndex + offset];
        if (right && nextIds.has(right.id)) {
          nextActiveTabId = right.id;
          break;
        }
        const left = tabs[activeIndex - offset];
        if (left && nextIds.has(left.id)) {
          nextActiveTabId = left.id;
          break;
        }
      }
    }
  }
  return { nextTabs, nextActiveTabId, removed: true };
}

export function closeWorkbenchTabState(
  tabs: WorkbenchTabInstance[],
  activeTabId: string | null,
  tabId: string,
): {
  nextTabs: WorkbenchTabInstance[];
  nextActiveTabId: string | null;
  removed: boolean;
  closedMode: WorkbenchRailMode | null;
  nextWouldHaveNoTabs: boolean;
  shouldClearFileSelection: boolean;
} {
  const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex === -1) {
    return {
      nextTabs: tabs,
      nextActiveTabId: activeTabId,
      removed: false,
      closedMode: null,
      nextWouldHaveNoTabs: false,
      shouldClearFileSelection: false,
    };
  }

  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  const closingTab = tabs[closingIndex];
  const nextWouldHaveNoTabs = nextTabs.length === 0;

  let nextActiveTabId: string | null = activeTabId;
  if (activeTabId === tabId) {
    if (nextTabs.length === 0) {
      nextActiveTabId = null;
    } else {
      const replacementIndex = Math.min(closingIndex, nextTabs.length - 1);
      nextActiveTabId = nextTabs[replacementIndex]?.id ?? null;
    }
  }

  return {
    nextTabs,
    nextActiveTabId,
    removed: true,
    closedMode: closingTab.mode,
    nextWouldHaveNoTabs,
    shouldClearFileSelection: closingTab.mode === 'files',
  };
}

export function clearSelectedWorkbenchTool(
  selectedToolByConversation: Record<string, WorkbenchRailMode>,
  tool: WorkbenchRailMode,
): Record<string, WorkbenchRailMode> {
  let changed = false;
  const nextSelectedToolByConversation: Record<string, WorkbenchRailMode> = {};
  for (const [conversationId, selectedTool] of Object.entries(selectedToolByConversation)) {
    if (selectedTool === tool) {
      changed = true;
      continue;
    }
    nextSelectedToolByConversation[conversationId] = selectedTool;
  }
  return changed ? nextSelectedToolByConversation : selectedToolByConversation;
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

function DiffOverlayIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="4" cy="3.5" r="1.6" />
      <circle cx="4" cy="12.5" r="1.6" />
      <circle cx="12" cy="8" r="1.6" />
      <path d="M4 5.2v5.6M4 5.2c0 2.2 1.8 2.8 4 2.8h2.2" />
    </svg>
  );
}

function FileDocumentBar({
  filePath,
  railOpen,
  canToggleRail,
  canToggleDiff = false,
  diffEnabled = false,
  collapseLabel = 'Collapse file tree',
  expandLabel = 'Show file tree',
  onRailOpenChange,
  onDiffToggle,
}: {
  filePath: string;
  railOpen: boolean;
  canToggleRail: boolean;
  canToggleDiff?: boolean;
  diffEnabled?: boolean;
  collapseLabel?: string;
  expandLabel?: string;
  onRailOpenChange: (open: boolean) => void;
  onDiffToggle?: () => void;
}) {
  const railLabel = railOpen ? collapseLabel : expandLabel;
  const diffLabel = diffEnabled ? 'Hide diff overlay' : 'Show diff overlay';

  return (
    <div className="ui-workbench-file-bar flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2 text-secondary">
      <div className="ui-workbench-file-bar__path min-w-0 flex-1">
        <div className="ui-workbench-file-bar__path-label truncate font-mono text-[12px] text-secondary" title={filePath}>
          {filePath}
        </div>
      </div>
      {canToggleRail ? (
        <IconButton
          compact
          className="ui-workbench-file-bar__button shrink-0"
          title={railLabel}
          aria-label={railLabel}
          onClick={() => onRailOpenChange(!railOpen)}
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
            <path d="M4 5h16v14H4z" />
            <path d="M15 5v14" />
            <path d={railOpen ? 'm10 9-3 3 3 3' : 'm8 9 3 3-3 3'} />
          </svg>
        </IconButton>
      ) : null}
      {canToggleDiff ? (
        <IconButton
          compact
          className={cx('ui-workbench-file-bar__button shrink-0', diffEnabled && 'text-accent')}
          title={diffLabel}
          aria-label={diffLabel}
          aria-pressed={diffEnabled}
          onClick={onDiffToggle}
        >
          <DiffOverlayIcon />
        </IconButton>
      ) : null}
      <IconButton
        compact
        className="ui-workbench-file-bar__button shrink-0"
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

type WorkbenchDiffState = {
  canToggleDiff: boolean;
  diffEnabled: boolean;
};

function isWorkbenchDiffStateDetail(value: unknown): value is { cwd: string; path: string; canToggleDiff: boolean; diffEnabled: boolean } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const detail = value as {
    cwd?: unknown;
    path?: unknown;
    canToggleDiff?: unknown;
    diffEnabled?: unknown;
  };
  return (
    typeof detail.cwd === 'string' &&
    typeof detail.path === 'string' &&
    typeof detail.canToggleDiff === 'boolean' &&
    typeof detail.diffEnabled === 'boolean'
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

function dispatchDesktopShortcutAction(action: string, source?: string | null): void {
  window.dispatchEvent(new CustomEvent(DESKTOP_SHORTCUT_EVENT, { detail: { action, ...(source ? { source } : {}) } }));
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
  options: { pathname?: string | null; draftCwd?: string | null } = {},
): string | null {
  if (options.pathname === DRAFT_CONVERSATION_ROUTE) {
    return options.draftCwd?.trim() || null;
  }

  if (!activeConversationId) {
    return null;
  }

  const session = sessions?.find((entry) => entry.id === activeConversationId) ?? null;
  return session?.cwd ?? null;
}

function isChatWorkspaceCwd(cwd: string | null | undefined): boolean {
  if (!cwd) return false;
  const normalized = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.endsWith('/chat-workspaces') || normalized.includes('/chat-workspaces/');
}

function hasProjectWorkspaceCwd(cwd: string | null | undefined): boolean {
  return Boolean(cwd?.trim()) && !isChatWorkspaceCwd(cwd);
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

export function shouldOpenFilesWorkbenchByDefaultForEmbeddedWindow(input: {
  embeddedWindowChrome: boolean;
  forceWorkbench: boolean;
  activeWorkbenchTool: WorkbenchRailMode;
  hasWorkspaceCwd: boolean;
  hasActiveWorkbenchTab: boolean;
  hasSavedConversationTool: boolean;
}): boolean {
  return (
    input.embeddedWindowChrome &&
    input.forceWorkbench &&
    input.activeWorkbenchTool === 'new' &&
    input.hasWorkspaceCwd &&
    !input.hasActiveWorkbenchTab &&
    !input.hasSavedConversationTool
  );
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

export function focusFirstSidebarControl(): boolean {
  const target = document.querySelector<HTMLElement>('aside a, aside button, nav a, nav button');
  if (!target) return false;
  target.focus();
  return document.activeElement === target;
}

export function focusComposerTextarea(): boolean {
  const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Message"]');
  if (!textarea) return false;
  textarea.focus();
  return document.activeElement === textarea;
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
  hasWorkspaceCwd?: boolean;
}): boolean {
  if (input.activeToolSlot === 'files') return input.hasPairedDocument || input.hasWorkspaceCwd === true;
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
      className="ui-resize-handle relative z-10 w-[5px] flex-shrink-0 cursor-col-resize select-none group"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wider invisible hit area */}
      <div className="ui-resize-handle__hit-area absolute inset-y-0 -left-0.5 -right-0.5" />
      {/* Visual line — thickens on hover */}
      <div
        className="ui-resize-handle__line absolute inset-y-0 left-[2px] w-[1px] transition-all duration-100"
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
          <SurfacePanel className="max-w-lg px-6 py-6">
            <SectionLabel tone="muted">Recovered from render error</SectionLabel>
            <h1 className="mt-2 text-[22px] font-semibold text-primary">{title}</h1>
            <p className="mt-2 text-[13px] leading-6 text-secondary">{body}</p>
            {errorMessage ? (
              <Notice tone="warning" className="mt-4">
                <SectionLabel tone="muted">Error details</SectionLabel>
                <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-primary">{errorMessage}</p>
              </Notice>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/conversations/new" className="ui-action-button">
                New conversation
              </Link>
            </div>
          </SurfacePanel>
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
  const [workbenchDiffState, setWorkbenchDiffState] = useState<WorkbenchDiffState>({ canToggleDiff: false, diffEnabled: false });
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

  useEffect(() => {
    setWorkbenchDiffState({ canToggleDiff: false, diffEnabled: false });
    if (!workspaceCwd || !workspaceFileId) {
      return;
    }

    function handleDiffState(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isWorkbenchDiffStateDetail(detail)) {
        return;
      }
      if (detail.cwd !== workspaceCwd || detail.path !== workspaceFileId) {
        return;
      }
      setWorkbenchDiffState({ canToggleDiff: detail.canToggleDiff, diffEnabled: detail.diffEnabled });
    }

    window.addEventListener(WORKBENCH_DIFF_STATE_EVENT, handleDiffState);
    return () => window.removeEventListener(WORKBENCH_DIFF_STATE_EVENT, handleDiffState);
  }, [workspaceCwd, workspaceFileId]);

  let mainContent: ReactNode = null;

  if (isNewWorkbenchTabMode(activeTool)) {
    mainContent = (
      <WorkbenchNewTabPage
        extensionToolPanels={extensionToolPanels}
        conversationId={conversationId}
        workspaceCwd={workspaceCwd ?? null}
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
  } else if (activeExtensionToolPanel && isSinglePaneWorkbenchMode(activeTool, activeExtensionToolPanel)) {
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
          canToggleDiff={activeToolSlot === 'files' && workbenchDiffState.canToggleDiff}
          diffEnabled={workbenchDiffState.diffEnabled}
          onRailOpenChange={onRailOpenChange}
          onDiffToggle={() => window.dispatchEvent(new CustomEvent(WORKBENCH_TOGGLE_DIFF_EVENT))}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">{mainContent}</div>
        {railOpen && extensionRailSurface ? (
          <>
            <ResizeHandle onMouseDown={onRailResizeMouseDown} onDoubleClick={onRailResizeReset} />
            <aside
              style={{ width: railWidth }}
              className="ui-workbench-rail relative z-10 flex-shrink-0 overflow-hidden border-l border-border-subtle bg-panel select-text [&>[data-extension-id]]:bg-panel"
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
  embeddedWindowChrome = false,
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
  onPromoteChatTab,
  onOpenNewTab,
  onActiveToolChange,
  onRailOpenChange,
  onWorkspaceFileClear,
  onStartSideChat,
}: {
  embeddedWindowChrome?: boolean;
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
  onPromoteChatTab?: (conversationId: string) => void;
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
      className="ui-workbench-panel flex flex-shrink-0 flex-col overflow-hidden border-l border-r border-border-subtle bg-base select-text"
      aria-label={embeddedWindowChrome ? 'Attached workbench' : 'Workbench'}
      data-workbench-document-pane="true"
      data-windowed-attached-workbench={embeddedWindowChrome ? 'true' : undefined}
      data-has-open-file={
        knowledgeFileId ||
        workspaceFileId ||
        artifactId ||
        activeTool === 'browser' ||
        activeTool === 'chat' ||
        activeTool === 'terminal' ||
        isSinglePaneWorkbenchMode(activeTool) ||
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
        onPromoteChatTab={onPromoteChatTab}
        onOpenNewTab={onOpenNewTab}
        onCheckpointSelect={() => undefined}
        onWorkspaceFileClear={onWorkspaceFileClear}
      />
      <div className="ui-workbench-panel__body min-h-0 flex-1 overflow-hidden">
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
  workspaceCwd,
  onActiveToolChange,
  onWorkspaceFileClear,
  onStartSideChat,
}: {
  extensionToolPanels: Array<(ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary>;
  conversationId: string | null;
  workspaceCwd: string | null;
  onActiveToolChange: (mode: WorkbenchRailMode) => void;
  onWorkspaceFileClear: () => void;
  onStartSideChat?: () => Promise<string | void>;
}) {
  const availableTools = extensionToolPanels.filter((surface) => {
    const slot = inferSurfaceToolSlot(surface);
    return shouldRenderWorkbenchToolInNav(surface) && slot !== 'artifacts' && slot !== 'files' && slot !== 'terminal';
  });
  const systemFilesExtensionSurface = findExtensionToolPanelBySlot(extensionToolPanels, 'files');
  const systemTerminalExtensionSurface = findExtensionToolPanelBySlot(extensionToolPanels, 'terminal');
  const canOpenFileExplorer = hasProjectWorkspaceCwd(workspaceCwd);
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
    <div className="ui-workbench-new-tab-page flex h-full min-w-0 items-center justify-center px-2 text-center select-text sm:px-4">
      <div className="ui-workbench-new-tab-page__inner w-full min-w-0" style={{ maxWidth: 'min(36rem, 100%)' }}>
        <SectionLabel className="ui-workbench-new-tab-page__label" tone="secondary">
          Workbench
        </SectionLabel>
        <h2 className="ui-workbench-new-tab-page__title mt-2 text-xl font-semibold text-primary text-balance">Open a tab</h2>
        <div className="ui-workbench-new-tab-grid mt-6 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-2">
          {canOpenFileExplorer ? (
            <ActionTile
              icon="□"
              label="File Explorer"
              onClick={() => {
                onActiveToolChange(systemFilesExtensionSurface ? extensionToolPanelMode(systemFilesExtensionSurface) : 'files');
                onWorkspaceFileClear();
              }}
            />
          ) : null}
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
  onPromoteChatTab,
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
  onPromoteChatTab?: (conversationId: string) => void;
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
    <div className="ui-workbench-tab-strip flex h-11 shrink-0 items-center gap-1 overflow-hidden border-b border-border-subtle bg-base px-2">
      <div className="ui-workbench-tab-strip__scroller flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {openTabs.map((tab) => {
          const isChatTab = tab.mode === 'chat' && Boolean(tab.conversationId);
          return (
            <WorkbenchTab
              key={tab.id}
              ref={activeTabId === tab.id ? activeTabRef : undefined}
              active={activeTabId === tab.id}
              title={labelForTab(tab)}
              draggable={isChatTab}
              onDragStart={
                isChatTab
                  ? (event) => {
                      const conversationId = tab.conversationId as string;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData(WORKBENCH_CHAT_TAB_DRAG_MIME, conversationId);
                      event.dataTransfer.setData('application/x-neon-pilot-conversation', conversationId);
                      event.dataTransfer.setData('text/plain', conversationId);
                    }
                  : undefined
              }
            >
              <WorkbenchTabButton icon={iconForMode(tab.mode)} label={labelForTab(tab)} onClick={() => selectTab(tab.id)} />
              {isChatTab && onPromoteChatTab ? (
                <WorkbenchTabActionButton
                  aria-label={`Move ${labelForTab(tab)} to sidebar`}
                  title={`Move ${labelForTab(tab)} to sidebar`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPromoteChatTab(tab.conversationId as string);
                  }}
                >
                  ⇱
                </WorkbenchTabActionButton>
              ) : null}
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
          );
        })}
      </div>
      <IconButton
        size="sm"
        className={cx(
          'ui-workbench-tab-strip__new ml-1 h-8 w-8 shrink-0 rounded-md text-[16px]',
          isNewWorkbenchTabMode(activeTool) && 'bg-surface text-primary',
        )}
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

interface LayoutProps {
  embeddedWindowChrome?: boolean;
  forceWorkbench?: boolean;
  suppressWorkbench?: boolean;
}

export function Layout({ embeddedWindowChrome = false, forceWorkbench = false, suppressWorkbench = false }: LayoutProps = {}) {
  const location = useLocation();
  useRouteTelemetry();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { versions } = useAppEvents();
  const activeConversationId = getActiveConversationId(location.pathname);
  const layoutSessions = useAllSessions();
  const [draftConversationCwd, setDraftConversationCwd] = useState(() => readDraftConversationCwd().trim());
  const activeExtensionCommandSourceRef = useRef<string | null>(null);
  const [desktopEnvironment, setDesktopEnvironment] = useState<DesktopEnvironmentState | null>(null);
  const [appLayoutMode, setAppLayoutMode] = useState<AppLayoutMode>(() => readAppLayoutMode());
  const [activeWorkbenchTabId, setActiveWorkbenchTabId] = useState<string | null>(() => readStoredWorkbenchTabs().activeTabId);
  const [openWorkbenchTabs, setOpenWorkbenchTabs] = useState<WorkbenchTabInstance[]>(() => readStoredWorkbenchTabs().tabs);
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
  useEffect(() => {
    if (viewportWidth < SIDEBAR_AUTO_COLLAPSE_WIDTH) {
      setSidebarOpen(false);
    }
  }, [viewportWidth]);
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
  const [railOpen, setRailOpen] = useState(() => readStoredRouteRightRailOpen(location.pathname));
  const pageSearchRootRef = useRef<HTMLDivElement | null>(null);
  const [registeredRightRailControl, setRegisteredRightRailControl] = useState<DesktopRightRailControl | null>(null);
  const railWidth = rail.width;
  const extensionRegistry = useExtensionRegistry();
  const routeShellNavItems = useMemo<RouteShellNavItem[]>(
    () => buildRouteShellNavItems(extensionRegistry.extensions),
    [extensionRegistry.extensions],
  );
  const activeRouteShellNavItem = useMemo(
    () => resolveActiveRouteShellNavItem(location.pathname, routeShellNavItems),
    [location.pathname, routeShellNavItems],
  );
  const routeRightRailStorageRoute = activeRouteShellNavItem?.route ?? location.pathname;
  const previousRouteShellRouteRef = useRef(routeRightRailStorageRoute);
  const [extensionKeybindings, setExtensionKeybindings] = useState<ExtensionKeybindingRegistration[]>([]);
  const [extensionCommands, setExtensionCommands] = useState<ExtensionCommandRegistration[]>([]);
  useEffect(() => {
    setRailOpen(readStoredRouteRightRailOpen(routeRightRailStorageRoute));
  }, [routeRightRailStorageRoute]);
  useEffect(() => {
    if (previousRouteShellRouteRef.current === routeRightRailStorageRoute) return;
    previousRouteShellRouteRef.current = routeRightRailStorageRoute;
    if (readExtensionSelection()?.kind === 'resource') {
      setExtensionSelection(null);
    }
  }, [routeRightRailStorageRoute]);
  const setRouteRightRailOpen = useCallback(
    (nextOpen: boolean | ((current: boolean) => boolean)) => {
      setRailOpen((current) => {
        const next = typeof nextOpen === 'function' ? nextOpen(current) : nextOpen;
        writeStoredRouteRightRailOpen(routeRightRailStorageRoute, next);
        return next;
      });
    },
    [routeRightRailStorageRoute],
  );
  useEffect(() => {
    writeStoredWorkbenchTabs({ tabs: openWorkbenchTabs, activeTabId: activeWorkbenchTabId });
  }, [activeWorkbenchTabId, openWorkbenchTabs]);
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
    function handleBrowserTabsChanged() {
      setBrowserTabsState(readBrowserTabsState());
    }

    window.addEventListener(BROWSER_TABS_CHANGED_EVENT, handleBrowserTabsChanged);
    window.addEventListener('storage', handleBrowserTabsChanged);
    return () => {
      window.removeEventListener(BROWSER_TABS_CHANGED_EVENT, handleBrowserTabsChanged);
      window.removeEventListener('storage', handleBrowserTabsChanged);
    };
  }, []);

  const windowedShellChild = isWindowedShellChild();
  const hideDesktopTopBar = embeddedWindowChrome || windowedShellChild;
  const effectiveSidebarOpen = windowedShellChild || embeddedWindowChrome ? false : sidebarOpen;
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

  const showWorkbench =
    !suppressWorkbench &&
    (forceWorkbench || appLayoutMode === 'workbench') &&
    routeSupportsWorkbench(location.pathname, extensionRegistry.surfaces);
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
  const hasActiveWorkbenchFile = Boolean(activeWorkbenchArtifactId || activeWorkbenchKnowledgeFileId || activeWorkbenchWorkspaceFileId);
  const previousActiveConversationIdRef = useRef<string | null>(activeConversationId);
  const prewarmedLiveSessionWorkspaceCwdsRef = useRef(new Map<string, number>());
  useEffect(() => {
    const refreshDraftConversationCwd = () => {
      setDraftConversationCwd(readDraftConversationCwd().trim());
    };

    refreshDraftConversationCwd();
    window.addEventListener(DRAFT_CONVERSATION_STATE_CHANGED_EVENT, refreshDraftConversationCwd);
    return () => {
      window.removeEventListener(DRAFT_CONVERSATION_STATE_CHANGED_EVENT, refreshDraftConversationCwd);
    };
  }, []);
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
  const activeWorkspaceCwd = resolveActiveWorkspaceCwd(layoutSessions, activeConversationId, {
    pathname: location.pathname,
    draftCwd: draftConversationCwd,
  });
  const activeHasProjectWorkspaceCwd = hasProjectWorkspaceCwd(activeWorkspaceCwd);
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
  useEffect(() => {
    if (!activeConversationId) return;
    if (activeHasProjectWorkspaceCwd) return;

    setOpenWorkbenchTabs((current) => {
      const nextTabs = current.filter((tab) => tab.mode !== 'files');
      if (nextTabs.length === current.length) return current;
      setActiveWorkbenchTabId((currentActiveTabId) =>
        nextTabs.some((tab) => tab.id === currentActiveTabId) ? currentActiveTabId : (nextTabs[0]?.id ?? null),
      );
      return nextTabs;
    });
    clearActiveWorkbenchFileSelection();
  }, [activeConversationId, activeHasProjectWorkspaceCwd, clearActiveWorkbenchFileSelection]);

  const extensionRightToolPanels = useMemo(
    () =>
      extensionRegistry.surfaces.filter(
        (surface) =>
          isExtensionRightToolPanelSurface(surface) ||
          (isNativeExtensionRightRailSurface(surface) && getExtensionViewPlacement(surface) === 'workbench-tool'),
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
    if (showWorkbench || embeddedWindowChrome || windowedShellChild) return null;
    return resolveRouteRightSidebarSurface({
      pathname: location.pathname,
      navItems: routeShellNavItems,
      surfaces: extensionRegistry.surfaces,
    });
  }, [embeddedWindowChrome, extensionRegistry.surfaces, location.pathname, routeShellNavItems, showWorkbench, windowedShellChild]);
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
    hasWorkspaceCwd: activeHasProjectWorkspaceCwd,
  });
  const activeWorkbenchRailSurface =
    showWorkbench &&
    !isNewWorkbenchTabMode(activeWorkbenchTool) &&
    activeWorkbenchAllowsRailSurface &&
    activeExtensionWorkbenchSurface &&
    !isSinglePaneWorkbenchMode(activeWorkbenchTool, activeWorkbenchToolPanel)
      ? activeWorkbenchToolPanel
      : null;
  const canToggleWorkbenchExplorer = Boolean(activeWorkbenchRailSurface);
  const effectiveWorkbenchExplorerOpen = workbenchExplorerOpen && activeWorkbenchRailSurface !== null;
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [setupReadinessOpen, setSetupReadinessOpen] = useState(false);
  const setupReadiness = useSetupReadiness();
  const [commandPaletteMounted, setCommandPaletteMounted] = useState(false);
  const [pendingCommandPaletteOpen, setPendingCommandPaletteOpen] = useState<OpenCommandPaletteDetail | null>(null);

  useEffect(() => {
    setExtensionCommandContext('setup.open', setupReadinessOpen);
    setExtensionCommandContext('setup.hasIncomplete', (setupReadiness.snapshot?.counts.actionable ?? 0) > 0);
    return () => {
      setExtensionCommandContext('setup.open', null);
      setExtensionCommandContext('setup.hasIncomplete', null);
    };
  }, [setupReadiness.snapshot?.counts.actionable, setupReadinessOpen]);

  useEffect(() => {
    function handleClose() {
      setSetupReadinessOpen(false);
    }
    window.addEventListener(SETUP_READINESS_CLOSE_EVENT, handleClose);
    return () => window.removeEventListener(SETUP_READINESS_CLOSE_EVENT, handleClose);
  }, []);

  const openWorkbenchToolTab = useCallback(
    (
      tool: WorkbenchRailMode,
      options?: { artifactId?: string | null; id?: string; conversationId?: string | null; forceNewTab?: boolean },
    ) => {
      if (tool === 'new') {
        setActiveWorkbenchTabId(null);
        return;
      }
      const parsed = parseExtensionToolPanelMode(tool);
      const surface = parsed
        ? extensionRightToolPanels.find((candidate) => candidate.extensionId === parsed.extensionId && candidate.id === parsed.surfaceId)
        : findExtensionToolPanelBySlot(extensionRightToolPanels, tool);
      const toolSlot = surface ? inferSurfaceToolSlot(surface) : tool;
      if (toolSlot === 'files' && !activeHasProjectWorkspaceCwd) {
        clearActiveWorkbenchFileSelection();
        setActiveWorkbenchTabId(null);
        return;
      }

      // Compute next tabs state and derive next active tab ID from current state.
      const current = openWorkbenchTabsRef.current;
      const singletonTabId = singletonWorkbenchToolTabId(tool, surface, activeConversationId);
      const normalizedOptions = singletonTabId
        ? { ...options, id: singletonTabId, conversationId: activeConversationId ?? options?.conversationId ?? null }
        : options;
      if (!options?.forceNewTab || singletonTabId) {
        const existing =
          tool === 'chat' && normalizedOptions?.conversationId
            ? current.find((tab) => tab.mode === 'chat' && tab.conversationId === normalizedOptions.conversationId)
            : normalizedOptions?.id
              ? current.find((tab) => tab.id === normalizedOptions.id)
              : null;
        if (existing) {
          setActiveWorkbenchTabId(existing.id);
          if (shouldOpenRailForWorkbenchTool(tool, surface)) {
            setWorkbenchExplorerOpen(true);
            writeStoredWorkbenchExplorerOpen(true);
          }
          return;
        }
      }
      const tab = createWorkbenchTabInstance(tool, normalizedOptions);
      setOpenWorkbenchTabs([...current, tab]);
      setActiveWorkbenchTabId(tab.id);
      if (shouldOpenRailForWorkbenchTool(tool, surface)) {
        setWorkbenchExplorerOpen(true);
        writeStoredWorkbenchExplorerOpen(true);
      }

      if (activeConversationId && tool !== 'browser') {
        setSelectedToolByConversation((current) => ({
          ...current,
          [activeConversationId]: tool,
        }));
      }
    },
    [activeConversationId, activeHasProjectWorkspaceCwd, clearActiveWorkbenchFileSelection, extensionRightToolPanels],
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

  useEffect(() => {
    if (
      !shouldOpenFilesWorkbenchByDefaultForEmbeddedWindow({
        embeddedWindowChrome,
        forceWorkbench,
        activeWorkbenchTool,
        hasWorkspaceCwd: activeHasProjectWorkspaceCwd,
        hasActiveWorkbenchTab: Boolean(activeWorkbenchTabId),
        hasSavedConversationTool: Boolean(activeConversationId && selectedToolByConversation[activeConversationId]),
      })
    ) {
      return;
    }

    const systemFilesExtensionSurface = findExtensionToolPanelBySlot(extensionRightToolPanels, 'files');
    openWorkbenchToolTab(systemFilesExtensionSurface ? extensionToolPanelMode(systemFilesExtensionSurface) : 'files');
  }, [
    activeConversationId,
    activeHasProjectWorkspaceCwd,
    activeWorkbenchTabId,
    activeWorkbenchTool,
    embeddedWindowChrome,
    extensionRightToolPanels,
    forceWorkbench,
    openWorkbenchToolTab,
    selectedToolByConversation,
  ]);

  const openWorkbenchNewTab = useCallback(() => {
    setActiveWorkbenchTabId(null);
  }, []);

  const createBrowserTabFromCommand = useCallback(() => {
    return executeBrowserTabsCommand('newTab');
  }, []);

  const reopenBrowserTabFromCommand = useCallback(() => {
    return executeBrowserTabsCommand('reopenTab');
  }, []);

  const closeBrowserTabFromCommand = useCallback(() => {
    return executeBrowserTabsCommand('closeTab');
  }, []);

  const closeWorkbenchTab = useCallback(
    (tabId: string) => {
      const current = openWorkbenchTabsRef.current;
      const closeState = closeWorkbenchTabState(current, activeWorkbenchTabId, tabId);
      if (!closeState.removed) return;

      setOpenWorkbenchTabs(closeState.nextTabs);
      setActiveWorkbenchTabId(closeState.nextActiveTabId);

      if (closeState.closedMode === 'terminal' && !closeState.nextTabs.some((tab) => tab.mode === 'terminal')) {
        setSelectedToolByConversation((current) => clearSelectedWorkbenchTool(current, 'terminal'));
      }

      if (closeState.nextWouldHaveNoTabs) {
        setAppLayoutMode('compact');
        writeAppLayoutMode('compact');
        setSearchParams(
          (current) => {
            const nextSearch = new URLSearchParams(clearWorkbenchOnlySearchParamsForCompact(current.toString()));
            nextSearch.delete('view');
            return nextSearch;
          },
          { replace: true },
        );
      }

      if (closeState.shouldClearFileSelection) {
        clearActiveWorkbenchFileSelection();
      }
    },
    [activeWorkbenchTabId, clearActiveWorkbenchFileSelection, setSearchParams],
  );

  const promoteWorkbenchChatTab = useCallback(
    (conversationId: string) => {
      ensureConversationTabOpen(conversationId, { active: true });
      const tab = openWorkbenchTabsRef.current.find(
        (candidate) => candidate.mode === 'chat' && candidate.conversationId === conversationId,
      );
      if (tab) {
        closeWorkbenchTab(tab.id);
      }
      navigate(`/conversations/${encodeURIComponent(conversationId)}`);
    },
    [closeWorkbenchTab, navigate],
  );

  useEffect(() => {
    setExtensionCommandContext('route', location.pathname);
    setExtensionCommandContext('layout.mode', appLayoutMode);
    setExtensionCommandContext('conversation.hasActive', Boolean(activeConversationId));
    setExtensionCommandContext('workbench.hasActiveTab', Boolean(activeWorkbenchTabId));
    setExtensionCommandContext('workbench.hasActiveChatTab', Boolean(activeWorkbenchChatConversationId));
    setExtensionCommandContext('workbench.hasActiveFile', hasActiveWorkbenchFile);
    setExtensionCommandContext('workbench.canToggleExplorer', canToggleWorkbenchExplorer);
    setExtensionCommandContext('browser.active', activeWorkbenchToolSlot === 'browser');
  }, [
    activeConversationId,
    activeWorkbenchChatConversationId,
    activeWorkbenchTabId,
    activeWorkbenchToolSlot,
    appLayoutMode,
    canToggleWorkbenchExplorer,
    hasActiveWorkbenchFile,
    location.pathname,
  ]);

  useEffect(() => {
    function publishConversationNavigationAvailability() {
      const layout = readConversationLayout();
      const conversationIds = [...layout.pinnedSessionIds, ...layout.sessionIds];
      setExtensionCommandContext(
        'conversation.canNavigate',
        Boolean(activeConversationId && conversationIds.length >= 2 && conversationIds.includes(activeConversationId)),
      );
    }

    publishConversationNavigationAvailability();
    window.addEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, publishConversationNavigationAvailability);
    return () => {
      window.removeEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, publishConversationNavigationAvailability);
      setExtensionCommandContext('conversation.canNavigate', null);
    };
  }, [activeConversationId]);

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
          existingSessions: layoutSessions,
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
    [layoutSessions, location.pathname, navigate],
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
          toggleRail: () => setRouteRightRailOpen((current) => !current),
        }
      : registeredRightRailControl;
  const canToggleRightRail = canToggleWorkbench || activeRightRailControl !== null;

  useEffect(() => {
    setExtensionCommandContext('layout.canToggleRightSidebar', canToggleRightRail);
    setExtensionCommandContext('layout.canToggleRightRail', canToggleRightRail);
    return () => {
      setExtensionCommandContext('layout.canToggleRightSidebar', null);
      setExtensionCommandContext('layout.canToggleRightRail', null);
    };
  }, [canToggleRightRail]);

  useEffect(() => {
    if (routeSupportsWorkbench(location.pathname, extensionRegistry.surfaces)) return;
    const { nextTabs, nextActiveTabId, removed } = removeTerminalWorkbenchTabs(openWorkbenchTabsRef.current, activeWorkbenchTabId);
    if (!removed) return;
    setOpenWorkbenchTabs(nextTabs);
    setActiveWorkbenchTabId(nextActiveTabId);
    setSelectedToolByConversation((current) => clearSelectedWorkbenchTool(current, 'terminal'));
  }, [activeWorkbenchTabId, extensionRegistry.surfaces, location.pathname]);

  const handleAppLayoutModeChange = useCallback(
    (mode: AppLayoutMode) => {
      const previousMode = appLayoutMode;
      setAppLayoutMode(mode);
      writeAppLayoutMode(mode);

      if (mode === 'compact') {
        const { nextTabs, nextActiveTabId, removed } = removeTerminalWorkbenchTabs(openWorkbenchTabsRef.current, activeWorkbenchTabId);
        if (removed) {
          setOpenWorkbenchTabs(nextTabs);
          setActiveWorkbenchTabId(nextActiveTabId);
          setSelectedToolByConversation((current) => clearSelectedWorkbenchTool(current, 'terminal'));
        }
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
      activeWorkbenchTabId,
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
        'conversation.hasCwd': Boolean(activeWorkspaceCwd?.trim()),
        'workbench.hasActiveTab': Boolean(activeWorkbenchTabId),
        'workbench.hasActiveChatTab': Boolean(activeWorkbenchChatConversationId),
        'workbench.hasActiveFile': hasActiveWorkbenchFile,
        'workbench.canToggleExplorer': canToggleWorkbenchExplorer,
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
      openSetupReadiness() {
        startTransition(() => setSetupReadinessOpen(true));
        return true;
      },
      closeSetupReadiness() {
        window.dispatchEvent(new CustomEvent(SETUP_READINESS_CLOSE_EVENT));
        return true;
      },
      refreshSetupReadiness() {
        void setupReadiness.refresh();
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
        return canToggleRightRail;
      },
      findOnPage() {
        dispatchDesktopShortcutAction('find-in-page');
        return true;
      },
      findNextOnPage() {
        dispatchDesktopShortcutAction('find-next-in-page');
        return true;
      },
      findPreviousOnPage() {
        dispatchDesktopShortcutAction('find-previous-in-page');
        return true;
      },
      closePageSearch() {
        dispatchDesktopShortcutAction('close-find-in-page');
        return true;
      },
      closeConversation() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.closeConversation, activeExtensionCommandSourceRef.current);
        return true;
      },
      reopenClosedConversation() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.reopenClosedConversation, activeExtensionCommandSourceRef.current);
        return true;
      },
      toggleConversationPin() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.toggleConversationPin, activeExtensionCommandSourceRef.current);
        return true;
      },
      toggleConversationLock() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.toggleConversationLock, activeExtensionCommandSourceRef.current);
        return true;
      },
      toggleConversationArchive() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.toggleConversationArchive, activeExtensionCommandSourceRef.current);
        return true;
      },
      renameConversation() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.renameConversation, activeExtensionCommandSourceRef.current);
        return true;
      },
      async duplicateConversation() {
        if (!activeConversationId) return false;
        try {
          const { newSessionId } = await api.duplicateConversation(activeConversationId);
          navigate(buildConversationSurfacePath(newSessionId));
          return true;
        } catch (error) {
          addNotification({
            type: 'error',
            message: `Duplicate failed: ${error instanceof Error ? error.message : String(error)}`,
            source: 'conversation',
          });
          return false;
        }
      },
      async copyConversationWorkingDirectory() {
        const cwd = activeWorkspaceCwd?.trim();
        if (!cwd) return false;
        try {
          await writeClipboardText(cwd);
          return true;
        } catch {
          addNotification({ type: 'error', message: 'Copy to clipboard failed.', source: 'conversation' });
          return false;
        }
      },
      async copyConversationId() {
        if (!activeConversationId) return false;
        try {
          await writeClipboardText(activeConversationId);
          return true;
        } catch {
          addNotification({ type: 'error', message: 'Copy to clipboard failed.', source: 'conversation' });
          return false;
        }
      },
      async copyConversationDeeplink() {
        if (!activeConversationId || typeof window === 'undefined') return false;
        try {
          await writeClipboardText(buildConversationDeeplink(activeConversationId, window.location.href));
          return true;
        } catch {
          addNotification({ type: 'error', message: 'Could not build a deeplink for this conversation.', source: 'conversation' });
          return false;
        }
      },
      saveConversationTitle() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.saveConversationTitle, activeExtensionCommandSourceRef.current);
        return true;
      },
      cancelConversationTitleEdit() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.cancelConversationTitleEdit, activeExtensionCommandSourceRef.current);
        return true;
      },
      editConversationCwd() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.editConversationCwd, activeExtensionCommandSourceRef.current);
        return true;
      },
      saveConversationCwd() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.saveConversationCwd, activeExtensionCommandSourceRef.current);
        return true;
      },
      cancelConversationCwdEdit() {
        dispatchDesktopShortcutAction(DESKTOP_SHORTCUT_ACTIONS.cancelConversationCwdEdit, activeExtensionCommandSourceRef.current);
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
      promoteActiveWorkbenchChatTab() {
        if (!activeWorkbenchChatConversationId) return false;
        promoteWorkbenchChatTab(activeWorkbenchChatConversationId);
        return true;
      },
      closeActiveWorkbenchFile() {
        if (!hasActiveWorkbenchFile) return false;
        window.dispatchEvent(new CustomEvent(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT));
        return true;
      },
      refreshActiveWorkbenchFile() {
        if (!hasActiveWorkbenchFile) return false;
        window.dispatchEvent(new CustomEvent(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT));
        return true;
      },
      toggleWorkbenchExplorer() {
        if (!canToggleWorkbenchExplorer) return false;
        handleToggleWorkbenchExplorer();
        return true;
      },
      toggleWorkbenchDiff() {
        window.dispatchEvent(new CustomEvent(WORKBENCH_TOGGLE_DIFF_EVENT));
        return true;
      },
      browserNewTab() {
        return createBrowserTabFromCommand();
      },
      browserReopenTab() {
        return reopenBrowserTabFromCommand();
      },
      browserCloseTab() {
        return closeBrowserTabFromCommand();
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
        window.dispatchEvent(
          new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'copySource' } }),
        );
        return true;
      },
      artifactToggleSource() {
        window.dispatchEvent(
          new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'toggleSource' } }),
        );
        return true;
      },
      artifactToggleFullscreen() {
        window.dispatchEvent(
          new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'toggleFullscreen' } }),
        );
        return true;
      },
      artifactClose() {
        window.dispatchEvent(
          new CustomEvent<{ command: ArtifactModalCommand }>(ARTIFACT_MODAL_COMMAND_EVENT, { detail: { command: 'close' } }),
        );
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
      toggleFirstFileChange() {
        window.dispatchEvent(new CustomEvent<FileChangeCommandDetail>(FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstToolBlock() {
        window.dispatchEvent(new CustomEvent<ToolBlockCommandDetail>(TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstToolBlockLinkedRuns() {
        window.dispatchEvent(new CustomEvent<ToolBlockCommandDetail>(TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstTraceCluster() {
        window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstTraceClusterOverflow() {
        window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstInlineTraceRun() {
        window.dispatchEvent(new CustomEvent<InlineTraceRunCommandDetail>(INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstThinkingBlock() {
        window.dispatchEvent(new CustomEvent<ThinkingBlockCommandDetail>(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      toggleFirstSubagentBlock() {
        window.dispatchEvent(new CustomEvent<SubagentBlockCommandDetail>(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
        return true;
      },
      copyFirstMessageAction() {
        window.dispatchEvent(
          new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'copyFirst' } }),
        );
        return true;
      },
      editFirstMessageAction() {
        window.dispatchEvent(
          new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'editFirst' } }),
        );
        return true;
      },
      rewindFirstMessageAction() {
        window.dispatchEvent(
          new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'rewindFirst' } }),
        );
        return true;
      },
      forkFirstMessageAction() {
        window.dispatchEvent(
          new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command: 'forkFirst' } }),
        );
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
      openDrawingPicker() {
        window.dispatchEvent(new CustomEvent(DRAWING_PICKER_OPEN_COMMAND_EVENT));
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
      openDraftWorkspacePicker() {
        window.dispatchEvent(new CustomEvent(DRAFT_WORKSPACE_PICKER_OPEN_COMMAND_EVENT));
        return true;
      },
      toggleDraftWorkspacePicker() {
        window.dispatchEvent(new CustomEvent(DRAFT_WORKSPACE_PICKER_TOGGLE_COMMAND_EVENT));
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
        return focusComposerTextarea();
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
      toggleComposerPreferences() {
        window.dispatchEvent(new CustomEvent(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT));
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
      createComposerDrawing() {
        window.dispatchEvent(new CustomEvent(COMPOSER_CREATE_DRAWING_COMMAND_EVENT));
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
        window.dispatchEvent(new CustomEvent(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT));
        return true;
      },
      cycleThinking() {
        window.dispatchEvent(new CustomEvent(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT));
        return true;
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
        return focusFirstSidebarControl();
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
      async invokeExtensionCommand(command: ExtensionCommandRegistration, args: unknown) {
        try {
          const response = await api.invokeExtensionAction(command.extensionId, command.action, args ?? {});
          if (response.ok === false) return { ok: false, message: response.error };
          return response.result;
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      },
      onExtensionCommandResult(command: ExtensionCommandRegistration, result: unknown) {
        const notification = buildExtensionCommandNotification(command, result);
        if (notification) addNotification(notification);
      },
    }),
    [
      activeRightRailControl,
      activeConversationId,
      activeWorkspaceCwd,
      activeWorkbenchArtifactId,
      activeWorkbenchChatConversationId,
      activeWorkbenchKnowledgeFileId,
      activeWorkbenchRailSurface,
      activeWorkbenchTabId,
      activeWorkbenchWorkspaceFileId,
      appLayoutMode,
      canToggleRightRail,
      canToggleWorkbenchExplorer,
      canToggleWorkbench,
      closeWorkbenchTab,
      closeBrowserTabFromCommand,
      createBrowserTabFromCommand,
      extensionCommands,
      extensionRightToolPanels,
      handleAppLayoutModeChange,
      handlePrimarySidebarToggle,
      handleWorkbenchToggle,
      hasActiveWorkbenchFile,
      location.pathname,
      navigate,
      openWorkbenchNewTab,
      openWorkbenchToolTab,
      promoteWorkbenchChatTab,
      reopenBrowserTabFromCommand,
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
      if (isShortcutCaptureActive()) return;
      if (isShortcutCaptureEventTarget(event.target)) return;
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
      const detail = event.detail as {
        command?: string;
        args?: unknown;
        requestId?: string;
        resolve?: (handled: boolean) => void;
        source?: unknown;
      };
      if (!detail.command) return;
      const previousSource = activeExtensionCommandSourceRef.current;
      activeExtensionCommandSourceRef.current = typeof detail.source === 'string' ? detail.source : null;
      void executeExtensionCommand(detail.command, detail.args, executeCommandOptions)
        .then((handled) => {
          detail.resolve?.(handled);
          if (detail.requestId) void api.acknowledgeExtensionCommand(detail.requestId, handled).catch(() => undefined);
        })
        .finally(() => {
          activeExtensionCommandSourceRef.current = previousSource;
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
      } else if (!shouldKeepActiveToolWhenConversationHasNoSavedSelection(activeWorkbenchToolSlot)) {
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
    activeWorkbenchToolSlot,
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
    if (!activeHasProjectWorkspaceCwd) {
      clearActiveWorkbenchFileSelection();
      return;
    }

    setSelectedWorkspaceFileByConversation((current) => ({
      ...current,
      [activeConversationId]: workspaceFile,
    }));
    setActiveConversationTool('files');
  }, [activeConversationId, activeHasProjectWorkspaceCwd, clearActiveWorkbenchFileSelection, location.search, setActiveConversationTool]);

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
        clearActiveWorkbenchFileSelection();
        return;
      }
    }

    window.addEventListener(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT, handleWorkbenchCloseActiveFile);
    return () => window.removeEventListener(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT, handleWorkbenchCloseActiveFile);
  }, [
    activeWorkbenchArtifactId,
    activeWorkbenchKnowledgeFileId,
    activeWorkbenchWorkspaceFileId,
    clearActiveWorkbenchFileSelection,
    setSearchParams,
  ]);

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
    function handleWorkbenchChatOpen(event: Event) {
      const detail = (event as CustomEvent<WorkbenchChatOpenDetail>).detail;
      if (!detail?.conversationId) return;
      handleAppLayoutModeChange('workbench');
      openWorkbenchToolTab('chat', { conversationId: detail.conversationId, forceNewTab: detail.forceNewTab });
    }

    function handleWorkbenchChatClose(event: Event) {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (!detail?.conversationId) return;
      closeWorkbenchTab(detail.conversationId);
    }

    function handleWorkbenchPromoteChat(event: Event) {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (!detail?.conversationId) return;
      promoteWorkbenchChatTab(detail.conversationId);
    }

    window.addEventListener(WORKBENCH_CHAT_OPEN_EVENT, handleWorkbenchChatOpen);
    window.addEventListener(WORKBENCH_CHAT_CLOSE_EVENT, handleWorkbenchChatClose);
    window.addEventListener(WORKBENCH_PROMOTE_CHAT_EVENT, handleWorkbenchPromoteChat);
    return () => {
      window.removeEventListener(WORKBENCH_CHAT_OPEN_EVENT, handleWorkbenchChatOpen);
      window.removeEventListener(WORKBENCH_CHAT_CLOSE_EVENT, handleWorkbenchChatClose);
      window.removeEventListener(WORKBENCH_PROMOTE_CHAT_EVENT, handleWorkbenchPromoteChat);
    };
  }, [closeWorkbenchTab, handleAppLayoutModeChange, openWorkbenchToolTab, promoteWorkbenchChatTab]);

  useEffect(() => {
    function handleDesktopShortcut(event: Event) {
      if (hasBlockingOverlayOpen()) {
        return;
      }

      const detail = (event as CustomEvent<{ action?: unknown; command?: unknown; args?: unknown }>).detail;
      if (detail?.action === undefined && typeof detail.command === 'string' && detail.command.trim()) {
        if (
          detail.command === 'page.find' ||
          detail.command === 'page.findNext' ||
          detail.command === 'page.findPrevious' ||
          detail.command === 'page.closeFind'
        ) {
          return;
        }
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
      if (event.defaultPrevented) {
        return;
      }

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
      if (!activeHasProjectWorkspaceCwd) return;
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
    activeHasProjectWorkspaceCwd,
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
    setupReadiness,
  ]);

  return (
    <NotificationProvider>
      <NotificationCommandBridge open={notificationCenterOpen} onClose={() => setNotificationCenterOpen(false)} />
      <DesktopChromeContext.Provider value={{ setRightRailControl: setRegisteredRightRailControl }}>
        <div
          className={cx(
            'flex flex-col overflow-hidden bg-base text-primary select-none',
            embeddedWindowChrome ? 'h-full min-h-0' : 'h-screen',
          )}
        >
          {!hideDesktopTopBar ? (
            <DesktopTopBar
              environment={desktopEnvironment}
              sidebarOpen={effectiveSidebarOpen}
              onToggleSidebar={handlePrimarySidebarToggle}
              showRailToggle={canToggleRightRail}
              railOpen={canToggleWorkbench ? showWorkbench : (activeRightRailControl?.railOpen ?? false)}
              railToggleLabel={canToggleWorkbench ? { open: 'Hide workbench', closed: 'Show workbench' } : undefined}
              onToggleRail={canToggleWorkbench ? handleWorkbenchToggle : (activeRightRailControl?.toggleRail ?? (() => {}))}
              trailingExtra={
                <>
                  <SetupReadinessButton
                    count={setupReadiness.snapshot?.counts.actionable ?? 0}
                    onClick={() => {
                      startTransition(() => setSetupReadinessOpen((open) => !open));
                    }}
                  />
                  <NotificationBell
                    onClick={() => {
                      startTransition(() => setNotificationCenterOpen((open) => !open));
                    }}
                  />
                </>
              }
            />
          ) : null}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {effectiveSidebarOpen ? (
              <div
                style={{ width: sidebar.width }}
                className={cx(
                  'relative z-20 flex-shrink-0 flex flex-col overflow-hidden',
                  embeddedWindowChrome ? 'wos-embedded-sidebar' : 'bg-panel border-r border-border-subtle',
                )}
              >
                <Suspense fallback={<div className="flex-1 bg-panel" aria-label="Loading sidebar" />}>
                  <Sidebar
                    onNewConversation={(args) =>
                      startNewConversationFromLayout(true, {
                        cwd: args?.cwd,
                      })
                    }
                  />
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
                      embeddedWindowChrome={embeddedWindowChrome}
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
                      onPromoteChatTab={promoteWorkbenchChatTab}
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
                        onRailOpenChange={setRouteRightRailOpen}
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
                            className="relative z-10 flex-shrink-0 overflow-hidden border-l border-border-subtle bg-transparent select-text [&>[data-extension-id]]:bg-transparent"
                          >
                            <NativeExtensionSurfaceHost
                              surface={routePrimaryRailSurface}
                              pathname={location.pathname}
                              search={location.search}
                              hash={location.hash}
                              conversationId={activeConversationId}
                              cwd={activeWorkspaceCwd}
                              instanceId="right-sidebar"
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
        <NotificationToaster suppress={notificationCenterOpen} />
      </Suspense>
      {notificationCenterOpen ? (
        <Suspense fallback={null}>
          <NotificationCenter onClose={() => setNotificationCenterOpen(false)} />
        </Suspense>
      ) : null}
      {setupReadinessOpen ? (
        <Suspense fallback={null}>
          <SetupReadinessPopover
            snapshot={setupReadiness.snapshot}
            loading={setupReadiness.loading}
            error={setupReadiness.error}
            onClose={() => setSetupReadinessOpen(false)}
            onRefresh={() => void setupReadiness.refresh()}
            onRunAction={setupReadiness.runAction}
            onDismiss={setupReadiness.dismiss}
            onRestore={setupReadiness.restore}
          />
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
