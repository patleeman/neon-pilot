import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { CenteredMessage, IconButton, Notice, TextButton } from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ScratchpadState {
  conversationId: string;
  content: string;
  updatedAt: string | null;
}

function normalizeState(value: unknown, conversationId: string): ScratchpadState {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<ScratchpadState>) : {};
  return {
    conversationId,
    content: typeof record.content === 'string' ? record.content : '',
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
}

export function ScratchpadPanel({ pa, context }: ExtensionSurfaceProps) {
  const conversationId = context.conversationId ?? '';
  const [state, setState] = useState<ScratchpadState>(() => normalizeState(null, conversationId));
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const paRef = useRef(pa);
  const loadRequestIdRef = useRef(0);
  paRef.current = pa;

  const dirty = draft !== state.content;

  const load = useCallback(async () => {
    const requestId = (loadRequestIdRef.current += 1);
    if (!conversationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = normalizeState(await paRef.current.extension.invoke('getScratchpad', { conversationId }), conversationId);
      if (loadRequestIdRef.current !== requestId) return;
      setState(next);
      setDraft(next.content);
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (loadRequestIdRef.current === requestId) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setSavedMessage(null);
    setState(normalizeState(null, conversationId));
    setDraft('');
    void load();
  }, [conversationId, load]);

  async function save(content: string) {
    if (!conversationId || saving) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const next = normalizeState(await paRef.current.extension.invoke('setScratchpad', { conversationId, content }), conversationId);
      setState(next);
      setDraft(next.content);
      setSavedMessage(content.trim() ? 'Saved' : 'Cleared');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      paRef.current.ui?.notify?.({ type: 'error', source: 'Scratchpad', message: 'Scratchpad update failed', details: message });
    } finally {
      setSaving(false);
    }
  }

  if (!conversationId) {
    return (
      <CenteredMessage
        eyebrow="Scratchpad"
        title="Open a conversation"
        body="Scratchpad notes are scoped to one conversation and follow that thread across compaction and restarts."
      />
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-base text-primary">
      <header className="border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">Scratchpad</h2>
            <p className="truncate text-[11px] text-muted">
              {state.updatedAt ? `Updated ${new Date(state.updatedAt).toLocaleString()}` : loading ? 'Loading...' : 'No saved notes'}
            </p>
          </div>
          <IconButton compact aria-label="Refresh scratchpad" title="Refresh scratchpad" disabled={loading || saving} onClick={() => void load()}>
            ↻
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {error ? (
          <Notice tone="danger" className="text-[12px]">
            {error}
          </Notice>
        ) : null}
        {savedMessage ? (
          <Notice tone="success" className="text-[12px]">
            {savedMessage}
          </Notice>
        ) : null}
        <textarea
          className="min-h-0 flex-1 resize-none rounded-md border border-border-subtle bg-surface px-3 py-2 font-mono text-[12px] leading-5 text-primary outline-none focus:border-accent"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSavedMessage(null);
          }}
          placeholder="Keep thread-local working notes here: assumptions, decisions, open questions, handoff state. Do not store secrets."
          disabled={loading}
          aria-label="Conversation scratchpad"
        />
      </div>

      <footer className="flex items-center gap-2 border-t border-border-subtle px-3 py-2">
        <span className="text-[11px] text-muted">{draft.length.toLocaleString()} chars</span>
        <span className="flex-1" />
        <TextButton disabled={!dirty || saving || loading} onClick={() => setDraft(state.content)}>
          Revert
        </TextButton>
        <TextButton disabled={!draft || saving || loading} onClick={() => void save('')}>
          Clear
        </TextButton>
        <TextButton disabled={!dirty || saving || loading} onClick={() => void save(draft)}>
          {saving ? 'Saving...' : 'Save'}
        </TextButton>
      </footer>
    </section>
  );
}
