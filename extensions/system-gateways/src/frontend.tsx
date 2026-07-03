import {
  AppPageIntro,
  AppPageLayout,
  Button,
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  ContextRailSection,
  ErrorState,
  type ExtensionSurfaceProps,
  IconButton,
  KeyValueItem,
  KeyValueList,
  KeyValueTable,
  Notice,
  PanelMessage,
  QuietLoadingState,
  StatusDot,
  Switch,
  TextInput,
  TextLink,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedDialog,
  WindowedDialogStack,
  WindowedEmptyState,
  WindowedField,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedList,
  WindowedListItem,
  WindowedLoadingState,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedStateBlock,
  WindowedTextInput,
  WindowedTimeline,
  WindowedTimelineItem,
  WindowedToggle,
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
type WindowedGatewayDialog = 'configuration' | 'access' | 'activity' | null;

const TELEGRAM_PROVIDER_ID = 'telegram';

function GatewayIcon({ name }: { name: 'check' | 'refresh' | 'plus' | 'minus' | 'trash' }) {
  const paths = {
    check: ['M20 6 9 17l-5-5'],
    refresh: ['M21 12a9 9 0 1 1-3-6.7', 'M21 3v6h-6'],
    plus: ['M12 5v14', 'M5 12h14'],
    minus: ['M5 12h14'],
    trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14', 'M10 11v5', 'M14 11v5'],
  } satisfies Record<string, string[]>;
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

async function loadPageState(): Promise<PageState> {
  const [gateway, token, access] = await Promise.all([
    apiRequest<GatewayState>('/api/gateways'),
    apiRequest<TelegramTokenState>('/api/gateways/telegram/token'),
    apiRequest<TelegramAccessPolicy>('/api/gateways/telegram/access'),
  ]);
  return { gateway, token, access };
}

export function GatewaysPage({ context }: Pick<ExtensionSurfaceProps, 'context'> = {} as Pick<ExtensionSurfaceProps, 'context'>) {
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [windowedDialog, setWindowedDialog] = useState<WindowedGatewayDialog>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOperation((current) => current ?? 'refresh');
    setError(null);
    try {
      setPageState(await loadPageState());
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

  useEffect(() => {
    const handleInvalidation = (event: Event) => {
      const detail = (event as CustomEvent<{ topics?: unknown }>).detail;
      const topics = Array.isArray(detail?.topics) ? detail.topics : [];
      if (topics.includes('gateways') || topics.includes('sessions')) {
        void load();
      }
    };
    window.addEventListener('neon-pilot-app-invalidate', handleInvalidation);
    return () => window.removeEventListener('neon-pilot-app-invalidate', handleInvalidation);
  }, [load]);

  const telegramProvider = useMemo(
    () => pageState?.gateway.providers.find((provider) => provider.id === TELEGRAM_PROVIDER_ID) ?? null,
    [pageState],
  );
  const telegramConnection = useMemo(
    () => pageState?.gateway.connections.find((connection) => connection.provider === TELEGRAM_PROVIDER_ID) ?? null,
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

  const windowed = context?.shellPresentation === 'windowed';

  if (loading && !pageState) return windowed ? <WindowedGatewaysLoading /> : <GatewaysLoadingPage />;

  if (!pageState) {
    if (windowed) {
      return (
        <WindowedPageShell layout="standard" className="gateways-page-windowed">
          <WindowedPageMain title="Telegram" actions={<WindowedPageButton onClick={() => void load()}>Try again</WindowedPageButton>}>
            <WindowedPageSection title="Status" meta="Unavailable">
              <WindowedStateBlock tone="danger">{error ?? 'Gateway settings could not be loaded.'}</WindowedStateBlock>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      );
    }

    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout contentClassName="space-y-6">
          <AppPageIntro title="Gateways" />
          <ErrorState message={error ?? 'Gateways could not be loaded.'} />
          <Button variant="action" onClick={() => void load()}>
            Try again
          </Button>
        </AppPageLayout>
      </div>
    );
  }

  const tokenConfigured = pageState.token.configured;
  const connectionStatus = telegramConnection?.status ?? 'needs_config';
  const gatewayEnabled = Boolean(telegramConnection?.enabled);
  const statusTone = statusDotTone(connectionStatus, tokenConfigured, gatewayEnabled);
  const busy = operation !== null;
  const gatewayToggleDisabled = busy || !telegramConnection || !tokenConfigured;

  if (windowed) {
    const telegramEvents = pageState.gateway.events.filter((event) => event.provider === TELEGRAM_PROVIDER_ID).slice(0, 8);
    const dialogTitle =
      windowedDialog === 'configuration'
        ? 'Telegram configuration'
        : windowedDialog === 'access'
          ? 'Telegram access'
          : windowedDialog === 'activity'
            ? 'Recent activity'
            : null;
    const dialogMeta =
      windowedDialog === 'configuration'
        ? tokenConfigured
          ? 'Token configured'
          : 'Token missing'
        : windowedDialog === 'access'
          ? `${pageState.access.approvedUserIds.length + pageState.access.approvedChatIds.length} approved`
          : windowedDialog === 'activity'
            ? `${telegramEvents.length} events`
            : undefined;

    return (
      <div className="h-full overflow-hidden">
        <WindowedPageShell layout="standard" className="gateways-page-windowed">
          <WindowedPageMain
            title={telegramProvider?.label ?? 'Telegram'}
            actions={
              <>
                <WindowedPageButton disabled={busy || !tokenConfigured} onClick={testToken}>
                  Test bot
                </WindowedPageButton>
                <WindowedPageButton
                  aria-label="Open Telegram configuration"
                  title="Open Telegram configuration"
                  onClick={() => setWindowedDialog('configuration')}
                >
                  Configure
                </WindowedPageButton>
                <WindowedPageButton disabled={busy} onClick={() => void load()}>
                  Refresh
                </WindowedPageButton>
              </>
            }
          >
            {error ? (
              <WindowedPageSection title="Action needed">
                <WindowedStateBlock tone="danger">{error}</WindowedStateBlock>
              </WindowedPageSection>
            ) : null}
            {notice ? (
              <WindowedPageSection title="Last change">
                <div className="wos-gateway-notice">{notice}</div>
              </WindowedPageSection>
            ) : null}
            <WindowedPageSection title="Providers" meta={`${pageState.gateway.providers.length} available`}>
              <WindowedDataTable
                columnTemplate="minmax(12rem, 1fr) minmax(6.5rem, 0.42fr) minmax(12rem, 0.72fr)"
                columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Configuration', align: 'right' }]}
              >
                {pageState.gateway.providers.map((provider) => {
                  const connection = pageState.gateway.connections.find((candidate) => candidate.provider === provider.id);
                  const providerEnabled = Boolean(connection?.enabled);
                  return (
                    <WindowedDataRow
                      key={provider.id}
                      name={provider.label}
                      meta={connection?.statusMessage ?? provider.description ?? 'Gateway provider'}
                      status={
                        <WindowedBadge tone={gatewayBadgeTone(connection?.status ?? 'needs_config', tokenConfigured, providerEnabled)}>
                          {providerEnabled ? formatGatewayStatus(connection?.status ?? 'needs_config') : 'Paused'}
                        </WindowedBadge>
                      }
                      action={
                        <span className="wos-gateway-provider-location">{formatConfigurationLocation(provider.configurationLocation)}</span>
                      }
                    />
                  );
                })}
              </WindowedDataTable>
            </WindowedPageSection>
            <WindowedPageSection title="Readiness" meta={gatewayEnabled ? 'Enabled' : 'Paused'}>
              <WindowedKeyValueGrid
                items={[
                  { label: 'Token', value: tokenConfigured ? 'Configured' : 'Missing' },
                  { label: 'Connection', value: telegramConnection ? 'Created' : 'Not created' },
                  { label: 'Runtime', value: gatewayEnabled ? formatGatewayStatus(connectionStatus) : 'Paused' },
                ]}
              />
              {telegramConnection?.statusMessage ? <p className="wos-gateway-status-message">{telegramConnection.statusMessage}</p> : null}
            </WindowedPageSection>
            <WindowedPageSection title="Connection">
              <WindowedDataTable
                columnTemplate="minmax(12rem, 1fr) minmax(6.5rem, 0.42fr) minmax(8rem, 0.5fr)"
                columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}
              >
                <WindowedDataRow
                  name={telegramProvider?.label ?? 'Telegram'}
                  meta="Telegram Bot API"
                  enabled={gatewayEnabled}
                  status={
                    <WindowedBadge tone={gatewayBadgeTone(connectionStatus, tokenConfigured, gatewayEnabled)}>
                      {formatGatewayStatus(connectionStatus)}
                    </WindowedBadge>
                  }
                  action={
                    telegramConnection ? (
                      <WindowedToggle
                        checked={gatewayEnabled}
                        disabled={gatewayToggleDisabled}
                        accent="gateways"
                        label={gatewayEnabled ? 'Pause Telegram gateway' : 'Enable Telegram gateway'}
                        onChange={() => setConnectionEnabled(!gatewayEnabled)}
                      />
                    ) : (
                      <WindowedPageButton
                        disabled={busy}
                        aria-label="Create Telegram connection"
                        title="Create Telegram connection"
                        onClick={createConnection}
                      >
                        Create
                      </WindowedPageButton>
                    )
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>
            <WindowedPageSection title="Gateway tools" meta="Subwindows">
              <WindowedDataTable
                columnTemplate="minmax(12rem, 1fr) minmax(7rem, 0.45fr) minmax(6rem, 0.34fr)"
                columns={[{ label: 'Tool' }, { label: 'State' }, { label: 'Open', align: 'right' }]}
              >
                <WindowedDataRow
                  name="Configuration"
                  meta="Setup route, docs, and bot token"
                  selected={windowedDialog === 'configuration'}
                  accent="gateways"
                  status={
                    <WindowedBadge tone={tokenConfigured ? 'positive' : 'warning'}>
                      {tokenConfigured ? 'Configured' : 'Missing token'}
                    </WindowedBadge>
                  }
                  onSelect={() => setWindowedDialog('configuration')}
                  action={
                    <WindowedPageButton
                      aria-label="Open Telegram configuration"
                      title="Open Telegram configuration"
                      onClick={() => setWindowedDialog('configuration')}
                    >
                      Open
                    </WindowedPageButton>
                  }
                />
                <WindowedDataRow
                  name="Access"
                  meta="Approved Telegram users and chats"
                  selected={windowedDialog === 'access'}
                  accent="gateways"
                  status={
                    <WindowedBadge tone="neutral">
                      {pageState.access.approvedUserIds.length + pageState.access.approvedChatIds.length} approved
                    </WindowedBadge>
                  }
                  onSelect={() => setWindowedDialog('access')}
                  action={
                    <WindowedPageButton
                      aria-label="Open Telegram access"
                      title="Open Telegram access"
                      onClick={() => setWindowedDialog('access')}
                    >
                      Open
                    </WindowedPageButton>
                  }
                />
                <WindowedDataRow
                  name="Activity"
                  meta="Recent gateway events"
                  selected={windowedDialog === 'activity'}
                  accent="gateways"
                  status={
                    <WindowedBadge tone={telegramEvents.length ? 'positive' : 'neutral'}>{telegramEvents.length} events</WindowedBadge>
                  }
                  onSelect={() => setWindowedDialog('activity')}
                  action={
                    <WindowedPageButton
                      aria-label="Open Telegram activity"
                      title="Open Telegram activity"
                      onClick={() => setWindowedDialog('activity')}
                    >
                      Open
                    </WindowedPageButton>
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        {dialogTitle ? (
          <WindowedDialog
            title={dialogTitle}
            meta={dialogMeta}
            accent="gateways"
            parentWindowTitle="Gateways"
            onClose={() => setWindowedDialog(null)}
          >
            {windowedDialog === 'configuration' ? (
              <WindowedDialogStack>
                <WindowedKeyValueList
                  items={[
                    { label: 'Setup', value: telegramProvider?.setupRoute ?? '/gateways' },
                    { label: 'Configuration', value: formatConfigurationLocation(telegramProvider?.configurationLocation) },
                    { label: 'Docs', value: 'Telegram Bot API' },
                    { label: 'Last update', value: telegramConnection?.updatedAt ? formatDate(telegramConnection.updatedAt) : 'Never' },
                  ]}
                />
                <div className="wos-gateway-token-row">
                  <WindowedField
                    label="Telegram bot token"
                    span="full"
                    hint={tokenConfigured ? 'A token is already saved.' : 'Paste a bot token from BotFather.'}
                  >
                    <WindowedTextInput
                      aria-label="Telegram bot token"
                      autoComplete="off"
                      placeholder={tokenConfigured ? 'Token is already saved' : '123456789:AA...'}
                      type="password"
                      value={tokenDraft}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTokenDraft(event.target.value)}
                    />
                  </WindowedField>
                  <div className="wos-gateway-token-actions">
                    {tokenDraft.trim() ? (
                      <WindowedPageButton tone="accent" disabled={busy} onClick={saveToken}>
                        Save token
                      </WindowedPageButton>
                    ) : null}
                    {tokenConfigured ? (
                      <WindowedPageButton
                        tone="danger"
                        disabled={busy}
                        aria-label="Remove Telegram bot token"
                        title="Remove Telegram bot token"
                        onClick={removeToken}
                      >
                        Remove
                      </WindowedPageButton>
                    ) : null}
                  </div>
                </div>
              </WindowedDialogStack>
            ) : null}

            {windowedDialog === 'access' ? (
              <div className="wos-gateway-access-grid">
                <WindowedAllowlistEditor
                  title="Approved users"
                  emptyLabel="No approved users yet."
                  inputLabel="Telegram user ID"
                  placeholder="1191448898"
                  values={pageState.access.approvedUserIds}
                  value={newUserId}
                  busy={busy}
                  onValueChange={setNewUserId}
                  onAdd={() => {
                    const value = newUserId.trim();
                    if (!value || pageState.access.approvedUserIds.includes(value)) return;
                    setNewUserId('');
                    updateAccess(
                      { ...pageState.access, approvedUserIds: [...pageState.access.approvedUserIds, value] },
                      'Telegram user allowlist updated.',
                    );
                  }}
                  onRemove={(value) =>
                    updateAccess(
                      { ...pageState.access, approvedUserIds: pageState.access.approvedUserIds.filter((id) => id !== value) },
                      'Telegram user allowlist updated.',
                    )
                  }
                />
                <WindowedAllowlistEditor
                  title="Approved chats"
                  emptyLabel="No approved chats yet."
                  inputLabel="Telegram chat ID"
                  placeholder="-1001192755030"
                  values={pageState.access.approvedChatIds}
                  value={newChatId}
                  busy={busy}
                  onValueChange={setNewChatId}
                  onAdd={() => {
                    const value = newChatId.trim();
                    if (!value || pageState.access.approvedChatIds.includes(value)) return;
                    setNewChatId('');
                    updateAccess(
                      { ...pageState.access, approvedChatIds: [...pageState.access.approvedChatIds, value] },
                      'Telegram chat allowlist updated.',
                    );
                  }}
                  onRemove={(value) =>
                    updateAccess(
                      { ...pageState.access, approvedChatIds: pageState.access.approvedChatIds.filter((id) => id !== value) },
                      'Telegram chat allowlist updated.',
                    )
                  }
                />
              </div>
            ) : null}

            {windowedDialog === 'activity' ? (
              telegramEvents.length > 0 ? (
                <WindowedTimeline>
                  {telegramEvents.map((event) => (
                    <WindowedTimelineItem
                      key={event.id}
                      title={formatEventKind(event.kind)}
                      meta={formatDate(event.createdAt)}
                      tone={event.kind === 'error' ? 'danger' : 'neutral'}
                    >
                      {event.message}
                    </WindowedTimelineItem>
                  ))}
                </WindowedTimeline>
              ) : (
                <WindowedEmptyState>No Telegram gateway events yet.</WindowedEmptyState>
              )
            ) : null}
          </WindowedDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="space-y-6">
        <AppPageIntro
          title="Gateways"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <IconButton
                type="button"
                compact
                aria-label="Test Telegram bot"
                title="Test Telegram bot"
                disabled={busy || !tokenConfigured}
                onClick={testToken}
              >
                <GatewayIcon name="check" />
              </IconButton>
              <IconButton
                type="button"
                compact
                aria-label="Refresh gateways"
                title="Refresh gateways"
                disabled={busy}
                onClick={() => void load()}
              >
                <GatewayIcon name="refresh" />
              </IconButton>
            </div>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <section className="space-y-6">
          <div className="border-b border-border-subtle pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot tone={statusTone} size="sm" />
                  <h2 className="truncate text-base font-semibold text-primary">{telegramProvider?.label ?? 'Telegram'}</h2>
                </div>
                <GatewayReadinessTable
                  tokenConfigured={tokenConfigured}
                  connectionCreated={Boolean(telegramConnection)}
                  runtimeLabel={gatewayEnabled ? formatGatewayStatus(connectionStatus) : 'Paused'}
                />
                {telegramConnection?.statusMessage ? <p className="text-xs text-secondary">{telegramConnection.statusMessage}</p> : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {telegramConnection ? (
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <span>{gatewayEnabled ? 'Enabled' : 'Paused'}</span>
                    <Switch
                      checked={gatewayEnabled}
                      disabled={gatewayToggleDisabled}
                      aria-label={gatewayEnabled ? 'Pause Telegram gateway' : 'Enable Telegram gateway'}
                      onClick={() => setConnectionEnabled(!gatewayEnabled)}
                    />
                  </label>
                ) : (
                  <Button variant="action" tone="accent" disabled={busy} onClick={createConnection}>
                    <GatewayIcon name="plus" />
                    Create connection
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-border-subtle pb-5">
            <h2 className="text-base font-semibold text-primary">Bot token</h2>
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
                {tokenDraft.trim() ? (
                  <Button variant="action" tone="accent" title="Save Telegram bot token" disabled={busy} onClick={saveToken}>
                    <GatewayIcon name="check" />
                    Save token
                  </Button>
                ) : null}
                {tokenConfigured ? (
                  <IconButton
                    type="button"
                    compact
                    className="text-danger"
                    aria-label="Remove Telegram bot token"
                    title="Remove Telegram bot token"
                    disabled={busy}
                    onClick={removeToken}
                  >
                    <GatewayIcon name="trash" />
                  </IconButton>
                ) : null}
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
        </section>
      </AppPageLayout>
    </div>
  );
}

function GatewaysLoadingPage() {
  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="space-y-6">
        <AppPageIntro
          title="Gateways"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <IconButton type="button" compact aria-label="Test Telegram bot" title="Test Telegram bot" disabled>
                <GatewayIcon name="check" />
              </IconButton>
              <IconButton type="button" compact aria-label="Refresh gateways" title="Refresh gateways" disabled>
                <GatewayIcon name="refresh" />
              </IconButton>
            </div>
          }
        />
        <QuietLoadingState label="Loading gateway settings" className="min-h-24" />
      </AppPageLayout>
    </div>
  );
}

function WindowedGatewaysLoading() {
  return (
    <WindowedPageShell layout="standard" className="gateways-page-windowed">
      <WindowedPageMain title="Telegram">
        <WindowedPageSection title="Status" meta="Loading">
          <WindowedLoadingState label="Loading gateway settings" />
        </WindowedPageSection>
      </WindowedPageMain>
    </WindowedPageShell>
  );
}

export function GatewaysContextRail() {
  const [state, setState] = useState<PageState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    void loadPageState()
      .then(setState)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleInvalidation = (event: Event) => {
      const detail = (event as CustomEvent<{ topics?: unknown }>).detail;
      const topics = Array.isArray(detail?.topics) ? detail.topics : [];
      if (topics.includes('gateways') || topics.includes('sessions')) {
        load();
      }
    };
    window.addEventListener('neon-pilot-app-invalidate', handleInvalidation);
    return () => window.removeEventListener('neon-pilot-app-invalidate', handleInvalidation);
  }, [load]);

  const telegramProvider = state?.gateway.providers.find((provider) => provider.id === TELEGRAM_PROVIDER_ID) ?? null;
  const telegramConnection = state?.gateway.connections.find((connection) => connection.provider === TELEGRAM_PROVIDER_ID) ?? null;
  const telegramEvents = state?.gateway.events.filter((event) => event.provider === TELEGRAM_PROVIDER_ID).slice(0, 8) ?? [];

  return (
    <ContextRail>
      <ContextRailHeader
        eyebrow="Gateway context"
        title={telegramProvider?.label ?? 'Telegram'}
        subtitle={state?.token.configured ? formatGatewayStatus(telegramConnection?.status ?? 'needs_config') : 'Token missing'}
      />
      <ContextRailBody>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {!state && !error ? <QuietLoadingState label="Loading gateway context" className="min-h-12" /> : null}
        {state ? (
          <>
            <ContextRailSection
              title="Status"
              actions={
                <StatusDot
                  tone={statusDotTone(
                    telegramConnection?.status ?? 'needs_config',
                    state.token.configured,
                    Boolean(telegramConnection?.enabled),
                  )}
                  size="xs"
                />
              }
            >
              <KeyValueList>
                <KeyValueItem label="Setup" value={telegramProvider?.setupRoute ?? '/gateways'} />
                <KeyValueItem label="Configuration" value={formatConfigurationLocation(telegramProvider?.configurationLocation)} />
                <KeyValueItem
                  label="Docs"
                  value={
                    telegramProvider?.docsUrl ? (
                      <TextLink href={telegramProvider.docsUrl} target="_blank" rel="noreferrer">
                        Telegram Bot API
                      </TextLink>
                    ) : (
                      'Telegram Bot API'
                    )
                  }
                />
                <KeyValueItem
                  label="Last update"
                  value={telegramConnection?.updatedAt ? formatDate(telegramConnection.updatedAt) : 'Never'}
                />
              </KeyValueList>
            </ContextRailSection>

            <ContextRailSection title="Recent activity">
              {telegramEvents.length > 0 ? (
                <ol className="divide-y divide-border-subtle">
                  {telegramEvents.map((event) => (
                    <li key={event.id} className="py-2">
                      <div className="text-[13px] text-primary">{event.message}</div>
                      <div className="mt-1 text-[11px] text-secondary">
                        {formatEventKind(event.kind)} · {formatDate(event.createdAt)}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <PanelMessage className="py-2">No Telegram gateway events yet.</PanelMessage>
              )}
            </ContextRailSection>
          </>
        ) : null}
      </ContextRailBody>
    </ContextRail>
  );
}

function WindowedAllowlistEditor({
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
    <div className="wos-gateway-allowlist">
      <div className="wos-gateway-allowlist__header">
        <h4>{title}</h4>
        <span>{values.length} approved</span>
      </div>
      <div className="wos-gateway-allowlist__form">
        <WindowedField label={inputLabel}>
          <WindowedTextInput
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
        </WindowedField>
        {value.trim() ? (
          <WindowedPageButton
            disabled={busy}
            aria-label={`Add ${title.toLowerCase()}`}
            title={`Add ${title.toLowerCase()}`}
            onClick={onAdd}
          >
            Add
          </WindowedPageButton>
        ) : null}
      </div>
      {values.length > 0 ? (
        <WindowedList className="wos-gateway-allowlist__values">
          {values.map((entry) => (
            <WindowedListItem
              key={entry}
              title={entry}
              meta="Allowed"
              accent="gateways"
              status={
                <WindowedPageButton
                  tone="danger"
                  disabled={busy}
                  aria-label={`Remove ${entry} from ${title.toLowerCase()}`}
                  title={`Remove ${entry} from ${title.toLowerCase()}`}
                  onClick={() => onRemove(entry)}
                >
                  Remove
                </WindowedPageButton>
              }
            />
          ))}
        </WindowedList>
      ) : (
        <WindowedEmptyState>{emptyLabel}</WindowedEmptyState>
      )}
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
    <div className="pb-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-primary">Telegram access</h2>
        <p className="text-sm text-secondary">Only approved users and chats can send work to Neon Pilot.</p>
      </div>
      <div className="mt-4 grid gap-4">
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
    <div className="min-w-0 rounded-md border border-border-subtle/70 bg-surface/35">
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-border-subtle/60 px-3">
        <h3 className="text-sm font-medium text-primary">{title}</h3>
        <span className="text-[11px] text-tertiary">{values.length} approved</span>
      </div>
      <div className="flex gap-2 px-3 py-3">
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
        {value.trim() ? (
          <IconButton
            type="button"
            compact
            aria-label={`Add ${title.toLowerCase()}`}
            title={`Add ${title.toLowerCase()}`}
            disabled={busy}
            onClick={onAdd}
          >
            <GatewayIcon name="plus" />
          </IconButton>
        ) : null}
      </div>
      {values.length > 0 ? (
        <ul className="divide-y divide-border-subtle/55 border-t border-border-subtle/55">
          {values.map((entry) => (
            <li key={entry} className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
              <span className="truncate font-mono text-xs text-primary">{entry}</span>
              <IconButton
                type="button"
                compact
                aria-label={`Remove ${entry}`}
                title={`Remove ${entry}`}
                disabled={busy}
                onClick={() => onRemove(entry)}
              >
                <GatewayIcon name="trash" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border-subtle/55 px-3 py-3 text-sm text-secondary">{emptyLabel}</p>
      )}
    </div>
  );
}

function GatewayReadinessTable({
  tokenConfigured,
  connectionCreated,
  runtimeLabel,
}: {
  tokenConfigured: boolean;
  connectionCreated: boolean;
  runtimeLabel: string;
}) {
  return (
    <KeyValueTable
      columns={3}
      items={[
        { label: 'Token', value: tokenConfigured ? 'Configured' : 'Missing' },
        { label: 'Connection', value: connectionCreated ? 'Created' : 'Not created' },
        { label: 'Runtime', value: runtimeLabel },
      ]}
      className="max-w-2xl"
    />
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

function gatewayBadgeTone(
  status: GatewayStatus,
  tokenConfigured: boolean,
  enabled: boolean,
): 'neutral' | 'positive' | 'warning' | 'danger' {
  const tone = statusDotTone(status, tokenConfigured, enabled);
  if (tone === 'success') return 'positive';
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  return 'neutral';
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
