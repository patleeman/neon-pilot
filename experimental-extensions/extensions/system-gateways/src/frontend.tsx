import type { GatewayConnection, GatewayEvent, GatewayState, GatewayThreadBinding, SessionMeta } from '@personal-agent/extensions/data';
import { api, CONVERSATION_LAYOUT_CHANGED_EVENT, readConversationLayout, timeAgoCompact } from '@personal-agent/extensions/data';
import { AppPageIntro, AppPageLayout, ToolbarButton } from '@personal-agent/extensions/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const EMPTY_GATEWAY_STATE: GatewayState = { providers: [], connections: [], bindings: [], events: [], chatTargets: [] };
const INPUT_CLASS =
  'w-full rounded-lg border border-border-subtle bg-surface/70 px-3 py-2 text-[13px] text-primary shadow-none transition-colors focus:border-accent/50 focus:bg-surface focus:outline-none disabled:opacity-50';

export function GatewaysPage() {
  const [state, setState] = useState<GatewayState>(EMPTY_GATEWAY_STATE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramTokenState, setTelegramTokenState] = useState<{ configured: boolean } | null>(null);
  const [telegramTokenLoading, setTelegramTokenLoading] = useState(true);
  const [telegramTokenError, setTelegramTokenError] = useState<string | null>(null);
  const [telegramTokenDraft, setTelegramTokenDraft] = useState('');
  const [telegramTokenEditing, setTelegramTokenEditing] = useState(false);
  const [telegramTokenNotice, setTelegramTokenNotice] = useState<string | null>(null);
  const [telegramTokenSaveError, setTelegramTokenSaveError] = useState<string | null>(null);
  const [telegramChatNotice, setTelegramChatNotice] = useState<string | null>(null);
  const [telegramChatError, setTelegramChatError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [openThreadIds, setOpenThreadIds] = useState(() => readGatewayOpenThreadIds());
  const [telegramChatIdDraft, setTelegramChatIdDraft] = useState('');
  const [telegramThreadId, setTelegramThreadId] = useState('');

  const telegramConnection = state.connections.find((c) => c.provider === 'telegram') ?? null;
  const telegramBinding = telegramConnection
    ? (state.bindings.find((b) => b.connectionId === telegramConnection.id && b.provider === 'telegram') ?? null)
    : null;
  const telegramChatTarget = telegramConnection
    ? (state.chatTargets.find((target) => target.connectionId === telegramConnection.id && target.provider === 'telegram') ?? null)
    : null;
  const configuredTelegramChatId = telegramChatTarget?.externalChatId || telegramBinding?.externalChatId || '';
  const openThreadIdSet = useMemo(() => new Set(openThreadIds), [openThreadIds]);
  const openSessions = useMemo(() => {
    const byId = new Map(sessions.map((session) => [session.id, session]));
    return openThreadIds.map((threadId) => byId.get(threadId)).filter((session): session is SessionMeta => Boolean(session));
  }, [openThreadIds, sessions]);

  useEffect(() => {
    let cancelled = false;
    api
      .gateways()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = formatGatewayError(err);
          setError(msg);
          window.dispatchEvent(
            new CustomEvent('pa-notification', {
              detail: { type: 'error', message: `Failed to load gateways: ${msg}`, source: 'system-gateways' },
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleConversationLayoutChanged() {
      setOpenThreadIds(readGatewayOpenThreadIds());
    }

    window.addEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, handleConversationLayoutChanged);
    return () => window.removeEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, handleConversationLayoutChanged);
  }, []);

  useEffect(() => {
    if (configuredTelegramChatId && !telegramChatIdDraft.trim()) {
      setTelegramChatIdDraft(configuredTelegramChatId);
    }
  }, [configuredTelegramChatId, telegramChatIdDraft]);

  useEffect(() => {
    let cancelled = false;
    api
      .sessions()
      .then((next) => {
        if (cancelled) return;
        setSessions(next);
      })
      .catch((err) => {
        if (!cancelled) setSessionsError(formatGatewayError(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTelegramThreadId((current) => {
      if (current && openThreadIdSet.has(current)) {
        return current;
      }

      if (telegramBinding?.conversationId && openThreadIdSet.has(telegramBinding.conversationId)) {
        return telegramBinding.conversationId;
      }

      return openSessions[0]?.id ?? '';
    });
  }, [openSessions, openThreadIdSet, telegramBinding?.conversationId]);

  useEffect(() => {
    let cancelled = false;
    api
      .telegramGatewayToken()
      .then((next) => {
        if (!cancelled) setTelegramTokenState(next);
      })
      .catch((err) => {
        if (!cancelled) setTelegramTokenError(formatGatewayError(err));
      })
      .finally(() => {
        if (!cancelled) setTelegramTokenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveTelegramToken() {
    const token = telegramTokenDraft.trim();
    if (!token) {
      setTelegramTokenSaveError('Telegram bot token is required.');
      return;
    }

    setBusy('telegram-token-save');
    setTelegramTokenNotice(null);
    setTelegramTokenSaveError(null);
    setTelegramChatNotice(null);
    try {
      const result = await api.saveTelegramGatewayToken(token);
      setState(result.state);
      setTelegramTokenState({ configured: result.configured });
      setTelegramTokenDraft('');
      setTelegramTokenEditing(false);
      setTelegramTokenNotice('Telegram bot saved. The gateway will attach chats when messages arrive.');
    } catch (err) {
      setTelegramTokenSaveError(formatGatewayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function removeTelegramToken() {
    const confirmed = window.confirm('Remove the Telegram bot token and stop the gateway?');
    if (!confirmed) return;

    setBusy('telegram-token-remove');
    setTelegramTokenNotice(null);
    setTelegramTokenSaveError(null);
    setTelegramChatNotice(null);
    setTelegramChatError(null);
    try {
      const result = await api.deleteTelegramGatewayToken();
      setState(result.state);
      setTelegramTokenState({ configured: result.configured });
      setTelegramTokenDraft('');
      setTelegramTokenEditing(false);
      setTelegramTokenNotice('Telegram bot removed.');
    } catch (err) {
      setTelegramTokenSaveError(formatGatewayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function updateTelegram(enabled: boolean) {
    setBusy(enabled ? 'resume' : 'pause');
    setError(null);
    try {
      setState(await api.updateGatewayConnection('telegram', { status: enabled ? 'active' : 'paused', enabled }));
    } catch (err) {
      setError(formatGatewayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function detachTelegram() {
    if (!telegramBinding) return;
    setBusy('detach');
    setError(null);
    try {
      setState(await api.detachGatewayConversation(telegramBinding.conversationId, 'telegram'));
    } catch (err) {
      setError(formatGatewayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveTelegramChatConfig() {
    const chatId = telegramChatIdDraft.trim();
    if (!chatId) {
      setTelegramChatError('Enter a Telegram chat ID.');
      return;
    }

    setBusy('telegram-chat-save');
    setTelegramChatNotice(null);
    setTelegramChatError(null);
    try {
      setState(await api.saveTelegramGatewayChat(chatId));
      setTelegramChatNotice('Telegram chat ID saved.');
    } catch (err) {
      setTelegramChatError(formatGatewayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function attachTelegramChat() {
    const chatId = configuredTelegramChatId;
    const thread = sessions.find((session) => session.id === telegramThreadId) ?? null;
    if (!telegramThreadId) {
      if (telegramBinding) {
        await detachTelegram();
        return;
      }
      setError('Choose an open thread or leave it detached.');
      return;
    }
    if (!chatId || !thread) {
      setError('Save a Telegram chat ID and choose an open thread.');
      return;
    }

    setBusy('telegram-attach');
    setError(null);
    try {
      setState(
        await api.attachGatewayConversation({
          provider: 'telegram',
          conversationId: thread.id,
          conversationTitle: thread.title || thread.id,
          externalChatId: chatId,
          externalChatLabel: chatId,
        }),
      );
      setTelegramChatIdDraft('');
    } catch (err) {
      setError(formatGatewayError(err));
    } finally {
      setBusy(null);
    }
  }

  const telegramConfigured = telegramTokenState?.configured === true;
  const showTelegramTokenEditor = !telegramConfigured || telegramTokenEditing;
  const gatewayActive =
    telegramConnection?.enabled && (telegramConnection.status === 'active' || telegramConnection.status === 'connected');
  const gatewayStatusLabel = telegramTokenLoading
    ? 'Loading'
    : telegramConfigured
      ? gatewayActive
        ? 'Active'
        : telegramConnection?.status
          ? formatStatus(telegramConnection.status)
          : 'Configured'
      : 'Needs setup';

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[112rem]" contentClassName="space-y-6">
        <AppPageIntro
          title="Telegram Gateway"
          summary="Configure Telegram and route it into conversation threads. One bot, one saved chat, attached to the thread that should handle it. Civilized."
          actions={
            <div className="inline-flex items-center gap-2 text-sm text-secondary">
              <span className={`h-2 w-2 rounded-full ${gatewayActive ? 'bg-success' : telegramConfigured ? 'bg-warning' : 'bg-dim'}`} />
              <span className="font-medium text-primary">{gatewayStatusLabel}</span>
            </div>
          }
        />

        {error ? <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
        {loading ? <div className="rounded-lg border border-border-subtle bg-surface/25 px-3 py-2 text-sm text-dim">Loading…</div> : null}

        <main className="space-y-5">
          <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-primary">Bot Settings</h2>
                <p className="mt-1 text-sm text-secondary">Store the Telegram bot token used by the managed gateway runtime.</p>
              </div>
              {!showTelegramTokenEditor ? (
                <div className="flex flex-wrap gap-2">
                  <ToolbarButton
                    disabled={busy !== null}
                    onClick={() => {
                      setTelegramTokenEditing(true);
                      setTelegramTokenNotice(null);
                      setTelegramTokenSaveError(null);
                      setTelegramChatNotice(null);
                    }}
                  >
                    Replace token
                  </ToolbarButton>
                  <ToolbarButton disabled={busy !== null} onClick={removeTelegramToken}>
                    {busy === 'telegram-token-remove' ? 'Removing…' : 'Remove bot'}
                  </ToolbarButton>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-lg bg-surface/50 p-2">
                <div className="text-dim">Token</div>
                <div className={`mt-1 ${telegramConfigured ? 'text-success' : 'text-secondary'}`}>
                  {telegramConfigured ? 'Stored' : 'Not configured'}
                </div>
              </div>
              <div className="rounded-lg bg-surface/50 p-2">
                <div className="text-dim">Chat ID</div>
                <div className="mt-1 truncate text-primary">{configuredTelegramChatId || '—'}</div>
              </div>
              <div className="rounded-lg bg-surface/50 p-2">
                <div className="text-dim">Attached thread</div>
                <div className="mt-1 truncate text-primary">
                  {telegramBinding?.conversationTitle || telegramBinding?.conversationId || '—'}
                </div>
              </div>
            </div>

            {telegramTokenLoading && !telegramTokenState ? <p className="mt-4 text-sm text-dim">Loading Telegram config…</p> : null}
            {telegramTokenError && !telegramTokenState ? (
              <p className="mt-4 text-sm text-danger">Failed to load Telegram config: {telegramTokenError}</p>
            ) : null}
            {showTelegramTokenEditor ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="min-w-0 text-sm text-secondary">
                  Bot token
                  <input
                    type="password"
                    value={telegramTokenDraft}
                    onChange={(event) => setTelegramTokenDraft(event.target.value)}
                    placeholder="123456:ABC-DEF…"
                    className={`${INPUT_CLASS} mt-1`}
                    disabled={busy !== null}
                  />
                </label>
                <div className="flex shrink-0 gap-2">
                  <ToolbarButton disabled={busy !== null || telegramTokenDraft.trim().length === 0} onClick={saveTelegramToken}>
                    {busy === 'telegram-token-save' ? 'Saving…' : telegramConfigured ? 'Save token' : 'Add bot'}
                  </ToolbarButton>
                  {telegramConfigured ? (
                    <ToolbarButton
                      disabled={busy !== null}
                      onClick={() => {
                        setTelegramTokenDraft('');
                        setTelegramTokenEditing(false);
                        setTelegramTokenSaveError(null);
                      }}
                    >
                      Cancel
                    </ToolbarButton>
                  ) : null}
                </div>
              </div>
            ) : null}
            {telegramTokenNotice ? <p className="mt-3 text-xs text-success">{telegramTokenNotice}</p> : null}
            {telegramTokenSaveError ? <p className="mt-3 text-xs text-danger">{telegramTokenSaveError}</p> : null}
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
            <div>
              <h2 className="text-xl font-semibold text-primary">Routing Settings</h2>
              <p className="mt-1 text-sm text-secondary">Save a chat ID, then attach that Telegram chat to an open conversation thread.</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm text-secondary">
                Chat ID
                <input
                  value={telegramChatIdDraft}
                  onChange={(event) => {
                    setTelegramChatIdDraft(event.target.value);
                    setTelegramChatNotice(null);
                    setTelegramChatError(null);
                  }}
                  placeholder="123456789"
                  className={`${INPUT_CLASS} mt-1`}
                  disabled={busy !== null}
                />
              </label>
              <label className="min-w-0 text-sm text-secondary">
                Thread
                <select
                  className={`${INPUT_CLASS} mt-1`}
                  value={telegramThreadId}
                  onChange={(event) => setTelegramThreadId(event.target.value)}
                  disabled={busy !== null || sessions.length === 0}
                >
                  <option value="">No thread (detached)</option>
                  {openSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title || session.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {sessionsError ? <p className="mt-3 text-xs text-danger">Failed to load threads: {sessionsError}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <ToolbarButton
                disabled={busy !== null || !telegramTokenState?.configured || !telegramChatIdDraft.trim()}
                onClick={saveTelegramChatConfig}
              >
                {busy === 'telegram-chat-save' ? 'Saving…' : configuredTelegramChatId ? 'Save chat ID' : 'Add chat ID'}
              </ToolbarButton>
              <ToolbarButton
                disabled={busy !== null || !configuredTelegramChatId || (!telegramThreadId && !telegramBinding)}
                onClick={attachTelegramChat}
              >
                {busy === 'telegram-attach'
                  ? 'Attaching…'
                  : !telegramThreadId && telegramBinding
                    ? 'Detach thread'
                    : telegramBinding
                      ? 'Update attachment'
                      : 'Attach thread'}
              </ToolbarButton>
            </div>
            {telegramChatNotice ? <p className="mt-3 text-xs text-success">{telegramChatNotice}</p> : null}
            {telegramChatError ? <p className="mt-3 text-xs text-danger">{telegramChatError}</p> : null}

            {telegramBinding ? (
              <GatewayRow
                connection={telegramConnection}
                binding={telegramBinding}
                busy={busy}
                icon="TG"
                iconBg="bg-sky-500"
                title="Telegram"
                targetLabel="Chat ID"
                onPause={() => updateTelegram(false)}
                onResume={() => updateTelegram(true)}
                onDetach={detachTelegram}
                showPauseResume
              />
            ) : null}
          </section>

          <GatewayActivity events={state.events} />
        </main>
      </AppPageLayout>
    </div>
  );
}

function GatewayRow({
  connection,
  binding,
  busy,
  icon,
  iconBg,
  title,
  targetLabel,
  onPause,
  onResume,
  onDetach,
  showPauseResume = false,
}: {
  connection: GatewayConnection;
  binding: GatewayThreadBinding | null;
  busy: string | null;
  icon: string;
  iconBg: string;
  title: string;
  targetLabel: string;
  onPause?: () => void;
  onResume?: () => void;
  onDetach: () => void;
  showPauseResume?: boolean;
}) {
  const active = connection.enabled && (connection.status === 'active' || connection.status === 'connected');
  const statusDot =
    connection.status === 'needs_attention'
      ? 'bg-danger'
      : connection.status === 'paused'
        ? 'bg-warning'
        : active
          ? 'bg-success'
          : 'bg-dim';
  const statusLabel =
    connection.status === 'needs_attention'
      ? 'Needs attention'
      : connection.status === 'paused'
        ? 'Paused'
        : active
          ? 'Active'
          : formatStatus(connection.status);

  return (
    <div className="grid gap-3 border-t border-border-subtle py-5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white ${iconBg}`}>{icon}</div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[14px] font-medium">{title}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
          <span className="text-[13px] text-secondary">{statusLabel}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {binding ? (
          <Link
            className="ui-toolbar-button rounded-lg px-3 py-1.5 text-[12px] shadow-none"
            to={`/conversations/${encodeURIComponent(binding.conversationId)}`}
          >
            Open thread
          </Link>
        ) : null}
        {binding ? (
          <ToolbarButton className="rounded-lg px-3 py-1.5 text-[12px] shadow-none" onClick={onDetach} disabled={busy !== null}>
            Detach
          </ToolbarButton>
        ) : null}
        {showPauseResume && onPause && onResume ? (
          <ToolbarButton
            className="rounded-lg px-3 py-1.5 text-[12px] shadow-none"
            onClick={active ? onPause : onResume}
            disabled={busy !== null}
          >
            {active ? 'Pause' : 'Resume'}
          </ToolbarButton>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 gap-6 text-[13px] sm:col-span-2 max-sm:grid-cols-1">
        <GatewayMeta label="Thread" value={binding?.conversationTitle || binding?.conversationId || '—'} muted={!binding} />
        <GatewayMeta
          label={targetLabel}
          value={binding?.externalChatLabel || binding?.externalChatId || '—'}
          muted={!binding?.externalChatId}
        />
        <GatewayMeta label="Updated" value={timeAgoCompact(connection.updatedAt)} />
      </dl>
    </div>
  );
}

function GatewayMeta({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</dt>
      <dd className={`mt-1 truncate ${muted ? 'text-secondary' : 'text-primary'}`}>{value}</dd>
    </div>
  );
}

function GatewayActivity({ events }: { events: GatewayEvent[] }) {
  const rows = useMemo(() => events.slice(0, 10), [events]);
  return (
    <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary">Recent Activity</h2>
          <p className="mt-1 text-sm text-secondary">Routing, status, and outbound delivery events from Telegram.</p>
        </div>
        <p className="text-xs text-dim">Last 100 retained</p>
      </div>
      <div className="mt-5 overflow-x-auto rounded-lg border border-border-subtle/50 bg-background/15">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface/50 text-xs uppercase tracking-[0.12em] text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Kind</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr key={event.id} className="border-t border-border-subtle">
                <td className="w-28 px-3 py-3 text-xs text-dim">{timeAgoCompact(event.createdAt)}</td>
                <td className="min-w-0 px-3 py-3 text-primary">{event.message}</td>
                <td className="px-3 py-3 text-xs text-secondary">{formatActivityKind(event.kind)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-secondary">
                  No activity yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function formatActivityKind(kind: string): string {
  const normalized = kind.replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatGatewayError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /Unexpected token.*doctype|not valid JSON/i.test(message) ? 'Gateway API is unavailable in this preview.' : message;
}

function readGatewayOpenThreadIds(): string[] {
  const layout = readConversationLayout();
  return [...layout.pinnedSessionIds, ...layout.sessionIds];
}
