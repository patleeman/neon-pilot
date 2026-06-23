import {
  type CSSProperties,
  type DragEvent,
  memo,
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

import { type ActivityTreeItem, buildActivityTreeItems, buildConversationActivityId } from '../activity/activityTree';
import { applyActivityTreeItemStyleProviders } from '../activity/activityTreeExtensionStyles';
import { type ActivityTreeDropPosition, ActivityTreeView } from '../activity/ActivityTreeView';
import { useAppEvents, useLiveTitles } from '../app/contexts';
import { api } from '../client/api';
import { OPEN_COMMAND_PALETTE_EVENT } from '../commands/commandPaletteEvents';
import { dispatchPromoteWorkbenchChat, WORKBENCH_CHAT_TAB_DRAG_MIME } from '../companion/companionEvents';
import {
  buildConversationGroupLabels,
  getConversationGroupLabel,
  groupConversationItemsByCwd,
  normalizeConversationGroupCwd,
} from '../conversation/conversationCwdGroups';
import { isNeutralChatCwdPath } from '../conversation/conversationCwdPresentation';
import {
  type ConversationBackgroundWorkKind,
  selectConversationActiveExecutions,
  summarizeConversationBackgroundWorkKind,
} from '../conversation/conversationExecutionActivity';
import {
  buildConversationDeeplink,
  buildConversationSurfacePath,
  resolveConversationAdjacentPath,
  resolveConversationCloseRedirect,
} from '../conversation/conversationRoutes';
import {
  DESKTOP_CONVERSATION_SHORTCUT_EVENT,
  isSidebarConversationShortcutAction,
  sidebarConversationShortcutCommandAction,
} from '../conversation/desktopConversationShortcutActions';
import {
  clearDraftConversationAttachments,
  clearDraftConversationComposer,
  clearDraftConversationCwd,
  clearDraftConversationModel,
  clearDraftConversationThinkingLevel,
  DRAFT_CONVERSATION_ID,
  DRAFT_CONVERSATION_ROUTE,
  readDraftConversationCwd,
} from '../conversation/draftConversation';
import { persistForkPromptDraft } from '../conversation/forking';
import { startNewConversation } from '../conversation/newConversationNavigation';
import {
  normalizeStoredThreadStringList,
  readCollapsedConversationGroupKeys,
  readConversationGroupLabelOverrides,
  readManualConversationGroupOrder,
  readThreadsFilterMode,
  readThreadsOrganizeMode,
  readThreadsSortMode,
  type ThreadsFilterMode,
  type ThreadsOrganizeMode,
  type ThreadsSortMode,
  writeCollapsedConversationGroupKeys,
  writeConversationGroupLabelOverrides,
  writeManualConversationGroupOrder,
  writeThreadsFilterMode,
  writeThreadsOrganizeMode,
  writeThreadsSortMode,
} from '../conversation/threadPresentationPreferences';
import { writeClipboardText } from '../desktop/clipboard';
import { getDesktopBridge, shouldUseNativeAppContextMenus } from '../desktop/desktopBridge';
import { ConversationDecoratorHost } from '../extensions/ConversationDecoratorHost';
import { NativeExtensionSurfaceHost } from '../extensions/NativeExtensionSurfaceHost';
import { createNativeExtensionClient } from '../extensions/nativePaClient';
import { ThreadHeaderActionHost } from '../extensions/ThreadHeaderActionHost';
import { type ExtensionSurfaceSummary, isExtensionLeftNavItemSurface, isNativeExtensionSidebarSurface } from '../extensions/types';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { GATEWAY_STATE_CHANGED_EVENT } from '../gateways/gatewayEvents';
import { getOrCreateConversationSurfaceId } from '../hooks/sessionStream';
import { buildConversationBootstrapVersionKey, fetchConversationBootstrapCached } from '../hooks/useConversationBootstrap';
import { useConversations } from '../hooks/useConversations';
import { prefetchDesktopConversationState } from '../hooks/useDesktopConversationState';
import { normalizeWorkspacePaths, readStoredWorkspacePaths, writeStoredWorkspacePaths } from '../local/savedWorkspacePaths';
import { routeIsKnowledge, routeMatchesPrefix } from '../navigation/routeRegistry';
import { sessionNeedsAttention } from '../session/sessionIndicators';
import {
  applyRemoteConversationLayout,
  type ConversationShelf,
  isWithinLocalWriteGrace,
  type OpenConversationDropPosition,
  readConversationLayout,
  replaceConversationLayout,
} from '../session/sessionTabs';
import type { GatewayState, SessionMeta } from '../shared/types';
import { timeAgoCompact } from '../shared/utils';
import {
  conversationRuntimeStore,
  sessionStore,
  useAllExecutions,
  useAllSessions,
  useAllTasks,
  useConversationActivityStatus,
  useConversationActivityStatusVersion,
  useConversationRuntime,
  useSession,
  useSessionsReady,
} from '../store';
import { ConversationStatusText } from './ConversationStatusText';
import { addNotification } from './notifications/notificationStore';
import { TextPromptDialog } from './shared/TextPromptDialog';
import { shouldUseDocumentNavigationForSidebarRoute } from './sidebarNavigationRouting';
import {
  CardMeta,
  IconButton,
  MenuItem,
  MenuSeparator,
  PanelMessage,
  PositionedMenu,
  RowButton,
  SectionLabel,
  SidebarNavButton,
} from './ui';
import { useSidebarConversationScope } from './useSidebarConversationScope';
import { WorkspaceQuickSelectModal } from './WorkspaceQuickSelectModal';

const SIDEBAR_CONVERSATION_PREFETCH_TAIL_BLOCKS = 120;
const SIDEBAR_DESKTOP_CONVERSATION_PREFETCH_TAIL_BLOCKS = 40;
const SIDEBAR_CONVERSATION_PREFETCH_DELAY_MS = 140;

function Ico({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function MoreActionsIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="6" r="1.15" />
      <circle cx="6" cy="6" r="1.15" />
      <circle cx="10" cy="6" r="1.15" />
    </svg>
  );
}

function formatGatewayProviderLabel(provider: string): string {
  if (provider === 'telegram') return 'Telegram';
  return provider
    .replace(/[_:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function GatewayRailIcon({ provider }: { provider: string }) {
  const providerLabel = formatGatewayProviderLabel(provider);
  const label = `${providerLabel} gateway attached`;
  const abbreviation = providerLabel
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="ui-sidebar-count-badge" title={label} aria-label={label}>
      {abbreviation || 'GW'}
    </span>
  );
}

export function buildGatewayConversationAttachRoute(conversationId: string): string {
  return `/gateways?conversationId=${encodeURIComponent(conversationId)}`;
}

const PATH = {
  conversations:
    'M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25H13.5l-3 3v-3H6.75A2.25 2.25 0 0 1 4.5 14.25v-7.5Z',
  nodes: 'M6 6.75h4.5v4.5H6v-4.5Zm7.5 0H18v4.5h-4.5v-4.5Zm-3.75 7.5h4.5v4.5h-4.5v-4.5Z',
  notes:
    'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  skills: 'M12 3.75l7.5 4.125v8.25L12 20.25 4.5 16.125v-8.25L12 3.75Zm0 0v16.5M4.5 7.875 12 12l7.5-4.125',
  workspace:
    'M3.75 6A2.25 2.25 0 0 1 6 3.75h4.19a2.25 2.25 0 0 1 1.59.66l.91.9a2.25 2.25 0 0 0 1.59.66H18A2.25 2.25 0 0 1 20.25 8.25v9A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25V6Z',
  workspaceAdd:
    'M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z M3.75 9.75h16.5 M15.75 11.25v4.5 M13.5 13.5h4.5',
  automations: 'M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  gateways: 'M5 12h5m4 0h5M9 8l3-3 3 3M9 16l3 3 3-3M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  settings:
    'M10.5 6h3m-1.5-3v6m4.348-2.826 2.121 2.121m-12.728 0 2.121-2.121m8.486 8.486 2.121 2.121m-12.728 0 2.121-2.121M6 10.5H3m18 0h-3m-5.25 7.5v3m0-18v3',
  close: 'M6 18 18 6M6 6l12 12',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  grid: 'M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z',
  filter: 'M4.5 7.5h15M7.5 12h9M10.5 16.5h3',
  search: 'm21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  list: 'M8.25 6.75h9m-9 5.25h9m-9 5.25h9M5.25 6.75h.01M5.25 12h.01M5.25 17.25h.01',
  grip: 'M9 6.75h.01M9 12h.01M9 17.25h.01M15 6.75h.01M15 12h.01M15 17.25h.01',
  clock: 'M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  lock: 'M7.5 10.5V8.25a4.5 4.5 0 0 1 9 0v2.25M6.75 10.5h10.5A1.5 1.5 0 0 1 18.75 12v6A1.5 1.5 0 0 1 17.25 19.5H6.75A1.5 1.5 0 0 1 5.25 18v-6a1.5 1.5 0 0 1 1.5-1.5Z',
  sparkles:
    'M12 3.75l1.07 3.43a1.5 1.5 0 0 0 .93.94l3.43 1.07-3.43 1.07a1.5 1.5 0 0 0-.93.93L12 15.62l-1.07-3.43a1.5 1.5 0 0 0-.93-.93L6.57 10.19 10 9.12a1.5 1.5 0 0 0 .93-.94L12 3.75Zm6 10.5.54 1.71a.75.75 0 0 0 .47.47l1.71.54-1.71.54a.75.75 0 0 0-.47.47L18 20.69l-.54-1.71a.75.75 0 0 0-.47-.47l-1.71-.54 1.71-.54a.75.75 0 0 0 .47-.47L18 14.25Z',
  chatBubble:
    'M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v6.75a2.25 2.25 0 0 1-2.25 2.25H12l-4.5 3v-3H6.75A2.25 2.25 0 0 1 4.5 13.5V6.75Z',
  check: 'm5 12.75 4.5 4.5L19 7.75',
  pin: 'm15.75 3.75 4.5 4.5-3 3v3l-2.25 2.25-7.5-7.5L9.75 6.75h3l3-3ZM9.75 14.25 4.5 19.5',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z M9 22V12h6v10',
  book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5z M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  code: 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
};

const LEGACY_THREAD_LIST_ENABLED = false;

const SIDEBAR_BROWSER_NEW_CHAT_HOTKEY = 'Ctrl+Shift+N';
const WORKBENCH_CLOSE_ACTIVE_FILE_EVENT = 'pa:workbench-close-active-file';
const WORKBENCH_DOCUMENT_WITH_OPEN_FILE_SELECTOR = '[data-workbench-document-pane="true"][data-has-open-file="true"]';
const SIDEBAR_DROP_TARGET_STYLE = { backgroundColor: 'rgb(var(--color-accent) / 0.1)' } satisfies CSSProperties;

function getExtensionNavIcon(icon: string | undefined): string {
  switch (icon) {
    case 'automation':
      return PATH.automations;
    case 'browser':
      return PATH.chatBubble;
    case 'diff':
      return PATH.list;
    case 'file':
      return PATH.workspace;
    case 'gear':
      return PATH.settings;
    case 'graph':
      return PATH.nodes;
    case 'kanban':
      return PATH.grid;
    case 'play':
      return PATH.clock;
    case 'sparkle':
      return PATH.sparkles;
    case 'terminal':
      return PATH.workspace;
    case 'search':
      return PATH.search;
    case 'chat':
      return PATH.chatBubble;
    case 'add':
      return PATH.plus;
    case 'clock':
      return PATH.clock;
    case 'home':
      return PATH.home;
    case 'book':
      return PATH.book;
    case 'star':
      return PATH.star;
    case 'link':
      return PATH.link;
    case 'code':
      return PATH.code;
    case 'tag':
      return PATH.tag;
    case 'app':
    case 'database':
    default:
      return PATH.grid;
  }
}

type SidebarConversationItem = {
  session: SessionMeta;
  section: ConversationShelf;
  pinned: boolean;
  originalIndex: number;
};

type SidebarConversationGroup = {
  key: string;
  cwd: string | null;
  label: string;
  defaultLabel: string;
  items: SidebarConversationItem[];
};

type SidebarExtensionNavItem = ExtensionSurfaceSummary & {
  id: string;
  route: string;
  label: string;
  icon?: string;
  sidebarView?: string;
  section?: 'primary' | 'settings';
  attentionCount?: number;
  attentionSeverity?: 'warning' | 'error';
};

function isRegisteredExtensionNavItem(
  item: { extensionId?: string; route: string; sidebarView?: string },
  registeredRoutes: ReadonlySet<string>,
  registeredSidebarSurfaces: ReadonlySet<string>,
): boolean {
  if (registeredRoutes.has(item.route)) return true;
  if (!item.extensionId || !item.sidebarView) return false;
  return registeredSidebarSurfaces.has(`${item.extensionId}:${item.sidebarView}`);
}

function isSidebarVisibleConversation(session: SessionMeta): boolean {
  return session.offshootKind !== 'subagent' && !session.sourceRunId;
}

type PointerPosition = { x: number; y: number };

let lastSidebarPointerPosition: PointerPosition | null = null;
let sidebarPointerTrackingAttached = false;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function recordSidebarPointerPosition(event: PointerEvent) {
  lastSidebarPointerPosition = { x: event.clientX, y: event.clientY };
}

function clearSidebarPointerPosition() {
  lastSidebarPointerPosition = null;
}

function ensureSidebarPointerTracking() {
  if (sidebarPointerTrackingAttached || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('pointermove', recordSidebarPointerPosition, { passive: true });
  window.addEventListener('pointerleave', clearSidebarPointerPosition);
  window.addEventListener('blur', clearSidebarPointerPosition);
  sidebarPointerTrackingAttached = true;
}

function elementContainsPointer(element: HTMLElement, point: PointerPosition): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const hoveredElement = document.elementFromPoint(point.x, point.y);
  if (hoveredElement && element.contains(hoveredElement)) {
    return true;
  }
  const bounds = element.getBoundingClientRect();
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

function useSidebarRowHover<T extends HTMLElement>() {
  const hoverRef = useRef<T | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    ensureSidebarPointerTracking();
  }, []);

  useIsomorphicLayoutEffect(() => {
    const element = hoverRef.current;
    const point = lastSidebarPointerPosition;
    if (!element || !point) {
      return;
    }
    const nextHovered = elementContainsPointer(element, point);
    setHovered((current) => (current === nextHovered ? current : nextHovered));
  });

  return {
    hoverRef,
    hovered,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };
}

function sameStringLists(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildActivityTreeGroupId(groupKey: string): string {
  return `group:${groupKey || 'chats'}`;
}

function getConversationItemSortTimestamp(session: SessionMeta, sortMode: ThreadsSortMode): number {
  const source = sortMode === 'created' ? session.timestamp : (session.lastActivityAt ?? session.attentionUpdatedAt ?? session.timestamp);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source)) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(source);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === source ? parsed : Number.NEGATIVE_INFINITY;
}

function compareConversationItems(left: SidebarConversationItem, right: SidebarConversationItem, sortMode: ThreadsSortMode): number {
  const timestampDelta =
    getConversationItemSortTimestamp(right.session, sortMode) - getConversationItemSortTimestamp(left.session, sortMode);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return left.originalIndex - right.originalIndex;
}

function normalizeHotkeyKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

function hasCommandOrControlHotkey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function resolveConversationNumberHotkey(event: KeyboardEvent): number {
  if (event.shiftKey || event.altKey || !hasCommandOrControlHotkey(event)) {
    return -1;
  }

  const match = event.code.match(/^Digit([1-9])$/);
  if (match) {
    return Number(match[1]) - 1;
  }

  const key = normalizeHotkeyKey(event.key);
  return /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
}

function resolveSidebarConversationHotkeyOrder<T>(input: {
  organizeMode: 'project' | 'chronological';
  orderedItems: readonly T[];
  groupedRows: ReadonlyArray<{ key: string; items: readonly T[] }>;
  collapsedGroupKeys?: ReadonlySet<string>;
}): T[] {
  if (input.organizeMode !== 'project') {
    return [...input.orderedItems];
  }

  return input.groupedRows.flatMap((group) => (input.collapsedGroupKeys?.has(group.key) ? [] : [...group.items]));
}

function getSessionWorkspaceCwd(session: Pick<SessionMeta, 'cwd' | 'workspaceCwd'>): string | null {
  const workspaceCwd = session.workspaceCwd?.trim();
  if (workspaceCwd && !isNeutralChatCwdPath(workspaceCwd)) {
    return workspaceCwd;
  }

  const cwd = session.cwd?.trim();
  return cwd && !isNeutralChatCwdPath(cwd) ? cwd : null;
}

function getLocalSessionWorkspacePath(session: Pick<SessionMeta, 'cwd' | 'workspaceCwd'> | null | undefined): string {
  return session ? (getSessionWorkspaceCwd(session) ?? '') : '';
}

function matchesLetterHotkey(event: KeyboardEvent, code: string, letter: string): boolean {
  return event.code === code || normalizeHotkeyKey(event.key) === letter;
}

function hasOverlayOpen(): boolean {
  return document.querySelector('.ui-overlay-backdrop') !== null;
}

function isFocusWithinWorkbenchOpenFile(): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof Element)) {
    return false;
  }

  return activeElement.closest(WORKBENCH_DOCUMENT_WITH_OPEN_FILE_SELECTOR) !== null;
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function getNewConversationHotkeyLabel(): string {
  if (getDesktopBridge() !== null) {
    return isMacPlatform() ? '⌘N' : 'Ctrl+N';
  }

  return SIDEBAR_BROWSER_NEW_CHAT_HOTKEY;
}

function TopNavItem({
  to,
  icon,
  label,
  badge,
  forceActive = false,
}: {
  to: string;
  icon: string;
  label: string;
  badge?: number | null;
  forceActive?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = forceActive || routeMatchesPrefix(location.pathname, to);
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const routerPath = `${location.pathname}${location.search}${location.hash}`;
      const browserPath =
        typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}${window.location.hash}` : routerPath;
      if (browserPath === to && routerPath !== to) {
        window.history.replaceState(window.history.state, '', routerPath);
      }
      if (shouldUseDocumentNavigationForSidebarRoute(location.pathname, to) && typeof window !== 'undefined') {
        window.location.assign(to);
        return;
      }
      navigate(to);
    },
    [location.hash, location.pathname, location.search, navigate, to],
  );

  return (
    <SidebarNavButton onClick={handleClick} active={active} data-route={to} className="w-full text-left">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 opacity-70"
      >
        <path d={icon} />
      </svg>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && <span className="ui-sidebar-nav-badge">{badge > 99 ? '99+' : badge}</span>}
    </SidebarNavButton>
  );
}

function SidebarPrimaryNav({
  chatActive,
  newConversationBusy,
  newConversationHotkeyLabel,
  items,
  onOpenChat,
  onNewConversation,
}: {
  chatActive: boolean;
  newConversationBusy: boolean;
  newConversationHotkeyLabel: string;
  items: SidebarExtensionNavItem[];
  onOpenChat: () => void;
  onNewConversation: () => void;
}) {
  return (
    <nav className="relative z-20 shrink-0 space-y-px bg-panel pb-1 pt-3" aria-label="Primary navigation">
      <div className="grid grid-cols-[minmax(0,1fr)_32px] gap-1 px-1">
        <SidebarNavButton onClick={onOpenChat} active={chatActive} className="mx-0 flex min-w-0 text-secondary" title="Chat">
          <Ico d={PATH.chatBubble} size={15} />
          <span className="flex-1 text-left">Chat</span>
        </SidebarNavButton>
        <SidebarNavButton
          onClick={onNewConversation}
          disabled={newConversationBusy}
          className="mx-0 flex justify-center text-secondary"
          title={newConversationBusy ? 'Creating conversation...' : `New chat (${newConversationHotkeyLabel})`}
          aria-label={newConversationBusy ? 'Creating conversation...' : `New chat (${newConversationHotkeyLabel})`}
        >
          <Ico d={PATH.plus} size={15} />
        </SidebarNavButton>
      </div>
      {items.map((item) => (
        <TopNavItem key={`${item.extensionId}:${item.id}`} to={item.route} icon={getExtensionNavIcon(item.icon)} label={item.label} />
      ))}
    </nav>
  );
}

function SidebarSettingsNav({ items, notice }: { items: SidebarExtensionNavItem[]; notice: string | null }) {
  return (
    <div className="relative z-20 shrink-0 bg-panel">
      {notice ? (
        <CardMeta as="div" aria-live="polite" className="px-4 pb-2" style={{ color: 'rgb(var(--color-accent) / 0.8)' }}>
          {notice}
        </CardMeta>
      ) : null}
      <div className="border-t border-border-subtle px-0 py-2 space-y-0.5">
        {items.map((item) => (
          <TopNavItem key={`${item.extensionId}:${item.id}`} to={item.route} icon={getExtensionNavIcon(item.icon)} label={item.label} />
        ))}
      </div>
    </div>
  );
}

function renderSidebarMenuPortal(menu: ReactNode) {
  if (typeof document === 'undefined') return menu;
  return createPortal(menu, document.body);
}

function getSidebarMenuPositionStyle(position: { x: number; y: number }, minWidth: number): CSSProperties {
  return {
    bottom: 'auto',
    left: position.x,
    marginBottom: 0,
    minWidth,
    position: 'fixed',
    right: 'auto',
    top: position.y,
  };
}

function ThreadsFilterButton({
  organizeMode,
  filterMode,
  sortMode,
  onChangeOrganizeMode,
  onChangeFilterMode,
  onChangeSortMode,
}: {
  organizeMode: ThreadsOrganizeMode;
  filterMode: ThreadsFilterMode;
  sortMode: ThreadsSortMode;
  onChangeOrganizeMode: (value: ThreadsOrganizeMode) => void;
  onChangeFilterMode: (value: ThreadsFilterMode) => void;
  onChangeSortMode: (value: ThreadsSortMode) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRootRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  function openMenu() {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const menuWidth = 172;
    const menuHeight = 320;
    const edgePadding = 12;
    const viewportWidth = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight;

    setMenuPosition({
      x: Math.max(edgePadding, Math.min(bounds.right - menuWidth, viewportWidth - menuWidth - edgePadding)),
      y: Math.max(edgePadding, Math.min(bounds.bottom + 6, viewportHeight - menuHeight - edgePadding)),
    });
    setMenuOpen(true);
  }

  function handleMenuToggle() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    openMenu();
  }

  function renderMenuItem({ label, icon, checked, onClick }: { label: string; icon: string; checked: boolean; onClick: () => void }) {
    return (
      <MenuItem
        onClick={() => {
          onClick();
          setMenuOpen(false);
        }}
        checked={checked}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-secondary">
            <Ico d={icon} size={11} />
          </span>
          <span className="truncate">{label}</span>
        </span>
        <span className="ml-3 flex h-4 w-4 shrink-0 items-center justify-center text-accent">
          {checked ? <Ico d={PATH.check} size={11} /> : null}
        </span>
      </MenuItem>
    );
  }

  return (
    <>
      <IconButton
        compact
        ref={buttonRef}
        type="button"
        onClick={handleMenuToggle}
        className="shrink-0"
        title="Organize and sort threads"
        aria-label="Organize and sort threads"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <Ico d={PATH.filter} size={12} />
      </IconButton>
      {menuOpen && menuPosition
        ? renderSidebarMenuPortal(
            <PositionedMenu
              ref={menuRootRef}
              placement="fixed"
              className="min-w-[172px]"
              style={getSidebarMenuPositionStyle(menuPosition, 172)}
              aria-label="Threads organization options"
            >
              <div className="space-y-px">
                <SectionLabel tone="muted" className="block px-2.5 pb-1 pt-2">
                  Show
                </SectionLabel>
                {renderMenuItem({
                  label: 'All threads',
                  icon: PATH.list,
                  checked: filterMode === 'all',
                  onClick: () => onChangeFilterMode('all'),
                })}
                {renderMenuItem({
                  label: 'Human threads',
                  icon: PATH.conversations,
                  checked: filterMode === 'human',
                  onClick: () => onChangeFilterMode('human'),
                })}
                {renderMenuItem({
                  label: 'Automation threads',
                  icon: PATH.automations,
                  checked: filterMode === 'automation',
                  onClick: () => onChangeFilterMode('automation'),
                })}
                <div className="my-1 h-px bg-border-subtle" aria-hidden="true" />
                <SectionLabel tone="muted" className="block px-2.5 pb-1 pt-1">
                  Organize
                </SectionLabel>
                {renderMenuItem({
                  label: 'By project',
                  icon: PATH.workspace,
                  checked: organizeMode === 'project',
                  onClick: () => onChangeOrganizeMode('project'),
                })}
                {renderMenuItem({
                  label: 'Chronological list',
                  icon: PATH.list,
                  checked: organizeMode === 'chronological',
                  onClick: () => onChangeOrganizeMode('chronological'),
                })}
                <div className="my-1 h-px bg-border-subtle" aria-hidden="true" />
                <SectionLabel tone="muted" className="block px-2.5 pb-1 pt-1">
                  Order
                </SectionLabel>
                {renderMenuItem({
                  label: 'Created',
                  icon: PATH.clock,
                  checked: sortMode === 'created',
                  onClick: () => onChangeSortMode('created'),
                })}
                {renderMenuItem({
                  label: 'Updated',
                  icon: PATH.sparkles,
                  checked: sortMode === 'updated',
                  onClick: () => onChangeSortMode('updated'),
                })}
                {renderMenuItem({
                  label: 'Manual order',
                  icon: PATH.grip,
                  checked: sortMode === 'manual',
                  onClick: () => onChangeSortMode('manual'),
                })}
              </div>
            </PositionedMenu>,
          )
        : null}
    </>
  );
}

function ConversationCwdGroupHeader({
  label,
  cwd,
  collapsed,
  canDrag = false,
  isDragging = false,
  isConversationDropTarget = false,
  dropPosition = null,
  dragId,
  onToggleCollapsed,
  onNewConversation,
  onOpenInFinder,
  onEditName,
  onArchiveThreads,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  label: string;
  cwd: string | null;
  collapsed: boolean;
  canDrag?: boolean;
  isDragging?: boolean;
  isConversationDropTarget?: boolean;
  dropPosition?: OpenConversationDropPosition | null;
  dragId?: string;
  onToggleCollapsed: () => void;
  onNewConversation: () => void;
  onOpenInFinder?: () => void | Promise<void>;
  onEditName?: () => void | Promise<void>;
  onArchiveThreads?: () => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTitle = cwd ?? label;
  const newConversationTitle = cwd ? `New conversation in ${cwd}` : 'New conversation';
  const workspaceActionsTitle = cwd ? `Workspace actions for ${cwd}` : `Chat actions for ${label}`;
  const toggleTitle = `${collapsed ? 'Expand' : 'Collapse'} ${label}`;
  const iconPath = hovered ? (collapsed ? PATH.chevronRight : PATH.chevronDown) : cwd ? PATH.workspace : PATH.chatBubble;
  const hasMenuActions = Boolean(onOpenInFinder || onEditName || onArchiveThreads || onRemove);
  const menuActionCount =
    Number(Boolean(onOpenInFinder)) + Number(Boolean(onEditName)) + Number(Boolean(onArchiveThreads)) + Number(Boolean(onRemove));
  const showMenuDivider = Boolean((onOpenInFinder || onEditName) && (onArchiveThreads || onRemove));
  const toggleButtonClassName = [
    'min-w-0 flex-1 gap-2 py-1 text-primary',
    canDrag && (isDragging ? 'cursor-grabbing opacity-60' : 'cursor-grab'),
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || !menuRootRef.current || menuRootRef.current.contains(target)) {
        return;
      }

      setMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen]);

  function stopMenuEvent(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
  }

  function openDomContextMenu(x: number, y: number) {
    const menuWidth = 214;
    const menuHeight = Math.max(1, menuActionCount) * 33 + (showMenuDivider ? 9 : 0) + 10;
    const viewportWidth = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight;
    const edgePadding = 12;

    setMenuPosition({
      x: Math.max(edgePadding, Math.min(x, viewportWidth - menuWidth - edgePadding)),
      y: Math.max(edgePadding, Math.min(y, viewportHeight - menuHeight - edgePadding)),
    });
    setMenuOpen(true);
  }

  async function runMenuHandler(handler?: () => void | Promise<void>) {
    await handler?.();
    setMenuOpen(false);
  }

  async function runNativeContextMenuAction(action: DesktopConversationCwdGroupContextMenuAction | null) {
    switch (action) {
      case 'open-in-finder':
        await onOpenInFinder?.();
        return;
      case 'edit-name':
        await onEditName?.();
        return;
      case 'archive-threads':
        await onArchiveThreads?.();
        return;
      case 'remove':
        await onRemove?.();
        return;
      default:
        return;
    }
  }

  function openContextMenuAt(x: number, y: number) {
    if (!hasMenuActions) {
      return;
    }

    const desktopBridge = shouldUseNativeAppContextMenus() ? getDesktopBridge() : null;
    if (desktopBridge?.showConversationCwdGroupContextMenu) {
      setMenuOpen(false);
      setMenuPosition(null);
      void desktopBridge
        .showConversationCwdGroupContextMenu({
          x,
          y,
          canOpenInFinder: Boolean(onOpenInFinder),
          canEditName: Boolean(onEditName),
          canArchiveThreads: Boolean(onArchiveThreads),
          canRemove: Boolean(onRemove),
        })
        .then(({ action }) => runNativeContextMenuAction(action))
        .catch(() => {
          openDomContextMenu(x, y);
        });
      return;
    }

    openDomContextMenu(x, y);
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!hasMenuActions) {
      return;
    }

    stopMenuEvent(event);
    openContextMenuAt(event.clientX, event.clientY);
  }

  function handleMenuButtonClick(event: ReactMouseEvent<HTMLButtonElement>) {
    stopMenuEvent(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    openContextMenuAt(bounds.left, bounds.bottom + 4);
  }

  return (
    <div
      className="relative px-4 pt-1 pb-0.5 transition-colors"
      style={isConversationDropTarget ? SIDEBAR_DROP_TARGET_STYLE : undefined}
      onContextMenu={handleContextMenu}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragOver={canDrag ? onDragOver : undefined}
      onDrop={canDrag ? onDrop : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      data-sidebar-group-key={dragId}
    >
      {dropPosition ? (
        <span aria-hidden="true" className={['ui-sidebar-drop-indicator', dropPosition === 'before' ? 'top-0' : 'bottom-0'].join(' ')} />
      ) : null}
      <div className="flex items-center gap-1">
        <RowButton
          compact
          draggable={false}
          onClick={onToggleCollapsed}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={toggleButtonClassName}
          title={hoverTitle}
          aria-label={toggleTitle}
          aria-expanded={!collapsed}
        >
          <span className="shrink-0 text-secondary">
            <Ico d={iconPath} size={13} />
          </span>
          <span className="min-w-0 truncate text-sm font-semibold tracking-tight">{label}</span>
        </RowButton>
        {hasMenuActions ? (
          <IconButton
            compact
            type="button"
            draggable={false}
            onClick={handleMenuButtonClick}
            className="shrink-0"
            title={workspaceActionsTitle}
            aria-label={workspaceActionsTitle}
          >
            <MoreActionsIcon size={12} />
          </IconButton>
        ) : null}
        <IconButton
          compact
          type="button"
          draggable={false}
          onClick={onNewConversation}
          className="shrink-0"
          title={newConversationTitle}
          aria-label={newConversationTitle}
        >
          <Ico d={PATH.plus} size={11} />
        </IconButton>
      </div>
      {menuOpen && menuPosition
        ? renderSidebarMenuPortal(
            <PositionedMenu
              ref={menuRootRef}
              placement="fixed"
              className="min-w-[214px]"
              style={getSidebarMenuPositionStyle(menuPosition, 214)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setMenuOpen(false);
                }
              }}
              aria-label={`Workspace actions for ${label}`}
            >
              <div className="space-y-px">
                {onOpenInFinder ? (
                  <MenuItem
                    onClick={() => {
                      void runMenuHandler(onOpenInFinder);
                    }}
                  >
                    Open in Finder
                  </MenuItem>
                ) : null}
                {onEditName ? (
                  <MenuItem
                    onClick={() => {
                      void runMenuHandler(onEditName);
                    }}
                  >
                    Edit Name
                  </MenuItem>
                ) : null}
                {showMenuDivider ? <MenuSeparator className="my-1" /> : null}
                {onArchiveThreads ? (
                  <MenuItem
                    onClick={() => {
                      void runMenuHandler(onArchiveThreads);
                    }}
                  >
                    Archive Threads
                  </MenuItem>
                ) : null}
                {onRemove ? (
                  <MenuItem
                    onClick={() => {
                      void runMenuHandler(onRemove);
                    }}
                    tone="danger"
                  >
                    Remove
                  </MenuItem>
                ) : null}
              </div>
            </PositionedMenu>,
          )
        : null}
    </div>
  );
}

type ConversationCopyMenuAction = 'id' | 'working-directory' | 'deeplink';

type ConversationCopyMenuState = {
  action: ConversationCopyMenuAction;
  status: 'copied' | 'failed';
};

const OpenConversationRow = memo(function OpenConversationRow({
  session,
  active,
  pinned = false,
  canDrag = false,
  isDragging = false,
  dropPosition = null,
  locked = false,
  onPin,
  onUnpin,
  onToggleLock,
  onClose,
  onArchive,
  onOpenInNewWindow,
  onDuplicate,
  onCopyWorkingDirectory,
  onCopyId,
  onCopyDeeplink,
  onPrefetch,
  gatewayProviders = [],
  isAutomation = false,
  automationTitle,
  hasPendingRuns = false,
  backgroundWorkKind = null,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  session: SessionMeta;
  active: boolean;
  pinned?: boolean;
  locked?: boolean;
  canDrag?: boolean;
  isDragging?: boolean;
  dropPosition?: OpenConversationDropPosition | null;
  onPin?: () => void;
  onUnpin?: () => void;
  onToggleLock?: () => void;
  onClose?: () => void;
  onArchive?: () => boolean | Promise<boolean>;
  onOpenInNewWindow?: () => boolean | Promise<boolean>;
  onDuplicate?: () => boolean | Promise<boolean>;
  onCopyWorkingDirectory?: () => boolean | Promise<boolean>;
  onCopyId?: () => boolean | Promise<boolean>;
  onCopyDeeplink?: () => boolean | Promise<boolean>;
  onPrefetch?: () => void;
  gatewayProviders?: string[];
  isAutomation?: boolean;
  automationTitle?: string;
  hasPendingRuns?: boolean;
  backgroundWorkKind?: ConversationBackgroundWorkKind | null;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const { hoverRef, hovered, onMouseEnter, onMouseLeave } = useSidebarRowHover<HTMLDivElement>();
  const navigate = useNavigate();
  const needsAttention = sessionNeedsAttention(session as Parameters<typeof sessionNeedsAttention>[0]);
  const { conversationDecorators, contextMenus } = useExtensionRegistry();
  const conversationExtensionMenuItems = useMemo(
    () =>
      contextMenus.filter((menu) => {
        if (menu.surface !== 'conversationList') {
          return false;
        }

        // Evaluate action-specific visibility conditions by action id.
        switch (menu.action) {
          case 'attachConversation':
            return session.id !== DRAFT_CONVERSATION_ID;
          case 'duplicateConversation':
            return Boolean(onDuplicate);
          case 'copyWorkingDirectory':
            return Boolean(onCopyWorkingDirectory);
          case 'copyConversationId':
            return Boolean(onCopyId);
          case 'copyDeeplink':
            return Boolean(onCopyDeeplink);
          default:
            return true;
        }

        return true;
      }),
    [contextMenus, onCopyDeeplink, onCopyId, onCopyWorkingDirectory, onDuplicate, session.id],
  );
  const decoratorsByPosition = useMemo(() => {
    const byPos: Record<string, typeof conversationDecorators> = { 'before-title': [], 'after-title': [], subtitle: [] };
    for (const d of conversationDecorators) {
      const list = byPos[d.position];
      if (list) list.push(d);
    }
    for (const list of Object.values(byPos)) list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return byPos;
  }, [conversationDecorators]);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [busyExtensionMenuId, setBusyExtensionMenuId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<ConversationCopyMenuState | null>(null);
  const hasContextMenuActions = Boolean(
    onPin || onUnpin || onToggleLock || onArchive || onOpenInNewWindow || conversationExtensionMenuItems.length > 0,
  );
  const contextMenuItemCount =
    (pinned && onUnpin ? 1 : !pinned && onPin ? 1 : 0) +
    Number(Boolean(onToggleLock)) +
    Number(Boolean(onArchive)) +
    Number(Boolean(onOpenInNewWindow)) +
    conversationExtensionMenuItems.length;

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || !menuRootRef.current || menuRootRef.current.contains(target)) {
        return;
      }

      setMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen]);

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!menuOpen) {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
      setCopyState(null);
      return;
    }

    if (!copyState) {
      return;
    }

    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }

    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyState(null);
      copyResetTimeoutRef.current = null;
    }, 1500);

    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    };
  }, [copyState, menuOpen]);

  const showQuickActions = hovered || menuOpen;
  const showCloseButton = showQuickActions && Boolean(onClose);
  const showTrailingControls = showCloseButton;
  const rowTitle = canDrag ? 'Drag to reorder conversations' : undefined;
  const prefetchTimeoutRef = useRef<number | null>(null);

  const cancelConversationPrefetch = useCallback(() => {
    if (prefetchTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(prefetchTimeoutRef.current);
    prefetchTimeoutRef.current = null;
  }, []);

  function stopRowInteraction(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
  }

  function getCopyMenuLabel(action: ConversationCopyMenuAction): string {
    if (!copyState || copyState.action !== action) {
      switch (action) {
        case 'working-directory':
          return 'Copy Working Directory';
        case 'id':
          return 'Copy Session ID';
        case 'deeplink':
          return 'Copy Deeplink';
      }
    }

    if (copyState.status === 'failed') {
      return 'Copy Failed';
    }

    switch (action) {
      case 'working-directory':
        return 'Copied Working Directory';
      case 'id':
        return 'Copied Session ID';
      case 'deeplink':
        return 'Copied Deeplink';
    }
  }

  async function handleCopyClick(action: ConversationCopyMenuAction, handler?: () => boolean | Promise<boolean>) {
    if (!handler || busyExtensionMenuId) {
      return;
    }

    const succeeded = await handler();
    setCopyState({ action, status: succeeded === false ? 'failed' : 'copied' });
  }

  function getConversationToolsCopyAction(action: string): ConversationCopyMenuAction | null {
    switch (action) {
      case 'copyWorkingDirectory':
        return 'working-directory';
      case 'copyConversationId':
        return 'id';
      case 'copyDeeplink':
        return 'deeplink';
      default:
        return null;
    }
  }

  function getConversationToolsCopyHandler(action: ConversationCopyMenuAction): (() => boolean | Promise<boolean>) | undefined {
    switch (action) {
      case 'working-directory':
        return onCopyWorkingDirectory;
      case 'id':
        return onCopyId;
      case 'deeplink':
        return onCopyDeeplink;
    }
  }

  function getExtensionContextMenuTitle(menu: (typeof conversationExtensionMenuItems)[number]): string {
    const copyAction = getConversationToolsCopyAction(menu.action);
    if (copyAction) {
      return getCopyMenuLabel(copyAction);
    }

    if (menu.action === 'duplicateConversation' && busyExtensionMenuId === menu.id) {
      return 'Duplicating…';
    }

    return busyExtensionMenuId === menu.id ? `${menu.title}…` : menu.title;
  }

  function openDomContextMenu(x: number, y: number) {
    const menuWidth = 224;
    const menuHeight = Math.max(1, contextMenuItemCount) * 33 + 10;
    const viewportWidth = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight;
    const edgePadding = 12;

    setMenuPosition({
      x: Math.max(edgePadding, Math.min(x, viewportWidth - menuWidth - edgePadding)),
      y: Math.max(edgePadding, Math.min(y, viewportHeight - menuHeight - edgePadding)),
    });
    setMenuOpen(true);
  }

  useEffect(() => cancelConversationPrefetch, [cancelConversationPrefetch]);

  const scheduleConversationPrefetch = useCallback(() => {
    if (!onPrefetch || prefetchTimeoutRef.current !== null) {
      return;
    }

    prefetchTimeoutRef.current = window.setTimeout(() => {
      prefetchTimeoutRef.current = null;
      onPrefetch();
    }, SIDEBAR_CONVERSATION_PREFETCH_DELAY_MS);
  }, [onPrefetch]);

  const handleRowMouseEnter = useCallback(() => {
    onMouseEnter();
    scheduleConversationPrefetch();
  }, [onMouseEnter, scheduleConversationPrefetch]);

  const handleRowMouseLeave = useCallback(() => {
    cancelConversationPrefetch();
    onMouseLeave();
  }, [cancelConversationPrefetch, onMouseLeave]);

  async function handleExtensionContextMenuClick(menu: (typeof conversationExtensionMenuItems)[number]) {
    if (busyExtensionMenuId) return;
    let closeAfterAction = true;
    setBusyExtensionMenuId(menu.id);
    try {
      switch (menu.action) {
        case 'attachConversation': {
          navigate(buildGatewayConversationAttachRoute(session.id));
          return;
        }
        case 'duplicateConversation': {
          await onDuplicate?.();
          return;
        }
        case 'exportSession': {
          const input = {
            conversationId: session.id,
            sessionTitle: session.title,
            cwd: session.cwd,
          };
          await api.invokeExtensionAction(menu.extensionId, menu.action, input);
          return;
        }
        default: {
          const copyAction = getConversationToolsCopyAction(menu.action);
          if (copyAction) {
            closeAfterAction = false;
            await handleCopyClick(copyAction, getConversationToolsCopyHandler(copyAction));
            return;
          }
          const input = {
            conversationId: session.id,
            sessionTitle: session.title,
            cwd: session.cwd,
          };
          await getPaClient(menu.extensionId).extension.invoke(menu.action, input);
        }
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        source: menu.title,
      });
    } finally {
      setBusyExtensionMenuId(null);
      if (closeAfterAction) {
        setMenuOpen(false);
      }
    }
  }

  const paClientByExtension = useRef<Map<string, ReturnType<typeof createNativeExtensionClient>>>(new Map());
  function getPaClient(extensionId: string) {
    let client = paClientByExtension.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      paClientByExtension.current.set(extensionId, client);
    }
    return client;
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!hasContextMenuActions) {
      return;
    }

    stopRowInteraction(event);
    openDomContextMenu(event.clientX, event.clientY);
  }

  return (
    <div
      ref={hoverRef}
      className="relative"
      data-sidebar-session-id={session.id}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragOver={canDrag ? onDragOver : undefined}
      onDrop={canDrag ? onDrop : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onMouseEnter={handleRowMouseEnter}
      onMouseLeave={handleRowMouseLeave}
      onContextMenu={handleContextMenu}
    >
      {dropPosition ? (
        <span aria-hidden="true" className={['ui-sidebar-drop-indicator', dropPosition === 'before' ? 'top-0' : 'bottom-0'].join(' ')} />
      ) : null}
      <Link
        to={`/conversations/${session.id}`}
        draggable={false}
        className={[
          'ui-sidebar-session-row select-none',
          active && 'ui-sidebar-session-row-active',
          canDrag && (isDragging ? 'cursor-grabbing opacity-60' : 'cursor-grab'),
        ]
          .filter(Boolean)
          .join(' ')}
        title={rowTitle}
      >
        <div className="flex w-3 shrink-0 items-center justify-center self-stretch">
          {session.isRunning || hasPendingRuns || needsAttention ? (
            <ConversationStatusText
              isRunning={session.isRunning}
              hasPendingRuns={hasPendingRuns}
              backgroundWorkKind={backgroundWorkKind}
              needsAttention={needsAttention}
              className="shrink-0"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 pr-[4.5rem]">
          <div className="flex min-w-0 items-center gap-1.5">
            {isAutomation ? (
              <span
                className="shrink-0 text-accent/75"
                title={automationTitle ? `Automation conversation: ${automationTitle}` : 'Automation conversation'}
              >
                <Ico d={PATH.automations} size={11} />
              </span>
            ) : null}
            {pinned ? (
              <span className="ui-sidebar-pinned-icon shrink-0" title="Pinned chat" aria-label="Pinned chat">
                <Ico d={PATH.pin} size={11} />
              </span>
            ) : null}
            {locked ? (
              <span className="shrink-0 text-dim" title="Locked conversation" aria-label="Locked conversation">
                <Ico d={PATH.lock} size={11} />
              </span>
            ) : null}
            {gatewayProviders.map((provider) => (
              <GatewayRailIcon key={provider} provider={provider} />
            ))}
            {decoratorsByPosition['before-title'].length > 0 &&
              decoratorsByPosition['before-title'].map((d) => (
                <ConversationDecoratorHost key={`${d.extensionId}:${d.id}`} registration={d} session={session} />
              ))}
            <p className="ui-row-title truncate leading-tight">{session.title}</p>
            {decoratorsByPosition['after-title'].length > 0 &&
              decoratorsByPosition['after-title'].map((d) => (
                <ConversationDecoratorHost key={`${d.extensionId}:${d.id}`} registration={d} session={session} />
              ))}
          </div>
          {decoratorsByPosition.subtitle.length > 0 && (
            <div className="flex min-w-0 items-center gap-1.5 mt-0.5">
              {decoratorsByPosition.subtitle.map((d) => (
                <ConversationDecoratorHost key={`${d.extensionId}:${d.id}`} registration={d} session={session} />
              ))}
            </div>
          )}
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex w-[3.75rem] items-center justify-end pr-1">
        {showTrailingControls ? (
          <div className="pointer-events-auto flex items-center gap-0.5">
            {showCloseButton ? (
              <IconButton
                compact
                type="button"
                onPointerDown={stopRowInteraction}
                onMouseDown={stopRowInteraction}
                onClick={() => onClose?.()}
                title="Close"
                aria-label="Close"
              >
                <Ico d={PATH.close} size={10} />
              </IconButton>
            ) : null}
          </div>
        ) : (
          <span className="ui-sidebar-session-meta ui-sidebar-session-time shrink-0 whitespace-nowrap">
            {timeAgoCompact(session.timestamp)}
          </span>
        )}
      </div>
      {menuOpen && menuPosition
        ? renderSidebarMenuPortal(
            <PositionedMenu
              ref={menuRootRef}
              placement="fixed"
              className="min-w-[224px]"
              style={getSidebarMenuPositionStyle(menuPosition, 224)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setMenuOpen(false);
                }
              }}
              aria-label={`Conversation actions for ${session.title}`}
            >
              <div className="space-y-px">
                {pinned && onUnpin ? (
                  <MenuItem
                    onClick={async () => {
                      const succeeded = await onUnpin();
                      if (succeeded !== false) {
                        setMenuOpen(false);
                      }
                    }}
                    disabled={busyExtensionMenuId !== null}
                  >
                    Unpin
                  </MenuItem>
                ) : null}
                {!pinned && onPin ? (
                  <MenuItem
                    onClick={async () => {
                      const succeeded = await onPin();
                      if (succeeded !== false) {
                        setMenuOpen(false);
                      }
                    }}
                    disabled={busyExtensionMenuId !== null}
                  >
                    Pin
                  </MenuItem>
                ) : null}
                {onToggleLock ? (
                  <MenuItem
                    onClick={async () => {
                      onToggleLock();
                      setMenuOpen(false);
                    }}
                    disabled={busyExtensionMenuId !== null}
                  >
                    {locked ? 'Unlock' : 'Lock'}
                  </MenuItem>
                ) : null}
                {onArchive ? (
                  <MenuItem
                    onClick={async () => {
                      const succeeded = await onArchive();
                      if (succeeded !== false) {
                        setMenuOpen(false);
                      }
                    }}
                    disabled={busyExtensionMenuId !== null}
                  >
                    Archive
                  </MenuItem>
                ) : null}
                {onOpenInNewWindow ? (
                  <MenuItem
                    onClick={async () => {
                      const succeeded = await onOpenInNewWindow?.();
                      if (succeeded !== false) {
                        setMenuOpen(false);
                      }
                    }}
                    disabled={busyExtensionMenuId !== null}
                  >
                    Open in Separate Window
                  </MenuItem>
                ) : null}
                {conversationExtensionMenuItems.length > 0 && (
                  <>
                    <MenuSeparator className="mx-2 my-1" />
                    {conversationExtensionMenuItems.map((menu) => (
                      <MenuItem
                        key={menu.id}
                        onClick={() => {
                          void handleExtensionContextMenuClick(menu);
                        }}
                        disabled={busyExtensionMenuId !== null}
                      >
                        {getExtensionContextMenuTitle(menu)}
                      </MenuItem>
                    ))}
                  </>
                )}
              </div>
            </PositionedMenu>,
          )
        : null}
    </div>
  );
});

/**
 * SessionRow — subscribes to the normalized session store for a single ID
 * and renders the memo'd OpenConversationRow. Each row re-renders only when
 * its own session or presence changes, not when other sessions update.
 */
const SessionRow = memo(function SessionRow({
  sessionId,
  active,
  pinned,
  locked,
  canDrag,
  isDragging,
  dropPosition,
  automationTitle,
  hasPendingRuns,
  backgroundWorkKind,
  gatewayProviders,
  onPin,
  onUnpin,
  onToggleLock,
  onClose,
  onArchive,
  onOpenInNewWindow,
  onDuplicate,
  onCopyWorkingDirectory,
  onCopyId,
  onCopyDeeplink,
  onPrefetch,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  initialSession,
}: {
  sessionId: string;
  active: boolean;
  pinned?: boolean;
  locked?: boolean;
  canDrag?: boolean;
  isDragging?: boolean;
  dropPosition?: OpenConversationDropPosition | null;
  automationTitle?: string;
  hasPendingRuns?: boolean;
  backgroundWorkKind?: ConversationBackgroundWorkKind | null;
  gatewayProviders?: string[];
  onPin?: () => void;
  onUnpin?: () => void;
  onToggleLock?: () => void;
  onClose?: () => void;
  onArchive?: () => boolean | Promise<boolean>;
  onOpenInNewWindow?: () => boolean | Promise<boolean>;
  onDuplicate?: () => boolean | Promise<boolean>;
  onCopyWorkingDirectory?: () => boolean | Promise<boolean>;
  onCopyId?: () => boolean | Promise<boolean>;
  onCopyDeeplink?: () => boolean | Promise<boolean>;
  onPrefetch?: () => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  initialSession?: SessionMeta;
}) {
  // Use store as primary source; fall back to initialSession from parent (AppDataContext)
  // during initial render before SSE has seeded the store.
  const storeSession = useSession(sessionId);
  const activityStatus = useConversationActivityStatus(sessionId);
  const conversationRuntime = useConversationRuntime(sessionId);
  const session = storeSession ?? initialSession;

  if (!session) return null;

  const isRunning = conversationRuntime?.running ?? session.isRunning ?? false;
  const pending = (hasPendingRuns ?? false) || activityStatus === 'hasRuns' || activityStatus === 'automation';

  return (
    <OpenConversationRow
      session={session.isRunning === isRunning ? session : { ...session, isRunning }}
      active={active}
      pinned={pinned}
      locked={locked}
      canDrag={canDrag}
      isDragging={isDragging}
      dropPosition={dropPosition}
      isAutomation={activityStatus === 'automation'}
      automationTitle={automationTitle}
      hasPendingRuns={pending}
      backgroundWorkKind={backgroundWorkKind}
      gatewayProviders={gatewayProviders}
      onPin={onPin}
      onUnpin={onUnpin}
      onToggleLock={onToggleLock}
      onClose={onClose}
      onArchive={onArchive}
      onOpenInNewWindow={onOpenInNewWindow}
      onDuplicate={onDuplicate}
      onCopyWorkingDirectory={onCopyWorkingDirectory}
      onCopyId={onCopyId}
      onCopyDeeplink={onCopyDeeplink}
      onPrefetch={onPrefetch}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    />
  );
});

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { versions } = useAppEvents();
  const { titles: liveTitles, setTitle: pushTitle } = useLiveTitles();
  const sessions = useAllSessions();
  const sessionsReady = useSessionsReady();
  const tasks = useAllTasks();
  const executionRecords = useAllExecutions();
  const conversationActivityStatusVersion = useConversationActivityStatusVersion();
  const extensionRegistry = useExtensionRegistry();
  const {
    pinnedIds,
    openIds,
    archivedConversationIds,
    pinnedSessions,
    tabs,
    openSession,
    closeSession,
    pinSession,
    unpinSession,
    archiveSession,
    restoreSession,
    lockedConversationIds,
    setSessionLocked,
    reopenMostRecentlyClosedSession,
    moveSession,
    shiftSession,
    loading,
    refetch,
  } = useConversations({ includeArchivedSessions: false });

  const [draftCwd, setDraftCwd] = useState(() => readDraftConversationCwd());
  const [savedWorkspacePaths, setSavedWorkspacePaths] = useState(() => readStoredWorkspacePaths());
  const [savedWorkspacePathsLoaded, setSavedWorkspacePathsLoaded] = useState(false);
  const [workspaceBootstrapHasOpenConversations, setWorkspaceBootstrapHasOpenConversations] = useState(false);
  const [workspaceSyncReady, setWorkspaceSyncReady] = useState(false);
  const [workspaceQuickSelectOpen, setWorkspaceQuickSelectOpen] = useState(false);
  const [threadsOrganizeMode, setThreadsOrganizeMode] = useState<ThreadsOrganizeMode>(() => readThreadsOrganizeMode());
  const [threadsFilterMode, setThreadsFilterMode] = useState<ThreadsFilterMode>(() => readThreadsFilterMode());
  const [threadsSortMode, setThreadsSortMode] = useState<ThreadsSortMode>(() => readThreadsSortMode());
  const [manualConversationGroupOrder, setManualConversationGroupOrder] = useState(() => readManualConversationGroupOrder());
  const [collapsedConversationGroupKeys, setCollapsedConversationGroupKeys] = useState(() => readCollapsedConversationGroupKeys());
  const [conversationGroupLabelOverrides, setConversationGroupLabelOverrides] = useState(() => readConversationGroupLabelOverrides());
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [draggingSection, setDraggingSection] = useState<ConversationShelf | null>(null);
  const [draggingGroupKey, setDraggingGroupKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    section: ConversationShelf;
    sessionId: string | null;
    position: OpenConversationDropPosition;
  } | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<{
    groupKey: string;
    position: OpenConversationDropPosition;
  } | null>(null);
  const [conversationCwdDropTargetGroupKey, setConversationCwdDropTargetGroupKey] = useState<string | null>(null);
  const [workbenchChatDropHover, setWorkbenchChatDropHover] = useState(false);
  const conversationSurfaceId = useMemo(() => getOrCreateConversationSurfaceId(), []);
  const sidebarNoticeTimeoutRef = useRef<number | null>(null);
  const [sidebarNotice, setSidebarNotice] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const [gatewayState, setGatewayState] = useState<GatewayState | null>(null);
  const [addWorkspaceBusy, setAddWorkspaceBusy] = useState(false);
  const workspaceLoadLifecycleRef = useRef({ latestRequestId: 0, disposed: false });

  useEffect(() => {
    workspaceLoadLifecycleRef.current.disposed = false;
    return () => {
      workspaceLoadLifecycleRef.current.disposed = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function handleGatewayStateChanged(event: Event) {
      setGatewayState((event as CustomEvent<GatewayState>).detail);
    }

    window.addEventListener(GATEWAY_STATE_CHANGED_EVENT, handleGatewayStateChanged);
    api
      .gateways()
      .then((next) => {
        if (!cancelled) setGatewayState(next);
      })
      .catch(() => {
        if (!cancelled) setGatewayState(null);
      });
    return () => {
      cancelled = true;
      window.removeEventListener(GATEWAY_STATE_CHANGED_EVENT, handleGatewayStateChanged);
    };
  }, [versions.sessions]);

  const showSidebarNotice = useCallback((tone: 'accent' | 'danger', text: string, durationMs = 2500) => {
    if (tone === 'danger') {
      addNotification({ type: 'error', message: text, source: 'sidebar' });
      return;
    }

    setSidebarNotice({ tone, text });
    if (sidebarNoticeTimeoutRef.current !== null) {
      window.clearTimeout(sidebarNoticeTimeoutRef.current);
    }
    sidebarNoticeTimeoutRef.current = window.setTimeout(() => {
      setSidebarNotice(null);
      sidebarNoticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(
    () => () => {
      if (sidebarNoticeTimeoutRef.current !== null) {
        window.clearTimeout(sidebarNoticeTimeoutRef.current);
      }
    },
    [],
  );

  const { activeConversationId, openWorkspacePaths, pinnedWorkspacePaths, visibleConversationTabs, workspaceConversationTabs } =
    useSidebarConversationScope({
      draftCwd,
      liveTitles,
      locationPathname: location.pathname,
      pinnedSessions,
      sessions,
      tabs,
    });

  const persistSavedWorkspacePathsState = useCallback((workspacePaths: string[], options: { invalidateLoads?: boolean } = {}) => {
    const normalized = normalizeWorkspacePaths(workspacePaths);
    if (options.invalidateLoads) {
      workspaceLoadLifecycleRef.current.latestRequestId += 1;
    }
    writeStoredWorkspacePaths(normalized);
    setSavedWorkspacePaths(normalized);
    return normalized;
  }, []);
  const rememberWorkspacePath = useCallback(
    (cwd: string | null | undefined) => {
      const [normalizedCwd] = normalizeWorkspacePaths([cwd]);
      if (!normalizedCwd || savedWorkspacePaths.includes(normalizedCwd)) {
        return;
      }

      const nextWorkspacePaths = persistSavedWorkspacePathsState([...savedWorkspacePaths, normalizedCwd], { invalidateLoads: true });
      void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
        // Ignore best-effort sync failures.
      });
    },
    [persistSavedWorkspacePathsState, savedWorkspacePaths],
  );
  const persistManualConversationGroupOrder = useCallback((groupKeys: string[]) => {
    const normalized = normalizeStoredThreadStringList(groupKeys);
    writeManualConversationGroupOrder(normalized);
    setManualConversationGroupOrder(normalized);
    return normalized;
  }, []);
  const loadSavedWorkspacePaths = useCallback(async () => {
    const requestId = workspaceLoadLifecycleRef.current.latestRequestId + 1;
    workspaceLoadLifecycleRef.current.latestRequestId = requestId;
    try {
      const {
        sessionIds,
        pinnedSessionIds,
        archivedSessionIds,
        activeConversationId,
        workspacePaths,
        remoteControlledConversationIds,
        conversationWorkspaceRevision,
        conversationWorkspaceUpdatedAt,
        conversationWorkspaceMigratedAt,
      } = await api.sidebarConversations();
      if (workspaceLoadLifecycleRef.current.disposed || workspaceLoadLifecycleRef.current.latestRequestId !== requestId) {
        return false;
      }
      if (!isWithinLocalWriteGrace()) {
        applyRemoteConversationLayout({
          sessionIds,
          pinnedSessionIds,
          archivedSessionIds,
          activeSessionId: activeConversationId,
          workspacePaths,
          remoteControlledConversationIds,
          conversationWorkspaceRevision,
          conversationWorkspaceUpdatedAt,
          conversationWorkspaceMigratedAt,
        });
      }
      persistSavedWorkspacePathsState(workspacePaths);
      setWorkspaceBootstrapHasOpenConversations(sessionIds.length > 0 || pinnedSessionIds.length > 0);
      return true;
    } catch (error) {
      if (workspaceLoadLifecycleRef.current.disposed || workspaceLoadLifecycleRef.current.latestRequestId !== requestId) {
        return false;
      }
      throw error;
    } finally {
      if (!workspaceLoadLifecycleRef.current.disposed && workspaceLoadLifecycleRef.current.latestRequestId === requestId) {
        setSavedWorkspacePathsLoaded(true);
      }
    }
  }, [persistSavedWorkspacePathsState]);

  useEffect(() => {
    void loadSavedWorkspacePaths().catch(() => {
      setSavedWorkspacePathsLoaded(true);
      setWorkspaceBootstrapHasOpenConversations(false);
    });
  }, [loadSavedWorkspacePaths]);

  useEffect(() => {
    if (versions.workspace === 0) {
      return;
    }

    void loadSavedWorkspacePaths().catch(() => {
      // Keep the last known workspace list; the next invalidation or picker open will retry.
    });
  }, [loadSavedWorkspacePaths, versions.workspace]);

  useEffect(() => {
    if (!workspaceQuickSelectOpen) {
      return;
    }

    void loadSavedWorkspacePaths().catch(() => {
      // Ignore refresh failures and keep the last saved list.
    });
  }, [loadSavedWorkspacePaths, workspaceQuickSelectOpen]);

  useEffect(() => {
    if (workspaceSyncReady || !savedWorkspacePathsLoaded || !sessionsReady) {
      return;
    }

    const hasLocalWorkspaceState = draftCwd.trim().length > 0 || pinnedIds.length > 0 || openIds.length > 0;
    if (hasLocalWorkspaceState || !workspaceBootstrapHasOpenConversations) {
      setWorkspaceSyncReady(true);
    }
  }, [
    draftCwd,
    openIds.length,
    pinnedIds.length,
    savedWorkspacePathsLoaded,
    sessionsReady,
    workspaceBootstrapHasOpenConversations,
    workspaceSyncReady,
  ]);

  useEffect(() => {
    if (!workspaceSyncReady || !sessionsReady) {
      return;
    }

    const nextWorkspacePaths = normalizeWorkspacePaths([...savedWorkspacePaths, ...openWorkspacePaths]);
    if (sameStringLists(savedWorkspacePaths, nextWorkspacePaths)) {
      return;
    }

    persistSavedWorkspacePathsState(nextWorkspacePaths, { invalidateLoads: true });
    void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
      // Ignore best-effort sync failures.
    });
  }, [openWorkspacePaths, persistSavedWorkspacePathsState, savedWorkspacePaths, sessionsReady, workspaceSyncReady]);

  const orderedConversationItems = useMemo(() => {
    const pinnedItems: SidebarConversationItem[] = pinnedSessions.map((session, originalIndex) => ({
      session,
      section: 'pinned' as const,
      pinned: true,
      originalIndex,
    }));
    const openItems: SidebarConversationItem[] = visibleConversationTabs.map((session, originalIndex) => ({
      session,
      section: 'open' as const,
      pinned: false,
      originalIndex,
    }));

    if (threadsSortMode === 'manual') {
      return [...pinnedItems, ...openItems];
    }

    return [...pinnedItems, ...[...openItems].sort((left, right) => compareConversationItems(left, right, threadsSortMode))];
  }, [pinnedSessions, threadsSortMode, visibleConversationTabs]);
  const automationThreadTitleByConversationId = useMemo(
    () =>
      new Map(tasks.flatMap((task) => (task.threadConversationId ? [[task.threadConversationId, task.title ?? task.id] as const] : []))),
    [tasks],
  );
  const automationConversationIdSet = useMemo(
    () => new Set(automationThreadTitleByConversationId.keys()),
    [automationThreadTitleByConversationId],
  );
  const runningAutomationConversationIdSet = useMemo(
    () => new Set((tasks ?? []).flatMap((task) => (task.running && task.threadConversationId ? [task.threadConversationId] : []))),
    [tasks],
  );
  const backgroundWorkKindByConversationId = useMemo(() => {
    const conversationIds = new Set(
      (executionRecords ?? [])
        .map((execution) => execution.conversationId?.trim())
        .filter((conversationId): conversationId is string => Boolean(conversationId)),
    );
    return new Map(
      [...conversationIds].flatMap((conversationId) => {
        const activeExecutions = selectConversationActiveExecutions({
          conversationId,
          executions: executionRecords,
          tasks,
          visibility: 'visible',
        });
        const kind = summarizeConversationBackgroundWorkKind(activeExecutions);
        return kind ? [[conversationId, kind] as const] : [];
      }),
    );
  }, [executionRecords, tasks]);
  const pendingExecutionConversationIdSet = useMemo(
    () => new Set(backgroundWorkKindByConversationId.keys()),
    [backgroundWorkKindByConversationId],
  );
  const filteredConversationItems = useMemo(
    () =>
      orderedConversationItems.filter((item) => {
        if (!isSidebarVisibleConversation(item.session) && item.session.id !== activeConversationId) {
          return false;
        }
        const isAutomation = automationConversationIdSet.has(item.session.id);
        if (threadsFilterMode === 'automation') {
          return isAutomation;
        }
        if (threadsFilterMode === 'human') {
          return !isAutomation;
        }
        return true;
      }),
    [activeConversationId, automationConversationIdSet, orderedConversationItems, threadsFilterMode],
  );
  const workspaceOrder = useMemo(
    () => normalizeWorkspacePaths([...pinnedWorkspacePaths, ...savedWorkspacePaths, ...openWorkspacePaths]),
    [openWorkspacePaths, pinnedWorkspacePaths, savedWorkspacePaths],
  );
  const conversationGroupLabels = useMemo(
    () =>
      buildConversationGroupLabels([...workspaceOrder, ...filteredConversationItems.map((item) => getSessionWorkspaceCwd(item.session))]),
    [filteredConversationItems, workspaceOrder],
  );
  const manualConversationGroupOrderIndex = useMemo(
    () => new Map(manualConversationGroupOrder.map((groupKey, index) => [groupKey, index] as const)),
    [manualConversationGroupOrder],
  );
  const lockedConversationIdSet = useMemo(() => new Set(lockedConversationIds), [lockedConversationIds]);

  const conversationBootstrapVersionKey = useMemo(
    () =>
      buildConversationBootstrapVersionKey({
        sessionsVersion: versions.sessions,
        sessionFilesVersion: versions.sessionFiles,
      }),
    [versions.sessionFiles, versions.sessions],
  );
  const prefetchConversation = useCallback(
    (conversationId: string) => {
      const normalizedConversationId = conversationId.trim();
      if (!normalizedConversationId || normalizedConversationId === activeConversationId) {
        return;
      }

      void fetchConversationBootstrapCached(
        normalizedConversationId,
        { tailBlocks: SIDEBAR_CONVERSATION_PREFETCH_TAIL_BLOCKS },
        conversationBootstrapVersionKey,
      ).catch(() => undefined);
      void prefetchDesktopConversationState(normalizedConversationId, {
        tailBlocks: SIDEBAR_DESKTOP_CONVERSATION_PREFETCH_TAIL_BLOCKS,
        includeToolBlocks: false,
      })?.catch(() => undefined);
    },
    [activeConversationId, conversationBootstrapVersionKey],
  );
  const activeConversationSurfaceId = useMemo(() => {
    if (location.pathname === DRAFT_CONVERSATION_ROUTE) {
      return DRAFT_CONVERSATION_ID;
    }

    return activeConversationId;
  }, [activeConversationId, location.pathname]);
  const resolveCloseRedirectPath = useCallback(
    (closingId: string) =>
      resolveConversationCloseRedirect({
        orderedIds: workspaceConversationTabs.map((session) => session.id),
        closingId,
      }),
    [workspaceConversationTabs],
  );
  const groupedConversationRows = useMemo(() => {
    if (threadsOrganizeMode !== 'project') {
      return [];
    }

    const groupsByCwdKey = new Map(
      groupConversationItemsByCwd(filteredConversationItems, (item) => getSessionWorkspaceCwd(item.session), {
        labelsByCwd: conversationGroupLabels,
      }).map((group) => [group.key, group] as const),
    );
    const baseGroups =
      threadsFilterMode === 'all'
        ? workspaceOrder.map(
            (workspacePath) =>
              groupsByCwdKey.get(workspacePath) ?? {
                key: workspacePath,
                cwd: workspacePath,
                label: getConversationGroupLabel(workspacePath, { labelsByCwd: conversationGroupLabels }),
                items: [],
              },
          )
        : [];
    const groups = [...baseGroups];
    const seenGroupKeys = new Set(groups.map((group) => group.key));

    for (const group of groupsByCwdKey.values()) {
      if (seenGroupKeys.has(group.key)) {
        continue;
      }

      groups.push(group);
      seenGroupKeys.add(group.key);
    }

    const rows = groups.map((group, groupIndex) => ({
      groupIndex,
      row: {
        key: group.key,
        cwd: group.cwd,
        defaultLabel: group.cwd ? group.label : 'Chats',
        label: conversationGroupLabelOverrides[group.key]?.trim() || (group.cwd ? group.label : 'Chats'),
        items: group.items,
      } satisfies SidebarConversationGroup,
    }));

    if (threadsSortMode === 'manual') {
      rows.sort((left, right) => {
        const leftManualIndex = manualConversationGroupOrderIndex.get(left.row.key);
        const rightManualIndex = manualConversationGroupOrderIndex.get(right.row.key);
        if (leftManualIndex !== undefined || rightManualIndex !== undefined) {
          if (leftManualIndex === undefined) {
            return 1;
          }
          if (rightManualIndex === undefined) {
            return -1;
          }
          if (leftManualIndex !== rightManualIndex) {
            return leftManualIndex - rightManualIndex;
          }
        }

        return left.groupIndex - right.groupIndex;
      });
    }

    return rows.map((entry) => entry.row);
  }, [
    conversationGroupLabelOverrides,
    conversationGroupLabels,
    filteredConversationItems,
    manualConversationGroupOrderIndex,
    threadsFilterMode,
    threadsOrganizeMode,
    threadsSortMode,
    workspaceOrder,
  ]);
  const conversationGroupsByKey = useMemo(
    () => new Map(groupedConversationRows.map((group) => [group.key, group] as const)),
    [groupedConversationRows],
  );
  const conversationGroupKeyBySessionId = useMemo(
    () => new Map(groupedConversationRows.flatMap((group) => group.items.map(({ session }) => [session.id, group.key] as const))),
    [groupedConversationRows],
  );
  const collapsedConversationGroupKeySet = useMemo(() => new Set(collapsedConversationGroupKeys), [collapsedConversationGroupKeys]);
  const renderedConversationItems = useMemo(
    () => (threadsOrganizeMode === 'project' ? groupedConversationRows.flatMap((group) => group.items) : filteredConversationItems),
    [filteredConversationItems, groupedConversationRows, threadsOrganizeMode],
  );
  const conversationItemBySessionId = useMemo(
    () => new Map(renderedConversationItems.map((item) => [item.session.id, item] as const)),
    [renderedConversationItems],
  );
  const activityTreeSessions = useMemo(() => {
    return renderedConversationItems.map(({ session }) => {
      const liveTitle = liveTitles.get(session.id);
      const titledSession = liveTitle && liveTitle !== session.title ? { ...session, title: liveTitle } : session;

      // Sidebar nesting has proven too brittle: parent/child lineage is transcript
      // topology, not list hierarchy. Keep every open thread as a flat row under
      // its workspace group so close, archive, drag, and reorder semantics stay
      // one-row-in/one-row-out.
      return {
        ...titledSession,
        parentSessionId: undefined,
        parentSessionFile: undefined,
        parentMessageId: undefined,
        offshootKind: titledSession.offshootKind ?? (titledSession.sourceRunId ? 'subagent' : undefined),
      };
    });
  }, [liveTitles, renderedConversationItems]);
  const baseActivityTreeItems = useMemo(() => {
    const pinnedIdSet = new Set(pinnedIds);
    const flatItems = buildActivityTreeItems({
      conversations: activityTreeSessions,
    }).map((item) => {
      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
      if (!conversationId) return item;

      const backendRuntime = conversationRuntimeStore.get(conversationId);
      const isRunning = backendRuntime?.running ?? item.metadata?.isRunning === true;
      const metadata = {
        ...item.metadata,
        isRunning,
        ...(conversationItemBySessionId.has(conversationId) ? {} : { canArchive: false }),
        ...(pinnedIdSet.has(conversationId) ? { isPinned: true } : {}),
        ...(lockedConversationIdSet.has(conversationId) ? { isLocked: true, canArchive: false } : {}),
        ...(runningAutomationConversationIdSet.has(conversationId) ? { hasPendingRuns: true } : {}),
        ...(pendingExecutionConversationIdSet.has(conversationId) && !runningAutomationConversationIdSet.has(conversationId)
          ? { hasPendingRuns: true, backgroundWorkKind: backgroundWorkKindByConversationId.get(conversationId) }
          : {}),
      };
      return { ...item, status: isRunning ? 'running' : item.status === 'running' ? 'idle' : item.status, metadata };
    });

    if (threadsOrganizeMode !== 'project' || groupedConversationRows.length === 0) {
      return flatItems;
    }

    const groupByConversationId = new Map<string, SidebarConversationGroup>();
    for (const group of groupedConversationRows) {
      for (const item of group.items) {
        groupByConversationId.set(item.session.id, group);
      }
    }

    const usedGroupKeys = new Set<string>();
    const groupedItems = flatItems.map((item) => {
      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
      const group = conversationId ? groupByConversationId.get(conversationId) : null;
      if (!group || item.kind !== 'conversation') return item;

      usedGroupKeys.add(group.key);
      if (item.parentId) return item;

      return { ...item, parentId: buildActivityTreeGroupId(group.key) } satisfies ActivityTreeItem;
    });
    const groupItems = groupedConversationRows
      .filter((group) => threadsFilterMode === 'all' || usedGroupKeys.has(group.key))
      .map(
        (group) =>
          ({
            id: buildActivityTreeGroupId(group.key),
            kind: 'group',
            title: group.label,
            subtitle: group.cwd ?? undefined,
            status: 'idle',
            metadata: { cwd: group.cwd, groupKey: group.key, defaultLabel: group.defaultLabel },
          }) satisfies ActivityTreeItem,
      );

    return [...groupItems, ...groupedItems];
  }, [
    activityTreeSessions,
    backgroundWorkKindByConversationId,
    conversationActivityStatusVersion,
    groupedConversationRows,
    lockedConversationIdSet,
    pendingExecutionConversationIdSet,
    pinnedIds,
    runningAutomationConversationIdSet,
    threadsFilterMode,
    threadsOrganizeMode,
  ]);
  const [activityTreeItems, setActivityTreeItems] = useState<ActivityTreeItem[]>(() => baseActivityTreeItems);
  const activeActivityTreeItemId = activeConversationId ? buildConversationActivityId(activeConversationId) : null;
  const collapsedActivityTreeGroupItemIds = useMemo(
    () => new Set(collapsedConversationGroupKeys.map((key) => buildActivityTreeGroupId(key))),
    [collapsedConversationGroupKeys],
  );
  const conversationGroupByKey = useMemo(
    () => new Map(groupedConversationRows.map((group) => [group.key, group] as const)),
    [groupedConversationRows],
  );
  const canReorderConversationRows = threadsFilterMode === 'all';
  const canReorderConversationGroups = canReorderConversationRows && threadsOrganizeMode === 'project';
  const hotkeyConversationItems = useMemo(
    () =>
      resolveSidebarConversationHotkeyOrder({
        organizeMode: threadsOrganizeMode,
        orderedItems: filteredConversationItems,
        groupedRows: groupedConversationRows,
        collapsedGroupKeys: collapsedConversationGroupKeySet,
      }),
    [collapsedConversationGroupKeySet, filteredConversationItems, groupedConversationRows, threadsOrganizeMode],
  );

  const toggleConversationGroupCollapsed = useCallback((groupKey: string) => {
    const normalizedGroupKey = groupKey.trim();
    if (!normalizedGroupKey) {
      return;
    }

    setCollapsedConversationGroupKeys((current) => {
      const next = current.includes(normalizedGroupKey)
        ? current.filter((key) => key !== normalizedGroupKey)
        : [...current, normalizedGroupKey];
      writeCollapsedConversationGroupKeys(next);
      return next;
    });
  }, []);

  const clearConversationGroupCollapsedState = useCallback((groupKey: string) => {
    const normalizedGroupKey = groupKey.trim();
    if (!normalizedGroupKey) {
      return;
    }

    setCollapsedConversationGroupKeys((current) => {
      if (!current.includes(normalizedGroupKey)) {
        return current;
      }

      const next = current.filter((key) => key !== normalizedGroupKey);
      writeCollapsedConversationGroupKeys(next);
      return next;
    });
  }, []);

  const updateConversationGroupLabelOverride = useCallback((groupKey: string, nextLabel: string | null) => {
    const normalizedGroupKey = groupKey.trim();
    if (!normalizedGroupKey) {
      return;
    }

    setConversationGroupLabelOverrides((current) => {
      const next = { ...current };
      const normalizedLabel = nextLabel?.trim() ?? '';
      if (normalizedLabel) {
        next[normalizedGroupKey] = normalizedLabel;
      } else {
        delete next[normalizedGroupKey];
      }
      writeConversationGroupLabelOverrides(next);
      return next;
    });
  }, []);

  const isConversationLocked = useCallback(
    (conversationId: string | null | undefined) => {
      const normalizedConversationId = conversationId?.trim() ?? '';
      return Boolean(normalizedConversationId && lockedConversationIdSet.has(normalizedConversationId));
    },
    [lockedConversationIdSet],
  );

  const toggleConversationLock = useCallback(
    (conversationId: string) => {
      const normalizedConversationId = conversationId.trim();
      if (!normalizedConversationId || normalizedConversationId === DRAFT_CONVERSATION_ID) {
        return false;
      }

      if (lockedConversationIdSet.has(normalizedConversationId)) {
        setSessionLocked(normalizedConversationId, false);
        showSidebarNotice('accent', 'Thread unlocked.');
        return true;
      }

      setSessionLocked(normalizedConversationId, true);
      showSidebarNotice('accent', 'Thread locked.');
      return true;
    },
    [lockedConversationIdSet, setSessionLocked, showSidebarNotice],
  );

  const guardUnlockedConversationAction = useCallback(
    (conversationId: string, actionLabel: string) => {
      if (!isConversationLocked(conversationId)) {
        return true;
      }

      showSidebarNotice('danger', `Unlock this conversation before ${actionLabel}.`, 4000);
      return false;
    },
    [isConversationLocked, showSidebarNotice],
  );

  const handleThreadsOrganizeModeChange = useCallback((value: ThreadsOrganizeMode) => {
    setThreadsOrganizeMode(value);
    writeThreadsOrganizeMode(value);
  }, []);

  const handleThreadsFilterModeChange = useCallback((value: ThreadsFilterMode) => {
    setThreadsFilterMode(value);
    writeThreadsFilterMode(value);
  }, []);

  const handleThreadsSortModeChange = useCallback((value: ThreadsSortMode) => {
    setThreadsSortMode(value);
    writeThreadsSortMode(value);
  }, []);

  useEffect(() => {
    setActivityTreeItems(baseActivityTreeItems);

    const styleProviders = extensionRegistry.activityTreeItemStyles;
    if (styleProviders.length === 0 || baseActivityTreeItems.length === 0) {
      return;
    }

    let cancelled = false;
    void applyActivityTreeItemStyleProviders(baseActivityTreeItems, styleProviders).then((styledItems) => {
      if (!cancelled) {
        setActivityTreeItems(styledItems);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [baseActivityTreeItems, extensionRegistry.activityTreeItemStyles]);

  const activityTreeExtensionActions = extensionRegistry.activityTreeItemActions;
  const activityTreeExtensionContextMenus = useMemo(
    () =>
      extensionRegistry.contextMenus.filter(
        (menu) =>
          menu.surface === 'conversationList' &&
          !['duplicateConversation', 'copyWorkingDirectory', 'copyConversationId', 'copyDeeplink'].includes(menu.action),
      ),
    [extensionRegistry.contextMenus],
  );
  const activityTreePaClientByExtension = useRef<Map<string, ReturnType<typeof createNativeExtensionClient>>>(new Map());
  const getActivityTreePaClient = useCallback((extensionId: string) => {
    let client = activityTreePaClientByExtension.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      activityTreePaClientByExtension.current.set(extensionId, client);
    }
    return client;
  }, []);
  const handleActivityTreeExtensionContextMenu = useCallback(
    async (
      menu: (typeof activityTreeExtensionContextMenus)[number],
      input: { conversationId: string; sessionTitle: string; cwd: string | undefined },
    ) => {
      try {
        if (menu.action === 'attachConversation') {
          navigate(buildGatewayConversationAttachRoute(input.conversationId));
          return;
        }

        if (menu.action === 'exportSession') {
          await api.invokeExtensionAction(menu.extensionId, menu.action, input);
          return;
        }

        await getActivityTreePaClient(menu.extensionId).extension.invoke(menu.action, input);
      } catch (error) {
        showSidebarNotice('danger', `${menu.title} failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
      }
    },
    [getActivityTreePaClient, navigate, showSidebarNotice],
  );
  const handleActivityTreeExtensionAction = useCallback(
    async (actionId: string, item: import('../activity/activityTree').ActivityTreeItem) => {
      const action = activityTreeExtensionActions.find((candidate) => candidate.id === actionId);
      if (!action) return;
      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
      const input = {
        itemId: item.id,
        kind: item.kind,
        title: item.title,
        conversationId,
        cwd: typeof item.metadata?.cwd === 'string' ? item.metadata.cwd : undefined,
      };
      try {
        await getActivityTreePaClient(action.extensionId).extension.invoke(action.action, input);
      } catch (error) {
        showSidebarNotice('danger', `${action.title} failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
      }
    },
    [activityTreeExtensionActions, getActivityTreePaClient, showSidebarNotice],
  );

  function clearDragState() {
    setDraggingSessionId(null);
    setDraggingSection(null);
    setDraggingGroupKey(null);
    setDropTarget(null);
    setGroupDropTarget(null);
    setConversationCwdDropTargetGroupKey(null);
  }

  function isWorkbenchChatTabDrag(event: DragEvent<HTMLElement>): boolean {
    const dataTransfer = event.dataTransfer as unknown as
      | {
          types?: {
            includes?: (value: string) => boolean;
            contains?: (value: string) => boolean;
            length?: number;
            item?: (index: number) => string | null;
          };
        }
      | undefined;
    const types = dataTransfer?.types;
    if (!types) return false;
    if (typeof types.includes === 'function') return types.includes(WORKBENCH_CHAT_TAB_DRAG_MIME);
    if (typeof types.contains === 'function') return types.contains(WORKBENCH_CHAT_TAB_DRAG_MIME);
    const length = types.length ?? 0;
    for (let index = 0; index < length; index += 1) {
      if (types.item?.(index) === WORKBENCH_CHAT_TAB_DRAG_MIME) return true;
    }
    return false;
  }

  function handleWorkbenchChatDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isWorkbenchChatTabDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setWorkbenchChatDropHover(true);
  }

  function handleWorkbenchChatDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!isWorkbenchChatTabDrag(event)) return;
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setWorkbenchChatDropHover(false);
  }

  function handleWorkbenchChatDrop(event: DragEvent<HTMLDivElement>) {
    if (!isWorkbenchChatTabDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setWorkbenchChatDropHover(false);
    const conversationId =
      event.dataTransfer.getData(WORKBENCH_CHAT_TAB_DRAG_MIME) ||
      event.dataTransfer.getData('application/x-neon-pilot-conversation') ||
      event.dataTransfer.getData('text/plain');
    if (conversationId) {
      dispatchPromoteWorkbenchChat({ conversationId });
    }
  }

  function getDropPosition(event: DragEvent<HTMLElement>): OpenConversationDropPosition {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  }

  function canDropConversationOnSession(draggedSessionId: string, targetSessionId: string): boolean {
    if (threadsOrganizeMode !== 'project') {
      return true;
    }

    const draggedGroupKey = conversationGroupKeyBySessionId.get(draggedSessionId);
    const targetGroupKey = conversationGroupKeyBySessionId.get(targetSessionId);
    return Boolean(draggedGroupKey && targetGroupKey && draggedGroupKey === targetGroupKey);
  }

  function canDropConversationGroupOnGroup(draggedGroupKey: string, targetGroupKey: string): boolean {
    const draggedGroup = conversationGroupsByKey.get(draggedGroupKey);
    const targetGroup = conversationGroupsByKey.get(targetGroupKey);
    return Boolean(draggedGroup && targetGroup);
  }

  function canDropConversationOnGroup(draggedSessionId: string, targetGroupKey: string): boolean {
    const targetGroup = conversationGroupsByKey.get(targetGroupKey);
    if (!targetGroup) {
      return false;
    }

    const draggedSession = [...pinnedSessions, ...tabs].find((session) => session.id === draggedSessionId);
    if (!draggedSession) {
      return false;
    }

    return getSessionWorkspaceCwd(draggedSession) !== (targetGroup.cwd ?? null);
  }

  function handleTabDragStart(section: ConversationShelf, sessionId: string, event: DragEvent<HTMLElement>) {
    setDraggingSessionId(sessionId);
    setDraggingSection(section);
    setDraggingGroupKey(null);
    setDropTarget(null);
    setGroupDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-neon-pilot-conversation', sessionId);
    event.dataTransfer.setData('application/x-neon-pilot-conversation-section', section);
    event.dataTransfer.setData('text/plain', sessionId);
  }

  function handleConversationGroupDragStart(groupKey: string, event: DragEvent<HTMLElement>) {
    setDraggingGroupKey(groupKey);
    setDraggingSessionId(null);
    setDraggingSection(null);
    setDropTarget(null);
    setGroupDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-neon-pilot-conversation-group', groupKey);
  }

  function handleTabDragOver(section: ConversationShelf, sessionId: string, event: DragEvent<HTMLDivElement>) {
    const draggedId = draggingSessionId ?? event.dataTransfer.getData('text/plain');
    const draggedSection = draggingSection || event.dataTransfer.getData('application/x-neon-pilot-conversation-section');
    if (!draggedId || !draggedSection || draggedSection !== section) {
      return;
    }

    if (!canDropConversationOnSession(draggedId, sessionId)) {
      const targetGroupKey = conversationGroupKeyBySessionId.get(sessionId);
      if (targetGroupKey && canDropConversationOnGroup(draggedId, targetGroupKey)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setConversationCwdDropTargetGroupKey((current) => (current === targetGroupKey ? current : targetGroupKey));
      }
      setDropTarget(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggedId === sessionId) {
      setDropTarget(null);
      return;
    }

    const position = getDropPosition(event);
    setDropTarget((current) =>
      current?.section === section && current.sessionId === sessionId && current.position === position
        ? current
        : { section, sessionId, position },
    );
  }

  function handleConversationGroupDragOver(groupKey: string, event: DragEvent<HTMLDivElement>) {
    const draggedConversationId =
      draggingSessionId || event.dataTransfer.getData('application/x-neon-pilot-conversation') || event.dataTransfer.getData('text/plain');
    if (draggedConversationId) {
      if (!canDropConversationOnGroup(draggedConversationId, groupKey)) {
        setConversationCwdDropTargetGroupKey(null);
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setConversationCwdDropTargetGroupKey((current) => (current === groupKey ? current : groupKey));
      setGroupDropTarget(null);
      return;
    }

    const draggedGroupId = draggingGroupKey ?? event.dataTransfer.getData('application/x-neon-pilot-conversation-group');
    if (!draggedGroupId) {
      return;
    }

    if (!canDropConversationGroupOnGroup(draggedGroupId, groupKey)) {
      setGroupDropTarget(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggedGroupId === groupKey) {
      setGroupDropTarget(null);
      return;
    }

    const position = getDropPosition(event);
    setGroupDropTarget((current) => (current?.groupKey === groupKey && current.position === position ? current : { groupKey, position }));
  }

  async function handleConversationCwdDrop(targetGroupKey: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();

    const draggedConversationId =
      draggingSessionId || event.dataTransfer.getData('application/x-neon-pilot-conversation') || event.dataTransfer.getData('text/plain');
    const targetGroup = conversationGroupsByKey.get(targetGroupKey);
    if (!draggedConversationId || !targetGroup || !canDropConversationOnGroup(draggedConversationId, targetGroupKey)) {
      clearDragState();
      return;
    }

    clearDragState();
    try {
      const result = await api.changeConversationCwd(
        draggedConversationId,
        targetGroup.cwd,
        conversationSurfaceId,
        targetGroup.cwd === null ? null : undefined,
      );
      if (result.changed && result.id !== draggedConversationId) {
        const nextActiveSessionId =
          activeConversationSurfaceId === draggedConversationId ? result.id : readConversationLayout().activeSessionId;
        replaceConversationLayout({
          sessionIds: openIds.map((id) => (id === draggedConversationId ? result.id : id)),
          pinnedSessionIds: pinnedIds.map((id) => (id === draggedConversationId ? result.id : id)),
          archivedSessionIds: archivedConversationIds,
          activeSessionId: nextActiveSessionId,
        });

        if (activeConversationSurfaceId === draggedConversationId) {
          navigate(buildConversationSurfacePath(result.id));
        }
      }
      await refetch();
      showSidebarNotice(
        'accent',
        result.changed === false ? `Conversation is already in ${targetGroup.label}.` : `Moved conversation to ${targetGroup.label}.`,
      );
    } catch (error) {
      showSidebarNotice('danger', `Move failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
    }
  }

  function handleConversationDrop(
    targetSection: ConversationShelf,
    targetSessionId: string | null,
    position: OpenConversationDropPosition,
  ) {
    if (!draggingSessionId || !draggingSection || draggingSection !== targetSection) {
      clearDragState();
      return;
    }

    if (targetSessionId === draggingSessionId) {
      clearDragState();
      return;
    }

    if (targetSessionId && !canDropConversationOnSession(draggingSessionId, targetSessionId)) {
      clearDragState();
      return;
    }

    if (threadsSortMode !== 'manual') {
      replaceConversationLayout({
        sessionIds: renderedConversationItems.filter((item) => item.section === 'open').map((item) => item.session.id),
        pinnedSessionIds: renderedConversationItems.filter((item) => item.section === 'pinned').map((item) => item.session.id),
        archivedSessionIds: archivedConversationIds,
      });
      setThreadsSortMode('manual');
      writeThreadsSortMode('manual');
    }

    moveSession(draggingSessionId, targetSection, targetSessionId, position);
    clearDragState();
  }

  function handleConversationGroupDrop(
    targetGroupKey: string,
    event: DragEvent<HTMLElement>,
    explicitPosition?: OpenConversationDropPosition,
  ) {
    event.preventDefault();

    const draggedConversationId =
      draggingSessionId || event.dataTransfer.getData('application/x-neon-pilot-conversation') || event.dataTransfer.getData('text/plain');
    if (draggedConversationId) {
      void handleConversationCwdDrop(targetGroupKey, event);
      return;
    }

    const draggedGroupId = draggingGroupKey ?? event.dataTransfer.getData('application/x-neon-pilot-conversation-group');
    if (!draggedGroupId || draggedGroupId === targetGroupKey || !canDropConversationGroupOnGroup(draggedGroupId, targetGroupKey)) {
      clearDragState();
      return;
    }

    const draggedIndex = groupedConversationRows.findIndex((group) => group.key === draggedGroupId);
    const targetIndex = groupedConversationRows.findIndex((group) => group.key === targetGroupKey);
    if (draggedIndex === -1 || targetIndex === -1) {
      clearDragState();
      return;
    }

    const nextGroupedRows = [...groupedConversationRows];
    const [draggedGroup] = nextGroupedRows.splice(draggedIndex, 1);
    if (!draggedGroup) {
      clearDragState();
      return;
    }

    const adjustedTargetIndex = nextGroupedRows.findIndex((group) => group.key === targetGroupKey);
    if (adjustedTargetIndex === -1) {
      clearDragState();
      return;
    }

    const insertIndex = (explicitPosition ?? getDropPosition(event)) === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
    nextGroupedRows.splice(insertIndex, 0, draggedGroup);

    persistManualConversationGroupOrder(nextGroupedRows.map((group) => group.key));
    replaceConversationLayout({
      sessionIds: nextGroupedRows.flatMap((group) => group.items.filter((item) => item.section === 'open').map((item) => item.session.id)),
      pinnedSessionIds: nextGroupedRows.flatMap((group) =>
        group.items.filter((item) => item.section === 'pinned').map((item) => item.session.id),
      ),
      archivedSessionIds: archivedConversationIds,
    });

    const nextLocalWorkspacePaths = normalizeWorkspacePaths(nextGroupedRows.flatMap((group) => (group.cwd ? [group.cwd] : [])));
    if (!sameStringLists(savedWorkspacePaths, nextLocalWorkspacePaths)) {
      persistSavedWorkspacePathsState(nextLocalWorkspacePaths, { invalidateLoads: true });
      void api.setSavedWorkspacePaths(nextLocalWorkspacePaths).catch(() => {
        // Ignore best-effort sync failures.
      });
    }

    if (threadsSortMode !== 'manual') {
      setThreadsSortMode('manual');
      writeThreadsSortMode('manual');
    }

    clearDragState();
  }

  function handleTabDrop(section: ConversationShelf, sessionId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const targetGroupKey = conversationGroupKeyBySessionId.get(sessionId);
    const draggedConversationId =
      draggingSessionId || event.dataTransfer.getData('application/x-neon-pilot-conversation') || event.dataTransfer.getData('text/plain');
    if (
      draggedConversationId &&
      targetGroupKey &&
      !canDropConversationOnSession(draggedConversationId, sessionId) &&
      canDropConversationOnGroup(draggedConversationId, targetGroupKey)
    ) {
      void handleConversationCwdDrop(targetGroupKey, event);
      return;
    }

    handleConversationDrop(section, sessionId, getDropPosition(event));
  }

  function getActivityTreeConversationId(item: ActivityTreeItem): string | null {
    const conversationId = item.metadata?.conversationId;
    return typeof conversationId === 'string' && conversationId.trim() ? conversationId : null;
  }

  function getActivityTreeGroupKey(item: ActivityTreeItem): string | null {
    const groupKey = item.metadata?.groupKey;
    return typeof groupKey === 'string' && groupKey.trim() ? groupKey : null;
  }

  function getActivityTreeConversationSection(conversationId: string): ConversationShelf | null {
    return conversationItemBySessionId.get(conversationId)?.section ?? null;
  }

  function canDragActivityTreeItem(item: ActivityTreeItem): boolean {
    if (!canReorderConversationRows) {
      return false;
    }

    if (item.kind === 'group') {
      return canReorderConversationGroups && Boolean(getActivityTreeGroupKey(item));
    }

    if (item.kind !== 'conversation') {
      return false;
    }

    const conversationId = getActivityTreeConversationId(item);
    return Boolean(conversationId && conversationId !== DRAFT_CONVERSATION_ID);
  }

  function canDropActivityTreeItem(
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    _position: ActivityTreeDropPosition,
  ): boolean {
    const draggedConversationId = getActivityTreeConversationId(draggedItem);
    if (draggedConversationId) {
      if (targetItem.kind === 'group') {
        const targetGroupKey = getActivityTreeGroupKey(targetItem);
        return Boolean(targetGroupKey && canDropConversationOnGroup(draggedConversationId, targetGroupKey));
      }

      const targetConversationId = getActivityTreeConversationId(targetItem);
      if (!targetConversationId || targetConversationId === draggedConversationId) {
        return false;
      }

      const draggedSection = getActivityTreeConversationSection(draggedConversationId);
      const targetSection = getActivityTreeConversationSection(targetConversationId);
      if (!draggedSection || !targetSection || draggedSection !== targetSection) {
        return false;
      }

      const targetGroupKey = conversationGroupKeyBySessionId.get(targetConversationId);
      return (
        canDropConversationOnSession(draggedConversationId, targetConversationId) ||
        Boolean(targetGroupKey && canDropConversationOnGroup(draggedConversationId, targetGroupKey))
      );
    }

    const draggedGroupKey = getActivityTreeGroupKey(draggedItem);
    const targetGroupKey = getActivityTreeGroupKey(targetItem);
    return Boolean(
      draggedGroupKey &&
      targetGroupKey &&
      draggedGroupKey !== targetGroupKey &&
      canDropConversationGroupOnGroup(draggedGroupKey, targetGroupKey),
    );
  }

  function handleActivityTreeDragStart(item: ActivityTreeItem, event: DragEvent<HTMLElement>) {
    const conversationId = getActivityTreeConversationId(item);
    if (conversationId) {
      const section = getActivityTreeConversationSection(conversationId);
      if (section) {
        handleTabDragStart(section, conversationId, event);
      }
      return;
    }

    const groupKey = getActivityTreeGroupKey(item);
    if (groupKey) {
      handleConversationGroupDragStart(groupKey, event);
    }
  }

  function handleActivityTreeDrop(
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    position: ActivityTreeDropPosition,
    event: DragEvent<HTMLElement>,
  ) {
    const draggedConversationId = getActivityTreeConversationId(draggedItem);
    if (draggedConversationId) {
      const targetGroupKey = getActivityTreeGroupKey(targetItem);
      if (targetGroupKey) {
        void handleConversationCwdDrop(targetGroupKey, event);
        return;
      }

      const targetConversationId = getActivityTreeConversationId(targetItem);
      const targetSection = targetConversationId ? getActivityTreeConversationSection(targetConversationId) : null;
      const targetConversationGroupKey = targetConversationId ? conversationGroupKeyBySessionId.get(targetConversationId) : null;
      if (
        targetConversationId &&
        targetConversationGroupKey &&
        !canDropConversationOnSession(draggedConversationId, targetConversationId) &&
        canDropConversationOnGroup(draggedConversationId, targetConversationGroupKey)
      ) {
        void handleConversationCwdDrop(targetConversationGroupKey, event);
        return;
      }

      if (targetConversationId && targetSection) {
        handleConversationDrop(targetSection, targetConversationId, position);
      } else {
        clearDragState();
      }
      return;
    }

    const targetGroupKey = getActivityTreeGroupKey(targetItem);
    if (targetGroupKey) {
      handleConversationGroupDrop(targetGroupKey, event, position);
      return;
    }

    clearDragState();
  }

  useEffect(() => {
    setDraftCwd(readDraftConversationCwd());
    setWorkspaceQuickSelectOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    // Only skip marking read if the session is in the sessions list AND
    // definitely does not need attention (no unread messages/activities
    // and not forced-unread).  If the session is a placeholder (not yet
    // in the sessions list — e.g., opened via open_session or pending
    // refreshSessionMeta) we always optimistically mark it as read.
    const sessionInSessions = (sessions ?? []).find((s) => s.id === activeConversationId);
    if (sessionInSessions && !sessionNeedsAttention(sessionInSessions)) {
      return;
    }

    sessionStore.patch(activeConversationId, {
      needsAttention: false,
      attentionUnreadMessageCount: 0,
      attentionUnreadActivityCount: 0,
      attentionActivityIds: [],
    });

    void api.markConversationAttentionRead(activeConversationId).catch(() => {
      // Ignore attention-clear failures; the next sessions refresh restores the
      // authoritative state if the backend did not accept the update.
    });
  }, [activeConversationId, sessions]);

  const handleNewConversation = useCallback(
    (cwd?: string | null, options?: { reuseEmptyConversation?: boolean }) => {
      const explicitCwd = normalizeConversationGroupCwd(cwd);
      void startNewConversation({
        navigate,
        cwd: explicitCwd,
        replace: location.pathname === DRAFT_CONVERSATION_ROUTE,
        focusComposer: true,
        reuseEmptyConversation: options?.reuseEmptyConversation,
        existingSessions: sessions,
      });
      setDraftCwd(explicitCwd);
    },
    [location.pathname, navigate, sessions],
  );

  const handleOpenChat = useCallback(() => {
    navigate('/conversations');
  }, [navigate]);

  const handleChatButtonClick = useCallback(() => {
    if (routeMatchesPrefix(location.pathname, '/conversations')) {
      void handleNewConversation();
    } else {
      handleOpenChat();
    }
  }, [handleNewConversation, handleOpenChat, location.pathname]);

  const handleOpenThreadSwitcher = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'threads' } }));
  }, []);

  const handleAddWorkspace = useCallback(() => {
    setWorkspaceQuickSelectOpen(true);
  }, []);

  const handleSelectSavedWorkspace = useCallback(
    (workspacePath: string) => {
      setWorkspaceQuickSelectOpen(false);
      void handleNewConversation(workspacePath);
    },
    [handleNewConversation],
  );

  const handleChooseNewWorkspaceFolder = useCallback(async () => {
    if (addWorkspaceBusy) {
      return;
    }

    setAddWorkspaceBusy(true);
    try {
      const result = await api.pickFolder({
        cwd: draftCwd.trim() || undefined,
        prompt: 'Choose a workspace folder',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      const nextWorkspacePaths = normalizeWorkspacePaths([...savedWorkspacePaths, result.path]);
      persistSavedWorkspacePathsState(nextWorkspacePaths, { invalidateLoads: true });
      void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
        // Ignore best-effort sync failures.
      });
      setWorkspaceQuickSelectOpen(false);
      void handleNewConversation(result.path);
    } catch (error) {
      showSidebarNotice('danger', `Add workspace failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
    } finally {
      setAddWorkspaceBusy(false);
    }
  }, [addWorkspaceBusy, draftCwd, handleNewConversation, persistSavedWorkspacePathsState, savedWorkspacePaths, showSidebarNotice]);

  const openCreatedConversation = useCallback(
    (sessionId: string, initialPromptText?: string) => {
      if (initialPromptText) {
        persistForkPromptDraft(sessionId, initialPromptText);
      }

      openSession(sessionId);
      void refetch().catch(() => {});
      navigate(buildConversationSurfacePath(sessionId));
    },
    [navigate, openSession, refetch],
  );

  const handleDuplicateConversation = useCallback(
    async (session: Pick<SessionMeta, 'id' | 'isLive'>) => {
      try {
        const { newSessionId } = await api.duplicateConversation(session.id);
        openCreatedConversation(newSessionId);
        return true;
      } catch (error) {
        showSidebarNotice('danger', `Duplicate failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
        return false;
      }
    },
    [openCreatedConversation, showSidebarNotice],
  );

  const copyTextToClipboard = useCallback(
    async (value: string) => {
      try {
        await writeClipboardText(value);
        return true;
      } catch {
        showSidebarNotice('danger', 'Copy to clipboard failed.', 4000);
        return false;
      }
    },
    [showSidebarNotice],
  );

  const handleCopyConversationId = useCallback(
    async (conversationId: string) => {
      return copyTextToClipboard(conversationId);
    },
    [copyTextToClipboard],
  );

  const handleCopyConversationWorkingDirectory = useCallback(
    async (cwd: string | null | undefined) => {
      const normalizedCwd = cwd?.trim() ?? '';
      if (!normalizedCwd) {
        showSidebarNotice('danger', 'No working directory is saved for this conversation.', 4000);
        return false;
      }

      return copyTextToClipboard(normalizedCwd);
    },
    [copyTextToClipboard, showSidebarNotice],
  );

  const handleCopyConversationDeeplink = useCallback(
    async (conversationId: string) => {
      if (typeof window === 'undefined') {
        showSidebarNotice('danger', 'Could not build a deeplink for this conversation.', 4000);
        return false;
      }

      try {
        return copyTextToClipboard(buildConversationDeeplink(conversationId, window.location.href));
      } catch {
        showSidebarNotice('danger', 'Could not build a deeplink for this conversation.', 4000);
        return false;
      }
    },
    [copyTextToClipboard, showSidebarNotice],
  );

  const handleOpenConversationInNewWindow = useCallback(
    async (conversationId: string) => {
      const desktopBridge = getDesktopBridge();
      if (!desktopBridge?.openConversationPopout) {
        showSidebarNotice('danger', 'Separate conversation windows are only available in the desktop app.', 4000);
        return false;
      }

      try {
        await desktopBridge.openConversationPopout({ conversationId });
        return true;
      } catch (error) {
        showSidebarNotice('danger', `Could not open separate window: ${error instanceof Error ? error.message : String(error)}`, 4000);
        return false;
      }
    },
    [showSidebarNotice],
  );

  const resolveConversationGroupRedirectPath = useCallback(
    (closingIds: readonly string[]) => {
      const closingIdSet = new Set(closingIds.map((value) => value.trim()).filter(Boolean));
      const orderedIds = workspaceConversationTabs.map((session) => session.id);
      const remainingIds = orderedIds.filter((id) => !closingIdSet.has(id));
      if (remainingIds.length === 0) {
        return DRAFT_CONVERSATION_ROUTE;
      }

      const activeIndex = activeConversationSurfaceId ? orderedIds.findIndex((id) => id === activeConversationSurfaceId) : -1;
      const nextIndex = activeIndex >= 0 ? Math.min(activeIndex, remainingIds.length - 1) : remainingIds.length - 1;
      return buildConversationSurfacePath(remainingIds[nextIndex]);
    },
    [activeConversationSurfaceId, workspaceConversationTabs],
  );

  const archiveConversationGroupSessions = useCallback(
    (sessionIds: readonly string[]) => {
      const normalizedSessionIds = sessionIds.map((value) => value.trim()).filter(Boolean);
      const lockedCount = normalizedSessionIds.filter((sessionId) => lockedConversationIdSet.has(sessionId)).length;
      const unlockedSessionIds = normalizedSessionIds.filter((sessionId) => !lockedConversationIdSet.has(sessionId));
      if (normalizedSessionIds.length === 0) {
        return 0;
      }

      if (unlockedSessionIds.length === 0) {
        showSidebarNotice(
          'danger',
          lockedCount === 1 ? 'Unlock this thread before archiving it.' : 'Unlock these threads before archiving them.',
          4000,
        );
        return 0;
      }

      const sessionIdSet = new Set(unlockedSessionIds);
      if (activeConversationSurfaceId && sessionIdSet.has(activeConversationSurfaceId)) {
        navigate(resolveConversationGroupRedirectPath(unlockedSessionIds));
      }

      replaceConversationLayout({
        sessionIds: openIds.filter((id) => !sessionIdSet.has(id)),
        pinnedSessionIds: pinnedIds.filter((id) => !sessionIdSet.has(id)),
        archivedSessionIds: [...new Set([...archivedConversationIds, ...unlockedSessionIds])],
      });

      if (lockedCount > 0) {
        showSidebarNotice(
          'danger',
          lockedCount === 1 ? 'Skipped 1 locked conversation.' : `Skipped ${lockedCount} locked conversations.`,
          4000,
        );
      }

      return unlockedSessionIds.length;
    },
    [
      activeConversationSurfaceId,
      archivedConversationIds,
      lockedConversationIdSet,
      navigate,
      openIds,
      pinnedIds,
      resolveConversationGroupRedirectPath,
      showSidebarNotice,
    ],
  );

  const handleOpenConversationGroupInFinder = useCallback(
    async (cwd: string | null, label: string) => {
      const normalizedCwd = normalizeConversationGroupCwd(cwd);
      if (!normalizedCwd) {
        showSidebarNotice('danger', `No working directory is saved for ${label}.`, 4000);
        return;
      }

      const desktopBridge = getDesktopBridge();
      if (!desktopBridge?.openPath) {
        showSidebarNotice('danger', 'Open in Finder is only available in the desktop app.', 4000);
        return;
      }

      const result = await desktopBridge.openPath(normalizedCwd);
      if (!result.opened) {
        showSidebarNotice('danger', result.error ? `Could not open ${label}: ${result.error}` : `Could not open ${label}.`, 4000);
      }
    },
    [showSidebarNotice],
  );

  const [renameConversationGroupPrompt, setRenameConversationGroupPrompt] = useState<{
    groupKey: string;
    defaultLabel: string;
    currentLabel: string;
  } | null>(null);
  const [renameConversationPrompt, setRenameConversationPrompt] = useState<{
    conversationId: string;
    currentTitle: string;
  } | null>(null);

  const handleRenameConversationGroup = useCallback((groupKey: string, defaultLabel: string, currentLabel: string) => {
    setRenameConversationGroupPrompt({ groupKey, defaultLabel, currentLabel });
  }, []);

  const handleRenameConversation = useCallback((conversationId: string, currentTitle: string) => {
    setRenameConversationPrompt({ conversationId, currentTitle });
  }, []);

  const submitRenameConversationGroup = useCallback(
    (nextLabel: string) => {
      const prompt = renameConversationGroupPrompt;
      if (!prompt) return;
      setRenameConversationGroupPrompt(null);

      const normalizedLabel = nextLabel.trim();
      updateConversationGroupLabelOverride(
        prompt.groupKey,
        normalizedLabel && normalizedLabel !== prompt.defaultLabel ? normalizedLabel : null,
      );

      if (normalizedLabel && normalizedLabel !== prompt.defaultLabel) {
        showSidebarNotice('accent', `Workspace renamed to ${normalizedLabel}.`);
        return;
      }

      showSidebarNotice('accent', `Workspace name reset to ${prompt.defaultLabel}.`);
    },
    [renameConversationGroupPrompt, showSidebarNotice, updateConversationGroupLabelOverride],
  );

  const submitRenameConversation = useCallback(
    async (nextTitle: string) => {
      const prompt = renameConversationPrompt;
      if (!prompt) return;
      const normalizedTitle = nextTitle.trim();
      if (!normalizedTitle) {
        showSidebarNotice('danger', 'Thread name cannot be empty.', 4000);
        return;
      }
      setRenameConversationPrompt(null);
      try {
        const result = await api.renameConversation(prompt.conversationId, normalizedTitle);
        sessionStore.patch(prompt.conversationId, { title: result.title });
        pushTitle(prompt.conversationId, result.title);
        showSidebarNotice('accent', 'Thread renamed.');
      } catch (error) {
        showSidebarNotice('danger', error instanceof Error ? error.message : String(error), 4000);
      }
    },
    [pushTitle, renameConversationPrompt, showSidebarNotice],
  );

  const handleArchiveConversationGroup = useCallback(
    (label: string, sessionIds: readonly string[]) => {
      const archivedCount = archiveConversationGroupSessions(sessionIds);
      if (archivedCount === 0) {
        showSidebarNotice('danger', `No conversations to archive in ${label}.`, 4000);
        return;
      }

      showSidebarNotice(
        'accent',
        archivedCount === 1 ? `Archived 1 conversation from ${label}.` : `Archived ${archivedCount} conversations from ${label}.`,
      );
    },
    [archiveConversationGroupSessions, showSidebarNotice],
  );

  const handleRemoveConversationGroup = useCallback(
    (groupKey: string, label: string, cwd: string | null, sessionIds: readonly string[], includesDraft: boolean) => {
      const removedCount = archiveConversationGroupSessions(sessionIds);
      updateConversationGroupLabelOverride(groupKey, null);
      clearConversationGroupCollapsedState(groupKey);

      const normalizedCwd = normalizeConversationGroupCwd(cwd);
      if (includesDraft && normalizedCwd && normalizeConversationGroupCwd(readDraftConversationCwd()) === normalizedCwd) {
        clearDraftConversationCwd();
      }

      if (normalizedCwd) {
        const nextWorkspacePaths = savedWorkspacePaths.filter((workspacePath) => workspacePath !== normalizedCwd);
        if (!sameStringLists(savedWorkspacePaths, nextWorkspacePaths)) {
          persistSavedWorkspacePathsState(nextWorkspacePaths, { invalidateLoads: true });
          void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
            // Ignore best-effort sync failures.
          });
        }
      }

      if (removedCount === 0 && !includesDraft && !normalizedCwd) {
        showSidebarNotice('danger', `No conversations to remove in ${label}.`, 4000);
        return;
      }

      showSidebarNotice('accent', `Removed ${label} from Threads.`);
    },
    [
      archiveConversationGroupSessions,
      clearConversationGroupCollapsedState,
      persistSavedWorkspacePathsState,
      savedWorkspacePaths,
      showSidebarNotice,
      updateConversationGroupLabelOverride,
    ],
  );

  const navigateConversation = useCallback(
    (direction: -1 | 1) => {
      const nextPath = resolveConversationAdjacentPath({
        orderedIds: workspaceConversationTabs.map((session) => session.id),
        activeId: activeConversationSurfaceId,
        direction,
      });

      if (nextPath) {
        navigate(nextPath);
      }
    },
    [activeConversationSurfaceId, navigate, workspaceConversationTabs],
  );

  const jumpToConversation = useCallback(
    (index: number) => {
      if (index < 0 || index >= hotkeyConversationItems.length) {
        return;
      }

      navigate(buildConversationSurfacePath(hotkeyConversationItems[index].session.id));
    },
    [hotkeyConversationItems, navigate],
  );

  const shiftActiveConversation = useCallback(
    (direction: -1 | 1) => {
      if (!activeConversationId) {
        return;
      }

      shiftSession(activeConversationId, direction);
      if (draggingSessionId === activeConversationId) {
        clearDragState();
      }
    },
    [activeConversationId, draggingSessionId, shiftSession],
  );

  const handleReopenClosedConversation = useCallback(() => {
    const sessionId = reopenMostRecentlyClosedSession();
    if (!sessionId) {
      return;
    }

    navigate(buildConversationSurfacePath(sessionId));
  }, [navigate, reopenMostRecentlyClosedSession]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || hasOverlayOpen()) {
        return;
      }

      const desktopBridge = getDesktopBridge();
      if (desktopBridge !== null) {
        const conversationIndex = resolveConversationNumberHotkey(event);
        if (conversationIndex !== -1) {
          event.preventDefault();
          jumpToConversation(conversationIndex);
          return;
        }

        if (hasCommandOrControlHotkey(event) && event.altKey && !event.shiftKey) {
          if (event.code === 'BracketLeft') {
            event.preventDefault();
            shiftActiveConversation(-1);
            return;
          }

          if (event.code === 'BracketRight') {
            event.preventDefault();
            shiftActiveConversation(1);
            return;
          }
        }
      }

      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
        return;
      }

      const key = normalizeHotkeyKey(event.key);
      if (matchesLetterHotkey(event, 'KeyN', 'n')) {
        event.preventDefault();
        handleChatButtonClick();
        return;
      }

      if (event.code === 'BracketLeft' || key === '[' || key === '{') {
        event.preventDefault();
        navigateConversation(-1);
        return;
      }

      if (event.code === 'BracketRight' || key === ']' || key === '}') {
        event.preventDefault();
        navigateConversation(1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleChatButtonClick, handleNewConversation, jumpToConversation, navigateConversation, shiftActiveConversation]);

  function handleCloseDraftTab() {
    const closeDraft = () => {
      clearDraftConversationAttachments();
      clearDraftConversationComposer();
      clearDraftConversationCwd();
      clearDraftConversationModel();
      clearDraftConversationThinkingLevel();
      setDraftCwd('');
    };

    if (draggingSessionId === DRAFT_CONVERSATION_ID) {
      clearDragState();
    }

    if (location.pathname === DRAFT_CONVERSATION_ROUTE) {
      const nextPath =
        resolveConversationAdjacentPath({
          orderedIds: workspaceConversationTabs.map((session) => session.id),
          activeId: null,
          direction: 1,
        }) ?? DRAFT_CONVERSATION_ROUTE;
      navigate(nextPath);
      window.setTimeout(closeDraft, 0);
      return;
    }

    closeDraft();
  }

  function handleArchiveConversation(sessionId: string) {
    if (!guardUnlockedConversationAction(sessionId, 'archiving it')) {
      return;
    }

    const archivingActiveConversation = activeConversationId === sessionId;
    const session =
      workspaceConversationTabs.find((candidate) => candidate.id === sessionId) ??
      sessions?.find((candidate) => candidate.id === sessionId);
    rememberWorkspacePath(getLocalSessionWorkspacePath(session));

    if (draggingSessionId === sessionId) {
      clearDragState();
    }

    if (archivingActiveConversation) {
      const redirectPath = resolveCloseRedirectPath(sessionId);
      archiveSession(sessionId);
      navigate(redirectPath);
      return;
    }

    archiveSession(sessionId);
  }

  function handleCloseConversation(sessionId: string) {
    if (!guardUnlockedConversationAction(sessionId, 'closing it')) {
      return;
    }

    const closingActiveConversation = activeConversationId === sessionId;
    const conversationIsOpen = tabs.some((session) => session.id === sessionId);
    const session =
      workspaceConversationTabs.find((candidate) => candidate.id === sessionId) ??
      sessions?.find((candidate) => candidate.id === sessionId);
    rememberWorkspacePath(getLocalSessionWorkspacePath(session));

    if (draggingSessionId === sessionId) {
      clearDragState();
    }

    if (closingActiveConversation) {
      const redirectPath = resolveCloseRedirectPath(sessionId);
      if (conversationIsOpen) {
        closeSession(sessionId);
      } else {
        archiveSession(sessionId);
      }
      navigate(redirectPath);
      return;
    }

    if (conversationIsOpen) {
      closeSession(sessionId);
    } else {
      archiveSession(sessionId);
    }
  }

  function handleClosePinnedConversation(sessionId: string) {
    if (!guardUnlockedConversationAction(sessionId, 'closing it')) {
      return;
    }

    const closingActiveConversation = activeConversationId === sessionId;
    const session =
      workspaceConversationTabs.find((candidate) => candidate.id === sessionId) ??
      sessions?.find((candidate) => candidate.id === sessionId);
    rememberWorkspacePath(getLocalSessionWorkspacePath(session));

    if (draggingSessionId === sessionId) {
      clearDragState();
    }

    if (closingActiveConversation) {
      const redirectPath = resolveCloseRedirectPath(sessionId);
      unpinSession(sessionId, { open: false });
      navigate(redirectPath);
      return;
    }

    unpinSession(sessionId, { open: false });
  }

  function handleCloseActiveConversation() {
    if (location.pathname === DRAFT_CONVERSATION_ROUTE) {
      handleCloseDraftTab();
      return;
    }

    if (!activeConversationId) {
      return;
    }

    if (pinnedSessions.some((session) => session.id === activeConversationId)) {
      handleClosePinnedConversation(activeConversationId);
      return;
    }

    if (tabs.some((session) => session.id === activeConversationId)) {
      handleCloseConversation(activeConversationId);
      return;
    }

    handleCloseConversation(activeConversationId);
  }

  function handleTogglePinnedActiveConversation() {
    if (location.pathname === DRAFT_CONVERSATION_ROUTE || !activeConversationId) {
      return;
    }

    if (pinnedSessions.some((session) => session.id === activeConversationId)) {
      handleUnpinConversation(activeConversationId);
      return;
    }

    pinSession(activeConversationId);
    if (draggingSessionId === activeConversationId) {
      clearDragState();
    }
  }

  function handleToggleLockedActiveConversation() {
    if (location.pathname === DRAFT_CONVERSATION_ROUTE || !activeConversationId) {
      return;
    }

    toggleConversationLock(activeConversationId);
  }

  function handleToggleArchivedActiveConversation() {
    if (location.pathname === DRAFT_CONVERSATION_ROUTE || !activeConversationId) {
      return;
    }

    const activeConversationPinned = pinnedSessions.some((session) => session.id === activeConversationId);
    const activeConversationOpen = tabs.some((session) => session.id === activeConversationId);

    if (draggingSessionId === activeConversationId) {
      clearDragState();
    }

    if (activeConversationPinned || activeConversationOpen) {
      handleArchiveConversation(activeConversationId);
      return;
    }

    restoreSession(activeConversationId);
  }

  useEffect(() => {
    if (getDesktopBridge() === null) {
      return;
    }

    function handleDesktopShortcut(event: Event) {
      if (hasOverlayOpen()) {
        return;
      }

      const detail = (event as CustomEvent<{ action?: unknown; command?: unknown }>).detail;
      const action = isSidebarConversationShortcutAction(detail?.action)
        ? detail.action
        : sidebarConversationShortcutCommandAction(detail?.command);
      if (!action) {
        return;
      }

      const isKnowledgeRoute = routeIsKnowledge(location.pathname, extensionRegistry.surfaces);

      if (action === 'close-conversation') {
        if (isFocusWithinWorkbenchOpenFile()) {
          window.dispatchEvent(new CustomEvent(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT));
          return;
        }

        if (isKnowledgeRoute) {
          window.dispatchEvent(new CustomEvent('kb:close-active-file'));
          return;
        }

        handleCloseActiveConversation();
        return;
      }

      if (action === 'reopen-closed-conversation') {
        if (isKnowledgeRoute) {
          window.dispatchEvent(new CustomEvent('kb:reopen-closed-file'));
          return;
        }

        handleReopenClosedConversation();
        return;
      }

      if (action === 'toggle-conversation-pin') {
        handleTogglePinnedActiveConversation();
        return;
      }

      if (action === 'toggle-conversation-lock') {
        handleToggleLockedActiveConversation();
        return;
      }

      if (action === 'toggle-conversation-archive') {
        handleToggleArchivedActiveConversation();
        return;
      }

      if (action === 'previous-conversation') {
        navigateConversation(-1);
        return;
      }

      navigateConversation(1);
    }

    window.addEventListener(DESKTOP_CONVERSATION_SHORTCUT_EVENT, handleDesktopShortcut);
    return () => window.removeEventListener(DESKTOP_CONVERSATION_SHORTCUT_EVENT, handleDesktopShortcut);
  }, [
    handleCloseActiveConversation,
    handleReopenClosedConversation,
    handleToggleArchivedActiveConversation,
    handleToggleLockedActiveConversation,
    handleTogglePinnedActiveConversation,
    navigateConversation,
  ]);

  function handlePinConversation(sessionId: string) {
    pinSession(sessionId);
    if (draggingSessionId === sessionId) {
      clearDragState();
    }
  }

  function handleUnpinConversation(sessionId: string) {
    unpinSession(sessionId);
    if (draggingSessionId === sessionId) {
      clearDragState();
    }
  }

  function renderConversationRow({ session, section, pinned }: SidebarConversationItem) {
    const isDraftTab = session.id === DRAFT_CONVERSATION_ID;
    const canDrag = canReorderConversationRows && !isDraftTab;
    const dropPosition =
      canDrag && dropTarget?.section === section && dropTarget.sessionId === session.id && draggingSessionId !== session.id
        ? dropTarget.position
        : null;

    const gatewayProviders =
      gatewayState?.bindings
        .filter((binding) => binding.conversationId === session.id)
        .map((binding) => binding.provider)
        .filter((provider, index, providers) => providers.indexOf(provider) === index) ?? [];

    const isAutomationRunning = runningAutomationConversationIdSet.has(session.id);
    const hasPendingExecutions = pendingExecutionConversationIdSet.has(session.id);
    const locked = lockedConversationIdSet.has(session.id);

    return (
      <SessionRow
        key={session.id}
        sessionId={session.id}
        active={isDraftTab ? location.pathname === DRAFT_CONVERSATION_ROUTE : location.pathname === `/conversations/${session.id}`}
        pinned={pinned}
        locked={locked}
        canDrag={canDrag}
        initialSession={session}
        automationTitle={automationThreadTitleByConversationId.get(session.id)}
        hasPendingRuns={hasPendingExecutions && !session.isRunning && !isAutomationRunning}
        backgroundWorkKind={backgroundWorkKindByConversationId.get(session.id) ?? null}
        gatewayProviders={gatewayProviders}
        isDragging={canDrag && draggingSessionId === session.id}
        dropPosition={dropPosition}
        onPin={!pinned && !isDraftTab ? () => handlePinConversation(session.id) : undefined}
        onUnpin={pinned ? () => handleUnpinConversation(session.id) : undefined}
        onToggleLock={!isDraftTab ? () => toggleConversationLock(session.id) : undefined}
        onClose={isDraftTab ? handleCloseDraftTab : !pinned && !locked ? () => handleCloseConversation(session.id) : undefined}
        onArchive={
          !isDraftTab && !locked
            ? () => {
                handleArchiveConversation(session.id);
                return true;
              }
            : undefined
        }
        onOpenInNewWindow={!isDraftTab ? () => handleOpenConversationInNewWindow(session.id) : undefined}
        onDuplicate={!isDraftTab ? () => handleDuplicateConversation(session) : undefined}
        onCopyWorkingDirectory={!isDraftTab && session.cwd?.trim() ? () => handleCopyConversationWorkingDirectory(session.cwd) : undefined}
        onCopyId={!isDraftTab ? () => handleCopyConversationId(session.id) : undefined}
        onCopyDeeplink={!isDraftTab ? () => handleCopyConversationDeeplink(session.id) : undefined}
        onPrefetch={!isDraftTab ? () => prefetchConversation(session.id) : undefined}
        onDragStart={canDrag ? (event) => handleTabDragStart(section, session.id, event) : undefined}
        onDragOver={canDrag ? (event) => handleTabDragOver(section, session.id, event) : undefined}
        onDrop={canDrag ? (event) => handleTabDrop(section, session.id, event) : undefined}
        onDragEnd={canDrag ? () => clearDragState() : undefined}
      />
    );
  }

  const extensionNavItems = useMemo<SidebarExtensionNavItem[]>(() => {
    const registeredRoutes = new Set(extensionRegistry.routes.map((route) => route.route));
    const registeredSidebarSurfaces = new Set(
      extensionRegistry.surfaces.filter(isNativeExtensionSidebarSurface).map((surface) => `${surface.extensionId}:${surface.id}`),
    );
    const legacy = extensionRegistry.surfaces
      .filter(isExtensionLeftNavItemSurface)
      .map((item) => ({ ...item, section: 'primary' as const }));
    const native = extensionRegistry.extensions
      .filter((extension) => extension.enabled)
      .flatMap((extension) => {
        const errorCount = (extension.errors?.length ?? 0) + (extension.buildError ? 1 : 0) + (extension.healthError ? 1 : 0);
        const warningCount = extension.diagnostics?.length ?? 0;
        const attention =
          errorCount > 0
            ? { attentionCount: errorCount, attentionSeverity: 'error' as const }
            : warningCount > 0
              ? { attentionCount: warningCount, attentionSeverity: 'warning' as const }
              : {};
        return (extension.contributes?.nav ?? []).flatMap((item) => {
          const navItem = {
            ...item,
            ...attention,
            extensionId: extension.id,
            packageType: extension.packageType ?? 'user',
          } as ExtensionSurfaceSummary & typeof item;
          return isRegisteredExtensionNavItem(navItem, registeredRoutes, registeredSidebarSurfaces)
            ? [navItem as SidebarExtensionNavItem]
            : [];
        });
      });
    return [...legacy, ...native];
  }, [extensionRegistry.extensions, extensionRegistry.routes, extensionRegistry.surfaces]);
  const primaryNavItems = useMemo(() => extensionNavItems.filter((item) => (item.section ?? 'primary') === 'primary'), [extensionNavItems]);
  const settingsNavItems = useMemo(() => extensionNavItems.filter((item) => item.section === 'settings'), [extensionNavItems]);
  const activeSidebarSurface = useMemo(() => {
    const activeNavItem = extensionNavItems.find(
      (item) => item.sidebarView && routeMatchesPrefix(location.pathname, item.route) && item.extensionId,
    );
    if (!activeNavItem?.sidebarView) return null;
    return (
      extensionRegistry.surfaces.find(
        (surface) =>
          surface.extensionId === activeNavItem.extensionId &&
          surface.id === activeNavItem.sidebarView &&
          isNativeExtensionSidebarSurface(surface),
      ) ?? null
    );
  }, [extensionNavItems, extensionRegistry.surfaces, location.pathname]);
  const newConversationHotkeyLabel = getNewConversationHotkeyLabel();
  const chatButtonActive = location.pathname === DRAFT_CONVERSATION_ROUTE;
  return (
    <>
      <aside className="flex-1 flex flex-col overflow-hidden">
        <SidebarPrimaryNav
          chatActive={chatButtonActive}
          newConversationBusy={false}
          newConversationHotkeyLabel={newConversationHotkeyLabel}
          items={primaryNavItems}
          onOpenChat={handleOpenChat}
          onNewConversation={() => {
            handleNewConversation();
          }}
        />

        {activeSidebarSurface ? (
          <div className="relative z-0 isolate flex-1 min-h-0 overflow-hidden" style={{ contain: 'layout paint' }}>
            <NativeExtensionSurfaceHost
              surface={activeSidebarSurface}
              pathname={location.pathname}
              search={location.search}
              hash={location.hash}
              instanceId="left-sidebar"
            />
          </div>
        ) : (
          <>
            <div className="px-4 pt-1 pb-0.5">
              <div className="flex items-center gap-1">
                <SectionLabel className="flex-1">Threads</SectionLabel>
                {extensionRegistry.threadHeaderActions.map((action) => (
                  <ThreadHeaderActionHost
                    key={`${action.extensionId}:${action.id}`}
                    registration={action}
                    actionContext={{ activeConversationId, cwd: draftCwd }}
                  />
                ))}
                <ThreadsFilterButton
                  organizeMode={threadsOrganizeMode}
                  filterMode={threadsFilterMode}
                  sortMode={threadsSortMode}
                  onChangeOrganizeMode={handleThreadsOrganizeModeChange}
                  onChangeFilterMode={handleThreadsFilterModeChange}
                  onChangeSortMode={handleThreadsSortModeChange}
                />
                <IconButton
                  compact
                  type="button"
                  onClick={handleOpenThreadSwitcher}
                  className="shrink-0"
                  title="Find threads and archived conversations"
                  aria-label="Find threads and archived conversations"
                >
                  <Ico d={PATH.search} size={12} />
                </IconButton>
                <IconButton
                  compact
                  type="button"
                  onClick={handleAddWorkspace}
                  className="-mr-1 shrink-0"
                  title={addWorkspaceBusy ? 'Choosing workspace…' : 'Add workspace'}
                  aria-label={addWorkspaceBusy ? 'Choosing workspace…' : 'Add workspace'}
                  disabled={addWorkspaceBusy}
                >
                  <Ico d={PATH.workspaceAdd} size={12} />
                </IconButton>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-3 transition-colors"
              style={workbenchChatDropHover ? SIDEBAR_DROP_TARGET_STYLE : undefined}
              onDragOver={handleWorkbenchChatDragOver}
              onDragLeave={handleWorkbenchChatDragLeave}
              onDrop={handleWorkbenchChatDrop}
            >
              <div className="py-0.5 space-y-0.5">
                {!loading &&
                sessionsReady &&
                renderedConversationItems.length === 0 &&
                !(threadsOrganizeMode === 'project' && groupedConversationRows.length > 0) ? (
                  <PanelMessage className="px-4 py-2">
                    {threadsFilterMode === 'automation'
                      ? 'No automation threads yet.'
                      : threadsFilterMode === 'human'
                        ? 'No human threads yet.'
                        : 'No open conversations yet.'}
                  </PanelMessage>
                ) : null}

                {!LEGACY_THREAD_LIST_ENABLED ? (
                  <ActivityTreeView
                    items={activityTreeItems}
                    activeItemId={activeActivityTreeItemId}
                    emptyMessage={loading || !sessionsReady ? 'Loading conversations…' : 'No conversations yet.'}
                    className="min-h-0"
                    canDragItem={canDragActivityTreeItem}
                    canDropItem={canDropActivityTreeItem}
                    collapsedGroupItemIds={collapsedActivityTreeGroupItemIds}
                    inlineActions={activityTreeExtensionActions.map((action) => ({
                      id: action.id,
                      title: action.title,
                      icon: action.icon,
                    }))}
                    onInlineAction={(actionId, item) => {
                      void handleActivityTreeExtensionAction(actionId, item);
                    }}
                    onToggleGroupItem={(item) => {
                      const groupKey = getActivityTreeGroupKey(item);
                      if (groupKey) {
                        toggleConversationGroupCollapsed(groupKey);
                      }
                    }}
                    onDragStartItem={handleActivityTreeDragStart}
                    onDropItem={handleActivityTreeDrop}
                    onDragEndItem={clearDragState}
                    onArchiveItem={(item) => {
                      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
                      if (conversationId) {
                        handleArchiveConversation(conversationId);
                      }
                    }}
                    onCreateChildItem={(item) => {
                      const cwd = typeof item.metadata?.cwd === 'string' ? item.metadata.cwd : null;
                      void handleNewConversation(cwd, { reuseEmptyConversation: false });
                    }}
                    onOpenItem={(item) => {
                      if (item.route) {
                        navigate(item.route);
                      }
                    }}
                    renderContextMenu={(item, context) => {
                      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
                      const conversationItem = conversationId ? conversationItemBySessionId.get(conversationId) : null;
                      const parentConversationId = conversationItem?.session.parentSessionId;
                      const parentConversation = parentConversationId ? conversationItemBySessionId.get(parentConversationId) : null;
                      const conversationLocked = conversationId ? isConversationLocked(conversationId) : false;
                      const groupKey = typeof item.metadata?.groupKey === 'string' ? item.metadata.groupKey : null;
                      const conversationGroup = groupKey ? conversationGroupByKey.get(groupKey) : null;
                      const isConversation = item.kind === 'conversation' && conversationId && conversationItem;
                      const isGroup = item.kind === 'group' && conversationGroup;
                      const groupSessionIds = conversationGroup?.items
                        .map(({ session }) => session.id)
                        .filter((sessionId) => sessionId !== DRAFT_CONVERSATION_ID);
                      const groupIncludesDraft = Boolean(
                        conversationGroup?.items.some(({ session }) => session.id === DRAFT_CONVERSATION_ID),
                      );
                      return (
                        <PositionedMenu placement="static" className="min-w-[224px]">
                          {item.route ? (
                            <MenuItem
                              onClick={() => {
                                context.close();
                                navigate(item.route!);
                              }}
                            >
                              Open
                            </MenuItem>
                          ) : null}
                          {isGroup ? (
                            <>
                              {conversationGroup.cwd ? (
                                <MenuItem
                                  onClick={() => {
                                    context.close();
                                    void handleOpenConversationGroupInFinder(conversationGroup.cwd!, conversationGroup.label);
                                  }}
                                >
                                  Open in Finder
                                </MenuItem>
                              ) : null}
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  handleRenameConversationGroup(
                                    conversationGroup.key,
                                    conversationGroup.defaultLabel,
                                    conversationGroup.label,
                                  );
                                }}
                              >
                                Edit Name
                              </MenuItem>
                              {groupSessionIds && groupSessionIds.length > 0 ? (
                                <MenuItem
                                  onClick={() => {
                                    context.close();
                                    void handleArchiveConversationGroup(conversationGroup.label, groupSessionIds);
                                  }}
                                >
                                  Archive Threads
                                </MenuItem>
                              ) : null}
                              <MenuItem
                                tone="danger"
                                onClick={() => {
                                  context.close();
                                  handleRemoveConversationGroup(
                                    conversationGroup.key,
                                    conversationGroup.label,
                                    conversationGroup.cwd,
                                    groupSessionIds ?? [],
                                    groupIncludesDraft,
                                  );
                                }}
                              >
                                Remove
                              </MenuItem>
                            </>
                          ) : isConversation ? (
                            <>
                              {parentConversation ? (
                                <MenuItem
                                  onClick={() => {
                                    context.close();
                                    navigate(`/conversations/${encodeURIComponent(parentConversation.session.id)}`);
                                  }}
                                >
                                  Go to Parent Thread
                                </MenuItem>
                              ) : null}
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  handleRenameConversation(conversationId, conversationItem.session.title);
                                }}
                              >
                                Rename Thread
                              </MenuItem>
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  if (conversationItem.pinned) {
                                    unpinSession(conversationId);
                                  } else {
                                    pinSession(conversationId);
                                  }
                                }}
                              >
                                {conversationItem.pinned ? 'Unpin Thread' : 'Pin Thread'}
                              </MenuItem>
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  toggleConversationLock(conversationId);
                                }}
                              >
                                {conversationLocked ? 'Unlock Thread' : 'Lock Thread'}
                              </MenuItem>
                              {!conversationLocked ? (
                                <MenuItem
                                  onClick={() => {
                                    context.close();
                                    if (conversationItem.pinned) {
                                      handleClosePinnedConversation(conversationId);
                                    } else {
                                      handleCloseConversation(conversationId);
                                    }
                                  }}
                                >
                                  Close Thread
                                </MenuItem>
                              ) : null}
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  void handleDuplicateConversation(conversationItem.session);
                                }}
                              >
                                Duplicate Thread
                              </MenuItem>
                              {!conversationLocked ? (
                                <MenuItem
                                  onClick={() => {
                                    context.close();
                                    handleArchiveConversation(conversationId);
                                  }}
                                >
                                  Archive Thread
                                </MenuItem>
                              ) : null}
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  void handleCopyConversationId(conversationId);
                                }}
                              >
                                Copy Session ID
                              </MenuItem>
                              <MenuItem
                                onClick={() => {
                                  context.close();
                                  void handleCopyConversationDeeplink(conversationId);
                                }}
                              >
                                Copy Deeplink
                              </MenuItem>
                              {conversationItem.session.cwd?.trim() ? (
                                <MenuItem
                                  onClick={() => {
                                    context.close();
                                    void handleCopyConversationWorkingDirectory(conversationItem.session.cwd);
                                  }}
                                >
                                  Copy Working Directory
                                </MenuItem>
                              ) : null}
                              {activityTreeExtensionContextMenus.map((menu) => (
                                <MenuItem
                                  key={`${menu.extensionId}:${menu.id}`}
                                  onClick={() => {
                                    context.close();
                                    void handleActivityTreeExtensionContextMenu(menu, {
                                      conversationId,
                                      sessionTitle: conversationItem.session.title,
                                      cwd: conversationItem.session.cwd,
                                    });
                                  }}
                                >
                                  {menu.title}
                                </MenuItem>
                              ))}
                            </>
                          ) : null}
                        </PositionedMenu>
                      );
                    }}
                  />
                ) : threadsOrganizeMode === 'project' ? (
                  groupedConversationRows.map((group) => {
                    const collapsed = collapsedConversationGroupKeySet.has(group.key);
                    const groupSessionIds = group.items
                      .map(({ session }) => session.id)
                      .filter((sessionId) => sessionId !== DRAFT_CONVERSATION_ID);
                    const groupIncludesDraft = group.items.some(({ session }) => session.id === DRAFT_CONVERSATION_ID);
                    const groupDropPosition =
                      canReorderConversationGroups && groupDropTarget?.groupKey === group.key && draggingGroupKey !== group.key
                        ? groupDropTarget.position
                        : null;

                    return (
                      <div key={`cwd:${group.key}`} className="space-y-0.5 pt-1.5 first:pt-0">
                        <ConversationCwdGroupHeader
                          label={group.label}
                          cwd={group.cwd}
                          collapsed={collapsed}
                          canDrag={canReorderConversationGroups}
                          isDragging={canReorderConversationGroups && draggingGroupKey === group.key}
                          isConversationDropTarget={conversationCwdDropTargetGroupKey === group.key}
                          dropPosition={groupDropPosition}
                          dragId={group.key}
                          onToggleCollapsed={() => toggleConversationGroupCollapsed(group.key)}
                          onNewConversation={() => {
                            void handleNewConversation(group.cwd);
                          }}
                          onOpenInFinder={group.cwd ? () => handleOpenConversationGroupInFinder(group.cwd, group.label) : undefined}
                          onEditName={() => handleRenameConversationGroup(group.key, group.defaultLabel, group.label)}
                          onArchiveThreads={
                            groupSessionIds.length > 0 ? () => handleArchiveConversationGroup(group.label, groupSessionIds) : undefined
                          }
                          onRemove={() =>
                            handleRemoveConversationGroup(group.key, group.label, group.cwd, groupSessionIds, groupIncludesDraft)
                          }
                          onDragStart={
                            canReorderConversationGroups ? (event) => handleConversationGroupDragStart(group.key, event) : undefined
                          }
                          onDragOver={
                            canReorderConversationGroups ? (event) => handleConversationGroupDragOver(group.key, event) : undefined
                          }
                          onDrop={canReorderConversationGroups ? (event) => handleConversationGroupDrop(group.key, event) : undefined}
                          onDragEnd={canReorderConversationGroups ? () => clearDragState() : undefined}
                        />
                        {!collapsed ? (
                          group.items.length > 0 ? (
                            group.items.map(renderConversationRow)
                          ) : !loading && sessionsReady ? (
                            <PanelMessage className="px-4 pb-1 pt-0">No conversations yet.</PanelMessage>
                          ) : null
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  filteredConversationItems.map(renderConversationRow)
                )}
              </div>
            </div>
          </>
        )}

        <SidebarSettingsNav items={settingsNavItems} notice={sidebarNotice?.text ?? null} />
      </aside>
      {renameConversationGroupPrompt ? (
        <TextPromptDialog
          title="Edit workspace name"
          label="Workspace name"
          initialValue={renameConversationGroupPrompt.currentLabel}
          allowEmpty
          confirmLabel="Save"
          onCancel={() => setRenameConversationGroupPrompt(null)}
          onSubmit={submitRenameConversationGroup}
        />
      ) : null}
      {renameConversationPrompt ? (
        <TextPromptDialog
          title="Rename conversation"
          label="Thread name"
          initialValue={renameConversationPrompt.currentTitle}
          confirmLabel="Save"
          onCancel={() => setRenameConversationPrompt(null)}
          onSubmit={(nextTitle) => void submitRenameConversation(nextTitle)}
        />
      ) : null}
      {workspaceQuickSelectOpen ? (
        <WorkspaceQuickSelectModal
          workspacePaths={savedWorkspacePaths}
          choosingNewFolder={addWorkspaceBusy}
          onClose={() => setWorkspaceQuickSelectOpen(false)}
          onSelectWorkspace={handleSelectSavedWorkspace}
          onChooseNewFolder={() => {
            void handleChooseNewWorkspaceFolder();
          }}
        />
      ) : null}
    </>
  );
}
