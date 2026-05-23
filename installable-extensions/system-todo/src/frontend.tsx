import { useCallback, useEffect, useMemo, useState } from 'react';

type TodoStatus = 'todo' | 'doing' | 'done' | 'blocked';

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

function statusLabel(status: TodoStatus): string {
  if (status === 'doing') return 'doing';
  if (status === 'blocked') return 'blocked';
  if (status === 'done') return 'done';
  return 'todo';
}

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
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setState(await invoke<TodoState>('getState'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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
          if (!cancelled) setState(next);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pa.ui?.notify?.({ type: 'error', source: 'Todos', message: 'Todo update failed', details: message });
    } finally {
      setBusyId(null);
    }
  }

  if (!conversationId || (!loading && state.items.length === 0 && !error)) return null;

  return (
    <div className="mx-2 mb-2 overflow-hidden rounded-xl border border-border-subtle bg-surface/70 text-[12px] text-primary">
      <div className="flex h-8 items-center gap-2 border-b border-border-subtle/70 px-2.5 text-secondary">
        <button type="button" className="text-[11px] text-dim hover:text-primary" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? '▸' : '▾'}
        </button>
        <span className="font-medium text-primary">Todos</span>
        <span className="text-dim">
          {loading ? 'loading…' : `${openItems.length} open${doneItems.length ? ` · ${doneItems.length} done` : ''}`}
        </span>
        <span className="flex-1" />
        {doneItems.length > 0 ? (
          <button
            type="button"
            className="rounded-md px-1.5 py-1 text-[11px] text-secondary hover:bg-base hover:text-primary disabled:opacity-50"
            disabled={Boolean(busyId)}
            onClick={() => void run('clear-done', () => invoke<TodoState>('clearItems', { scope: 'done' }))}
          >
            Clear done
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="max-h-32 overflow-y-auto p-1">
          {error ? <div className="m-1 rounded-md bg-danger/10 px-2 py-1.5 text-[11px] text-danger">{error}</div> : null}
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="group grid min-h-8 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-1 rounded-lg px-1.5 hover:bg-base/70"
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
                {item.status !== 'todo' || item.note ? (
                  <div className="truncate text-[10px] text-dim">
                    {statusLabel(item.status)}
                    {item.note ? ` · ${item.note}` : ''}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {!isDone(item) && item.status !== 'doing' ? (
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-1 text-[11px] text-secondary hover:bg-surface hover:text-primary"
                    disabled={Boolean(busyId)}
                    onClick={() => void run(item.id, () => invoke<TodoState>('updateItem', { id: item.id, status: 'doing' }))}
                  >
                    Doing
                  </button>
                ) : null}
                {!isDone(item) && item.status !== 'blocked' ? (
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-1 text-[11px] text-secondary hover:bg-surface hover:text-warning"
                    disabled={Boolean(busyId)}
                    onClick={() => void run(item.id, () => invoke<TodoState>('updateItem', { id: item.id, status: 'blocked' }))}
                  >
                    Block
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md px-1.5 py-1 text-[12px] text-secondary hover:bg-surface hover:text-danger"
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
