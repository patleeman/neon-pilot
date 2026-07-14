import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { APPLICATION_ACTIVATE_EVENT } from '../applications/applicationEvents';
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
import { ApplicationIcon, PaletteItemIcon } from './ApplicationIcon';
import { cx, Keycap, PanelMessage, RowButton, SearchInput, SectionLabel } from './ui';

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

export function CommandPalette() {
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
          subtitle: application.description,
          meta: 'Application',
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
        subtitle: extensionRegistry.applications.find((application) => application.id === item.applicationId)?.title,
        meta: 'Page',
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
      return { applications: 6, pages: 5, open: 5, commands: 4, archived: 0 };
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
  const presentationGroups = useMemo(() => {
    if (scope !== ALL_COMMAND_PALETTE_SCOPE || query.trim().length === 0) return groups;
    const items = groups
      .flatMap((group) => group.items)
      .sort((left, right) => right.score - left.score || (left.order ?? 0) - (right.order ?? 0));
    return items.length > 0 ? [{ section: 'results', label: 'Results', total: items.length, items }] : [];
  }, [groups, query, scope]);
  const visibleItems = useMemo(() => presentationGroups.flatMap((group) => group.items), [presentationGroups]);
  const preferredCursor = useMemo(() => selectPreferredCommandPaletteCursor(visibleItems, query), [query, visibleItems]);

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
  const showSectionHeaders = presentationGroups.length > 1 || query.trim().length === 0;
  const displayedLoadingSections = scope === ALL_COMMAND_PALETTE_SCOPE && visibleCount > 0 ? [] : loadingSections;
  const labelForSection = useCallback(
    (section: CommandPaletteSection) => quickOpenSectionLabels[section] ?? COMMAND_PALETTE_SECTION_LABELS[section] ?? section,
    [quickOpenSectionLabels],
  );
  const searchPlaceholder = 'Search applications, pages, conversations, and actions…';

  if (!open) {
    return null;
  }

  let runningIndex = -1;

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
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="ui-dialog-shell ui-command-palette-shell"
        style={{ overscrollBehavior: 'contain' }}
      >
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
              aria-label="Search command palette"
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
          {presentationGroups.map((group) => (
            <section
              key={group.section}
              className={cx(
                'ui-command-palette-section',
                group.section === 'applications' && query.trim().length === 0 && 'is-applications',
              )}
            >
              {showSectionHeaders && (
                <div className="ui-command-palette-section-header">
                  <SectionLabel>{group.label}</SectionLabel>
                </div>
              )}

              <div className={cx(group.section === 'applications' && query.trim().length === 0 && 'ui-command-palette-app-grid')}>
                {group.items.map((item) => {
                  runningIndex += 1;
                  const itemIndex = runningIndex;
                  const isSelected = itemIndex === cursor;
                  const isBusy = busyItemId === item.id;
                  const isApplicationCard = item.section === 'applications' && query.trim().length === 0;
                  const application = item.id.startsWith('application:')
                    ? extensionRegistry.applications.find((candidate) => candidate.id === item.id.slice('application:'.length))
                    : undefined;
                  const typeLabel =
                    item.section === 'applications'
                      ? 'Application'
                      : item.section === 'pages'
                        ? 'Page'
                        : item.section === 'open' || item.section === 'archived'
                          ? 'Thread'
                          : item.meta || 'Action';

                  return (
                    <RowButton
                      key={item.id}
                      data-command-palette-idx={itemIndex}
                      onMouseEnter={() => setCursor(itemIndex)}
                      onClick={() => {
                        void activateItem(item);
                      }}
                      disabled={item.disabled || isBusy}
                      selected={isSelected}
                      className={cx(
                        'ui-command-palette-result group disabled:cursor-not-allowed',
                        isApplicationCard && 'ui-command-palette-app-card',
                        item.disabled && 'opacity-55',
                      )}
                      title={item.subtitle ?? item.meta ?? item.title}
                    >
                      {application ? (
                        <ApplicationIcon icon={application.icon} title={application.title} className="ui-application-icon--palette" />
                      ) : (
                        <PaletteItemIcon section={item.section} />
                      )}

                      <div className="ui-command-palette-result-copy">
                        <p className="ui-command-palette-result-title">{item.title}</p>
                        {item.subtitle && (
                          <p className="ui-command-palette-result-subtitle" title={item.subtitle}>
                            {item.subtitle}
                          </p>
                        )}
                      </div>

                      {isBusy && <span className="mt-0.5 shrink-0 text-[10px] text-dim/60 font-mono">…</span>}
                      {!isApplicationCard && !isBusy ? <span className="ui-command-palette-result-type">{typeLabel}</span> : null}
                      {!isApplicationCard && isSelected ? <span className="ui-command-palette-result-enter">↵</span> : null}
                    </RowButton>
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
              {showSectionHeaders && (
                <div className="px-2.5 pb-1 flex items-center gap-2">
                  <SectionLabel>{labelForSection(section)}</SectionLabel>
                </div>
              )}
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
        <div className="ui-command-palette-footer">
          <span>{visibleCount > 0 ? `${visibleCount} results` : 'No results'}</span>
          <div className="ui-command-palette-shortcuts">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
