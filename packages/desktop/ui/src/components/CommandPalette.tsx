import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { APPLICATION_ACTIVATE_EVENT } from '../applications/applicationEvents';
import { type ApplicationWorkspaceState, EMPTY_APPLICATION_WORKSPACE } from '../applications/applicationWorkspace';
import { launcherPinKey, type LauncherPinSnapshot, type LauncherPinTarget } from '../applications/launcherPins';
import { api } from '../client/api';
import {
  ALL_COMMAND_PALETTE_SCOPE,
  COMMAND_PALETTE_SECTION_LABELS,
  type CommandPaletteItem,
  type CommandPaletteScope,
  type CommandPaletteSection,
  isCommandPaletteThreadDataLoading,
  isHostCommandDisabledInPalette,
  searchCommandPaletteItems,
  selectCommandPaletteScopedItems,
  selectPreferredCommandPaletteCursor,
  shouldBootstrapCommandPaletteThreads,
  THREAD_COMMAND_PALETTE_SECTIONS,
  THREADS_COMMAND_PALETTE_SCOPE,
} from '../commands/commandPalette';
import { activateCommandPaletteItem, type CommandPaletteAction, executePaletteCommand } from '../commands/commandPaletteActions';
import { COMMAND_PALETTE_STATE_EVENT, OPEN_COMMAND_PALETTE_EVENT, type OpenCommandPaletteDetail } from '../commands/commandPaletteEvents';
import {
  buildConversationContentSearchItems,
  buildConversationItems,
  type ExtensionQuickOpenItem,
  normalizeExtensionSearchItem,
  normalizeQuickOpenItem,
  type ScopedSessionMeta,
} from '../commands/commandPaletteItems';
import { readConversationIdFromPathname } from '../conversation/conversationRoutes';
import {
  canExecuteExtensionCommand,
  EXTENSION_COMMAND_CONTEXT_CHANGED_EVENT,
  getExtensionCommandContext,
  listHostCommands,
} from '../extensions/commands';
import { systemExtensionModules } from '../extensions/systemExtensionModules';
import type {
  ExtensionCommandRegistration,
  ExtensionQuickOpenRegistration,
  ExtensionSearchProviderRegistration,
} from '../extensions/types';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { useConversations } from '../hooks/useConversations';
import type { ConversationContentSearchMatch } from '../shared/types';
import { useAllSessions, useSessionsReady } from '../store';
import { PaletteItemIcon } from './ApplicationIcon';
import { cx, IconButton, Keycap, PanelMessage, RowButton, SearchInput } from './ui';

type ExtensionQuickOpenProvider = {
  list?: () => Promise<ExtensionQuickOpenItem[]> | ExtensionQuickOpenItem[];
  search?: (query: string, limit: number) => Promise<ExtensionQuickOpenItem[]> | ExtensionQuickOpenItem[];
};

const THREADS_EMPTY_QUERY_PAGE_SIZE = 50;
const CONVERSATION_CONTENT_SEARCH_LIMIT = 80;
const FILE_SEARCH_LIMIT = 50;
const FILE_CONTENT_SEARCH_DEBOUNCE_MS = 160;
const CONVERSATION_CONTENT_SEARCH_DEBOUNCE_MS = 160;
const COMMANDS_COMMAND_PALETTE_SCOPE = 'commands';

function commandSecondaryText(input: { category?: string; description?: string }, fallback?: string): string | undefined {
  return input.description?.trim() || input.category?.trim() || fallback;
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function emptyStateCopy(scope: CommandPaletteScope, query: string): string {
  if (query.trim().length > 0) {
    return scope === THREADS_COMMAND_PALETTE_SCOPE ? `No conversations match “${query}”.` : `No items match “${query}”.`;
  }

  return scope === THREADS_COMMAND_PALETTE_SCOPE ? 'No conversations yet.' : 'No items yet.';
}

function LauncherPinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m7 3 6 0-.6 5 2.1 2.2H5.5L7.6 8z" />
      <path d="M10 10.2V17" />
    </svg>
  );
}

function launcherTitleMatchTier(title: string, query: string): number {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return 0;
  if (normalizedTitle === normalizedQuery) return 3;
  if (normalizedTitle.startsWith(normalizedQuery)) return 2;
  if (normalizedTitle.includes(normalizedQuery)) return 1;
  return 0;
}

function deduplicateLauncherSearchResults<TAction>(items: CommandPaletteItem<TAction>[]): CommandPaletteItem<TAction>[] {
  const destinationTitles = new Set(
    items
      .filter((item) => item.section === 'applications' || item.section === 'pages')
      .map((item) => item.title.trim().toLocaleLowerCase()),
  );
  const seenResources = new Set<string>();

  return items.filter((item) => {
    if (item.section === 'commands') {
      const destinationTitle = item.title
        .replace(/^open\s+/i, '')
        .trim()
        .toLocaleLowerCase();
      if (destinationTitle !== item.title.trim().toLocaleLowerCase() && destinationTitles.has(destinationTitle)) {
        return false;
      }
    }

    if (item.pinTarget?.kind === 'conversation') {
      const key = launcherPinKey(item.pinTarget);
      if (seenResources.has(key)) return false;
      seenResources.add(key);
    }

    return true;
  });
}

export function CommandPalette({
  applicationWorkspace = EMPTY_APPLICATION_WORKSPACE,
  onToggleLauncherPin,
}: {
  applicationWorkspace?: ApplicationWorkspaceState;
  onToggleLauncherPin?: (target: LauncherPinTarget, snapshot: LauncherPinSnapshot) => void;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const requestedThreadBootstrapRef = useRef(false);
  const macPlatform = useMemo(() => isMacPlatform(), []);
  const sessions = useAllSessions();
  const extensionRegistry = useExtensionRegistry();
  const sessionsReady = useSessionsReady();
  const { pinnedSessions, tabs, archivedSessions, openSession, loading: sessionsLoading, refetch } = useConversations();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CommandPaletteScope>(ALL_COMMAND_PALETTE_SCOPE);
  const [anchorRect, setAnchorRect] = useState<OpenCommandPaletteDetail['anchorRect'] | null>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [archivedVisibleLimit, setArchivedVisibleLimit] = useState(THREADS_EMPTY_QUERY_PAGE_SIZE);
  const [conversationContentSearchResults, setConversationContentSearchResults] = useState<ConversationContentSearchMatch[]>([]);
  const [conversationContentSearchLoading, setConversationContentSearchLoading] = useState(false);
  const [conversationContentSearchError, setConversationContentSearchError] = useState<string | null>(null);
  const [quickOpenRegistrations, setQuickOpenRegistrations] = useState<ExtensionQuickOpenRegistration[]>([]);
  const [quickOpenItems, setQuickOpenItems] = useState<CommandPaletteItem<CommandPaletteAction>[]>([]);
  const [quickOpenLoading, setQuickOpenLoading] = useState(false);
  const [quickOpenError, setQuickOpenError] = useState<string | null>(null);
  const [quickOpenSearchItems, setQuickOpenSearchItems] = useState<CommandPaletteItem<CommandPaletteAction>[]>([]);
  const [quickOpenSearchLoading, setQuickOpenSearchLoading] = useState(false);
  const [quickOpenSearchError, setQuickOpenSearchError] = useState<string | null>(null);
  const [extensionSearchProviders, setExtensionSearchProviders] = useState<ExtensionSearchProviderRegistration[]>([]);
  const [extensionSearchItems, setExtensionSearchItems] = useState<CommandPaletteItem<CommandPaletteAction>[]>([]);
  const [extensionSearchLoading, setExtensionSearchLoading] = useState(false);
  const [extensionSearchError, setExtensionSearchError] = useState<string | null>(null);
  const [extensionCommands, setExtensionCommands] = useState<ExtensionCommandRegistration[]>([]);
  const [commandContextRevision, setCommandContextRevision] = useState(0);
  const openThreadSessions = useMemo(
    () => [...pinnedSessions.map((session) => ({ ...session, pinned: true }) satisfies ScopedSessionMeta), ...tabs],
    [pinnedSessions, tabs],
  );

  const openConversationItems = useMemo(() => buildConversationItems('open', openThreadSessions), [openThreadSessions]);
  const archivedConversationItems = useMemo(() => buildConversationItems('archived', archivedSessions), [archivedSessions]);
  const commandItems = useMemo<CommandPaletteItem<CommandPaletteAction>[]>(() => {
    const activeConversationId = readConversationIdFromPathname(location.pathname);
    const commandContext = { ...getExtensionCommandContext(), route: location.pathname };
    const commandOptions = {
      navigate,
      openCommandPalette: () => undefined,
      openRightRail: () => false,
      setLayout: () => undefined,
      activeConversationId,
      extensionCommands,
      invokeExtensionCommand: async () => undefined,
      context: commandContext,
    };
    const hostItems = listHostCommands().map((command, index) => {
      return {
        id: `host-command:${command.id}`,
        section: 'commands',
        title: command.title,
        subtitle: undefined,
        meta: command.category,
        keywords: [command.id, command.category].filter((keyword): keyword is string => typeof keyword === 'string'),
        order: index,
        disabled: isHostCommandDisabledInPalette(command.id, { activeConversationId, context: commandContext }),
        action: { kind: 'command' as const, command: command.id },
      };
    });
    const extensionItems = extensionCommands.map((command, index) => ({
      id: `extension-command:${command.extensionId}:${command.surfaceId}`,
      section: 'commands',
      title: command.title,
      icon: command.icon,
      subtitle: commandSecondaryText(command),
      meta: command.category ? undefined : 'Extension command',
      keywords: [command.surfaceId, command.extensionId, command.category, command.description].filter(
        (keyword): keyword is string => typeof keyword === 'string',
      ),
      order: hostItems.length + index,
      disabled: !canExecuteExtensionCommand(`${command.extensionId}.${command.surfaceId}`, command.args, commandOptions),
      action: { kind: 'command' as const, command: `${command.extensionId}.${command.surfaceId}`, args: command.args },
    }));
    return [...hostItems, ...extensionItems];
  }, [commandContextRevision, extensionCommands, location.pathname, navigate, open]);
  const applicationItems = useMemo<CommandPaletteItem<CommandPaletteAction>[]>(
    () =>
      extensionRegistry.applications
        .filter((application) => application.available)
        .map((application, index) => ({
          id: `application:${application.id}`,
          section: 'applications',
          title: application.title,
          icon: application.icon,
          pinTarget: { kind: 'application' as const, applicationId: application.id },
          keywords: [application.id, application.extensionId],
          order: index,
          action: { kind: 'navigate' as const, to: application.startRoute },
        })),
    [extensionRegistry.applications],
  );
  const applicationPageItems = useMemo<CommandPaletteItem<CommandPaletteAction>[]>(
    () =>
      extensionRegistry.applicationNavigation.map((item, index) => ({
        id: `application-page:${item.id}`,
        section: 'pages',
        title: item.label,
        icon: item.icon,
        parentLabel: extensionRegistry.applications.find((application) => application.id === item.applicationId)?.title,
        pinTarget: { kind: 'page' as const, navigationId: item.id },
        keywords: [item.route, item.applicationId, item.slot],
        order: index,
        action: { kind: 'navigate' as const, to: item.route },
      })),
    [extensionRegistry.applicationNavigation, extensionRegistry.applications],
  );
  const visibleCommandItems = query.trim().length === 0 ? commandItems.filter((item) => !item.disabled) : commandItems;
  const fileItems =
    scope === ALL_COMMAND_PALETTE_SCOPE
      ? [...applicationItems, ...applicationPageItems, ...visibleCommandItems, ...quickOpenItems]
      : scope === COMMANDS_COMMAND_PALETTE_SCOPE
        ? commandItems
        : quickOpenItems;
  const searchedFileItems = quickOpenSearchItems;
  const quickOpenScopes = useMemo(
    () =>
      quickOpenRegistrations
        .map((registration) => ({
          value: registration.section ?? registration.id,
          label: registration.title ?? registration.id,
          order: registration.order ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label)),
    [quickOpenRegistrations],
  );
  const quickOpenScopeLabel = quickOpenScopes.find((option) => option.value === scope)?.label ?? 'items';
  const quickOpenSectionLabels = useMemo(
    () => ({
      ...Object.fromEntries(quickOpenScopes.map((option) => [option.value, option.label])),
      ...Object.fromEntries(extensionSearchProviders.map((provider) => [provider.id, provider.title])),
    }),
    [extensionSearchProviders, quickOpenScopes],
  );
  const searchedConversationItems = useMemo(
    () => buildConversationContentSearchItems(conversationContentSearchResults, query.trim()),
    [conversationContentSearchResults, query],
  );
  const allItems = useMemo(() => {
    return selectCommandPaletteScopedItems({
      scope,
      query,
      openConversationItems,
      archivedConversationItems,
      fileItems,
      searchedConversationItems,
      searchedFileItems: [...extensionSearchItems, ...searchedFileItems],
    });
  }, [
    archivedConversationItems,
    extensionSearchItems,
    fileItems,
    openConversationItems,
    query,
    scope,
    searchedConversationItems,
    searchedFileItems,
  ]);

  const emptyQueryLimits = useMemo(() => {
    if (query.trim().length > 0) return undefined;
    if (scope === THREADS_COMMAND_PALETTE_SCOPE) return { archived: archivedVisibleLimit };
    if (scope === ALL_COMMAND_PALETTE_SCOPE) {
      return { applications: null, pages: null, open: 5, commands: 4, archived: 0 };
    }
    return undefined;
  }, [archivedVisibleLimit, query, scope]);
  const groups = useMemo(
    () =>
      searchCommandPaletteItems(allItems, {
        query,
        scope,
        emptyQueryLimits,
        sectionLabels: quickOpenSectionLabels,
      }),
    [allItems, emptyQueryLimits, query, quickOpenSectionLabels, scope],
  );
  const pinnedKeys = useMemo(
    () => new Set((applicationWorkspace.launcherPins ?? []).map((pin) => pin.key)),
    [applicationWorkspace.launcherPins],
  );
  const presentationGroups = useMemo(() => {
    if (scope !== ALL_COMMAND_PALETTE_SCOPE) return groups;
    if (query.trim().length === 0) {
      return groups.flatMap((group) => {
        if (group.section === 'pages') {
          const applicationLabels = [...new Set(group.items.map((item) => item.parentLabel ?? 'Other'))];
          return applicationLabels.map((applicationLabel) => {
            const items = group.items.filter((item) => (item.parentLabel ?? 'Other') === applicationLabel);
            return {
              ...group,
              section: `pages:${applicationLabel}`,
              label: `${applicationLabel} pages`,
              total: items.length,
              items,
            };
          });
        }
        if (group.section === 'open') return [{ ...group, label: 'Recent threads' }];
        if (group.section === 'commands') return [{ ...group, label: 'Suggested actions' }];
        return [group];
      });
    }
    const items = deduplicateLauncherSearchResults(
      groups
        .flatMap((group) => group.items)
        .sort(
          (left, right) =>
            launcherTitleMatchTier(right.title, query) - launcherTitleMatchTier(left.title, query) ||
            right.score - left.score ||
            (left.order ?? 0) - (right.order ?? 0),
        ),
    );
    return items.length > 0 ? [{ section: 'results', label: 'Results', total: items.length, items }] : [];
  }, [groups, query, scope]);
  const visiblePresentationGroups = useMemo(() => {
    if (query.trim().length > 0 || scope !== ALL_COMMAND_PALETTE_SCOPE) return presentationGroups;
    return presentationGroups
      .map((group) => ({
        ...group,
        // Pinned applications and pages remain in the full inventory. Pinning is a shortcut layer,
        // not a way to make destinations disappear from their owning section.
        items: group.items.filter((item) => item.pinTarget?.kind !== 'conversation' || !pinnedKeys.has(launcherPinKey(item.pinTarget))),
      }))
      .filter((group) => group.items.length > 0);
  }, [pinnedKeys, presentationGroups, query, scope]);
  const visibleItems = useMemo(() => visiblePresentationGroups.flatMap((group) => group.items), [visiblePresentationGroups]);
  const duplicateConversationTitles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of visibleItems) {
      if (item.pinTarget?.kind !== 'conversation') continue;
      const title = item.title.trim().toLocaleLowerCase();
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([title]) => title));
  }, [visibleItems]);
  const duplicateConversationOrdinals = useMemo(() => {
    const groups = new Map<string, CommandPaletteItem<CommandPaletteAction>[]>();
    for (const item of visibleItems) {
      if (item.pinTarget?.kind !== 'conversation' || !item.auxiliaryLabel) continue;
      const key = `${item.title.trim().toLocaleLowerCase()}\u0000${item.auxiliaryLabel}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return new Map(
      [...groups.values()].flatMap((items) => (items.length > 1 ? items.map((item, index) => [item.id, index + 1] as const) : [])),
    );
  }, [visibleItems]);
  const preferredCursor = useMemo(
    () => (scope === ALL_COMMAND_PALETTE_SCOPE && query.trim().length > 0 ? 0 : selectPreferredCommandPaletteCursor(visibleItems, query)),
    [query, scope, visibleItems],
  );
  const pinnedLauncherItems = useMemo(() => {
    const liveItems = [...applicationItems, ...applicationPageItems, ...openConversationItems, ...archivedConversationItems];
    const byKey = new Map(liveItems.flatMap((item) => (item.pinTarget ? [[launcherPinKey(item.pinTarget), item] as const] : [])));
    return (applicationWorkspace.launcherPins ?? []).map((pin) => ({ pin, item: byKey.get(pin.key) ?? null }));
  }, [applicationItems, applicationPageItems, applicationWorkspace.launcherPins, archivedConversationItems, openConversationItems]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setBusyItemId(null);
    setActionError(null);
  }, []);

  const openPalette = useCallback((options: OpenCommandPaletteDetail = {}) => {
    setQuery(options.query ?? '');
    setScope(ALL_COMMAND_PALETTE_SCOPE);
    setAnchorRect(options.anchorRect ?? null);
    setCursor(0);
    setBusyItemId(null);
    setActionError(null);
    setArchivedVisibleLimit(THREADS_EMPTY_QUERY_PAGE_SIZE);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_STATE_EVENT, { detail: { open } }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleCommandContextChanged = () => setCommandContextRevision((current) => current + 1);
    window.addEventListener(EXTENSION_COMMAND_CONTEXT_CHANGED_EVENT, handleCommandContextChanged);
    return () => window.removeEventListener(EXTENSION_COMMAND_CONTEXT_CHANGED_EVENT, handleCommandContextChanged);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([api.extensionCommands(), api.extensionSearchProviders()])
      .then(([commands, providers]) => {
        if (!cancelled) {
          setExtensionCommands(commands);
          setExtensionSearchProviders(providers);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExtensionCommands([]);
          setExtensionSearchProviders([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadQuickOpenItems = useCallback(async () => {
    setQuickOpenLoading(true);
    setQuickOpenError(null);
    try {
      const registrations = quickOpenRegistrations.length > 0 ? quickOpenRegistrations : await api.extensionQuickOpen();
      setQuickOpenRegistrations(registrations);
      const groups = await Promise.all(
        registrations.map(async (registration: ExtensionQuickOpenRegistration) => {
          const loader = systemExtensionModules.get(registration.extensionId);
          if (!loader) return [];
          const module = await loader();
          const provider = module[registration.provider] as ExtensionQuickOpenProvider | undefined;
          if (!provider?.list) return [];
          const items = await provider.list();
          return items.flatMap((item, index) => {
            const normalized = normalizeQuickOpenItem(registration, item, index);
            return normalized ? [normalized] : [];
          });
        }),
      );
      setQuickOpenItems(groups.flat());
    } catch (error) {
      setQuickOpenError(error instanceof Error ? error.message : String(error));
      setQuickOpenItems([]);
    } finally {
      setQuickOpenLoading(false);
    }
  }, [quickOpenRegistrations]);

  useEffect(() => {
    function handleOpenPalette(event: Event) {
      const detail = (event as CustomEvent<OpenCommandPaletteDetail>).detail;
      openPalette(detail ?? {});
    }

    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenPalette);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenPalette);
  }, [openPalette]);

  useEffect(() => {
    if (sessionsReady || !open) {
      requestedThreadBootstrapRef.current = false;
    }

    if (
      !shouldBootstrapCommandPaletteThreads({
        open,
        scope,
        sessions: sessions as unknown as unknown[] | null,
        alreadyRequested: requestedThreadBootstrapRef.current,
        sessionsReady,
      })
    ) {
      return;
    }

    requestedThreadBootstrapRef.current = true;
    void refetch().catch(() => {
      // Keep the palette usable even if the eager thread bootstrap fails.
    });
  }, [open, refetch, scope, sessions, sessionsReady]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (quickOpenLoading || quickOpenItems.length > 0) {
      return;
    }

    void loadQuickOpenItems();
  }, [loadQuickOpenItems, open, quickOpenItems.length, quickOpenLoading]);

  const archivedGroup = useMemo(() => groups.find((group) => group.section === 'archived') ?? null, [groups]);
  const canLoadMoreArchivedThreads = Boolean(
    open &&
    (scope === THREADS_COMMAND_PALETTE_SCOPE || scope === ALL_COMMAND_PALETTE_SCOPE) &&
    query.trim().length === 0 &&
    archivedGroup &&
    archivedGroup.total > archivedGroup.items.length,
  );

  useEffect(() => {
    if (!canLoadMoreArchivedThreads) {
      return;
    }

    const listElement = listRef.current;
    if (!listElement) {
      return;
    }

    if (listElement.scrollHeight > listElement.clientHeight + 8) {
      return;
    }

    setArchivedVisibleLimit((current) => current + THREADS_EMPTY_QUERY_PAGE_SIZE);
  }, [canLoadMoreArchivedThreads, groups]);

  const activeSearchProvider = extensionSearchProviders.find((provider) => provider.id === scope) ?? null;
  const shouldSearchExtensionProvider =
    open && query.trim().length > 0 && (scope === ALL_COMMAND_PALETTE_SCOPE || Boolean(activeSearchProvider));
  const quickOpenScopeActive =
    scope !== ALL_COMMAND_PALETTE_SCOPE &&
    scope !== THREADS_COMMAND_PALETTE_SCOPE &&
    scope !== COMMANDS_COMMAND_PALETTE_SCOPE &&
    !activeSearchProvider;
  const shouldSearchQuickOpenByContent = open && quickOpenScopeActive && query.trim().length > 0;

  const shouldSearchConversationsByContent =
    open && (scope === THREADS_COMMAND_PALETTE_SCOPE || scope === ALL_COMMAND_PALETTE_SCOPE) && query.trim().length > 0;

  useEffect(() => {
    if (!shouldSearchConversationsByContent) {
      setConversationContentSearchLoading(false);
      setConversationContentSearchError(null);
      setConversationContentSearchResults([]);
      return;
    }

    let cancelled = false;
    setConversationContentSearchLoading(true);
    setConversationContentSearchError(null);

    const handle = window.setTimeout(() => {
      void api
        .conversationContentSearch(query.trim(), CONVERSATION_CONTENT_SEARCH_LIMIT)
        .then((result: { matches: ConversationContentSearchMatch[] }) => {
          if (cancelled) {
            return;
          }
          setConversationContentSearchResults(result.matches);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          setConversationContentSearchError(error instanceof Error ? error.message : String(error));
          setConversationContentSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) {
            setConversationContentSearchLoading(false);
          }
        });
    }, CONVERSATION_CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, shouldSearchConversationsByContent]);

  useEffect(() => {
    if (!shouldSearchExtensionProvider) {
      setExtensionSearchLoading(false);
      setExtensionSearchError(null);
      setExtensionSearchItems([]);
      return;
    }

    let cancelled = false;
    setExtensionSearchLoading(true);
    setExtensionSearchError(null);

    const handle = window.setTimeout(() => {
      void api
        .extensionSearch({
          query: query.trim(),
          limit: FILE_SEARCH_LIMIT,
          ...(activeSearchProvider ? { providerId: activeSearchProvider.id } : {}),
        })
        .then((result: { providers: ExtensionSearchProviderRegistration[]; items: ExtensionSearchItem[] }) => {
          if (cancelled) return;
          setExtensionSearchItems(
            result.items.flatMap((item: ExtensionSearchItem, index: number) => {
              const provider =
                result.providers.find((candidate: ExtensionSearchProviderRegistration) => candidate.id === item.providerId) ??
                activeSearchProvider ??
                result.providers[0];
              if (!provider) return [];
              const normalized = normalizeExtensionSearchItem(provider, item, index);
              return normalized ? [normalized] : [];
            }),
          );
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setExtensionSearchError(error instanceof Error ? error.message : String(error));
          setExtensionSearchItems([]);
        })
        .finally(() => {
          if (!cancelled) setExtensionSearchLoading(false);
        });
    }, FILE_CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [activeSearchProvider, query, shouldSearchExtensionProvider]);

  useEffect(() => {
    if (!shouldSearchQuickOpenByContent) {
      setQuickOpenSearchLoading(false);
      setQuickOpenSearchError(null);
      setQuickOpenSearchItems([]);
      return;
    }

    let cancelled = false;
    setQuickOpenSearchLoading(true);
    setQuickOpenSearchError(null);

    const handle = window.setTimeout(() => {
      void (async () => {
        const registrations = quickOpenRegistrations.length > 0 ? quickOpenRegistrations : await api.extensionQuickOpen();
        setQuickOpenRegistrations(registrations);
        const groups = await Promise.all(
          registrations.map(async (registration: ExtensionQuickOpenRegistration) => {
            const loader = systemExtensionModules.get(registration.extensionId);
            if (!loader) return [];
            const module = await loader();
            const provider = module[registration.provider] as ExtensionQuickOpenProvider | undefined;
            if (!provider?.search) return [];
            const items = await provider.search(query.trim(), FILE_SEARCH_LIMIT);
            return items.flatMap((item, index) => {
              const normalized = normalizeQuickOpenItem(registration, item, index);
              return normalized ? [normalized] : [];
            });
          }),
        );
        return groups.flat();
      })()
        .then((items) => {
          if (cancelled) return;
          setQuickOpenSearchItems(items);
        })
        .catch((error) => {
          if (cancelled) return;
          setQuickOpenSearchError(error instanceof Error ? error.message : String(error));
          setQuickOpenSearchItems([]);
        })
        .finally(() => {
          if (!cancelled) setQuickOpenSearchLoading(false);
        });
    }, FILE_CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, quickOpenRegistrations, shouldSearchQuickOpenByContent]);

  const activateItem = useCallback(
    async (item: CommandPaletteItem<CommandPaletteAction>) => {
      if (item.disabled) {
        return;
      }

      setActionError(null);
      setBusyItemId(item.id);

      try {
        if (item.id.startsWith('application:')) {
          window.dispatchEvent(
            new CustomEvent(APPLICATION_ACTIVATE_EVENT, {
              detail: { applicationId: item.id.slice('application:'.length) },
            }),
          );
          closePalette();
          return;
        }
        const handled = await activateCommandPaletteItem(item, {
          commandItems,
          location,
          navigate,
          openSession,
          closePalette,
          executeExtensionCommand: executePaletteCommand,
        });
        if (!handled) {
          setActionError('Command is unavailable right now.');
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusyItemId(null);
      }
    },
    [closePalette, commandItems, location.hash, location.pathname, location.search, navigate, openSession],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handle = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [anchorRect, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCursor((current) => {
      if (visibleItems.length === 0) {
        return 0;
      }

      if (query.trim().length > 0) {
        return Math.max(0, Math.min(preferredCursor, visibleItems.length - 1));
      }

      return Math.max(0, Math.min(current, visibleItems.length - 1));
    });
  }, [open, preferredCursor, query, visibleItems.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current?.querySelector(`[data-command-palette-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      if (!open) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePalette();
        return;
      }

      if (event.key === 'Enter') {
        const actionable = event.target instanceof HTMLElement ? event.target.closest('button, a[href], [role="button"]') : null;
        if (actionable && shellRef.current?.contains(actionable)) {
          return;
        }
        event.preventDefault();
        const active = visibleItems[cursor];
        if (active) {
          void activateItem(active);
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((current) => Math.min(current + 1, Math.max(visibleItems.length - 1, 0)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'PageDown') {
        event.preventDefault();
        setCursor((current) => Math.min(current + 10, Math.max(visibleItems.length - 1, 0)));
        return;
      }

      if (event.key === 'PageUp') {
        event.preventDefault();
        setCursor((current) => Math.max(current - 10, 0));
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setCursor(0);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        setCursor(Math.max(visibleItems.length - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activateItem, closePalette, cursor, open, visibleItems]);

  useEffect(() => {
    if (!open) return;

    function handleFocusIn(event: FocusEvent) {
      const shell = shellRef.current;
      if (shell && event.target instanceof Node && !shell.contains(event.target)) closePalette();
    }

    document.addEventListener('focusin', handleFocusIn, true);
    return () => document.removeEventListener('focusin', handleFocusIn, true);
  }, [closePalette, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const shell = shellRef.current;
      if (!shell || !(event.target instanceof Node)) return;
      if (!shell.contains(event.target)) closePalette();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [closePalette, open]);

  useEffect(() => {
    closePalette();
  }, [closePalette, location.pathname, location.search]);

  const visibleCount = visibleItems.length;
  const loadingSections = useMemo(() => {
    const sections = new Set<CommandPaletteSection>();
    const threadSessionsLoading = isCommandPaletteThreadDataLoading({
      sessions: sessions as unknown as unknown[] | null,
      sessionsLoading,
      sessionsReady,
    });

    if (threadSessionsLoading) {
      if (scope === THREADS_COMMAND_PALETTE_SCOPE || scope === ALL_COMMAND_PALETTE_SCOPE) {
        for (const section of THREAD_COMMAND_PALETTE_SECTIONS) {
          sections.add(section);
        }
      }
    }

    if (conversationContentSearchLoading && (scope === THREADS_COMMAND_PALETTE_SCOPE || scope === ALL_COMMAND_PALETTE_SCOPE)) {
      sections.add('open');
      sections.add('archived');
    }

    if (quickOpenScopeActive && quickOpenLoading && fileItems.length === 0) {
      sections.add(scope);
    }

    if (quickOpenScopeActive && quickOpenSearchLoading) {
      sections.add(scope);
    }

    if (extensionSearchLoading) {
      sections.add(scope);
    }

    return [...sections];
  }, [
    conversationContentSearchLoading,
    extensionSearchLoading,
    fileItems.length,
    scope,
    sessionsReady,
    sessionsLoading,
    quickOpenLoading,
    quickOpenScopeActive,
    quickOpenSearchLoading,
  ]);
  const displayedLoadingSections = scope === ALL_COMMAND_PALETTE_SCOPE && visibleCount > 0 ? [] : loadingSections;
  const labelForSection = useCallback(
    (section: CommandPaletteSection) => quickOpenSectionLabels[section] ?? COMMAND_PALETTE_SECTION_LABELS[section] ?? section,
    [quickOpenSectionLabels],
  );
  const searchPlaceholder = 'Search Neon Pilot';

  if (!open) {
    return null;
  }

  let runningIndex = -1;
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const launcherWidth = Math.min(500, viewportWidth - 16);
  const launcherLeft = Math.max(8, Math.min(anchorRect?.left ?? 64, viewportWidth - launcherWidth - 8));
  const launcherTop = Math.max(38, Math.min((anchorRect?.top ?? 32) + (anchorRect?.height ?? 0) + 6, viewportHeight - 96));
  const launcherStyle = {
    '--launcher-left': `${launcherLeft}px`,
    '--launcher-top': `${launcherTop}px`,
    '--launcher-width': `${launcherWidth}px`,
    '--launcher-max-height': `${Math.max(240, viewportHeight - launcherTop - 8)}px`,
    overscrollBehavior: 'contain',
  } as CSSProperties;

  const togglePin = (item: CommandPaletteItem<CommandPaletteAction>) => {
    if (!item.pinTarget || !onToggleLauncherPin) return;
    onToggleLauncherPin(item.pinTarget, {
      title: item.title,
      ...(item.icon ? { icon: item.icon } : {}),
      ...(item.parentLabel ? { applicationTitle: item.parentLabel } : {}),
    });
  };

  return (
    <div
      className="ui-overlay-backdrop"
      data-command-palette="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePalette();
        }
      }}
    >
      <div ref={shellRef} role="dialog" aria-label="Launcher" className="ui-dialog-shell ui-command-palette-shell" style={launcherStyle}>
        <div className="ui-command-palette-header">
          <div className="ui-command-palette-search-row">
            <span className="ui-command-palette-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="10.75" cy="10.75" r="6.25" />
                <path d="m15.5 15.5 4 4" />
              </svg>
            </span>
            <SearchInput
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
                setActionError(null);
                setArchivedVisibleLimit(THREADS_EMPTY_QUERY_PAGE_SIZE);
              }}
              placeholder={searchPlaceholder}
              aria-label="Search launcher"
              className="ui-command-palette-input ui-command-palette-input-default"
            />
            <Keycap className="ui-command-palette-keycap">{macPlatform ? '⌘K' : 'Ctrl+K'}</Keycap>
          </div>

          {actionError && (
            <PanelMessage tone="danger" className="mt-2 px-0 py-0 text-[11px]">
              {actionError}
            </PanelMessage>
          )}
        </div>

        {query.trim().length === 0 && scope === ALL_COMMAND_PALETTE_SCOPE && pinnedLauncherItems.length > 0 ? (
          <section className="ui-launcher-pinned-section" aria-label="Pinned">
            <h2 className="ui-command-palette-section-header">Pinned</h2>
            {pinnedLauncherItems.map(({ pin, item }) => {
              const title = item?.title ?? pin.snapshot.title;
              const icon = item?.icon ?? pin.snapshot.icon;
              return (
                <div key={pin.key} className="ui-command-palette-result-row">
                  <RowButton
                    disabled={!item}
                    onClick={() => {
                      if (item) void activateItem(item);
                    }}
                    className={cx('ui-command-palette-result group disabled:cursor-not-allowed', !item && 'opacity-55')}
                    title={item ? title : `${title} is unavailable`}
                  >
                    <PaletteItemIcon section={item?.section ?? pin.target.kind} icon={icon} />
                    <div className="ui-command-palette-result-copy">
                      <p className="ui-command-palette-result-title">{title}</p>
                    </div>
                    {pin.snapshot.applicationTitle && pin.snapshot.applicationTitle !== title ? (
                      <span className="ui-command-palette-result-owner">{pin.snapshot.applicationTitle}</span>
                    ) : null}
                  </RowButton>
                  {onToggleLauncherPin ? (
                    <IconButton
                      compact
                      size="sm"
                      className="ui-command-palette-pin is-pinned"
                      aria-label={`Unpin ${title}`}
                      title={`Unpin ${title}`}
                      data-launcher-secondary-action="true"
                      onClick={() => onToggleLauncherPin(pin.target, pin.snapshot)}
                    >
                      <LauncherPinIcon />
                    </IconButton>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        <div
          ref={listRef}
          className="ui-command-palette-list"
          style={{ overscrollBehavior: 'contain' }}
          onScroll={(event) => {
            if (!canLoadMoreArchivedThreads) {
              return;
            }

            const element = event.currentTarget;
            const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
            if (distanceFromBottom > 96) {
              return;
            }

            setArchivedVisibleLimit((current) => current + THREADS_EMPTY_QUERY_PAGE_SIZE);
          }}
        >
          {visiblePresentationGroups.map((group) => (
            <section key={group.section} className="ui-command-palette-section">
              {query.trim().length === 0 ? <h2 className="ui-command-palette-section-header">{group.label}</h2> : null}
              <div>
                {group.items.map((item) => {
                  runningIndex += 1;
                  const itemIndex = runningIndex;
                  const isSelected = itemIndex === cursor;
                  const isBusy = busyItemId === item.id;
                  const isPinned = item.pinTarget ? pinnedKeys.has(launcherPinKey(item.pinTarget)) : false;
                  const normalizedTitleWithoutOpen = item.title
                    .replace(/^open\s+/i, '')
                    .trim()
                    .toLocaleLowerCase();
                  const normalizedSubtitle = item.subtitle?.trim().toLocaleLowerCase();
                  const showSubtitle =
                    !['applications', 'pages', 'open', 'archived'].includes(item.section) &&
                    Boolean(normalizedSubtitle) &&
                    normalizedSubtitle !== item.title.trim().toLocaleLowerCase() &&
                    normalizedSubtitle !== normalizedTitleWithoutOpen;
                  const titleCollision =
                    item.pinTarget?.kind === 'conversation' && duplicateConversationTitles.has(item.title.trim().toLocaleLowerCase());
                  const collisionOrdinal = duplicateConversationOrdinals.get(item.id);
                  const pageParentAlreadyLabeled = query.trim().length === 0 && group.section.startsWith('pages:');
                  const trailingLabel =
                    item.parentLabel && !pageParentAlreadyLabeled
                      ? titleCollision && item.auxiliaryLabel
                        ? `${item.auxiliaryLabel}${collisionOrdinal ? ` · ${collisionOrdinal}` : ''}`
                        : item.parentLabel
                      : item.section === 'commands'
                        ? item.meta
                        : undefined;

                  return (
                    <div key={item.id} className="ui-command-palette-result-row">
                      <RowButton
                        data-command-palette-idx={itemIndex}
                        onMouseEnter={() => setCursor(itemIndex)}
                        onClick={() => {
                          void activateItem(item);
                        }}
                        disabled={item.disabled || isBusy}
                        selected={isSelected}
                        className={cx('ui-command-palette-result group disabled:cursor-not-allowed', item.disabled && 'opacity-55')}
                        title={item.subtitle ?? item.meta ?? item.title}
                      >
                        <PaletteItemIcon section={item.section} icon={item.icon} />

                        <div className="ui-command-palette-result-copy">
                          <p className="ui-command-palette-result-title">{item.title}</p>
                          {showSubtitle && (
                            <p className="ui-command-palette-result-subtitle" title={item.subtitle}>
                              {item.subtitle}
                            </p>
                          )}
                        </div>

                        {isBusy && <span className="mt-0.5 shrink-0 text-[10px] text-dim/60 font-mono">…</span>}
                        {!isBusy && trailingLabel ? <span className="ui-command-palette-result-owner">{trailingLabel}</span> : null}
                      </RowButton>
                      {!isBusy && item.pinTarget && onToggleLauncherPin ? (
                        <IconButton
                          compact
                          size="sm"
                          className={cx('ui-command-palette-pin', isPinned && 'is-pinned')}
                          aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${item.title}`}
                          title={`${isPinned ? 'Unpin' : 'Pin'} ${item.title}`}
                          data-launcher-secondary-action="true"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePin(item);
                          }}
                        >
                          <LauncherPinIcon />
                        </IconButton>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {scope === THREADS_COMMAND_PALETTE_SCOPE &&
              query.trim().length === 0 &&
              group.section === 'archived' &&
              group.total > group.items.length ? (
                <PanelMessage className="px-2.5 py-2 font-mono text-[11px]">Scroll to load older threads…</PanelMessage>
              ) : null}
            </section>
          ))}

          {displayedLoadingSections.map((section) => (
            <section key={`loading:${section}`} className="pb-2 last:pb-0">
              <PanelMessage className="px-2.5 py-3 font-mono text-[12px]">Loading {labelForSection(section).toLowerCase()}…</PanelMessage>
            </section>
          ))}

          {conversationContentSearchError && scope === THREADS_COMMAND_PALETTE_SCOPE && (
            <section className="pb-2 last:pb-0">
              <PanelMessage tone="danger" className="px-2.5 py-3 text-[12px]">
                Failed to search thread contents: {conversationContentSearchError}
              </PanelMessage>
            </section>
          )}

          {quickOpenError && quickOpenScopeActive && (
            <section className="pb-2 last:pb-0">
              <PanelMessage tone="danger" className="px-2.5 py-3 text-[12px]">
                Failed to load {quickOpenScopeLabel.toLowerCase()}: {quickOpenError}
              </PanelMessage>
            </section>
          )}

          {quickOpenSearchError && quickOpenScopeActive && (
            <section className="pb-2 last:pb-0">
              <PanelMessage tone="danger" className="px-2.5 py-3 text-[12px]">
                Failed to search {quickOpenScopeLabel.toLowerCase()}: {quickOpenSearchError}
              </PanelMessage>
            </section>
          )}

          {extensionSearchError && (
            <section className="pb-2 last:pb-0">
              <PanelMessage tone="danger" className="px-2.5 py-3 text-[12px]">
                Failed to search {activeSearchProvider ? activeSearchProvider.title.toLowerCase() : 'extension content'}:{' '}
                {extensionSearchError}
              </PanelMessage>
            </section>
          )}

          {visibleCount === 0 &&
            displayedLoadingSections.length === 0 &&
            !(conversationContentSearchError && scope === THREADS_COMMAND_PALETTE_SCOPE) &&
            !(quickOpenError && quickOpenScopeActive) &&
            !(quickOpenSearchError && quickOpenScopeActive) &&
            !(extensionSearchError && activeSearchProvider) && (
              <PanelMessage align="center" className="px-4 py-6 font-mono text-[12px]">
                {emptyStateCopy(scope, query)}
              </PanelMessage>
            )}
        </div>
      </div>
    </div>
  );
}
