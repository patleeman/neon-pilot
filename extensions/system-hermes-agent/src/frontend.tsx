import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageLayout,
  ActivityTreeView,
  ChatRailComposer,
  ChatView,
  EmptyState,
  ErrorState,
  LoadingState,
  cx,
  type ActivityTreeItem,
  type ExtensionChatMessageBlock,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PublicHermesConfig = {
  id: string;
  name: string;
  baseUrl: string;
  sessionKey?: string;
  hasApiKey: boolean;
};

type PublicHermesConfigState = {
  activeDeploymentId: string;
  deployments: PublicHermesConfig[];
  config?: PublicHermesConfig;
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
const DEFAULT_DEPLOYMENT_NAME = 'Local Hermes';
const SESSION_CACHE_KEY = 'system-hermes-agent:last-sessions';
const HIDDEN_SESSIONS_KEY = 'system-hermes-agent:hidden-sessions';
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
  if (isRecord(value) && Array.isArray(value.sessions)) return value.sessions as T[];
  if (isRecord(value) && Array.isArray(value.messages)) return value.messages as T[];
  if (Array.isArray(value)) return value as T[];
  return [];
}

function unwrapMessageList(value: unknown): HermesMessage[] {
  if (isRecord(value) && isRecord(value.message)) return [value.message as HermesMessage];
  if (isRecord(value) && isRecord(value.data) && isRecord(value.data.message)) return [value.data.message as HermesMessage];
  return unwrapList<HermesMessage>(value);
}

function runId(value: unknown): string {
  if (!isRecord(value)) return '';
  return safeString(value.run_id ?? value.id).trim();
}

function runStatus(value: unknown): string {
  if (!isRecord(value)) return '';
  return safeString(value.status).trim().toLowerCase();
}

function runError(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.error)) return safeString(value.error.message, 'Hermes run failed.').trim() || 'Hermes run failed.';
  return safeString(value.error).trim() || null;
}

function hasListPayload(value: unknown): boolean {
  return (
    Array.isArray(value) ||
    (isRecord(value) && (Array.isArray(value.data) || Array.isArray(value.sessions) || Array.isArray(value.messages)))
  );
}

function unwrapSession(value: unknown): HermesSession | null {
  if (isRecord(value) && isRecord(value.session)) return value.session as HermesSession;
  if (isRecord(value) && isRecord(value.data)) return value.data as HermesSession;
  if (isRecord(value)) {
    const id = value.id ?? value.session_id ?? value.sessionId;
    if (safeString(id).trim()) return { ...value, id: safeString(id).trim() } as HermesSession;
  }
  return null;
}

function unwrapConfigState(value: unknown): PublicHermesConfigState {
  const record = isRecord(value) ? value : {};
  const deployments = Array.isArray(record.deployments) ? (record.deployments as PublicHermesConfig[]) : [];
  const config = isRecord(record.config) ? (record.config as PublicHermesConfig) : deployments[0];
  const resolvedDeployments =
    deployments.length > 0
      ? deployments
      : config
        ? [config]
        : [{ id: 'local', name: 'Local Hermes', baseUrl: DEFAULT_BASE_URL, hasApiKey: false }];
  return {
    activeDeploymentId:
      safeString(record.activeDeploymentId, resolvedDeployments[0]?.id ?? 'local').trim() || resolvedDeployments[0]?.id || 'local',
    deployments: resolvedDeployments,
    config,
  };
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

function messageFingerprint(message: HermesMessage): string {
  const id = messageString(message.id).trim();
  if (id) return `id:${id}`;
  return `${messageString(message.role).trim().toLowerCase()}|${messageText(message.content).trim()}|${messageString(
    message.timestamp ?? (message as { created_at?: unknown }).created_at,
  ).trim()}`;
}

function mergeMessages(current: HermesMessage[], incoming: HermesMessage[]): HermesMessage[] {
  const seen = new Set(current.map(messageFingerprint));
  const next = [...current];
  incoming.forEach((message) => {
    const key = messageFingerprint(message);
    if (seen.has(key)) return;
    seen.add(key);
    next.push(message);
  });
  return next;
}

function sessionTitle(session: HermesSession): string {
  return safeString(session.title).trim() || safeString(session.preview).trim().slice(0, 64) || safeString(session.id, 'Hermes session');
}

function remoteServerLabel(baseUrl: string | undefined): string {
  const raw = safeString(baseUrl).trim();
  if (!raw) return 'the configured remote server';
  try {
    const url = new URL(raw);
    return url.host || raw;
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '') || raw;
  }
}

function sessionId(session: HermesSession): string {
  return safeString(
    session.id ?? (session as { session_id?: unknown }).session_id ?? (session as { sessionId?: unknown }).sessionId,
  ).trim();
}

function sessionKeySet(sessions: HermesSession[]): Set<string> {
  return new Set(sessions.map((session) => sessionId(session)).filter(Boolean));
}

function firstNewSession(previous: HermesSession[], next: HermesSession[]): HermesSession | null {
  const previousIds = sessionKeySet(previous);
  return (
    next.find((session) => {
      const id = sessionId(session);
      return id && !previousIds.has(id);
    }) ??
    next[0] ??
    null
  );
}

function preserveNonEmptySessions(current: HermesSession[], next: HermesSession[]): HermesSession[] {
  return next.length === 0 && current.length > 0 ? current : next;
}

function readCachedSessions(deploymentId = 'local'): HermesSession[] {
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_CACHE_KEY}:${deploymentId}`);
    if (!raw && deploymentId === 'local') return readLegacyCachedSessions();
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HermesSession[]) : [];
  } catch {
    return [];
  }
}

function readLegacyCachedSessions(): HermesSession[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HermesSession[]) : [];
  } catch {
    return [];
  }
}

function writeCachedSessions(deploymentId: string, sessions: HermesSession[]) {
  if (sessions.length === 0) return;
  try {
    window.sessionStorage.setItem(`${SESSION_CACHE_KEY}:${deploymentId}`, JSON.stringify(sessions));
  } catch {
    // Best-effort UI cache only.
  }
}

function readHiddenSessionIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_SESSIONS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
    );
  } catch {
    return new Set();
  }
}

function writeHiddenSessionIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(HIDDEN_SESSIONS_KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort local sidebar preference only.
  }
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

function selectedDeploymentIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('deployment');
  return id?.trim() || null;
}

function buildDeploymentRoute(deploymentId: string): string {
  return `/ext/hermes?deployment=${encodeURIComponent(safeString(deploymentId))}`;
}

function buildSessionRoute(deploymentId: string, sessionId: string): string {
  return `/ext/hermes?deployment=${encodeURIComponent(safeString(deploymentId))}&session=${encodeURIComponent(safeString(sessionId))}`;
}

function buildDeploymentActivityId(id: string): string {
  return `hermes-deployment:${id}`;
}

function buildSessionActivityId(deploymentId: string, id: string): string {
  return `hermes-session:${deploymentId}:${id}`;
}

function newSessionTitle(): string {
  return `Neon Pilot ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

async function navigateTo(pa: ExtensionSurfaceProps['pa'], to: string) {
  const handled = await pa.commands.execute('app.navigate', { to });
  if (!handled && typeof window !== 'undefined') window.location.href = to;
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
  deployments = [],
  onSaved,
}: {
  pa: ExtensionSurfaceProps['pa'];
  initial?: PublicHermesConfig | null;
  deployments?: PublicHermesConfig[];
  onSaved: () => void;
}) {
  const [deploymentId, setDeploymentId] = useState(initial?.id ?? deployments[0]?.id ?? 'local');
  const [name, setName] = useState(initial?.name ?? deployments[0]?.name ?? DEFAULT_DEPLOYMENT_NAME);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [sessionKey, setSessionKey] = useState(initial?.sessionKey ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setDeploymentId(initial.id || 'local');
    setName(initial.name || DEFAULT_DEPLOYMENT_NAME);
    setBaseUrl(initial.baseUrl || DEFAULT_BASE_URL);
    setSessionKey(initial.sessionKey ?? '');
  }, [initial]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await pa.extension.invoke('updateConfig', {
        id: deploymentId,
        name,
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

  async function deleteCurrentDeployment() {
    if (!deploymentId || deployments.length <= 1) return;
    setSaving(true);
    setError(null);
    try {
      await pa.extension.invoke('deleteDeployment', { deploymentId });
      onSaved();
      pa.ui.toast('Hermes deployment removed.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startNewDeployment() {
    const id = `hermes-${deployments.length + 1}`;
    setDeploymentId(id);
    setName(`Hermes ${deployments.length + 1}`);
    setBaseUrl(DEFAULT_BASE_URL);
    setSessionKey('');
    setApiKey('');
  }

  return (
    <div className="space-y-4">
      {deployments.length > 0 ? (
        <div className="flex items-end gap-3">
          <label className="block min-w-0 flex-1 space-y-2">
            <span className="text-[12px] font-semibold text-secondary">Deployment</span>
            <select
              value={deploymentId}
              onChange={(event) => {
                const next = deployments.find((deployment) => deployment.id === event.currentTarget.value);
                if (!next) return;
                setDeploymentId(next.id);
                setName(next.name);
                setBaseUrl(next.baseUrl);
                setSessionKey(next.sessionKey ?? '');
                setApiKey('');
              }}
              className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2.5 text-[13px] text-primary outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
            >
              {deployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>
                  {deployment.name}
                </option>
              ))}
            </select>
          </label>
          <ToolbarButton onClick={startNewDeployment}>New deployment</ToolbarButton>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <label className="block space-y-2">
          <span className="text-[12px] font-semibold text-secondary">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Bender"
            name="hermes-deployment-name"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2.5 text-[13px] text-primary outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-[12px] font-semibold text-secondary">Deployment ID</span>
          <input
            value={deploymentId}
            onChange={(event) => setDeploymentId(event.currentTarget.value)}
            placeholder="bender"
            name="hermes-deployment-id"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-border-subtle bg-elevated/60 px-3 py-2.5 text-[13px] text-primary outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-[12px] font-semibold text-secondary">Base URL</span>
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
          <span className="block text-[12px] leading-5 text-dim">Local or tailnet URL for the Hermes API server.</span>
        </label>

        <label className="block space-y-2">
          <span className="text-[12px] font-semibold text-secondary">API key</span>
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
          <span className="block text-[12px] leading-5 text-dim">Raw API_SERVER_KEY value from Hermes. Do not include Bearer.</span>
        </label>
      </div>

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
        {deployments.length > 1 ? (
          <ToolbarButton onClick={() => void deleteCurrentDeployment()} disabled={saving}>
            Delete deployment
          </ToolbarButton>
        ) : null}
        <p className="text-[12px] text-dim">You can change this later in Extension settings.</p>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </div>
  );
}

export function HermesSettingsPanel({ pa }: ExtensionSurfaceProps) {
  const [config, setConfig] = useState<PublicHermesConfig | null>(null);
  const [deployments, setDeployments] = useState<PublicHermesConfig[]>([]);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResult, healthResult] = await Promise.allSettled([pa.extension.invoke('readConfig'), pa.extension.invoke('health')]);
      if (configResult.status === 'fulfilled') {
        const state = unwrapConfigState(configResult.value);
        setDeployments(state.deployments);
        setConfig(
          state.config ??
            state.deployments.find((deployment) => deployment.id === state.activeDeploymentId) ??
            state.deployments[0] ??
            null,
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
      <ConfigForm pa={pa} initial={config} deployments={deployments} onSaved={() => void load()} />
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
  deployments,
  connected,
  onSaved,
}: {
  pa: ExtensionSurfaceProps['pa'];
  config: PublicHermesConfig | null;
  deployments: PublicHermesConfig[];
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

        <div className="rounded-md border border-border-subtle bg-surface p-5 shadow-sm">
          <ConfigForm pa={pa} initial={config} deployments={deployments} onSaved={onSaved} />
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
  deployment,
  sessions,
  activeSessionId,
  activeDeploymentId,
  loading,
  error,
  onCloseSession,
  onSelectDeployment,
  onSelect,
}: {
  deployment: PublicHermesConfig;
  sessions: HermesSession[];
  activeSessionId: string | null;
  activeDeploymentId: string | null;
  loading: boolean;
  error: string | null;
  onCloseSession: (deploymentId: string, sessionId: string) => void;
  onSelectDeployment: () => void;
  onSelect: (session: HermesSession) => void;
}) {
  if (loading) return <LoadingState label="Loading Hermes sessions…" className="h-28 justify-center" />;
  if (error && sessions.length === 0) {
    return <p className="px-4 py-3 text-[12px] leading-5 text-dim">{error}</p>;
  }

  const items: ActivityTreeItem[] = sessions.map((session) => {
    const id = sessionId(session);
    const meta = `${session.message_count ?? 0} messages${session.tool_call_count ? ` · ${session.tool_call_count} tools` : ''}`;
    return {
      id: buildSessionActivityId(deployment.id, id),
      kind: 'conversation',
      parentId: buildDeploymentActivityId(deployment.id),
      title: sessionTitle(session),
      subtitle: meta,
      status: 'idle',
      route: buildSessionRoute(deployment.id, id),
      updatedAt: safeString(session.last_active ?? session.started_at) || undefined,
      metadata: {
        conversationId: id,
        deploymentId: deployment.id,
        canArchive: true,
        tooltip: `${sessionTitle(session)} · ${meta}`,
      },
    };
  });
  const treeItems: ActivityTreeItem[] = [
    {
      id: buildDeploymentActivityId(deployment.id),
      kind: 'group',
      title: deployment.name,
      subtitle: deployment.baseUrl,
      status: 'idle',
      route: buildDeploymentRoute(deployment.id),
      metadata: { deploymentId: deployment.id },
    },
    ...items,
  ];

  return (
    <div>
      {error ? <p className="px-3 pb-2 pt-1 text-[11px] leading-4 text-dim">{error}</p> : null}
      <ActivityTreeView
        items={treeItems}
        activeItemId={
          activeDeploymentId === deployment.id && activeSessionId
            ? buildSessionActivityId(deployment.id, activeSessionId)
            : activeDeploymentId === deployment.id
              ? buildDeploymentActivityId(deployment.id)
              : null
        }
        onArchiveItem={(item) => {
          const id = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
          const deploymentId = typeof item.metadata?.deploymentId === 'string' ? item.metadata.deploymentId : deployment.id;
          if (id) onCloseSession(deploymentId, id);
        }}
        onOpenItem={(item) => {
          if (item.kind === 'group') {
            onSelectDeployment();
            return;
          }
          const id = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
          const session = id ? sessions.find((candidate) => sessionId(candidate) === id) : null;
          if (session) onSelect(session);
        }}
      />
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
  const routeDeploymentId = selectedDeploymentIdFromSearch(context.search);
  const activeSessionId = selectedSessionIdFromSearch(context.search);
  const [deployments, setDeployments] = useState<PublicHermesConfig[]>([]);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(routeDeploymentId);
  const [sessionsByDeployment, setSessionsByDeployment] = useState<Record<string, HermesSession[]>>({});
  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(readHiddenSessionIds);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const resolvedActiveDeploymentId = routeDeploymentId ?? activeDeploymentId ?? deployments[0]?.id ?? 'local';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configState = unwrapConfigState(await pa.extension.invoke('readConfig'));
      setDeployments(configState.deployments);
      const nextActiveDeploymentId = routeDeploymentId ?? configState.activeDeploymentId;
      setActiveDeploymentId(nextActiveDeploymentId);
      const entries = await Promise.all(
        configState.deployments.map(async (deployment) => {
          try {
            const result = await pa.extension.invoke('listSessions', { deploymentId: deployment.id, limit: 100, includeChildren: true });
            if (!hasListPayload(result)) throw new Error('Hermes returned an unrecognized session list response.');
            const nextSessions = unwrapList<HermesSession>(result);
            const resolved = preserveNonEmptySessions(readCachedSessions(deployment.id), nextSessions);
            writeCachedSessions(deployment.id, resolved);
            return [deployment.id, resolved] as const;
          } catch (err) {
            setError(humanErrorMessage(err));
            return [deployment.id, readCachedSessions(deployment.id)] as const;
          }
        }),
      );
      setSessionsByDeployment(Object.fromEntries(entries));
    } catch (err) {
      setError(humanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pa, routeDeploymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    try {
      const deploymentId = resolvedActiveDeploymentId;
      const previousSessions = sessionsByDeployment[deploymentId] ?? [];
      const result = await pa.extension.invoke('createSession', { deploymentId, title: newSessionTitle() });
      let session = unwrapSession(result);
      const sessionsResult = await pa.extension.invoke('listSessions', { deploymentId, limit: 100, includeChildren: true });
      if (hasListPayload(sessionsResult)) {
        const nextSessions = unwrapList<HermesSession>(sessionsResult);
        const resolved = preserveNonEmptySessions(previousSessions, nextSessions);
        writeCachedSessions(deploymentId, resolved);
        setSessionsByDeployment((current) => ({ ...current, [deploymentId]: resolved }));
        session ??= firstNewSession(previousSessions, nextSessions);
        if (nextSessions.length === 0) setError('Hermes returned an empty session list after creating the session.');
      } else {
        setError('Hermes returned an unrecognized session list response.');
      }
      if (session) await navigateTo(pa, buildSessionRoute(deploymentId, sessionId(session)));
    } catch (err) {
      setError(humanErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function closeSession(deploymentId: string, id: string) {
    const key = `${deploymentId}:${id}`;
    setHiddenSessionIds((current) => {
      const next = new Set(current);
      next.add(key);
      writeHiddenSessionIds(next);
      return next;
    });
    if (deploymentId === resolvedActiveDeploymentId && id === activeSessionId) void navigateTo(pa, buildDeploymentRoute(deploymentId));
  }

  function showHiddenSessions() {
    const next = new Set<string>();
    writeHiddenSessionIds(next);
    setHiddenSessionIds(next);
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
        {deployments.map((deployment) => {
          const sessions = sessionsByDeployment[deployment.id] ?? readCachedSessions(deployment.id);
          const visibleSessions = sessions.filter((session) => !hiddenSessionIds.has(`${deployment.id}:${sessionId(session)}`));
          const hiddenCount = Math.max(0, sessions.length - visibleSessions.length);
          return (
            <div key={deployment.id}>
              <SessionList
                deployment={deployment}
                sessions={visibleSessions}
                activeSessionId={activeSessionId}
                activeDeploymentId={resolvedActiveDeploymentId}
                loading={loading}
                error={error}
                onCloseSession={closeSession}
                onSelectDeployment={() => void navigateTo(pa, buildDeploymentRoute(deployment.id))}
                onSelect={(session) => void navigateTo(pa, buildSessionRoute(deployment.id, sessionId(session)))}
              />
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={showHiddenSessions}
                  className="mx-2 mt-2 rounded px-2 py-1 text-left text-[11px] text-dim hover:bg-surface-hover hover:text-secondary"
                >
                  Show {hiddenCount} hidden {hiddenCount === 1 ? 'session' : 'sessions'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HermesAgentPage({ pa, context }: ExtensionSurfaceProps) {
  const routeDeploymentId = selectedDeploymentIdFromSearch(context.search);
  const activeSessionId = selectedSessionIdFromSearch(context.search);
  const [config, setConfig] = useState<PublicHermesConfig | null>(null);
  const [deployments, setDeployments] = useState<PublicHermesConfig[]>([]);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [sessions, setSessions] = useState<HermesSession[]>(() => readCachedSessions(routeDeploymentId ?? 'local'));
  const [messages, setMessages] = useState<HermesMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [activeRun, setActiveRun] = useState<{ id: string; sessionId: string; startedAt: number } | null>(null);
  const activeDeploymentId = routeDeploymentId ?? config?.id ?? deployments[0]?.id ?? 'local';

  const activeSession = useMemo(
    () => sessions.find((session) => sessionId(session) === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const runPending = sending || activeRun !== null;
  const chatBlocks = useMemo(() => toChatBlocks(messages, runPending), [messages, runPending]);
  const configured = Boolean(config?.baseUrl && config.hasApiKey);
  const connected = health?.ok ?? false;
  const showSetup = !loading && !configured;

  const loadShell = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionsError(null);
    try {
      const [configResult, healthResult, sessionsResult] = await Promise.allSettled([
        pa.extension.invoke('readConfig'),
        pa.extension.invoke('health', { deploymentId: activeDeploymentId }),
        pa.extension.invoke('listSessions', { deploymentId: activeDeploymentId, limit: 100, includeChildren: true }),
      ]);
      if (configResult.status === 'fulfilled') {
        const state = unwrapConfigState(configResult.value);
        setDeployments(state.deployments);
        const selected =
          state.deployments.find((deployment) => deployment.id === activeDeploymentId) ?? state.config ?? state.deployments[0] ?? null;
        setConfig(selected);
      } else {
        setError(humanErrorMessage(configResult.reason));
      }
      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value as HealthState);
      } else {
        setHealth(null);
      }
      if (sessionsResult.status === 'fulfilled') {
        if (hasListPayload(sessionsResult.value)) {
          const nextSessions = unwrapList<HermesSession>(sessionsResult.value);
          setSessions((current) => {
            const resolved = preserveNonEmptySessions(current, nextSessions);
            writeCachedSessions(activeDeploymentId, resolved);
            return resolved;
          });
          if (nextSessions.length === 0) {
            setSessionsError('Hermes returned an empty session list. Keeping the existing sessions.');
          }
        } else {
          setSessionsError('Hermes returned an unrecognized session list response.');
        }
      } else {
        setSessions([]);
        setSessionsError(humanErrorMessage(sessionsResult.reason));
      }
    } catch (err) {
      setError(humanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeDeploymentId, pa]);

  const loadMessages = useCallback(async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      const result = await pa.extension.invoke('getMessages', { deploymentId: activeDeploymentId, sessionId: activeSessionId });
      if (hasListPayload(result)) {
        const nextMessages = unwrapList<HermesMessage>(result);
        setMessages((current) => (nextMessages.length === 0 && current.length > 0 ? current : nextMessages));
      } else {
        setError('Hermes returned an unrecognized message list response.');
      }
    } catch (err) {
      setError(humanErrorMessage(err));
    } finally {
      setMessagesLoading(false);
    }
  }, [activeDeploymentId, activeSessionId, pa]);

  useEffect(() => {
    void loadShell();
  }, [loadShell]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!activeRun) return;
    let cancelled = false;
    const poll = async () => {
      try {
        if (Date.now() - activeRun.startedAt >= 180_000) {
          if (!cancelled) {
            setActiveRun(null);
            setError('Hermes is still running this turn. Refresh the session in a moment to pick up the result.');
          }
          return;
        }
        const result = await pa.extension.invoke('getRun', { deploymentId: activeDeploymentId, runId: activeRun.id });
        if (cancelled) return;
        const status = runStatus(result);
        const errorMessage = runError(result);
        if (status === 'failed' || status === 'cancelled') {
          setActiveRun(null);
          setError(errorMessage ?? `Hermes run ${status}.`);
          return;
        }
        if (status === 'completed') {
          const returnedMessages = unwrapMessageList(result);
          if (activeRun.sessionId === activeSessionId) {
            setMessages((current) => mergeMessages(current, returnedMessages));
          }
          setActiveRun(null);
          if (activeRun.sessionId === activeSessionId) {
            await loadMessages();
          }
          void loadShell();
        }
      } catch (err) {
        if (!cancelled) {
          setActiveRun(null);
          setError(humanErrorMessage(err));
        }
      }
    };
    const timeout = window.setTimeout(() => {
      void poll();
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeRun, activeSessionId, loadMessages, loadShell, pa]);

  async function send(textInput: string) {
    const text = textInput.trim();
    if (!text || !activeSessionId || activeRun) return;
    const runSessionId = activeSessionId;
    setSending(true);
    setError(null);
    const optimistic: HermesMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    try {
      const result = await pa.extension.invoke('startSessionRun', {
        deploymentId: activeDeploymentId,
        sessionId: runSessionId,
        message: text,
      });
      const id = runId(result);
      if (!id) throw new Error('Hermes did not return a run id.');
      const status = runStatus(result);
      const errorMessage = runError(result);
      if (status === 'failed' || status === 'cancelled') throw new Error(errorMessage ?? `Hermes run ${status}.`);
      if (status === 'completed') {
        const returnedMessages = unwrapMessageList(result);
        setMessages((current) => mergeMessages(current, returnedMessages));
        await loadMessages();
        void loadShell();
      } else {
        setActiveRun({ id, sessionId: runSessionId, startedAt: Date.now() });
      }
    } catch (err) {
      setError(humanErrorMessage(err));
    } finally {
      setSending(false);
    }
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
        <header className="mx-auto w-full max-w-[68rem] shrink-0 px-8 pb-2 pt-9 sm:px-10">
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
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {!activeSessionId ? (
            <EmptyState title="No session selected" body="Use the Hermes sidebar to open or create a remote agent session." />
          ) : messagesLoading || loading ? (
            <LoadingState label="Loading messages…" />
          ) : chatBlocks.length === 0 ? (
            <EmptyState title="Empty Hermes session" body="Send the first message to this remote agent session." />
          ) : (
            <ChatView
              messages={chatBlocks}
              conversationId={activeSessionId}
              isStreaming={sending}
              remoteControlled
              remoteControlStatus={`You are remotely controlling a hermes agent on ${remoteServerLabel(config?.baseUrl)}.`}
            />
          )}
        </div>

        {activeSessionId ? (
          <div className="shrink-0" aria-label="Hermes chat composer">
            <ChatRailComposer
              conversationId={activeSessionId}
              workspaceCwd={config?.name ?? 'Hermes'}
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

        <HermesSetupSection pa={pa} config={config} deployments={deployments} connected={connected} onSaved={() => void loadShell()} />
      </AppPageLayout>
    </div>
  );
}
