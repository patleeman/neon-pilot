import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  StatusDot,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type GatewayProviderId = 'telegram' | 'slack_mcp';
type GatewayStatus = 'needs_config' | 'connected' | 'active' | 'paused' | 'needs_attention';

interface GatewayProviderSummary {
  id: GatewayProviderId;
  label: string;
  implemented: boolean;
}

interface GatewayConnection {
  id: string;
  provider: GatewayProviderId;
  label: string;
  status: GatewayStatus;
  enabled: boolean;
  statusMessage?: string;
  updatedAt: string;
}

interface GatewayThreadBinding {
  id: string;
  provider: GatewayProviderId;
  conversationId: string;
  conversationTitle?: string;
  externalChatId?: string;
  externalChatLabel?: string;
  repliesEnabled: boolean;
  updatedAt: string;
}

interface GatewayChatTarget {
  id: string;
  provider: GatewayProviderId;
  externalChatId: string;
  externalChatLabel?: string;
  conversationId: string;
  conversationTitle?: string;
  repliesEnabled: boolean;
  updatedAt: string;
}

interface GatewayEvent {
  id: string;
  provider: GatewayProviderId;
  conversationId?: string;
  kind: 'inbound' | 'outbound' | 'routing' | 'status' | 'error';
  message: string;
  createdAt: string;
}

interface GatewayState {
  providers: GatewayProviderSummary[];
  connections: GatewayConnection[];
  bindings: GatewayThreadBinding[];
  chatTargets: GatewayChatTarget[];
  events: GatewayEvent[];
}

interface TelegramTokenState {
  configured: boolean;
}

interface GatewayFormState {
  conversationId: string;
  conversationTitle: string;
  externalChatId: string;
  externalChatLabel: string;
}

const emptyGatewayState: GatewayState = {
  providers: [],
  connections: [],
  bindings: [],
  chatTargets: [],
  events: [],
};

const emptyForm: GatewayFormState = {
  conversationId: '',
  conversationTitle: '',
  externalChatId: '',
  externalChatLabel: '',
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `${response.status} ${response.statusText}`);
  }
  return body as T;
}

function formatStatus(status: GatewayStatus): string {
  return status.replace(/_/g, ' ');
}

function statusTone(status: GatewayStatus): string {
  if (status === 'active' || status === 'connected') return 'success';
  if (status === 'needs_attention') return 'danger';
  if (status === 'paused') return 'muted';
  return 'warning';
}

function providerLabel(provider: GatewayProviderId): string {
  return provider === 'telegram' ? 'Telegram' : 'Slack MCP';
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function findProviderConnection(state: GatewayState, provider: GatewayProviderId): GatewayConnection | null {
  return state.connections.find((connection) => connection.provider === provider) ?? null;
}

function hasTelegramRoute(state: GatewayState, conversationId: string): boolean {
  return state.bindings.some((binding) => binding.provider === 'telegram' && binding.conversationId === conversationId);
}

function normalizeForm(value: GatewayFormState): GatewayFormState {
  return {
    conversationId: value.conversationId.trim(),
    conversationTitle: value.conversationTitle.trim(),
    externalChatId: value.externalChatId.trim(),
    externalChatLabel: value.externalChatLabel.trim(),
  };
}

export function GatewaysPage({ context }: ExtensionSurfaceProps) {
  const [state, setState] = useState<GatewayState>(emptyGatewayState);
  const [token, setToken] = useState<TelegramTokenState>({ configured: false });
  const [tokenDraft, setTokenDraft] = useState('');
  const [form, setForm] = useState<GatewayFormState>(() => ({
    ...emptyForm,
    conversationId: context.conversationId ?? '',
  }));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [nextState, nextToken] = await Promise.all([
      fetchJson<GatewayState>('/api/gateways'),
      fetchJson<TelegramTokenState>('/api/gateways/telegram/token'),
    ]);
    setState(nextState);
    setToken(nextToken);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    refresh()
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (context.conversationId) {
      setForm((current) => ({ ...current, conversationId: current.conversationId || context.conversationId || '' }));
    }
  }, [context.conversationId]);

  const telegramConnection = useMemo(() => findProviderConnection(state, 'telegram'), [state]);
  const telegramBindings = useMemo(() => state.bindings.filter((binding) => binding.provider === 'telegram'), [state.bindings]);
  const unassignedTelegramTargets = useMemo(
    () =>
      state.chatTargets.filter(
        (target) => target.provider === 'telegram' && (!target.conversationId || !hasTelegramRoute(state, target.conversationId)),
      ),
    [state],
  );

  async function runOperation(label: string, operation: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await operation();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function toggleTelegram(enabled: boolean) {
    await runOperation('toggle-telegram', async () => {
      setState(
        await fetchJson<GatewayState>('/api/gateways/connections/telegram', {
          method: 'PATCH',
          body: JSON.stringify({ status: enabled ? 'active' : 'paused', enabled }),
        }),
      );
      setMessage(enabled ? 'Telegram gateway enabled.' : 'Telegram gateway paused.');
    });
  }

  async function saveTelegramToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenDraft.trim();
    if (!token) {
      setError('Telegram bot token is required.');
      return;
    }
    await runOperation('telegram-token', async () => {
      const result = await fetchJson<{ configured: boolean; state: GatewayState }>('/api/gateways/telegram/token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setToken({ configured: result.configured });
      setState(result.state);
      setTokenDraft('');
      setMessage('Telegram token saved and gateway started.');
    });
  }

  async function removeTelegramToken() {
    await runOperation('remove-telegram-token', async () => {
      const result = await fetchJson<{ configured: boolean; state: GatewayState }>('/api/gateways/telegram/token', { method: 'DELETE' });
      setToken({ configured: result.configured });
      setState(result.state);
      setMessage('Telegram token removed.');
    });
  }

  async function attachConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = normalizeForm(form);
    if (!next.conversationId) {
      setError('Conversation id is required.');
      return;
    }
    await runOperation('attach-telegram', async () => {
      setState(
        await fetchJson<GatewayState>('/api/gateways/bindings', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'telegram',
            conversationId: next.conversationId,
            conversationTitle: next.conversationTitle || undefined,
            externalChatId: next.externalChatId || undefined,
            externalChatLabel: next.externalChatLabel || undefined,
          }),
        }),
      );
      setForm({ ...emptyForm, conversationId: context.conversationId ?? '' });
      setMessage('Telegram route saved.');
    });
  }

  async function detachConversation(conversationId: string) {
    await runOperation(`detach-${conversationId}`, async () => {
      setState(
        await fetchJson<GatewayState>(`/api/gateways/bindings/${encodeURIComponent(conversationId)}?provider=telegram`, {
          method: 'DELETE',
        }),
      );
      setMessage('Telegram route removed.');
    });
  }

  const telegramStatus = telegramConnection?.status ?? 'needs_config';
  const telegramReady = token.configured && telegramConnection?.enabled && telegramStatus !== 'paused' && telegramStatus !== 'needs_attention';

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <LoadingState label="Loading gateways..." />
      </div>
    );
  }

  if (error && state.providers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <ErrorState message={error} />
          <Button variant="action" onClick={refresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[74rem]" contentClassName="space-y-8">
        <AppPageIntro
          title="Gateways"
          summary="Route external messages into Neon Pilot conversations."
          actions={<ToolbarButton onClick={refresh}>Refresh</ToolbarButton>}
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}

        <AppPageSection title="Telegram" layout="stacked" bodyClassName="space-y-5">
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium text-primary">
                <StatusDot tone={telegramReady ? 'success' : statusTone(telegramStatus)} />
                <span>{telegramReady ? 'Ready' : token.configured ? formatStatus(telegramStatus) : 'Needs Bot Token'}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                Bot {token.configured ? 'configured' : 'not configured'}; {telegramBindings.length} active{' '}
                {telegramBindings.length === 1 ? 'route' : 'routes'}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {telegramConnection ? (
                <ToolbarButton disabled={!token.configured || busy === 'toggle-telegram'} onClick={() => toggleTelegram(!telegramConnection.enabled)}>
                  {telegramConnection.enabled ? 'Pause Telegram' : 'Start Telegram'}
                </ToolbarButton>
              ) : null}
              <ToolbarButton disabled={!token.configured || busy === 'remove-telegram-token'} onClick={removeTelegramToken}>
                Remove Token
              </ToolbarButton>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
            <form className="space-y-3" onSubmit={saveTelegramToken}>
              <div>
                <h3 className="text-[14px] font-semibold text-primary">Bot</h3>
                <p className="mt-1 text-[12px] text-muted">Stored in extension secrets.</p>
              </div>
              <Field label="Telegram bot token">
                <TextInput
                  name="telegramBotToken"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={tokenDraft}
                  placeholder={token.configured ? 'Configured' : '123456:ABC...'}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTokenDraft(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="action" disabled={busy === 'telegram-token'}>
                  Save Token
                </Button>
              </div>
            </form>

            <form className="grid gap-3 md:grid-cols-2" onSubmit={attachConversation}>
              <div className="md:col-span-2">
                <h3 className="text-[14px] font-semibold text-primary">Route Messages</h3>
                <p className="mt-1 text-[12px] text-muted">Choose the conversation that receives messages from a Telegram chat.</p>
              </div>
              <Field label="Conversation ID">
                <TextInput
                  name="conversationId"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.conversationId}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, conversationId: event.target.value }))}
                />
              </Field>
              <Field label="Conversation Title">
                <TextInput
                  name="conversationTitle"
                  autoComplete="off"
                  value={form.conversationTitle}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setForm((current) => ({ ...current, conversationTitle: event.target.value }))
                  }
                />
              </Field>
              <Field label="Telegram Chat ID">
                <TextInput
                  name="telegramChatId"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.externalChatId}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, externalChatId: event.target.value }))}
                />
              </Field>
              <Field label="Telegram Chat Label">
                <TextInput
                  name="telegramChatLabel"
                  autoComplete="off"
                  value={form.externalChatLabel}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setForm((current) => ({ ...current, externalChatLabel: event.target.value }))
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <Button type="submit" variant="action" disabled={!token.configured || busy === 'attach-telegram'}>
                  Save Route
                </Button>
                {!token.configured ? <p className="mt-2 text-[12px] text-muted">Save a bot token before routing messages.</p> : null}
              </div>
            </form>
          </div>
        </AppPageSection>

        <AppPageSection title="Active Routes" layout="stacked">
          {telegramBindings.length === 0 ? (
            <EmptyState title="No Telegram routes" />
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Conversation</DataTableHeaderCell>
                  <DataTableHeaderCell>Telegram Chat</DataTableHeaderCell>
                  <DataTableHeaderCell>Replies</DataTableHeaderCell>
                  <DataTableHeaderCell>Updated</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {telegramBindings.map((binding) => (
                  <DataTableRow key={binding.id}>
                    <DataTableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-primary">{binding.conversationTitle || binding.conversationId}</div>
                        <div className="truncate text-[11px] text-muted">{binding.conversationId}</div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>{binding.externalChatLabel || binding.externalChatId || 'Unassigned'}</DataTableCell>
                    <DataTableCell>{binding.repliesEnabled ? 'On' : 'Off'}</DataTableCell>
                    <DataTableCell>{formatDate(binding.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <ToolbarButton disabled={busy === `detach-${binding.conversationId}`} onClick={() => detachConversation(binding.conversationId)}>
                        Detach
                      </ToolbarButton>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </AppPageSection>

        {unassignedTelegramTargets.length > 0 ? (
          <AppPageSection title="Incoming Chats" layout="stacked">
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Telegram Chat</DataTableHeaderCell>
                  <DataTableHeaderCell>Conversation</DataTableHeaderCell>
                  <DataTableHeaderCell>Replies</DataTableHeaderCell>
                  <DataTableHeaderCell>Updated</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {unassignedTelegramTargets.map((target) => (
                  <DataTableRow key={target.id}>
                    <DataTableCell>{target.externalChatLabel || target.externalChatId}</DataTableCell>
                    <DataTableCell>{target.conversationTitle || target.conversationId || 'Unassigned'}</DataTableCell>
                    <DataTableCell>{target.repliesEnabled ? 'On' : 'Off'}</DataTableCell>
                    <DataTableCell>{formatDate(target.updatedAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </AppPageSection>
        ) : null}

        <AppPageSection title="Recent Activity" layout="stacked">
          {state.events.length === 0 ? (
            <EmptyState title="No gateway activity" />
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Time</DataTableHeaderCell>
                  <DataTableHeaderCell>Provider</DataTableHeaderCell>
                  <DataTableHeaderCell>Kind</DataTableHeaderCell>
                  <DataTableHeaderCell>Message</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {state.events.slice(0, 20).map((event) => (
                  <DataTableRow key={event.id}>
                    <DataTableCell>{formatDate(event.createdAt)}</DataTableCell>
                    <DataTableCell>{providerLabel(event.provider)}</DataTableCell>
                    <DataTableCell className="capitalize">{event.kind}</DataTableCell>
                    <DataTableCell>{event.message}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </AppPageSection>
      </AppPageLayout>
    </div>
  );
}
