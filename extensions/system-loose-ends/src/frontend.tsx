import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { useCallback, useEffect, useMemo, useState } from 'react';

type LooseEndStatus = 'open' | 'resolved' | 'dismissed';

interface LooseEndItem {
  id: string;
  text: string;
  status: LooseEndStatus;
  createdAt: string;
  updatedAt: string;
}

interface LooseEndsState {
  schemaVersion: 1;
  enabled: boolean;
  updatedAt: string;
  items: LooseEndItem[];
}

const EMPTY_STATE: LooseEndsState = { schemaVersion: 1, enabled: false, updatedAt: new Date(0).toISOString(), items: [] };

function formatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusLabel(status: LooseEndStatus): string {
  if (status === 'resolved') return 'Resolved';
  if (status === 'dismissed') return 'Dismissed';
  return 'Open';
}

export function LooseEndsPanel({ pa, context }: ExtensionSurfaceProps) {
  const conversationId = context.conversationId;
  const [state, setState] = useState<LooseEndsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  const openItems = useMemo(() => state.items.filter((item) => item.status === 'open'), [state.items]);
  const visibleItems = useMemo(
    () => (showClosed ? state.items : state.items.filter((item) => item.status === 'open')),
    [showClosed, state.items],
  );

  const invoke = useCallback(
    async <T,>(action: string, input: Record<string, unknown> = {}) => {
      if (!conversationId) throw new Error('Open a conversation to use Loose Ends.');
      return (await pa.extension.invoke(action, { conversationId, ...input })) as T;
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
      setState(await invoke<LooseEndsState>('getState'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [conversationId, invoke]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<LooseEndsState>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setState(await action());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pa.ui.notify({ type: 'error', source: 'Loose Ends', message: 'Loose Ends update failed', details: message });
    } finally {
      setBusy(false);
    }
  }

  if (!conversationId) {
    return (
      <div className="space-y-3 p-4 text-[13px] text-secondary">
        <h2 className="text-[15px] font-semibold text-primary">Loose Ends</h2>
        <p>Open a conversation to capture context that would otherwise be lost.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-[13px] text-primary">
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-[15px] font-semibold tracking-tight">Loose Ends</h2>
            <p className="text-[12px] leading-5 text-secondary">Out-of-band context worth remembering. Not a work log.</p>
          </div>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-[12px] transition-colors ${
              state.enabled ? 'border-accent text-accent' : 'border-border-subtle text-secondary hover:text-primary'
            }`}
            disabled={busy || loading}
            onClick={() => void run(() => invoke<LooseEndsState>('setEnabled', { enabled: !state.enabled }))}
          >
            {state.enabled ? 'On' : 'Off'}
          </button>
        </div>
        {state.updatedAt !== EMPTY_STATE.updatedAt ? (
          <div className="mt-2 text-[11px] text-dim">Updated {formatTime(state.updatedAt)}</div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div> : null}

        <div className="space-y-2">
          <textarea
            className="min-h-[88px] w-full resize-y rounded-md border border-border-subtle bg-surface px-3 py-2 text-[13px] leading-5 text-primary outline-none placeholder:text-dim focus:border-accent"
            placeholder="Assumptions, non-obvious tradeoffs, surprises, nearby bugs, follow-ups, risks..."
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-dim">{openItems.length} open</span>
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground disabled:opacity-50"
              disabled={busy || !draft.trim()}
              onClick={() =>
                void run(async () => {
                  const next = await invoke<LooseEndsState>('addItem', { text: draft });
                  setDraft('');
                  return next;
                })
              }
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-dim">Items</h3>
          <button type="button" className="text-[12px] text-secondary hover:text-primary" onClick={() => setShowClosed((value) => !value)}>
            {showClosed ? 'Hide closed' : 'Show closed'}
          </button>
        </div>

        {loading ? <div className="text-[12px] text-secondary">Loading…</div> : null}
        {!loading && visibleItems.length === 0 ? (
          <div className="space-y-2 py-6 text-center text-[12px] leading-5 text-secondary">
            <p>No loose ends yet.</p>
            <p>Capture only context that would help later and is easy to miss in the transcript.</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {visibleItems.map((item) => (
            <div key={item.id} className="space-y-2 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
              <textarea
                className="w-full resize-y rounded-md border border-transparent bg-transparent p-0 text-[13px] leading-5 text-primary outline-none focus:border-border-subtle focus:bg-surface focus:p-2"
                value={item.text}
                disabled={busy}
                onChange={(event) => {
                  const text = event.target.value;
                  setState((current) => ({
                    ...current,
                    items: current.items.map((candidate) => (candidate.id === item.id ? { ...candidate, text } : candidate)),
                  }));
                }}
                onBlur={(event) => {
                  const text = event.target.value.trim();
                  if (text) void run(() => invoke<LooseEndsState>('updateItem', { id: item.id, text }));
                }}
              />
              <div className="flex items-center justify-between gap-2 text-[11px] text-dim">
                <span>
                  {statusLabel(item.status)} · {formatTime(item.updatedAt)}
                </span>
                <div className="flex items-center gap-2">
                  {item.status === 'open' ? (
                    <>
                      <button
                        type="button"
                        className="hover:text-success"
                        onClick={() => void run(() => invoke<LooseEndsState>('updateItem', { id: item.id, status: 'resolved' }))}
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        className="hover:text-warning"
                        onClick={() => void run(() => invoke<LooseEndsState>('updateItem', { id: item.id, status: 'dismissed' }))}
                      >
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="hover:text-primary"
                      onClick={() => void run(() => invoke<LooseEndsState>('updateItem', { id: item.id, status: 'open' }))}
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    className="hover:text-danger"
                    onClick={() => void run(() => invoke<LooseEndsState>('deleteItem', { id: item.id }))}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
