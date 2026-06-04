import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, EmptyState, ErrorState, LoadingState, ToolbarButton, cx } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PublicHermesConfig = {
  baseUrl: string;
  sessionKey?: string;
  hasApiKey: boolean;
};

type HermesSession = {
  id: string;
  title?: string | null;
  preview?: string | null;
  source?: string | null;
  model?: string | null;
  message_count?: number | null;
  tool_call_count?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  started_at?: string | null;
  last_active?: string | null;
  ended_at?: string | null;
  parent_session_id?: string | null;
};

type HermesMessage = {
  id?: string;
  role?: string;
  content?: unknown;
  tool_name?: string | null;
  timestamp?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
};

type HealthState = {
  ok: boolean;
  config: PublicHermesConfig;
  basic?: unknown;
  detailed?: unknown;
  error?: string | null;
};

const DEFAULT_BASE_URL = 'http://127.0.0.1:8642';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapList<T>(value: unknown): T[] {
  if (isRecord(value) && Array.isArray(value.data)) return value.data as T[];
  return [];
}

function unwrapSession(value: unknown): HermesSession | null {
  if (isRecord(value) && isRecord(value.session)) return value.session as HermesSession;
  return null;
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (isRecord(part)) return typeof part.text === 'string' ? part.text : JSON.stringify(part);
        return String(part);
      })
      .join('\n');
  }
  if (content == null) return '';
  return JSON.stringify(content, null, 2);
}

function sessionTitle(session: HermesSession): string {
  return session.title?.trim() || session.preview?.trim()?.slice(0, 64) || session.id;
}

function formatCompactDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 10) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function selectedSessionIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('session');
  return id?.trim() || null;
}

function buildSessionRoute(sessionId: string): string {
  return `/ext/hermes?session=${encodeURIComponent(sessionId)}`;
}

async function navigateTo(pa: ExtensionSurfaceProps['pa'], to: string) {
  const handled = await pa.commands.execute('app.navigate', { to });
  if (!handled && typeof window !== 'undefined') window.location.href = to;
}

function SmallButton({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="rounded-md border border-border-subtle bg-elevated/60 px-2.5 py-1.5 text-[12px] font-medium text-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ConfigForm({
  pa,
  initial,
  onSaved,
}: {
  pa: ExtensionSurfaceProps['pa'];
  initial?: PublicHermesConfig | null;
  onSaved: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [sessionKey, setSessionKey] = useState(initial?.sessionKey ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setBaseUrl(initial.baseUrl || DEFAULT_BASE_URL);
    setSessionKey(initial.sessionKey ?? '');
  }, [initial]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await pa.extension.invoke('updateConfig', {
        baseUrl,
        sessionKey,
        ...(apiKey.trim() ? { apiKey } : {}),
      });
      setApiKey('');
      onSaved();
      pa.ui.toast('Hermes connection saved.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 border-b border-border-subtle pb-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <label className="space-y-1.5">
          <span className="text-[12px] font-medium text-secondary">Hermes URL</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.currentTarget.value)}
            placeholder={DEFAULT_BASE_URL}
            className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[12px] font-medium text-secondary">API key</span>
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            placeholder={initial?.hasApiKey ? 'Saved; enter a new key to replace' : 'Bearer token'}
            type="password"
            className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-[12px] font-medium text-secondary">Memory session key</span>
        <input
          value={sessionKey}
          onChange={(event) => setSessionKey(event.currentTarget.value)}
          placeholder="agent:main:neon-pilot:dm:local"
          className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
        />
      </label>
      <div className="flex items-center gap-3">
        <ToolbarButton onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving...' : 'Save connection'}
        </ToolbarButton>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </section>
  );
}

function SessionList({
  sessions,
  activeSessionId,
  loading,
  error,
  compact,
  onSelect,
}: {
  sessions: HermesSession[];
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;
  compact?: boolean;
  onSelect: (session: HermesSession) => void;
}) {
  if (loading) return <LoadingState label="Loading Hermes sessions..." className="h-28 justify-center" />;
  if (error) return <ErrorState message={error} className={compact ? 'm-3' : ''} />;
  if (sessions.length === 0) {
    return compact ? (
      <p className="px-4 py-3 text-[12px] text-dim">No Hermes sessions yet.</p>
    ) : (
      <EmptyState title="No Hermes sessions" body="Create a session to start talking to the remote Hermes agent." />
    );
  }

  return (
    <div className={compact ? 'space-y-px px-1' : 'grid gap-1'}>
      {sessions.map((session) => {
        const active = session.id === activeSessionId;
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session)}
            className={cx(
              'w-full rounded-md px-3 py-2 text-left transition-colors',
              active ? 'bg-accent/15 text-primary' : 'text-secondary hover:bg-elevated/70 hover:text-primary',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{sessionTitle(session)}</span>
              <span className="shrink-0 text-[11px] text-dim">{formatCompactDate(session.last_active ?? session.started_at)}</span>
            </span>
            <span className="mt-1 block truncate text-[11px] text-dim">
              {session.message_count ?? 0} messages
              {session.tool_call_count ? ` · ${session.tool_call_count} tools` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MessagesView({ messages, pending }: { messages: HermesMessage[]; pending: boolean }) {
  if (messages.length === 0 && !pending) {
    return <EmptyState title="Empty Hermes session" body="Send the first message to this remote agent session." />;
  }

  return (
    <div className="space-y-3">
      {messages.map((message, index) => {
        const role = message.role ?? 'message';
        const isUser = role === 'user';
        const isTool = role === 'tool' || Boolean(message.tool_name);
        return (
          <article
            key={message.id ?? `${role}-${index}`}
            className={cx(
              'rounded-md border px-4 py-3',
              isUser
                ? 'ml-auto max-w-[78%] border-accent/30 bg-accent/10'
                : isTool
                  ? 'border-border-subtle bg-elevated/35'
                  : 'mr-auto max-w-[86%] border-border-subtle bg-surface',
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.08em] text-dim">
              <span>{message.tool_name || role}</span>
              <span>{formatCompactDate(message.timestamp)}</span>
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-6 text-primary">{messageText(message.content)}</div>
            {message.reasoning || message.reasoning_content ? (
              <details className="mt-2 text-[12px] text-secondary">
                <summary className="cursor-pointer text-dim">Reasoning</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-base p-3">{message.reasoning ?? message.reasoning_content}</pre>
              </details>
            ) : null}
          </article>
        );
      })}
      {pending ? (
        <div className="rounded-md border border-border-subtle bg-elevated/40 px-4 py-3 text-[13px] text-secondary">
          Hermes is working...
        </div>
      ) : null}
    </div>
  );
}

export function HermesSessionsSidebar({ pa, context }: ExtensionSurfaceProps) {
  const activeSessionId = selectedSessionIdFromSearch(context.search);
  const [sessions, setSessions] = useState<HermesSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await pa.extension.invoke('listSessions', { limit: 100, includeChildren: true });
      setSessions(unwrapList<HermesSession>(result));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    try {
      const result = await pa.extension.invoke('createSession', { title: 'Neon Pilot session' });
      const session = unwrapSession(result);
      await load();
      if (session) await navigateTo(pa, buildSessionRoute(session.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-base">
      <div className="px-4 pb-2 pt-2">
        <div className="flex items-center gap-2">
          <p className="ui-section-label flex-1">Hermes Sessions</p>
          <SmallButton onClick={() => void load()} disabled={loading} title="Refresh sessions">
            Refresh
          </SmallButton>
          <SmallButton onClick={() => void create()} disabled={creating} title="Create session">
            +
          </SmallButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          loading={loading}
          error={error}
          compact
          onSelect={(session) => void navigateTo(pa, buildSessionRoute(session.id))}
        />
      </div>
    </div>
  );
}

export function HermesAgentPage({ pa, context }: ExtensionSurfaceProps) {
  const activeSessionId = selectedSessionIdFromSearch(context.search);
  const [config, setConfig] = useState<PublicHermesConfig | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [sessions, setSessions] = useState<HermesSession[]>([]);
  const [messages, setMessages] = useState<HermesMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? null, [activeSessionId, sessions]);

  const loadShell = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResult, healthResult, sessionsResult] = await Promise.all([
        pa.extension.invoke('readConfig'),
        pa.extension.invoke('health'),
        pa.extension.invoke('listSessions', { limit: 100, includeChildren: true }),
      ]);
      setConfig(isRecord(configResult) && isRecord(configResult.config) ? (configResult.config as PublicHermesConfig) : null);
      setHealth(healthResult as HealthState);
      setSessions(unwrapList<HermesSession>(sessionsResult));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pa]);

  const loadMessages = useCallback(async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      const result = await pa.extension.invoke('getMessages', { sessionId: activeSessionId });
      setMessages(unwrapList<HermesMessage>(result));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMessagesLoading(false);
    }
  }, [activeSessionId, pa]);

  useEffect(() => {
    void loadShell();
  }, [loadShell]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function createSession() {
    setCreating(true);
    setError(null);
    try {
      const result = await pa.extension.invoke('createSession', { title: 'Neon Pilot session' });
      const session = unwrapSession(result);
      await loadShell();
      if (session) await navigateTo(pa, buildSessionRoute(session.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function send() {
    const text = composer.trim();
    if (!text || !activeSessionId) return;
    setSending(true);
    setError(null);
    setComposer('');
    const optimistic: HermesMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    try {
      await pa.extension.invoke('sendMessage', { sessionId: activeSessionId, message: text });
      await Promise.all([loadMessages(), loadShell()]);
    } catch (err) {
      setError(getErrorMessage(err));
      setComposer(text);
    } finally {
      setSending(false);
    }
  }

  async function rename() {
    if (!activeSessionId) return;
    const title = window.prompt('Session title', activeSession?.title ?? '');
    if (title == null) return;
    await pa.extension.invoke('renameSession', { sessionId: activeSessionId, title });
    await loadShell();
  }

  async function fork() {
    if (!activeSessionId) return;
    const result = await pa.extension.invoke('forkSession', { sessionId: activeSessionId });
    const session = unwrapSession(result);
    await loadShell();
    if (session) await navigateTo(pa, buildSessionRoute(session.id));
  }

  async function remove() {
    if (!activeSessionId || !(await pa.ui.confirm({ title: 'Delete Hermes session?', message: 'This deletes the session in Hermes.' })))
      return;
    await pa.extension.invoke('deleteSession', { sessionId: activeSessionId });
    await loadShell();
    await navigateTo(pa, '/ext/hermes');
  }

  return (
    <div className="h-full overflow-y-auto bg-base">
      <AppPageLayout shellClassName="max-w-[88rem]" contentClassName="space-y-6">
        <AppPageIntro
          title="Hermes Agent"
          summary="A bespoke interface over a running Hermes Agent instance. Hermes owns tools, memory, skills, and sessions."
          actions={
            <div className="flex items-center gap-2">
              <ToolbarButton onClick={() => void loadShell()} disabled={loading}>
                Refresh
              </ToolbarButton>
              <ToolbarButton onClick={() => void createSession()} disabled={creating}>
                New session
              </ToolbarButton>
            </div>
          }
        />

        <ConfigForm pa={pa} initial={config} onSaved={() => void loadShell()} />

        {error ? <ErrorState message={error} /> : null}
        {loading ? <LoadingState label="Loading Hermes..." /> : null}

        <section className="grid min-h-[34rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 border-r border-border-subtle pr-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-primary">Sessions</h2>
                <p className={cx('text-[12px]', health?.ok ? 'text-success' : 'text-warning')}>
                  {health?.ok ? 'Connected' : health?.error || 'Not connected'}
                </p>
              </div>
            </div>
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              loading={loading}
              error={null}
              onSelect={(session) => void navigateTo(pa, buildSessionRoute(session.id))}
            />
          </aside>

          <main className="flex min-h-0 flex-col">
            <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
              <div className="min-w-0">
                <h2 className="truncate text-[18px] font-semibold text-primary">
                  {activeSession ? sessionTitle(activeSession) : 'Select a Hermes session'}
                </h2>
                {activeSession ? (
                  <p className="mt-1 text-[12px] text-dim">
                    {activeSession.id} · {activeSession.message_count ?? 0} messages
                  </p>
                ) : null}
              </div>
              {activeSession ? (
                <div className="flex items-center gap-2">
                  <SmallButton onClick={() => void rename()}>Rename</SmallButton>
                  <SmallButton onClick={() => void fork()}>Fork</SmallButton>
                  <SmallButton onClick={() => void remove()}>Delete</SmallButton>
                </div>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {!activeSessionId ? (
                <EmptyState title="Select a Hermes session" body="Choose a session from the sidebar or create a new one." />
              ) : messagesLoading ? (
                <LoadingState label="Loading messages..." />
              ) : (
                <MessagesView messages={messages} pending={sending} />
              )}
            </div>

            <form
              className="border-t border-border-subtle pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.currentTarget.value)}
                disabled={!activeSessionId || sending}
                placeholder={activeSessionId ? 'Message Hermes...' : 'Select or create a Hermes session first'}
                className="min-h-[5.5rem] w-full resize-y rounded-md border border-border-subtle bg-elevated/50 px-3 py-2 text-[13px] leading-6 text-primary outline-none focus:border-accent disabled:opacity-50"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[12px] text-dim">Turns run inside Hermes with its configured model, tools, memory, and skills.</p>
                <ToolbarButton disabled={!activeSessionId || sending || !composer.trim()} onClick={() => void send()}>
                  {sending ? 'Sending...' : 'Send'}
                </ToolbarButton>
              </div>
            </form>
          </main>
        </section>
      </AppPageLayout>
    </div>
  );
}
