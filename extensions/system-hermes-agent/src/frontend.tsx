import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageLayout,
  ChatRailComposer,
  ChatView,
  EmptyState,
  ErrorState,
  LoadingState,
  cx,
  type ExtensionChatMessageBlock,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
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
  id?: unknown;
  role?: unknown;
  content?: unknown;
  tool_name?: unknown;
  timestamp?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
};

type HealthState = {
  ok: boolean;
  config: PublicHermesConfig;
  basic?: unknown;
  detailed?: unknown;
  error?: string | null;
};

const DEFAULT_BASE_URL = 'http://127.0.0.1:8642';
const DISCONNECTED_MESSAGE = 'Hermes is not reachable at the configured URL.';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function humanErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  if (message.includes('fetch failed')) return DISCONNECTED_MESSAGE;
  return message.replace(/^Extension "[^"]+" action "[^"]+" failed:\s*/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value == null) return fallback;
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (typeof serialized === 'string') return serialized;
  } catch {
    // Fall back to String below for cyclic or otherwise unserializable Hermes payloads.
  }
  try {
    return String(value);
  } catch {
    return fallback;
  }
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
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (isRecord(part) && 'text' in part) return safeString(part.text);
        return safeString(part);
      })
      .filter(Boolean)
      .join('\n');
  }
  return safeString(content);
}

function sessionTitle(session: HermesSession): string {
  return safeString(session.title).trim() || safeString(session.preview).trim().slice(0, 64) || safeString(session.id, 'Hermes session');
}

function sessionId(session: HermesSession): string {
  return safeString(session.id).trim();
}

function formatCompactDate(value?: unknown): string {
  const text = safeString(value).trim();
  if (!text) return '';
  const date = new Date(text);
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

function messageTimestamp(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || new Date(0).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  }
  if (isRecord(value)) {
    const candidate = value.iso ?? value.date ?? value.value ?? value.timestamp;
    return messageTimestamp(candidate);
  }
  return new Date(0).toISOString();
}

function messageString(value: unknown, fallback = ''): string {
  return safeString(value, fallback);
}

function selectedSessionIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('session');
  return id?.trim() || null;
}

function buildSessionRoute(sessionId: string): string {
  return `/ext/hermes?session=${encodeURIComponent(safeString(sessionId))}`;
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

function SidebarIconButton({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
      className="ui-icon-button ui-icon-button-compact shrink-0"
    >
      {children}
    </button>
  );
}

function SidebarSvgIcon({ path }: { path: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
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
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-[12px] font-semibold text-secondary">Hermes URL</span>
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.currentTarget.value)}
          placeholder="http://127.0.0.1:8642"
          type="url"
          name="hermes-url"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2.5 text-[13px] text-primary outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
        />
        <span className="block text-[12px] leading-5 text-dim">
          Use the local server URL or a reachable Tailscale URL such as http://bender.tail5a01ec.ts.net:8642.
        </span>
      </label>

      <label className="block space-y-2">
        <span className="text-[12px] font-semibold text-secondary">API Key</span>
        <input
          value={apiKey}
          onChange={(event) => setApiKey(event.currentTarget.value)}
          placeholder={initial?.hasApiKey ? 'Saved; enter a new key to replace' : 'API_SERVER_KEY'}
          type="password"
          name="hermes-api-key"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2.5 text-[13px] text-primary outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
        />
        <span className="block text-[12px] leading-5 text-dim">
          Paste the raw API_SERVER_KEY value from ~/.hermes/.env. Do not include Bearer.
        </span>
      </label>

      <details className="space-y-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-secondary">Advanced</summary>
        <label className="block space-y-2">
          <span className="text-[12px] font-semibold text-secondary">Memory Session Key</span>
          <input
            value={sessionKey}
            onChange={(event) => setSessionKey(event.currentTarget.value)}
            placeholder="agent:main:neon-pilot:dm:local"
            name="hermes-memory-session-key"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2.5 text-[13px] text-primary outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
          />
          <span className="block text-[12px] leading-5 text-dim">
            Optional. Hermes uses this as a stable long-term memory scope across sessions.
          </span>
        </label>
      </details>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ToolbarButton onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Connect Hermes'}
        </ToolbarButton>
        <p className="text-[12px] text-dim">You can change this later in Extension settings.</p>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </div>
  );
}

export function HermesSettingsPanel({ pa }: ExtensionSurfaceProps) {
  const [config, setConfig] = useState<PublicHermesConfig | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResult, healthResult] = await Promise.allSettled([pa.extension.invoke('readConfig'), pa.extension.invoke('health')]);
      if (configResult.status === 'fulfilled') {
        setConfig(
          isRecord(configResult.value) && isRecord(configResult.value.config) ? (configResult.value.config as PublicHermesConfig) : null,
        );
      } else {
        setError(humanErrorMessage(configResult.reason));
      }
      setHealth(healthResult.status === 'fulfilled' ? (healthResult.value as HealthState) : null);
    } catch (err) {
      setError(humanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-primary">Hermes Agent</h2>
        <p className="mt-1 text-[13px] leading-6 text-secondary">
          Connect Neon Pilot to a running Hermes API server. Sessions, tools, memory, and model execution stay inside Hermes.
        </p>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Loading Hermes settings…" className="h-16 justify-center" /> : null}
      <ConfigForm pa={pa} initial={config} onSaved={() => void load()} />
      {config?.baseUrl ? (
        <p className={cx('text-[12px]', health?.ok ? 'text-success' : 'text-dim')}>
          {health?.ok ? `Connected to ${config.baseUrl}.` : `Not connected to ${config.baseUrl}.`}
        </p>
      ) : null}
    </div>
  );
}

function HermesSetupSection({
  pa,
  config,
  connected,
  onSaved,
}: {
  pa: ExtensionSurfaceProps['pa'];
  config: PublicHermesConfig | null;
  connected: boolean;
  onSaved: () => void;
}) {
  return (
    <section className="grid w-full gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="space-y-7">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Set Up Hermes</p>
          <h2 className="text-balance text-[34px] font-semibold leading-tight tracking-[-0.02em] text-primary">
            Connect to a full remote agent.
          </h2>
          <p className="max-w-2xl text-[14px] leading-7 text-secondary">
            Hermes runs its own model, tools, memory, skills, and sessions. Neon Pilot is the interface: it stores the connection, lists
            remote sessions, and sends turns into the Hermes API server.
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-sm">
          <ConfigForm pa={pa} initial={config} onSaved={onSaved} />
          {connected ? <p className="mt-4 text-[12px] text-success">Connected to Hermes.</p> : null}
        </div>
      </div>

      <aside className="space-y-5 border-t border-border-subtle pt-5 lg:border-t-0 lg:pt-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dim/85">On this page</div>
        <div className="space-y-3 text-[13px] leading-6 text-secondary">
          <div>
            <h3 className="text-[13px] font-semibold text-primary">What Hermes Owns</h3>
            <p className="mt-1">The agent runtime, tools, memory, skills, provider, and remote sessions all stay inside Hermes.</p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-primary">How Connection Works</h3>
            <p className="mt-1">Enable the Hermes API server, restart Hermes, then paste the reachable URL and raw API key here.</p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-primary">Using Tailscale?</h3>
            <p className="mt-1">Set API_SERVER_HOST=0.0.0.0 on the Hermes machine so the tailnet URL can reach port 8642.</p>
          </div>
        </div>
      </aside>
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
  if (loading) return <LoadingState label="Loading Hermes sessions…" className="h-28 justify-center" />;
  if (error) {
    return compact ? (
      <p className="px-4 py-3 text-[12px] leading-5 text-dim">{error}</p>
    ) : (
      <EmptyState title="Hermes unavailable" body={error} />
    );
  }
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
        const id = sessionId(session);
        const active = id === activeSessionId;
        const meta = `${session.message_count ?? 0} messages${session.tool_call_count ? ` · ${session.tool_call_count} tools` : ''}`;
        if (compact) {
          return (
            <div key={id || sessionTitle(session)} className="relative" data-sidebar-session-id={id}>
              <button
                type="button"
                onClick={() => onSelect(session)}
                className={cx('ui-sidebar-session-row select-none text-left', active && 'ui-sidebar-session-row-active')}
                title={`${sessionTitle(session)} · ${meta}`}
              >
                <span className="flex w-3 shrink-0 items-center justify-center self-stretch" />
                <span className="min-w-0 flex-1 pr-[4.5rem]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="ui-row-title truncate text-[12px] leading-tight">{sessionTitle(session)}</span>
                  </span>
                </span>
              </button>
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex w-[3.75rem] items-center justify-end pr-1">
                <span className="ui-sidebar-session-meta ui-sidebar-session-time shrink-0 whitespace-nowrap">
                  {formatCompactDate(session.last_active ?? session.started_at)}
                </span>
              </span>
            </div>
          );
        }

        return (
          <button
            key={id || sessionTitle(session)}
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
            <span className="mt-1 block truncate text-[11px] text-dim">{meta}</span>
          </button>
        );
      })}
    </div>
  );
}

function toChatBlocks(messages: HermesMessage[], pending: boolean): ExtensionChatMessageBlock[] {
  const blocks: ExtensionChatMessageBlock[] = [];
  messages.forEach((message, index) => {
    const ts = messageTimestamp(message.timestamp);
    const id = messageString(message.id, `hermes-${index}`).trim() || `hermes-${index}`;
    const reasoning = messageString(message.reasoning ?? message.reasoning_content);
    if (reasoning) {
      blocks.push({ type: 'thinking', id: `${id}-reasoning`, ts, text: reasoning });
    }
    const role = messageString(message.role, 'assistant').trim().toLowerCase();
    const text = messageText(message.content);
    if (role === 'user') {
      blocks.push({ type: 'user', id, ts, text });
    } else if (role === 'tool' || message.tool_name) {
      const toolName = messageString(message.tool_name, 'tool').trim() || 'tool';
      blocks.push({ type: 'text', id, ts, text: text ? `**${toolName}**\n\n${text}` : `**${toolName}**` });
    } else {
      blocks.push({ type: 'text', id, ts, text });
    }
  });
  if (pending) {
    blocks.push({ type: 'text', id: 'hermes-pending', ts: new Date().toISOString(), text: 'Hermes is working…', streaming: true });
  }
  return blocks.map(sanitizeChatBlock);
}

function sanitizeChatBlock(block: ExtensionChatMessageBlock, index: number): ExtensionChatMessageBlock {
  const id = safeString((block as { id?: unknown }).id).trim() || `hermes-${index}`;
  const ts = messageTimestamp((block as { ts?: unknown }).ts);
  switch (block.type) {
    case 'user':
      return {
        ...block,
        id,
        ts,
        text: safeString(block.text),
        images: block.images?.map((image) => ({
          ...image,
          alt: safeString(image.alt, 'Hermes image'),
          src: typeof image.src === 'string' ? image.src : undefined,
          mimeType: typeof image.mimeType === 'string' ? image.mimeType : undefined,
          caption: typeof image.caption === 'string' ? image.caption : undefined,
        })),
      };
    case 'context':
      return {
        ...block,
        id,
        ts,
        text: safeString(block.text),
        customType: safeString(block.customType, 'hermes_context').trim() || 'hermes_context',
      };
    case 'thinking':
    case 'text':
      return { ...block, id, ts, text: safeString(block.text) };
    case 'image':
      return {
        ...block,
        id,
        ts,
        alt: safeString(block.alt, 'Hermes image'),
        src: typeof block.src === 'string' ? block.src : undefined,
        mimeType: typeof block.mimeType === 'string' ? block.mimeType : undefined,
        caption: typeof block.caption === 'string' ? block.caption : undefined,
      };
    case 'error':
      return { ...block, id, ts, tool: typeof block.tool === 'string' ? block.tool : undefined, message: safeString(block.message) };
  }
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
      setError(humanErrorMessage(err));
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
      setError(humanErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="px-4 pb-0.5 pt-1">
        <div className="flex items-center gap-1">
          <p className="ui-section-label flex-1">Hermes Sessions</p>
          <SidebarIconButton onClick={() => void load()} disabled={loading} title="Refresh sessions">
            <SidebarSvgIcon path="M20 6v5h-5M4 18v-5h5M18.4 9A7 7 0 0 0 6.2 6.8L4 9m2 6a7 7 0 0 0 11.8 2.2L20 15" />
          </SidebarIconButton>
          <SidebarIconButton onClick={() => void create()} disabled={creating} title="Create session">
            <SidebarSvgIcon path="M12 5v14M5 12h14" />
          </SidebarIconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          loading={loading}
          error={error}
          compact
          onSelect={(session) => void navigateTo(pa, buildSessionRoute(sessionId(session)))}
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
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => sessionId(session) === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const chatBlocks = useMemo(() => toChatBlocks(messages, sending), [messages, sending]);
  const configured = Boolean(config?.baseUrl && config.hasApiKey);
  const connected = health?.ok ?? false;
  const showSetup = !configured || !connected;

  const loadShell = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionsError(null);
    try {
      const [configResult, healthResult, sessionsResult] = await Promise.allSettled([
        pa.extension.invoke('readConfig'),
        pa.extension.invoke('health'),
        pa.extension.invoke('listSessions', { limit: 100, includeChildren: true }),
      ]);
      if (configResult.status === 'fulfilled') {
        setConfig(
          isRecord(configResult.value) && isRecord(configResult.value.config) ? (configResult.value.config as PublicHermesConfig) : null,
        );
      } else {
        setError(humanErrorMessage(configResult.reason));
      }
      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value as HealthState);
      } else {
        setHealth(null);
      }
      if (sessionsResult.status === 'fulfilled') {
        setSessions(unwrapList<HermesSession>(sessionsResult.value));
      } else {
        setSessions([]);
        setSessionsError(humanErrorMessage(sessionsResult.reason));
      }
    } catch (err) {
      setError(humanErrorMessage(err));
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
      setError(humanErrorMessage(err));
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
      setError(humanErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function send(textInput: string) {
    const text = textInput.trim();
    if (!text || !activeSessionId) return;
    setSending(true);
    setError(null);
    const optimistic: HermesMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    try {
      await pa.extension.invoke('sendMessage', { sessionId: activeSessionId, message: text });
      await Promise.all([loadMessages(), loadShell()]);
    } catch (err) {
      setError(humanErrorMessage(err));
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

  if (!showSetup) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-base">
        {error ? <ErrorState message={error} /> : null}
        {sessionsError ? (
          <div className="mx-auto mt-4 w-full max-w-[68rem] rounded-md border border-border-subtle bg-elevated/35 px-3 py-2 text-[13px] text-secondary">
            {sessionsError}
          </div>
        ) : null}
        <header className="mx-auto flex w-full max-w-[68rem] shrink-0 items-start justify-between gap-4 px-8 pb-2 pt-9 sm:px-10">
          <div className="min-w-0">
            <h1 className="truncate text-[40px] font-semibold leading-tight text-primary">
              {activeSession ? sessionTitle(activeSession) : 'New Conversation'}
            </h1>
            {activeSession ? (
              <p className="mt-1 truncate text-[12px] text-dim">
                {activeSession.message_count ?? 0} messages
                {activeSession.tool_call_count ? ` · ${activeSession.tool_call_count} tools` : ''}
                {health?.ok ? ' · Connected' : ''}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ToolbarButton onClick={() => void loadShell()} disabled={loading}>
              Refresh
            </ToolbarButton>
            <ToolbarButton onClick={() => void createSession()} disabled={creating}>
              New Session
            </ToolbarButton>
            {activeSession ? (
              <>
                <SmallButton onClick={() => void rename()}>Rename</SmallButton>
                <SmallButton onClick={() => void fork()}>Fork</SmallButton>
                <SmallButton onClick={() => void remove()}>Delete</SmallButton>
              </>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {!activeSessionId ? (
            <EmptyState title="No session selected" body="Use the Hermes sidebar to open or create a remote agent session." />
          ) : messagesLoading || loading ? (
            <LoadingState label="Loading messages…" />
          ) : chatBlocks.length === 0 ? (
            <EmptyState title="Empty Hermes session" body="Send the first message to this remote agent session." />
          ) : (
            <ChatView messages={chatBlocks} conversationId={activeSessionId} isStreaming={sending} remoteControlled />
          )}
        </div>

        {activeSessionId ? (
          <div className="shrink-0" aria-label="Hermes chat composer">
            <ChatRailComposer
              conversationId={activeSessionId}
              workspaceCwd="Hermes"
              isStreaming={sending}
              models={[{ id: 'hermes-agent', name: 'Hermes Agent', label: 'Hermes Agent' }]}
              currentModel="hermes-agent"
              currentThinkingLevel="unset"
              tokens={null}
              contextUsage={null}
              onSubmit={(text: string) => {
                void send(text);
              }}
              onAbortStream={() => {}}
              onSelectModel={() => {}}
              onSelectThinkingLevel={() => {}}
              composerPlaceholder="Message Hermes…   /  commands · @ notes · ⇧↵ newline"
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-base">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="flex min-h-full flex-col gap-10">
        <header className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[40px] font-semibold leading-tight text-primary">Hermes Agent</h1>
            <p className="mt-1 text-[13px] text-secondary">
              Use Neon Pilot as a client for a running Hermes Agent. Hermes owns the tools, memory, skills, and sessions.
            </p>
          </div>
        </header>

        {error ? <ErrorState message={error} /> : null}
        {sessionsError ? (
          <div className="rounded-md border border-border-subtle bg-elevated/35 px-3 py-2 text-[13px] text-secondary">{sessionsError}</div>
        ) : null}
        {loading ? <LoadingState label="Loading Hermes…" className="h-20 justify-center" /> : null}

        <HermesSetupSection pa={pa} config={config} connected={connected} onSaved={() => void loadShell()} />
      </AppPageLayout>
    </div>
  );
}
