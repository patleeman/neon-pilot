import React, { useCallback, useEffect, useState } from 'react';

interface CodeModeState {
  enabled: boolean;
  active?: boolean | null;
  pending?: boolean;
  running?: boolean | null;
}

export function CodeModeShelf({
  pa,
  shelfContext,
}: {
  pa: {
    extension: { invoke<T = unknown>(action: string, input?: Record<string, unknown>): Promise<T> };
    ui?: { notify?(input: unknown): void };
  };
  shelfContext: { conversationId: string; isLive?: boolean };
}) {
  const conversationId = shelfContext.conversationId;
  const draft = !conversationId;
  const [state, setState] = useState<CodeModeState>({ enabled: false });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await pa.extension.invoke<CodeModeState>('readState', draft ? { draft: true } : { conversationId }));
    } catch {
      setState({ enabled: false });
    }
  }, [conversationId, draft, pa]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      setState(
        await pa.extension.invoke<CodeModeState>(
          'toggleCodeMode',
          draft ? { draft: true, action: 'off' } : { conversationId, action: 'off' },
        ),
      );
      pa.ui?.notify?.({ type: 'info', source: 'Code Mode', message: 'Code mode disabled' });
    } catch (error) {
      pa.ui?.notify?.({
        type: 'error',
        source: 'Code Mode',
        message: 'Could not disable code mode',
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!state.enabled) return null;

  return (
    <div className="border-b border-border-subtle/70 bg-accent-bg/35 px-3 py-1.5 text-[12px] text-primary">
      <div className="flex min-h-6 items-center gap-2">
        <span className="font-medium">Code Mode</span>
        <span className="text-secondary">
          {draft
            ? 'Next new conversation starts with only exec_code exposed.'
            : state.pending
              ? state.running
                ? 'Current turn may still have existing tools; next turn uses exec_code.'
                : 'Pending live tool update; next turn uses exec_code.'
              : 'Only exec_code is exposed to the model.'}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-[11px] text-secondary hover:bg-base hover:text-primary disabled:opacity-50"
          disabled={busy}
          onClick={() => void disable()}
        >
          Turn off
        </button>
      </div>
    </div>
  );
}
