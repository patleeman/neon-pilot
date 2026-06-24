import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { api } from '../client/api';
import {
  COMMAND_PALETTE_SCOPE_OPTIONS,
  COMMAND_PALETTE_SECTION_LABELS,
  type CommandPaletteItem,
  type CommandPaletteScope,
  type CommandPaletteSection,
  isCommandPaletteThreadDataLoading,
  isHostCommandDisabledInPalette,
  searchCommandPaletteItems,
  selectCommandPaletteScopedItems,
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
import { canExecuteExtensionCommand, EXTENSION_COMMAND_CONTEXT_CHANGED_EVENT, listHostCommands } from '../extensions/commands';
import { systemExtensionModules } from '../extensions/systemExtensionModules';
import type {
  ExtensionCommandRegistration,
  ExtensionQuickOpenRegistration,
  ExtensionSearchProviderRegistration,
} from '../extensions/types';
import { useConversations } from '../hooks/useConversations';
import type { ConversationContentSearchMatch } from '../shared/types';
import { useAllSessions, useSessionsReady } from '../store';
import { cx, RowButton, SegmentedControl } from './ui';

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
  const sessionsReady = useSessionsReady();
  const { pinnedSessions, tabs, archivedSessions, openSession, loading: sessionsLoading, refetch } = useConversations();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CommandPaletteScope>(THREADS_COMMAND_PALETTE_SCOPE);
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
    const commandOptions = {
      navigate,
      openCommandPalette: () => undefined,
      openRightRail: () => false,
      setLayout: () => undefined,
      activeConversationId,
      extensionCommands,
      invokeExtensionCommand: async () => undefined,
      context: { route: location.pathname },
    };
    const hostItems = listHostCommands().map((command, index) => {
      return {
        id: `host-command:${command.id}`,
        section: 'commands',
        title: command.title,
        subtitle: command.id,
        meta: command.category,
        keywords: [command.id, command.category].filter((keyword): keyword is string => typeof keyword === 'string'),
        order: index,
        disabled: isHostCommandDisabledInPalette(command.id, { activeConversationId, context: commandOptions.context }),
        action: { kind: 'command' as const, command: command.id },
      };
    });
    const extensionItems = extensionCommands.map((command, index) => ({
      id: `extension-command:${command.extensionId}:${command.surfaceId}`,
      section: 'commands',
      title: command.title,
      subtitle: `${command.extensionId}.${command.surfaceId}`,
      meta: command.category ?? command.extensionId,
      keywords: [command.surfaceId, command.extensionId, command.category, command.description].filter(
        (keyword): keyword is string => typeof keyword === 'string',
      ),
      order: hostItems.length + index,
      disabled: !canExecuteExtensionCommand(`${command.extensionId}.${command.surfaceId}`, command.args, commandOptions),
      action: { kind: 'command' as const, command: `${command.extensionId}.${command.surfaceId}`, args: command.args },
    }));
    return [...hostItems, ...extensionItems];
  }, [commandContextRevision, extensionCommands, location.pathname, navigate]);
  const fileItems = scope === COMMANDS_COMMAND_PALETTE_SCOPE ? commandItems : quickOpenItems;
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
  const searchProviderScopes = useMemo(
    () => extensionSearchProviders.map((provider) => ({ value: provider.id, label: provider.title })),
    [extensionSearchProviders],
  );
  const quickOpenScopeLabel = quickOpenScopes.find((option) => option.value === scope)?.label ?? 'items';
  const scopeOptions = useMemo(
    () => [
      ...COMMAND_PALETTE_SCOPE_OPTIONS,
      { value: COMMANDS_COMMAND_PALETTE_SCOPE, label: 'Commands' },
      ...quickOpenScopes.map(({ value, label }) => ({ value, label })),
      ...searchProviderScopes,
    ],
    [quickOpenScopes, searchProviderScopes],
  );
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
      searchedFileItems: extensionSearchItems.length > 0 ? extensionSearchItems : searchedFileItems,
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

  const emptyQueryLimits = useMemo(
    () => (scope === THREADS_COMMAND_PALETTE_SCOPE && query.trim().length === 0 ? { archived: archivedVisibleLimit } : undefined),
    [archivedVisibleLimit, query, scope],
  );
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
  const visibleItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setBusyItemId(null);
    setActionError(null);
  }, []);

  const openPalette = useCallback((options: OpenCommandPaletteDetail = {}) => {
    setQuery(options.query ?? '');
    setScope(options.scope ?? THREADS_COMMAND_PALETTE_SCOPE);
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
    scope === THREADS_COMMAND_PALETTE_SCOPE &&
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
  const shouldSearchExtensionProvider = open && Boolean(activeSearchProvider) && query.trim().length > 0;
  const quickOpenScopeActive = scope !== THREADS_COMMAND_PALETTE_SCOPE && scope !== COMMANDS_COMMAND_PALETTE_SCOPE && !activeSearchProvider;
  const shouldSearchQuickOpenByContent = open && quickOpenScopeActive && query.trim().length > 0;

  const shouldSearchConversationsByContent = open && scope === THREADS_COMMAND_PALETTE_SCOPE && query.trim().length > 0;

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
    if (!shouldSearchExtensionProvider || !activeSearchProvider) {
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
        .extensionSearch({ query: query.trim(), limit: FILE_SEARCH_LIMIT, providerId: activeSearchProvider.id })
        .then((result: { providers: ExtensionSearchProviderRegistration[]; items: ExtensionSearchItem[] }) => {
          if (cancelled) return;
          setExtensionSearchItems(
            result.items.flatMap((item: ExtensionSearchItem, index: number) => {
              const provider =
                result.providers.find((candidate: ExtensionSearchProviderRegistration) => candidate.id === item.providerId) ??
                activeSearchProvider;
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

      return Math.max(0, Math.min(current, visibleItems.length - 1));
    });
  }, [open, visibleItems.length]);

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

      if (event.key === 'Tab') {
        event.preventDefault();
        const scopeValues = scopeOptions.map((option) => option.value);
        const currentIndex = scopeValues.indexOf(scope);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + scopeValues.length) % scopeValues.length;
        const nextScope = scopeValues[nextIndex];
        setScope(nextScope);
        setCursor(0);
        setActionError(null);
        setArchivedVisibleLimit(THREADS_EMPTY_QUERY_PAGE_SIZE);
        window.requestAnimationFrame(() => inputRef.current?.focus());
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
  }, [activateItem, closePalette, cursor, open, scope, scopeOptions, visibleItems]);

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
      if (scope === THREADS_COMMAND_PALETTE_SCOPE) {
        for (const section of THREAD_COMMAND_PALETTE_SECTIONS) {
          sections.add(section);
        }
      }
    }

    if (conversationContentSearchLoading && scope === THREADS_COMMAND_PALETTE_SCOPE) {
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
  const showSectionHeaders = groups.length > 1;
  const labelForSection = useCallback(
    (section: CommandPaletteSection) => quickOpenSectionLabels[section] ?? COMMAND_PALETTE_SECTION_LABELS[section] ?? section,
    [quickOpenSectionLabels],
  );
  const searchPlaceholder = scope === THREADS_COMMAND_PALETTE_SCOPE ? 'Search threads…' : `Open ${labelForSection(scope).toLowerCase()}…`;

  if (!open) {
    return null;
  }

  const anchoredPanelWidth = anchorRect ? Math.min(anchorRect.width, window.innerWidth - 32) : undefined;
  const anchoredPanelLeft =
    anchorRect && anchoredPanelWidth ? Math.min(Math.max(16, anchorRect.left), window.innerWidth - anchoredPanelWidth - 16) : undefined;
  let runningIndex = -1;

  return (
    <div
      className="ui-overlay-backdrop"
      data-command-palette="true"
      style={{
        background: 'transparent',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: anchorRect ? 0 : '5.5rem 1.75rem 1.75rem',
      }}
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
        className="ui-dialog-shell"
        style={{
          position: anchorRect ? 'fixed' : undefined,
          left: anchoredPanelLeft !== undefined ? `${anchoredPanelLeft}px` : undefined,
          top: anchorRect ? `${anchorRect.top}px` : undefined,
          width: anchoredPanelWidth !== undefined ? `${anchoredPanelWidth}px` : undefined,
          maxWidth: anchorRect ? undefined : '560px',
          maxHeight: anchorRect ? `min(560px, calc(100vh - ${anchorRect.top + 12}px))` : 'min(560px, calc(100vh - 7rem))',
          overscrollBehavior: 'contain',
        }}
      >
        <div className={cx('border-b border-border-subtle px-4 py-3.5', anchorRect && 'px-2.5 pb-2 pt-0')}>
          <div className={cx('flex items-center gap-2 min-w-0', anchorRect && 'h-7')}>
            <span className="text-[13px] text-dim">⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
                setActionError(null);
                setArchivedVisibleLimit(THREADS_EMPTY_QUERY_PAGE_SIZE);
              }}
              placeholder={anchorRect ? 'Search threads, models, settings…' : searchPlaceholder}
              aria-label="Search command palette"
              className={cx(
                'min-w-0 flex-1 bg-transparent text-primary placeholder:text-dim outline-none',
                anchorRect ? 'font-mono text-[11px] tracking-[0.05em]' : 'text-[15px]',
              )}
            />
            <span className="shrink-0 rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[10px] text-dim">
              {macPlatform ? '⌘K' : 'Ctrl+K'}
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <SegmentedControl
              value={scope}
              options={scopeOptions}
              ariaLabel="Command palette scope"
              className="font-mono text-[10px]"
              onChange={(nextScope) => {
                setScope(nextScope);
                setCursor(0);
                setActionError(null);
                setArchivedVisibleLimit(THREADS_EMPTY_QUERY_PAGE_SIZE);
                window.requestAnimationFrame(() => inputRef.current?.focus());
              }}
            />

            <div className="flex items-center gap-2 font-mono text-[10px] text-dim/70">
              <span>{visibleCount > 0 ? `${cursor + 1}/${visibleCount}` : '0/0'}</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </div>

          {actionError && <p className="pt-2 text-[11px] text-danger">{actionError}</p>}
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-1.5 py-1.5"
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
          {groups.map((group) => (
            <section key={group.section} className="pb-1 last:pb-0">
              {showSectionHeaders && (
                <div className="px-2.5 pb-0.5 flex items-center gap-2">
                  <p className="ui-section-label">{group.label}</p>
                  <span className="ui-section-count">
                    {group.items.length}
                    {group.total > group.items.length ? `/${group.total}` : ''}
                  </span>
                </div>
              )}

              {group.items.map((item) => {
                runningIndex += 1;
                const itemIndex = runningIndex;
                const isSelected = itemIndex === cursor;
                const isBusy = busyItemId === item.id;
                const secondaryText = [item.subtitle, item.meta].filter(Boolean).join(' · ');

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
                      'group flex w-full items-start gap-2 px-2.5 py-1.5 disabled:cursor-not-allowed',
                      isSelected && 'text-accent',
                      item.disabled && 'opacity-55',
                    )}
                    title={item.subtitle ?? item.title}
                  >
                    <span
                      className={cx(
                        'mt-[3px] h-3.5 w-px shrink-0 rounded-full transition-colors',
                        isSelected ? 'bg-accent' : 'bg-border-subtle',
                      )}
                    />

                    <div className="min-w-0 flex-1">
                      <p className={cx('truncate text-[13px] leading-[1.2]', isSelected ? 'text-accent' : 'text-primary')}>{item.title}</p>
                      {secondaryText && (
                        <p className="mt-px truncate text-[10.5px] leading-[1.15] text-secondary" title={secondaryText}>
                          {secondaryText}
                        </p>
                      )}
                    </div>

                    {isBusy && <span className="mt-0.5 shrink-0 text-[10px] text-dim/60 font-mono">…</span>}
                  </RowButton>
                );
              })}

              {scope === THREADS_COMMAND_PALETTE_SCOPE &&
              query.trim().length === 0 &&
              group.section === 'archived' &&
              group.total > group.items.length ? (
                <p className="px-2.5 py-2 text-[11px] text-dim font-mono">Scroll to load older threads…</p>
              ) : null}
            </section>
          ))}

          {loadingSections.map((section) => (
            <section key={`loading:${section}`} className="pb-2 last:pb-0">
              {showSectionHeaders && (
                <div className="px-2.5 pb-1 flex items-center gap-2">
                  <p className="ui-section-label">{labelForSection(section)}</p>
                </div>
              )}
              <p className="px-2.5 py-3 text-[12px] text-dim font-mono">Loading {labelForSection(section).toLowerCase()}…</p>
            </section>
          ))}

          {conversationContentSearchError && scope === THREADS_COMMAND_PALETTE_SCOPE && (
            <section className="pb-2 last:pb-0">
              <p className="px-2.5 py-3 text-[12px] text-danger">Failed to search thread contents: {conversationContentSearchError}</p>
            </section>
          )}

          {quickOpenError && quickOpenScopeActive && (
            <section className="pb-2 last:pb-0">
              <p className="px-2.5 py-3 text-[12px] text-danger">
                Failed to load {quickOpenScopeLabel.toLowerCase()}: {quickOpenError}
              </p>
            </section>
          )}

          {quickOpenSearchError && quickOpenScopeActive && (
            <section className="pb-2 last:pb-0">
              <p className="px-2.5 py-3 text-[12px] text-danger">
                Failed to search {quickOpenScopeLabel.toLowerCase()}: {quickOpenSearchError}
              </p>
            </section>
          )}

          {extensionSearchError && activeSearchProvider && (
            <section className="pb-2 last:pb-0">
              <p className="px-2.5 py-3 text-[12px] text-danger">
                Failed to search {activeSearchProvider.title.toLowerCase()}: {extensionSearchError}
              </p>
            </section>
          )}

          {visibleCount === 0 &&
            loadingSections.length === 0 &&
            !(conversationContentSearchError && scope === THREADS_COMMAND_PALETTE_SCOPE) &&
            !(quickOpenError && quickOpenScopeActive) &&
            !(quickOpenSearchError && quickOpenScopeActive) &&
            !(extensionSearchError && activeSearchProvider) && (
              <p className="px-4 py-10 text-center font-mono text-[12px] text-dim">{emptyStateCopy(scope, query)}</p>
            )}
        </div>
      </div>
    </div>
  );
}
