import {
  AppPageIntro,
  AppPageLayout,
  Button,
  CenteredLoadingState,
  ErrorState,
  Notice,
  StatusDot,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type GatewayStatus = 'needs_config' | 'connected' | 'active' | 'paused' | 'needs_attention';

interface GatewayProviderSummary {
  id: string;
  label: string;
  description?: string;
  implemented: boolean;
  configurationLocation: 'gateways' | 'settings' | 'extension' | 'external';
  setupRoute?: string;
  docsUrl?: string;
}

interface GatewayConnection {
  id: string;
  provider: string;
  label: string;
  status: GatewayStatus;
  enabled: boolean;
  statusMessage?: string;
  updatedAt: string;
}

interface GatewayEvent {
  id: string;
  provider: string;
  kind: 'inbound' | 'outbound' | 'routing' | 'status' | 'error';
  message: string;
  createdAt: string;
}

interface GatewayState {
  providers: GatewayProviderSummary[];
  connections: GatewayConnection[];
  events: GatewayEvent[];
}

interface TelegramTokenState {
  configured: boolean;
}

interface TelegramAccessPolicy {
  approvedUserIds: string[];
  approvedChatIds: string[];
}

interface TelegramTestResult {
  ok: boolean;
  bot?: { username?: string; first_name?: string } | null;
  error?: string;
}

interface PageState {
  gateway: GatewayState;
  token: TelegramTokenState;
  access: TelegramAccessPolicy;
}

type Operation = 'refresh' | 'saveToken' | 'removeToken' | 'test' | 'create' | 'enable' | 'pause' | 'access' | null;

const TELEGRAM_PROVIDER_ID = 'telegram';

export function GatewaysPage() {
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newChatId, setNewChatId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setOperation((current) => current ?? 'refresh');
    setError(null);
    try {
      const [gateway, token, access] = await Promise.all([
        apiRequest<GatewayState>('/api/gateways'),
        apiRequest<TelegramTokenState>('/api/gateways/telegram/token'),
        apiRequest<TelegramAccessPolicy>('/api/gateways/telegram/access'),
      ]);
      setPageState({ gateway, token, access });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setOperation((current) => (current === 'refresh' ? null : current));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const telegramProvider = useMemo(
    () => pageState?.gateway.providers.find((provider) => provider.id === TELEGRAM_PROVIDER_ID) ?? null,
    [pageState],
  );
  const telegramConnection = useMemo(
    () => pageState?.gateway.connections.find((connection) => connection.provider === TELEGRAM_PROVIDER_ID) ?? null,
    [pageState],
  );
  const telegramEvents = useMemo(
    () => pageState?.gateway.events.filter((event) => event.provider === TELEGRAM_PROVIDER_ID).slice(0, 5) ?? [],
    [pageState],
  );

  const runMutation = useCallback(
    async (nextOperation: Exclude<Operation, null>, task: () => Promise<string | null>) => {
      setOperation(nextOperation);
      setError(null);
      setNotice(null);
      try {
        const message = await task();
        await load();
        setNotice(message);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setOperation(null);
      }
    },
    [load],
  );

  const saveToken = useCallback(() => {
    const token = tokenDraft.trim();
    if (!token) {
      setError('Paste a Telegram bot token before saving.');
      return;
    }
    void runMutation('saveToken', async () => {
      await apiRequest('/api/gateways/telegram/token', {
        method: 'POST',
        body: { token },
      });
      setTokenDraft('');
      return 'Telegram token saved and the gateway is enabled.';
    });
  }, [runMutation, tokenDraft]);

  const removeToken = useCallback(() => {
    void runMutation('removeToken', async () => {
      await apiRequest('/api/gateways/telegram/token', { method: 'DELETE' });
      return 'Telegram token removed.';
    });
  }, [runMutation]);

  const testToken = useCallback(() => {
    void runMutation('test', async () => {
      const result = await apiRequest<TelegramTestResult>('/api/gateways/telegram/test', { method: 'POST' });
      const botName = result.bot?.username ? `@${result.bot.username}` : result.bot?.first_name;
      return botName ? `Telegram responded as ${botName}.` : 'Telegram responded successfully.';
    });
  }, [runMutation]);

  const createConnection = useCallback(() => {
    void runMutation('create', async () => {
      await apiRequest('/api/gateways/connections', {
        method: 'POST',
        body: { provider: TELEGRAM_PROVIDER_ID },
      });
      return 'Telegram gateway connection created.';
    });
  }, [runMutation]);

  const setConnectionEnabled = useCallback(
    (enabled: boolean) => {
      void runMutation(enabled ? 'enable' : 'pause', async () => {
        await apiRequest(`/api/gateways/connections/${TELEGRAM_PROVIDER_ID}`, {
          method: 'PATCH',
          body: {
            status: enabled ? 'active' : 'paused',
            enabled,
            statusMessage: enabled ? 'Telegram gateway enabled' : 'Telegram gateway paused',
          },
        });
        return enabled ? 'Telegram gateway enabled.' : 'Telegram gateway paused.';
      });
    },
    [runMutation],
  );

  const updateAccess = useCallback(
    (access: TelegramAccessPolicy, message: string) => {
      void runMutation('access', async () => {
        await apiRequest<TelegramAccessPolicy>('/api/gateways/telegram/access', {
          method: 'PATCH',
          body: access,
        });
        return message;
      });
    },
    [runMutation],
  );

  if (loading && !pageState) {
    return <CenteredLoadingState label="Loading gateways..." />;
  }

  if (!pageState) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <ErrorState message={error ?? 'Gateways could not be loaded.'} />
          <Button variant="action" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const tokenConfigured = pageState.token.configured;
  const connectionStatus = telegramConnection?.status ?? 'needs_config';
  const statusTone = statusDotTone(connectionStatus, tokenConfigured, Boolean(telegramConnection?.enabled));
  const busy = operation !== null;

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="space-y-6">
        <AppPageIntro
          title="Gateways"
          subtitle="Connect Neon Pilot to external chats."
          actions={
            <ToolbarButton type="button" disabled={busy} onClick={() => void load()}>
              Refresh
            </ToolbarButton>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
          <div className="space-y-4">
            <div className="border border-border bg-surface px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot tone={statusTone} size="sm" />
                    <h2 className="text-base font-semibold text-primary">{telegramProvider?.label ?? 'Telegram'}</h2>
                  </div>
                  <p className="max-w-2xl text-sm text-secondary">
                    {telegramProvider?.description ?? 'Run Neon Pilot from Telegram DMs, groups, and topics.'}
                  </p>
                </div>
                <ConnectionStatusLabel status={connectionStatus} enabled={Boolean(telegramConnection?.enabled)} />
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <StatusMetric label="Token" value={tokenConfigured ? 'Configured' : 'Missing'} />
                <StatusMetric label="Connection" value={telegramConnection ? 'Created' : 'Not created'} />
                <StatusMetric label="Runtime" value={telegramConnection?.enabled ? 'Enabled' : 'Paused'} />
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                {!telegramConnection ? (
                  <Button variant="action" disabled={busy} onClick={createConnection}>
                    Create connection
                  </Button>
                ) : telegramConnection.enabled ? (
                  <Button variant="ghost" disabled={busy} onClick={() => setConnectionEnabled(false)}>
                    Pause gateway
                  </Button>
                ) : (
                  <Button variant="action" disabled={busy || !tokenConfigured} onClick={() => setConnectionEnabled(true)}>
                    Enable gateway
                  </Button>
                )}
                <Button variant="toolbar" disabled={busy || !tokenConfigured} onClick={testToken}>
                  Test bot
                </Button>
              </div>
              {telegramConnection?.statusMessage ? <p className="mt-3 text-xs text-secondary">{telegramConnection.statusMessage}</p> : null}
            </div>

            <div className="border border-border bg-surface px-5 py-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-primary">Bot token</h2>
                <p className="text-sm text-secondary">Paste a BotFather token. Neon Pilot stores it in the host secret store.</p>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <TextInput
                  aria-label="Telegram bot token"
                  autoComplete="off"
                  placeholder={tokenConfigured ? 'Token is already saved' : '123456789:AA...'}
                  type="password"
                  value={tokenDraft}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTokenDraft(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="action" disabled={busy || !tokenDraft.trim()} onClick={saveToken}>
                    Save token
                  </Button>
                  <Button variant="ghost" tone="danger" disabled={busy || !tokenConfigured} onClick={removeToken}>
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            <AccessEditor
              access={pageState.access}
              busy={busy}
              newUserId={newUserId}
              newChatId={newChatId}
              onNewUserIdChange={setNewUserId}
              onNewChatIdChange={setNewChatId}
              onAddUser={() => {
                const value = newUserId.trim();
                if (!value || pageState.access.approvedUserIds.includes(value)) return;
                setNewUserId('');
                updateAccess(
                  { ...pageState.access, approvedUserIds: [...pageState.access.approvedUserIds, value] },
                  'Telegram user allowlist updated.',
                );
              }}
              onAddChat={() => {
                const value = newChatId.trim();
                if (!value || pageState.access.approvedChatIds.includes(value)) return;
                setNewChatId('');
                updateAccess(
                  { ...pageState.access, approvedChatIds: [...pageState.access.approvedChatIds, value] },
                  'Telegram chat allowlist updated.',
                );
              }}
              onRemoveUser={(value) =>
                updateAccess(
                  { ...pageState.access, approvedUserIds: pageState.access.approvedUserIds.filter((id) => id !== value) },
                  'Telegram user allowlist updated.',
                )
              }
              onRemoveChat={(value) =>
                updateAccess(
                  { ...pageState.access, approvedChatIds: pageState.access.approvedChatIds.filter((id) => id !== value) },
                  'Telegram chat allowlist updated.',
                )
              }
            />
          </div>

          <aside className="space-y-4">
            <div className="border border-border bg-surface px-5 py-4">
              <h2 className="text-base font-semibold text-primary">Provider details</h2>
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Setup" value={telegramProvider?.setupRoute ?? '/gateways'} />
                <DetailRow label="Configuration" value={formatConfigurationLocation(telegramProvider?.configurationLocation)} />
                <DetailRow label="Docs" value={telegramProvider?.docsUrl ?? 'Telegram Bot API'} />
              </div>
            </div>

            <div className="border border-border bg-surface px-5 py-4">
              <h2 className="text-base font-semibold text-primary">Recent activity</h2>
              {telegramEvents.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {telegramEvents.map((event) => (
                    <li key={event.id} className="border-l border-border pl-3">
                      <div className="text-sm text-primary">{event.message}</div>
                      <div className="mt-1 text-xs text-secondary">
                        {formatEventKind(event.kind)} · {formatDate(event.createdAt)}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-secondary">No Telegram gateway events yet.</p>
              )}
            </div>
          </aside>
        </section>
      </AppPageLayout>
    </div>
  );
}

export function GatewaysSidebar() {
  const [state, setState] = useState<{ gateway: GatewayState; token: TelegramTokenState } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([apiRequest<GatewayState>('/api/gateways'), apiRequest<TelegramTokenState>('/api/gateways/telegram/token')])
      .then(([gateway, token]) => {
        if (!cancelled) setState({ gateway, token });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const telegram = state?.gateway.connections.find((connection) => connection.provider === TELEGRAM_PROVIDER_ID) ?? null;
  const events = state?.gateway.events.filter((event) => event.provider === TELEGRAM_PROVIDER_ID).slice(0, 3) ?? [];

  return (
    <div className="h-full overflow-y-auto px-3 py-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-primary">Gateways</h2>
          <p className="mt-1 text-xs text-secondary">External chat connections.</p>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {!state && !error ? <p className="text-xs text-secondary">Loading gateway status...</p> : null}
        {state ? (
          <div className="border border-border bg-surface px-3 py-3">
            <div className="flex items-center gap-2">
              <StatusDot
                tone={statusDotTone(telegram?.status ?? 'needs_config', state.token.configured, Boolean(telegram?.enabled))}
                size="xs"
              />
              <span className="text-sm font-medium text-primary">Telegram</span>
            </div>
            <p className="mt-2 text-xs text-secondary">
              {state.token.configured ? formatGatewayStatus(telegram?.status ?? 'needs_config') : 'Token needed'}
            </p>
          </div>
        ) : null}
        {events.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase text-secondary">Recent</h3>
            <ol className="mt-2 space-y-2">
              {events.map((event) => (
                <li key={event.id} className="text-xs text-secondary">
                  {event.message}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AccessEditor({
  access,
  busy,
  newUserId,
  newChatId,
  onNewUserIdChange,
  onNewChatIdChange,
  onAddUser,
  onAddChat,
  onRemoveUser,
  onRemoveChat,
}: {
  access: TelegramAccessPolicy;
  busy: boolean;
  newUserId: string;
  newChatId: string;
  onNewUserIdChange: (value: string) => void;
  onNewChatIdChange: (value: string) => void;
  onAddUser: () => void;
  onAddChat: () => void;
  onRemoveUser: (value: string) => void;
  onRemoveChat: (value: string) => void;
}) {
  return (
    <div className="border border-border bg-surface px-5 py-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-primary">Telegram access</h2>
        <p className="text-sm text-secondary">Only approved users and chats can send work to Neon Pilot.</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AllowlistEditor
          title="Approved users"
          emptyLabel="No approved users yet."
          inputLabel="Telegram user ID"
          placeholder="1191448898"
          values={access.approvedUserIds}
          value={newUserId}
          busy={busy}
          onValueChange={onNewUserIdChange}
          onAdd={onAddUser}
          onRemove={onRemoveUser}
        />
        <AllowlistEditor
          title="Approved chats"
          emptyLabel="No approved chats yet."
          inputLabel="Telegram chat ID"
          placeholder="-1001192755030"
          values={access.approvedChatIds}
          value={newChatId}
          busy={busy}
          onValueChange={onNewChatIdChange}
          onAdd={onAddChat}
          onRemove={onRemoveChat}
        />
      </div>
    </div>
  );
}

function AllowlistEditor({
  title,
  emptyLabel,
  inputLabel,
  placeholder,
  values,
  value,
  busy,
  onValueChange,
  onAdd,
  onRemove,
}: {
  title: string;
  emptyLabel: string;
  inputLabel: string;
  placeholder: string;
  values: string[];
  value: string;
  busy: boolean;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-sm font-medium text-primary">{title}</h3>
      <div className="flex gap-2">
        <TextInput
          aria-label={inputLabel}
          inputMode="text"
          placeholder={placeholder}
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
          onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <ToolbarButton type="button" disabled={busy || !value.trim()} onClick={onAdd}>
          Add
        </ToolbarButton>
      </div>
      {values.length > 0 ? (
        <ul className="space-y-2">
          {values.map((entry) => (
            <li key={entry} className="flex min-w-0 items-center justify-between gap-2 border border-border px-3 py-2">
              <span className="truncate font-mono text-xs text-primary">{entry}</span>
              <ToolbarButton type="button" disabled={busy} onClick={() => onRemove(entry)}>
                Remove
              </ToolbarButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary">{emptyLabel}</p>
      )}
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-3 py-2">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="mt-1 font-medium text-primary">{value}</dd>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3">
      <span className="text-secondary">{label}</span>
      <span className="min-w-0 truncate text-right text-primary">{value}</span>
    </div>
  );
}

function ConnectionStatusLabel({ status, enabled }: { status: GatewayStatus; enabled: boolean }) {
  return (
    <div className="border border-border px-3 py-1.5 text-xs font-medium text-secondary">
      {enabled ? formatGatewayStatus(status) : 'Paused'}
    </div>
  );
}

async function apiRequest<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json().catch(async () => ({ error: await response.text().catch(() => '') }))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statusDotTone(status: GatewayStatus, tokenConfigured: boolean, enabled: boolean): 'muted' | 'success' | 'warning' | 'danger' {
  if (!tokenConfigured || status === 'needs_config') return 'warning';
  if (status === 'needs_attention') return 'danger';
  if (!enabled || status === 'paused') return 'muted';
  return 'success';
}

function formatGatewayStatus(status: GatewayStatus): string {
  if (status === 'needs_config') return 'Needs setup';
  if (status === 'needs_attention') return 'Needs attention';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatConfigurationLocation(value: GatewayProviderSummary['configurationLocation'] | undefined): string {
  if (value === 'gateways') return 'Gateways page';
  if (value === 'settings') return 'Settings';
  if (value === 'external') return 'External setup';
  return 'Extension page';
}

function formatEventKind(kind: GatewayEvent['kind']): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
