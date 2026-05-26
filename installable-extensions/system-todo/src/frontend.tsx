import React, { useCallback, useEffect, useMemo, useState } from 'react';

type TodoStatus = 'todo' | 'done';

interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface TodoState {
  schemaVersion: 1;
  updatedAt: string;
  items: TodoItem[];
}

const EMPTY_STATE: TodoState = { schemaVersion: 1, updatedAt: new Date(0).toISOString(), items: [] };

function isDone(item: TodoItem): boolean {
  return item.status === 'done';
}

export function TodoShelf({
  pa,
  shelfContext,
}: {
  pa: {
    extension: { invoke<T = unknown>(action: string, input?: Record<string, unknown>): Promise<T> };
    ui?: { notify?(input: unknown): void };
  };
  shelfContext: { conversationId: string };
}) {
  const conversationId = shelfContext.conversationId;
  const [state, setState] = useState<TodoState>(EMPTY_STATE);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openItems = useMemo(() => state.items.filter((item) => !isDone(item)), [state.items]);
  const doneItems = useMemo(() => state.items.filter(isDone), [state.items]);
  const visibleItems = useMemo(() => [...openItems, ...doneItems], [doneItems, openItems]);

  const invoke = useCallback(
    async <T,>(action: string, input: Record<string, unknown> = {}) => {
      if (!conversationId) throw new Error('Open a conversation to use todos.');
      return pa.extension.invoke<T>(action, { conversationId, ...input });
    },
    [conversationId, pa],
  );

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setState(EMPTY_STATE);
      setLoadedConversationId(null);
      return;
    }
    setError(null);
    try {
      setState(await invoke<TodoState>('getState'));
      setLoadedConversationId(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [conversationId, invoke]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const interval = setInterval(() => {
      invoke<TodoState>('getState')
        .then((next) => {
          if (!cancelled) {
            setState(next);
            setLoadedConversationId(conversationId);
          }
        })
        .catch(() => {
          // Keep the last rendered state. Explicit user actions surface errors.
        });
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [conversationId, invoke]);

  async function run(label: string, action: () => Promise<TodoState>) {
    if (busyId) return;
    setBusyId(label);
    setError(null);
    try {
      setState(await action());
      setLoadedConversationId(conversationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pa.ui?.notify?.({ type: 'error', source: 'Todos', message: 'Todo update failed', details: message });
    } finally {
      setBusyId(null);
    }
  }

  if (!conversationId || loadedConversationId !== conversationId || state.items.length === 0) return null;

  return (
    <div className="border-b border-border-subtle/60 px-3 py-1.5 text-[12px] text-primary">
      <div className="flex h-6 items-center gap-2 text-secondary">
        <button type="button" className="text-[11px] text-dim hover:text-primary" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? '▸' : '▾'}
        </button>
        <span className="font-medium text-primary">Todos</span>
        <span className="text-dim">{`${openItems.length} open${doneItems.length ? ` · ${doneItems.length} done` : ''}`}</span>
        <span className="flex-1" />
        {doneItems.length > 0 ? (
          <button
            type="button"
            className="rounded-md px-1.5 py-0.5 text-[11px] text-secondary hover:bg-base hover:text-primary disabled:opacity-50"
            disabled={Boolean(busyId)}
            onClick={() => void run('clear-done', () => invoke<TodoState>('clearItems', { scope: 'done' }))}
          >
            Clear done
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="max-h-28 overflow-y-auto py-0.5">
          {error ? <div className="rounded-md bg-danger/10 px-2 py-1.5 text-[11px] text-danger">{error}</div> : null}
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="group grid min-h-7 grid-cols-[1.4rem_minmax(0,1fr)_auto] items-center gap-1 rounded-md hover:bg-base/60"
            >
              <button
                type="button"
                className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${
                  isDone(item) ? 'border-success text-success' : 'border-border-strong text-transparent hover:text-secondary'
                }`}
                disabled={Boolean(busyId)}
                title={isDone(item) ? 'Reopen todo' : 'Mark complete'}
                onClick={() =>
                  void run(item.id, () => invoke<TodoState>('updateItem', { id: item.id, status: isDone(item) ? 'todo' : 'done' }))
                }
              >
                ✓
              </button>
              <div className="min-w-0">
                <div className={`truncate ${isDone(item) ? 'text-dim line-through' : 'text-primary'}`}>{item.text}</div>
                {item.note ? <div className="truncate text-[10px] text-dim">{item.note}</div> : null}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[12px] text-secondary hover:bg-surface hover:text-danger"
                  disabled={Boolean(busyId)}
                  title="Delete todo"
                  onClick={() => void run(item.id, () => invoke<TodoState>('deleteItem', { id: item.id }))}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
