import { CheckButton, IconButton, Notice, TaskListItem } from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type TodoStatus = 'todo' | 'doing' | 'blocked' | 'done';

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
const todoStateCache = new Map<string, TodoState>();
const todoStateLoadCache = new Map<string, Promise<TodoState>>();

function isDone(item: TodoItem): boolean {
  return item.status === 'done';
}

function cacheKey(conversationId: string, metadataVersion: unknown): string {
  return `${conversationId}:${typeof metadataVersion === 'number' || typeof metadataVersion === 'string' ? metadataVersion : 'unversioned'}`;
}

function normalizeTodoState(value: unknown): TodoState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_STATE;
  }

  const record = value as Partial<TodoState>;
  return {
    schemaVersion: 1,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : EMPTY_STATE.updatedAt,
    items: Array.isArray(record.items) ? record.items : [],
  };
}

export function clearTodoShelfStateCacheForTests(): void {
  todoStateCache.clear();
  todoStateLoadCache.clear();
}

export function TodoShelf({
  pa,
  shelfContext,
}: {
  pa: {
    extension: { invoke<T = unknown>(action: string, input?: Record<string, unknown>): Promise<T> };
    ui?: { notify?(input: unknown): void };
  };
  shelfContext: { conversationId: string; metadataVersion?: number | string };
}) {
  const conversationId = shelfContext.conversationId;
  const activeCacheKey = conversationId ? cacheKey(conversationId, shelfContext.metadataVersion) : null;
  const cachedState = activeCacheKey ? todoStateCache.get(activeCacheKey) : undefined;
  const [state, setState] = useState<TodoState>(cachedState ?? EMPTY_STATE);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(cachedState ? conversationId : null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const paRef = useRef(pa);
  paRef.current = pa;
  const activeCacheKeyRef = useRef(activeCacheKey);
  activeCacheKeyRef.current = activeCacheKey;

  const openItems = useMemo(() => state.items.filter((item) => !isDone(item)), [state.items]);

  const invoke = useCallback(
    async <T,>(action: string, input: Record<string, unknown> = {}) => {
      if (!conversationId) throw new Error('Open a conversation to use todos.');
      return paRef.current.extension.invoke<T>(action, { conversationId, ...input });
    },
    [conversationId],
  );

  const refresh = useCallback(async () => {
    const key = activeCacheKey;
    if (!conversationId) {
      setState(EMPTY_STATE);
      setLoadedConversationId(null);
      return;
    }
    const cached = key ? todoStateCache.get(key) : undefined;
    if (cached) {
      setState(cached);
      setLoadedConversationId(conversationId);
      return;
    }

    setError(null);
    try {
      const load =
        key && todoStateLoadCache.has(key)
          ? (todoStateLoadCache.get(key) as Promise<TodoState>)
          : invoke<TodoState>('getState')
              .then(normalizeTodoState)
              .finally(() => {
                if (key) todoStateLoadCache.delete(key);
              });
      if (key && !todoStateLoadCache.has(key)) {
        todoStateLoadCache.set(key, load);
      }
      const nextState = await load;
      if (activeCacheKeyRef.current !== key) {
        return;
      }
      if (key && nextState.items.length > 0) {
        todoStateCache.set(key, nextState);
      } else if (key) {
        todoStateCache.delete(key);
      }
      setState(nextState);
      setLoadedConversationId(conversationId);
    } catch (err) {
      if (activeCacheKeyRef.current !== key) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeCacheKey, conversationId, invoke]);

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
            const normalized = normalizeTodoState(next);
            if (activeCacheKey && normalized.items.length > 0) {
              todoStateCache.set(activeCacheKey, normalized);
            } else if (activeCacheKey) {
              todoStateCache.delete(activeCacheKey);
            }
            setState(normalized);
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
  }, [activeCacheKey, conversationId, invoke]);

  async function run(label: string, action: () => Promise<TodoState>) {
    if (busyId) return;
    setBusyId(label);
    setError(null);
    try {
      const nextState = normalizeTodoState(await action());
      if (activeCacheKey && nextState.items.length > 0) {
        todoStateCache.set(activeCacheKey, nextState);
      } else if (activeCacheKey) {
        todoStateCache.delete(activeCacheKey);
      }
      setState(nextState);
      setLoadedConversationId(conversationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      paRef.current.ui?.notify?.({ type: 'error', source: 'Todos', message: 'Todo update failed', details: message });
    } finally {
      setBusyId(null);
    }
  }

  if (!conversationId || loadedConversationId !== conversationId || openItems.length === 0) return null;

  return (
    <div className="border-b border-border-subtle/60 px-3 py-1.5 text-[12px] text-primary">
      <div className="flex h-6 items-center gap-2 text-secondary">
        <IconButton
          compact
          type="button"
          className="text-[11px] text-dim hover:text-primary"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand todos' : 'Collapse todos'}
        >
          {collapsed ? '▸' : '▾'}
        </IconButton>
        <span className="font-medium text-primary">Todos</span>
        <span className="text-dim">{`${openItems.length} open`}</span>
        <span className="flex-1" />
      </div>

      {!collapsed ? (
        <div className="max-h-28 overflow-y-auto py-0.5">
          {error ? (
            <Notice tone="danger" className="px-2 py-1.5 text-[11px]">
              {error}
            </Notice>
          ) : null}
          {openItems.map((item) => (
            <TaskListItem
              key={item.id}
              checked={isDone(item)}
              label={item.text}
              detail={[item.status === 'doing' ? 'In progress' : item.status === 'blocked' ? 'Blocked' : null, item.note]
                .filter(Boolean)
                .join(' — ')}
              control={
                <CheckButton
                  checked={isDone(item)}
                  disabled={Boolean(busyId)}
                  title={isDone(item) ? 'Reopen todo' : 'Mark complete'}
                  aria-label={isDone(item) ? 'Reopen todo' : 'Mark complete'}
                  onClick={() =>
                    void run(item.id, () => invoke<TodoState>('updateItem', { id: item.id, status: isDone(item) ? 'todo' : 'done' }))
                  }
                />
              }
              actions={
                <IconButton
                  compact
                  className="text-[12px] text-secondary"
                  disabled={Boolean(busyId)}
                  title="Delete todo"
                  aria-label="Delete todo"
                  onClick={() => void run(item.id, () => invoke<TodoState>('deleteItem', { id: item.id }))}
                >
                  ×
                </IconButton>
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
