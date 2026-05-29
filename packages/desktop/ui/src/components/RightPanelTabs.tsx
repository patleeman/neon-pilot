import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { useLiveTitles } from '../app/contexts.js';
import { COMPANION_CHAT_CLOSE_EVENT, COMPANION_CHAT_OPEN_EVENT, type CompanionChatOpenDetail } from '../companion/companionEvents.js';
import { useCompanionConversations } from '../companion/useCompanionConversations.js';
import { ChatRail } from './chat/ChatRail.js';
import { ContextRail } from './ContextRail.js';
import { cx } from './ui.js';

const TAB_CONTAINER_CLASS = 'relative z-10 flex-shrink-0 overflow-hidden border-l border-border-subtle bg-panel select-text';

/**
 * Tabbed container for the right panel in compact mode.
 *
 * The first tab is always "Context" (the existing ContextRail).
 * Additional tabs are companion chats opened via fork or the "+" button.
 */
export function RightPanelTabs({
  width,
  conversationId,
  workspaceCwd,
  onDoubleClick: _onDoubleClick,
  onMouseDown: _onMouseDown,
}: {
  width: number;
  conversationId: string | null;
  workspaceCwd: string | null;
  onMouseDown: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const { titles } = useLiveTitles();
  const companion = useCompanionConversations(titles);
  const [tabs, setTabs] = useState<RightPanelTabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('context');
  const [creating, setCreating] = useState(false);

  // Persist the last active tab per main conversation across navigation switches.
  const activeTabByConversationRef = useRef<Record<string, string>>({});

  // Reload companions from storage when the main conversation changes.
  useEffect(() => {
    if (!conversationId) {
      setTabs([]);
      setActiveTabId('context');
      return;
    }

    const stored = companion.loadCompanions(conversationId);
    const restoredTabs = stored.map((c) => ({ id: c.id, kind: 'chat', conversationId: c.conversationId, title: c.title }));
    setTabs(restoredTabs);

    // Check for a preferred companion from sessionStorage (set when starting
    // a side chat from the workbench new tab page).
    const preferredCompanionId = sessionStorage.getItem('np:preferred-companion');
    if (preferredCompanionId) {
      sessionStorage.removeItem('np:preferred-companion');
      if (restoredTabs.some((t) => t.id === preferredCompanionId)) {
        setActiveTabId(preferredCompanionId);
        activeTabByConversationRef.current = {
          ...activeTabByConversationRef.current,
          [conversationId]: preferredCompanionId,
        };
        return;
      }
    }

    // Restore the last active tab for this conversation, if it still exists.
    const lastActive = activeTabByConversationRef.current[conversationId];
    if (lastActive && (lastActive === 'context' || restoredTabs.some((t) => t.id === lastActive))) {
      setActiveTabId(lastActive);
    } else {
      setActiveTabId('context');
    }
  }, [conversationId, companion]);

  // Persist the active tab choice.
  const persistActiveTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      if (conversationId) {
        activeTabByConversationRef.current = {
          ...activeTabByConversationRef.current,
          [conversationId]: tabId,
        };
      }
    },
    [conversationId],
  );

  // Listen for open/close companion events from ConversationPage / TopologyBlock.
  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<CompanionChatOpenDetail>).detail;
      if (!detail?.conversationId) return;

      setTabs((current) => {
        // If already open, just switch to it.
        if (current.some((t) => t.id === detail.conversationId)) {
          persistActiveTab(detail.conversationId);
          return current;
        }
        const newTab: RightPanelTabItem = {
          id: detail.conversationId,
          kind: 'chat',
          conversationId: detail.conversationId,
          title: detail.title ?? 'Side Chat',
        };
        persistActiveTab(detail.conversationId);

        // Register as companion if the main conversation is known.
        if (conversationId) {
          companion.registerCompanion(conversationId, detail.conversationId);
        }

        return [...current, newTab];
      });
    }

    function handleClose(event: Event) {
      const detail = (event as CustomEvent<{ conversationId: string }>).detail;
      if (!detail?.conversationId) return;

      setTabs((current) => {
        const next = current.filter((t) => t.id !== detail.conversationId);
        // If the active tab was closed, switch to context.
        if (activeTabId === detail.conversationId) {
          persistActiveTab('context');
        }
        return next;
      });
      if (conversationId) {
        companion.unregisterCompanion(conversationId, detail.conversationId);
      }
    }

    window.addEventListener(COMPANION_CHAT_OPEN_EVENT, handleOpen);
    window.addEventListener(COMPANION_CHAT_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(COMPANION_CHAT_OPEN_EVENT, handleOpen);
      window.removeEventListener(COMPANION_CHAT_CLOSE_EVENT, handleClose);
    };
  }, [activeTabId, companion, conversationId]);

  // Update titles when live titles change.
  useEffect(() => {
    if (!conversationId) return;
    setTabs((current) =>
      current.map((tab) => {
        if (tab.kind !== 'chat') return tab;
        const title = titles.get(tab.conversationId);
        return title ? { ...tab, title } : tab;
      }),
    );
  }, [titles, conversationId]);

  const handleNewChat = useCallback(async () => {
    if (!conversationId) return;
    setCreating(true);
    try {
      const newId = await companion.createCompanion(conversationId, workspaceCwd);
      if (newId) {
        setTabs((current) => {
          const newTab: RightPanelTabItem = { id: newId, kind: 'chat', conversationId: newId, title: 'Side Chat' };
          persistActiveTab(newId);
          return [...current, newTab];
        });
      }
    } finally {
      setCreating(false);
    }
  }, [companion, conversationId, workspaceCwd]);

  const handleCloseTab = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setTabs((current) => {
        const next = current.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          persistActiveTab('context');
        }
        return next;
      });
      if (conversationId) {
        companion.unregisterCompanion(conversationId, tabId);
      }
    },
    [activeTabId, companion, conversationId],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  return (
    <aside style={{ width }} className={TAB_CONTAINER_CLASS} aria-label="Conversation panel">
      {/* Tab strip */}
      <div className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border-subtle bg-base px-1.5">
        {/* Context tab */}
        <TabButton label="Context" active={activeTabId === 'context'} onClick={() => persistActiveTab('context')} />

        {/* Companion chat tabs */}
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.title}
            active={activeTabId === tab.id}
            onClick={() => persistActiveTab(tab.id)}
            onClose={(e) => handleCloseTab(tab.id, e)}
          />
        ))}

        {/* New chat button */}
        <button
          type="button"
          onClick={handleNewChat}
          disabled={!conversationId || creating}
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-[15px] text-secondary transition hover:bg-surface hover:text-primary disabled:opacity-30"
          title={conversationId ? 'New side chat' : 'Open a conversation first'}
          aria-label="New side chat"
        >
          +
        </button>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTabId === 'context' ? (
          <Suspense fallback={<div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading…</div>}>
            <ContextRail />
          </Suspense>
        ) : activeTab?.kind === 'chat' ? (
          <ChatRail key={activeTab.conversationId} conversationId={activeTab.conversationId} workspaceCwd={workspaceCwd} />
        ) : null}
      </div>
    </aside>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
  onClose,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onClose?: (event: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative flex max-w-[160px] shrink-0 items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cx(
          'flex min-w-0 items-center gap-1 rounded-t px-2 py-1.5 pr-5 text-[12px] font-medium transition',
          active ? 'bg-panel text-primary' : 'text-secondary hover:bg-surface/60 hover:text-primary',
        )}
      >
        <span className="truncate">{label}</span>
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cx(
            'absolute right-0.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-[11px] transition',
            hovered || active ? 'text-dim hover:bg-surface-2 hover:text-primary opacity-100' : 'opacity-0',
          )}
          aria-label={`Close ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RightPanelTabItem {
  id: string;
  kind: 'chat' | 'context';
  conversationId: string;
  title: string;
}
