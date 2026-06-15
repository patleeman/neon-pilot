import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  ActivityTreeView,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  ErrorState,
  Field,
  IconButton,
  LoadingState,
  Notice,
  PanelMessage,
  SectionLabel,
  Select,
  StatusDot,
  TextInput,
  TextLink,
  ToolbarButton,
  type ActivityTreeItem,
} from '@neon-pilot/extensions/ui';
import React, { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type GatewayProviderId = 'telegram' | string;
type GatewayStatus = 'needs_config' | 'connected' | 'active' | 'paused' | 'needs_attention';

interface GatewayProviderSummary {
  id: GatewayProviderId;
  label: string;
  description?: string;
  icon?: string;
  implemented: boolean;
  configurationLocation?: 'gateways' | 'settings' | 'extension' | 'external';
  extensionId?: string;
  setupRoute?: string;
  docsUrl?: string;
  order?: number;
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

interface SessionSummary {
  id: string;
  title?: string;
  cwd?: string;
  lastActivityAt?: string;
  timestamp?: string;
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

function providerFallbackLabel(provider: GatewayProviderId): string {
  if (provider === 'telegram') return 'Telegram';
  return provider
    .replace(/[_:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function providerLabel(provider: GatewayProviderId, providers: GatewayProviderSummary[] = []): string {
  return providers.find((candidate) => candidate.id === provider)?.label ?? providerFallbackLabel(provider);
}

function formatRouteCount(count: number): string {
  return `${count} active ${count === 1 ? 'route' : 'routes'}`;
}

function conversationLabel(conversation: SessionSummary): string {
  return conversation.title || conversation.id;
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

function buildConversationRoute(conversationId: string): string {
  return `/conversations/${encodeURIComponent(conversationId)}?gateway=1`;
}

function buildGatewayRouteActivityId(binding: GatewayThreadBinding): string {
  return `gateway-route:${binding.provider}:${binding.conversationId}`;
}

function selectedConversationIdFromPath(pathname: string): string | null {
  const match = /^\/conversations\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function selectedConversationIdFromContext(context: ExtensionSurfaceProps['context']): string {
  if (context.conversationId) return context.conversationId;
  const search = context.search.startsWith('?') ? context.search.slice(1) : context.search;
  return new URLSearchParams(search).get('conversationId') ?? '';
}

async function navigateTo(pa: ExtensionSurfaceProps['pa'], to: string) {
  const handled = await pa.commands?.execute?.('app.navigate', { to });
  if (!handled && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: to } }));
  }
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

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 7a5 5 0 0 0-8.5-3.2L3 5.3" />
      <path d="M3 2.8v2.5h2.5" />
      <path d="M3 9a5 5 0 0 0 8.5 3.2L13 10.7" />
      <path d="M13 13.2v-2.5h-2.5" />
    </svg>
  );
}

export function GatewaysSidebar({ pa, context }: ExtensionSurfaceProps) {
  const [state, setState] = useState<GatewayState>(emptyGatewayState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await fetchJson<GatewayState>('/api/gateways'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const providersById = useMemo(() => new Map(state.providers.map((provider) => [provider.id, provider])), [state.providers]);
  const activeConversationId = selectedConversationIdFromPath(context.pathname);
  const telegramBindings = state.bindings.filter((binding) => binding.provider === 'telegram');
  const activeBinding = telegramBindings.find((binding) => binding.conversationId === activeConversationId);
  const activeItemId = activeBinding ? buildGatewayRouteActivityId(activeBinding) : null;
  const telegramConnection = findProviderConnection(state, 'telegram');
  const overallStatus: GatewayStatus = telegramConnection?.enabled
    ? telegramConnection.status
    : telegramConnection
      ? 'paused'
      : 'needs_config';
  const treeItems: ActivityTreeItem[] = telegramBindings.map((binding) => ({
    id: buildGatewayRouteActivityId(binding),
    kind: 'conversation',
    title: binding.conversationTitle || binding.conversationId,
    subtitle: `${providerLabel(binding.provider, state.providers)} · ${binding.externalChatLabel || binding.externalChatId || 'Chat not assigned'}`,
    status: 'idle',
    route: buildConversationRoute(binding.conversationId),
    updatedAt: binding.updatedAt,
    metadata: {
      conversationId: binding.conversationId,
      provider: binding.provider,
      tooltip: `${binding.conversationTitle || binding.conversationId} · ${
        binding.externalChatLabel || binding.externalChatId || providerLabel(binding.provider, state.providers)
      }`,
    },
  }));
  const summary = telegramBindings.length > 0 ? `${formatRouteCount(telegramBindings.length)} · Telegram` : 'No Telegram routes';

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="px-4 pb-1 pt-1">
        <div className="flex items-center gap-1">
          <SectionLabel className="flex-1">Telegram Routes</SectionLabel>
          <IconButton compact title="Refresh routes" aria-label="Refresh routes" disabled={loading} onClick={() => void load()}>
            <SidebarSvgIcon path="M20 6v5h-5M4 18v-5h5M18.4 9A7 7 0 0 0 6.2 6.8L4 9m2 6a7 7 0 0 0 11.8 2.2L20 15" />
          </IconButton>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          <StatusDot tone={statusTone(overallStatus)} />
          <span>{summary}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {loading && treeItems.length === 0 ? <LoadingState label="Loading routes..." className="h-24 justify-center" /> : null}
        {error ? <p className="px-4 py-2 text-[12px] leading-5 text-danger">{error}</p> : null}
        {!loading && treeItems.length === 0 && !error ? (
          <PanelMessage className="px-4 py-3">
            {providersById.has('telegram') ? 'No Telegram routes yet.' : 'Telegram Gateway is not enabled.'}
          </PanelMessage>
        ) : null}
        {treeItems.length > 0 ? (
          <ActivityTreeView
            items={treeItems}
            activeItemId={activeItemId}
            onOpenItem={(item) => {
              if (item.route) void navigateTo(pa, item.route);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function GatewaysPage({ pa, context }: ExtensionSurfaceProps) {
  const selectedContextConversationId = selectedConversationIdFromContext(context);
  const [state, setState] = useState<GatewayState>(emptyGatewayState);
  const [token, setToken] = useState<TelegramTokenState>({ configured: false });
  const [conversations, setConversations] = useState<SessionSummary[]>([]);
  const [tokenDraft, setTokenDraft] = useState('');
  const [form, setForm] = useState<GatewayFormState>(() => ({
    ...emptyForm,
    conversationId: selectedContextConversationId,
  }));
  const previousContextConversationIdRef = useRef(selectedContextConversationId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [nextState, nextToken, nextConversations] = await Promise.all([
      fetchJson<GatewayState>('/api/gateways'),
      fetchJson<TelegramTokenState>('/api/gateways/telegram/token'),
      fetchJson<SessionSummary[]>('/api/sessions?limit=100'),
    ]);
    setState(nextState);
    setToken(nextToken);
    setConversations(nextConversations);
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
    const previousContextConversationId = previousContextConversationIdRef.current;
    const contextChanged = previousContextConversationId !== selectedContextConversationId;
    const matched = conversations.find((conversation) => conversation.id === selectedContextConversationId);

    setForm((current) => {
      if (contextChanged) {
        if (selectedContextConversationId) {
          return {
            ...current,
            conversationId: selectedContextConversationId,
            conversationTitle: matched?.title || '',
          };
        }
        if (previousContextConversationId && current.conversationId === previousContextConversationId) {
          return {
            ...current,
            conversationId: '',
            conversationTitle: '',
          };
        }
        return current;
      }

      if (selectedContextConversationId && current.conversationId === selectedContextConversationId && matched?.title) {
        return {
          ...current,
          conversationTitle: current.conversationTitle || matched.title,
        };
      }
      return current;
    });
    previousContextConversationIdRef.current = selectedContextConversationId;
  }, [selectedContextConversationId, conversations]);

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

  function selectConversation(conversationId: string) {
    const conversation = conversations.find((candidate) => candidate.id === conversationId);
    setForm((current) => ({
      ...current,
      conversationId,
      conversationTitle: conversation ? conversationLabel(conversation) : '',
    }));
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
      setForm({ ...emptyForm, conversationId: selectedContextConversationId });
      setMessage('Telegram route saved.');
    });
  }

  async function detachConversation(provider: GatewayProviderId, conversationId: string) {
    await runOperation(`detach-${provider}-${conversationId}`, async () => {
      setState(
        await fetchJson<GatewayState>(
          `/api/gateways/bindings/${encodeURIComponent(conversationId)}?provider=${encodeURIComponent(provider)}`,
          {
            method: 'DELETE',
          },
        ),
      );
      setMessage(`${providerLabel(provider, state.providers)} route removed.`);
    });
  }

  const telegramStatus = telegramConnection?.status ?? 'needs_config';
  const telegramReady =
    token.configured && telegramConnection?.enabled && telegramStatus !== 'paused' && telegramStatus !== 'needs_attention';
  const telegramTone = token.configured ? (telegramReady ? 'success' : statusTone(telegramStatus)) : 'warning';

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
      <AppPageLayout shellClassName="max-w-[74rem]" contentClassName="space-y-5">
        <AppPageIntro
          title="Telegram Gateway"
          actions={
            <IconButton aria-label="Refresh gateway" title="Refresh gateway" onClick={refresh}>
              <RefreshIcon />
            </IconButton>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}

        <AppPageSection layout="stacked" bodyClassName="space-y-4">
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                <StatusDot tone={telegramTone} />
                {telegramReady ? 'Connected' : token.configured ? formatStatus(telegramStatus) : 'Needs Bot Token'}
              </span>
              <span>{token.configured ? 'Token saved' : 'Token required'}</span>
              <span>
                {telegramBindings.length} active {telegramBindings.length === 1 ? 'route' : 'routes'}
              </span>
              <TextLink href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                BotFather
              </TextLink>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {telegramConnection ? (
                <ToolbarButton
                  disabled={!token.configured || busy === 'toggle-telegram'}
                  onClick={() => toggleTelegram(!telegramConnection.enabled)}
                >
                  {telegramConnection.enabled ? 'Pause Telegram' : 'Start Telegram'}
                </ToolbarButton>
              ) : null}
              <ToolbarButton disabled={!token.configured || busy === 'remove-telegram-token'} onClick={removeTelegramToken}>
                Remove Token
              </ToolbarButton>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
            <form className="space-y-3" onSubmit={saveTelegramToken}>
              <SectionLabel tone="muted">Credentials</SectionLabel>
              <Field label="Bot Token">
                <TextInput
                  name="telegramBotToken"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={tokenDraft}
                  placeholder={token.configured ? 'Configured' : '123456:ABC…'}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTokenDraft(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="action" disabled={busy === 'telegram-token'}>
                Save Token
              </Button>
            </form>

            <div className="space-y-3">
              <SectionLabel tone="muted">Route</SectionLabel>
              {token.configured ? (
                <form className="space-y-3" onSubmit={attachConversation}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Conversation">
                      <Select
                        name="conversationId"
                        autoComplete="off"
                        value={form.conversationId}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => selectConversation(event.target.value)}
                      >
                        <option value="">Choose a conversation…</option>
                        {conversations.map((conversation) => (
                          <option key={conversation.id} value={conversation.id}>
                            {conversationLabel(conversation)}
                          </option>
                        ))}
                        {form.conversationId && !conversations.some((conversation) => conversation.id === form.conversationId) ? (
                          <option value={form.conversationId}>{form.conversationTitle || form.conversationId}</option>
                        ) : null}
                      </Select>
                    </Field>
                    <Field label="Telegram Chat ID">
                      <TextInput
                        name="telegramChatId"
                        autoComplete="off"
                        spellCheck={false}
                        value={form.externalChatId}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setForm((current) => ({ ...current, externalChatId: event.target.value }))
                        }
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
                  </div>
                  {form.conversationId ? (
                    <div className="text-[12px] leading-5 text-muted">Routes into {form.conversationTitle || form.conversationId}.</div>
                  ) : null}
                  <Button type="submit" variant="action" disabled={busy === 'attach-telegram'}>
                    Save Route
                  </Button>
                </form>
              ) : (
                <PanelMessage>Save a bot token before routing Telegram chats into conversations.</PanelMessage>
              )}
            </div>
          </div>
        </AppPageSection>

        <AppPageSection layout="stacked" bodyClassName="space-y-2">
          <SectionLabel tone="muted">Active Routes</SectionLabel>
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
              {telegramBindings.length === 0 ? <DataTableEmptyRow colSpan={5}>No Telegram routes yet.</DataTableEmptyRow> : null}
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
                    <ToolbarButton
                      disabled={busy === `detach-${binding.provider}-${binding.conversationId}`}
                      onClick={() => detachConversation(binding.provider, binding.conversationId)}
                    >
                      Detach
                    </ToolbarButton>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </AppPageSection>

        {unassignedTelegramTargets.length > 0 ? (
          <AppPageSection layout="stacked" bodyClassName="space-y-2">
            <SectionLabel tone="muted">Incoming Chats</SectionLabel>
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

        <AppPageSection layout="stacked" bodyClassName="space-y-2">
          <SectionLabel tone="muted">Recent Activity</SectionLabel>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Time</DataTableHeaderCell>
                <DataTableHeaderCell>Kind</DataTableHeaderCell>
                <DataTableHeaderCell>Message</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {state.events.length === 0 ? <DataTableEmptyRow colSpan={3}>No Telegram activity yet.</DataTableEmptyRow> : null}
              {state.events.slice(0, 20).map((event) => (
                <DataTableRow key={event.id}>
                  <DataTableCell>{formatDate(event.createdAt)}</DataTableCell>
                  <DataTableCell className="capitalize">{event.kind}</DataTableCell>
                  <DataTableCell>{event.message}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </AppPageSection>
      </AppPageLayout>
    </div>
  );
}
