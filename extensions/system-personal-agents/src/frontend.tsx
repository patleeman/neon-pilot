import type { ExtensionSurfaceProps, PersonalAgentGatewayBinding, PersonalAgentProfile } from '@neon-pilot/extensions';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  LoadingState,
  Notice,
  SectionLabel,
  Select,
  StatusDot,
  TextButton,
  Textarea,
  TextInput,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type HostWrapperProps = ExtensionSurfaceProps & {
  HostComponent: React.ComponentType<ExtensionSurfaceProps>;
  hostProps?: Record<string, unknown>;
};

interface ProfileListResult {
  profiles: PersonalAgentProfile[];
}

interface EnsureConversationResult {
  profile: PersonalAgentProfile;
  conversationId: string;
}

export function parseAgentId(pathname: string): string | null {
  const match = pathname.match(/^\/agents\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .flatMap((part) => (part.trim() ? [part.trim()[0]?.toUpperCase() ?? ''] : []))
    .join('')
    .slice(0, 2);
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function gatewaySummary(bindings: PersonalAgentGatewayBinding[]): string {
  const enabled = bindings.filter((binding) => binding.enabled);
  if (enabled.length === 0) return 'No gateways';
  return enabled.map((binding) => binding.displayName || binding.gatewayId).join(', ');
}

function cloneBindings(bindings: PersonalAgentGatewayBinding[]): PersonalAgentGatewayBinding[] {
  return bindings.map((binding) => ({ ...binding }));
}

export function PersonalAgentsShell({ HostComponent, ...props }: HostWrapperProps) {
  const { pa, context } = props;
  const routeAgentId = parseAgentId(context.pathname);
  const [profiles, setProfiles] = useState<PersonalAgentProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(routeAgentId);
  const [selected, setSelected] = useState<PersonalAgentProfile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paRef = useRef(pa);
  paRef.current = pa;

  const selectedProfile = useMemo(
    () => selected ?? profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selected, selectedId],
  );

  const navigateAgent = useCallback(
    (agentId: string) => {
      setSelectedId(agentId);
      void pa.commands.execute('app.navigate', { to: `/agents/${encodeURIComponent(agentId)}` });
    },
    [pa.commands],
  );

  const refresh = useCallback(async () => {
    setError(null);
    const result = await paRef.current.extension.invoke<ProfileListResult>('listProfiles', {});
    setProfiles(result.profiles);
    const routeProfile = routeAgentId ? result.profiles.find((profile) => profile.id === routeAgentId) : null;
    const selectedProfile = selectedId ? result.profiles.find((profile) => profile.id === selectedId) : null;
    const nextId = routeProfile?.id ?? selectedProfile?.id ?? result.profiles[0]?.id ?? null;
    if (!nextId) {
      setSelected(null);
      setSelectedId(null);
      setConversationId(null);
      if (routeAgentId) {
        void paRef.current.commands.execute('app.navigate', { to: '/agents' });
      }
      return;
    }
    setSelectedId(nextId);
    const ensured = await paRef.current.extension.invoke<EnsureConversationResult>('ensureDefaultConversation', { id: nextId });
    setSelected(ensured.profile);
    setProfiles((current) => current.map((profile) => (profile.id === ensured.profile.id ? ensured.profile : profile)));
    setConversationId(ensured.conversationId);
    if (!routeProfile) {
      void paRef.current.commands.execute('app.navigate', { to: `/agents/${encodeURIComponent(nextId)}` });
    }
  }, [routeAgentId, selectedId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function run<T>(label: string, action: () => Promise<T>): Promise<T | null> {
    if (busy) return null;
    setBusy(label);
    setError(null);
    try {
      return await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      paRef.current.ui.notify({ type: 'error', source: 'Personal Agents', message: 'Personal agent update failed', details: message });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function createAgent() {
    const result = await run('create', () =>
      paRef.current.extension.invoke<{ profile: PersonalAgentProfile }>('createProfile', { name: 'New Agent' }),
    );
    if (!result) return;
    setProfiles((current) => [...current, result.profile].sort((a, b) => a.name.localeCompare(b.name)));
    navigateAgent(result.profile.id);
  }

  async function saveProfile(patch: Partial<PersonalAgentProfile>) {
    if (!selectedProfile) return;
    const result = await run('save', () =>
      paRef.current.extension.invoke<{ profile: PersonalAgentProfile }>('updateProfile', { id: selectedProfile.id, ...patch }),
    );
    if (!result) return;
    setSelected(result.profile);
    setProfiles((current) => current.map((profile) => (profile.id === result.profile.id ? result.profile : profile)));
  }

  async function deleteSelected() {
    if (!selectedProfile) return;
    const ok = await pa.ui.confirm({ title: 'Delete personal agent?', message: `Delete ${selectedProfile.name}? Its conversation is kept.` });
    if (!ok) return;
    const deleted = await run('delete', () => paRef.current.extension.invoke('deleteProfile', { id: selectedProfile.id }));
    if (!deleted) return;
    const remaining = profiles.filter((profile) => profile.id !== selectedProfile.id);
    setProfiles(remaining);
    const next = remaining[0] ?? null;
    if (next) navigateAgent(next.id);
    else {
      setSelected(null);
      setSelectedId(null);
      setConversationId(null);
      void pa.commands.execute('app.navigate', { to: '/agents' });
    }
  }

  const sidebar = (
    <aside className="flex min-h-0 w-[248px] flex-col border-r border-border-subtle bg-surface/60">
      <div className="flex h-12 items-center gap-2 border-b border-border-subtle px-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-primary">Agents</div>
          <div className="text-[11px] text-dim">{profiles.length} configured</div>
        </div>
        <IconButton compact aria-label="Create agent" title="Create agent" disabled={Boolean(busy)} onClick={() => void createAgent()}>
          +
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {profiles.length === 0 ? (
          <div className="px-2 py-4 text-[12px] leading-5 text-secondary">Create an agent to start a dedicated chat.</div>
        ) : (
          profiles.map((profile) => {
            const active = profile.id === selectedProfile?.id;
            return (
              <button
                key={profile.id}
                type="button"
                className={[
                  'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition',
                  active ? 'bg-accent/10 text-primary' : 'text-secondary hover:bg-elevated hover:text-primary',
                ].join(' ')}
                onClick={() => navigateAgent(profile.id)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[12px] font-semibold text-accent">
                  {profile.avatar || initials(profile.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{profile.name}</span>
                  <span className="block truncate text-[11px] text-dim">{gatewaySummary(profile.gatewayBindings)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[248px_minmax(0,1fr)_320px] bg-base">
      {sidebar}
      <main className="min-h-0 min-w-0 border-r border-border-subtle">
        {loading ? (
          <LoadingState label="Loading agents..." className="h-full justify-center" />
        ) : error && !selectedProfile ? (
          <ErrorState message={error} className="m-6" />
        ) : selectedProfile && conversationId ? (
          <HostComponent {...props} hostProps={{ ...(props.hostProps ?? {}), conversationId }} />
        ) : (
          <EmptyState
            title="Create your first personal agent"
            description="Agents get their own chat transcript, soul document, gateways, and automations."
            action={<Button onClick={() => void createAgent()}>Create agent</Button>}
          />
        )}
      </main>
      <AgentDetailsPanel
        profile={selectedProfile}
        busy={busy}
        error={error}
        onSave={(patch) => void saveProfile(patch)}
        onDelete={() => void deleteSelected()}
      />
    </div>
  );
}

function AgentDetailsPanel({
  profile,
  busy,
  error,
  onSave,
  onDelete,
}: {
  profile: PersonalAgentProfile | null;
  busy: string | null;
  error: string | null;
  onSave: (patch: Partial<PersonalAgentProfile>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<PersonalAgentProfile | null>(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  if (!profile || !draft) {
    return (
      <aside className="min-h-0 overflow-auto bg-surface/40 px-4 py-4">
        <SectionLabel tone="muted">Agent Details</SectionLabel>
        <p className="mt-3 text-[13px] leading-5 text-secondary">Select an agent to edit its soul, gateways, memory, skills, and policy.</p>
      </aside>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const telegramBindings = draft.gatewayBindings.filter((binding) => binding.gatewayId === 'telegram');

  function updateBinding(index: number, patch: Partial<PersonalAgentGatewayBinding>) {
    const bindings = cloneBindings(draft.gatewayBindings);
    bindings[index] = { ...bindings[index], ...patch, updatedAt: new Date().toISOString() };
    setDraft({ ...draft, gatewayBindings: bindings });
  }

  function addTelegramBinding() {
    const now = new Date().toISOString();
    setDraft({
      ...draft,
      gatewayBindings: [
        ...draft.gatewayBindings,
        {
          id: `gateway_${Date.now().toString(36)}`,
          gatewayId: 'telegram',
          displayName: 'Telegram',
          enabled: true,
          conversationPolicy: 'default',
          trustLevel: 'paired',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  }

  return (
    <aside className="min-h-0 overflow-auto bg-surface/40">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <SectionLabel tone="muted">Agent Details</SectionLabel>
          <span className="flex-1" />
          <StatusDot tone={dirty ? 'warning' : 'success'} title={dirty ? 'Unsaved changes' : 'Saved'} />
        </div>
        <h2 className="mt-1 truncate text-[16px] font-semibold text-primary">{profile.name}</h2>
      </div>

      <div className="space-y-5 px-4 py-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <section className="space-y-3">
          <SectionLabel>Identity</SectionLabel>
          <Field label="Name">
            <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={draft.description ?? ''}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>
        </section>

        <section className="space-y-3">
          <SectionLabel>Soul</SectionLabel>
          <Textarea rows={10} value={draft.soul} onChange={(event) => setDraft({ ...draft, soul: event.target.value })} />
        </section>

        <section className="space-y-3">
          <SectionLabel>Runtime</SectionLabel>
          <Field label="Default cwd">
            <TextInput value={draft.defaultCwd ?? ''} onChange={(event) => setDraft({ ...draft, defaultCwd: event.target.value })} />
          </Field>
          <Field label="Model">
            <TextInput
              placeholder="provider/model"
              value={draft.defaultModelRef ?? ''}
              onChange={(event) => setDraft({ ...draft, defaultModelRef: event.target.value })}
            />
          </Field>
          <Field label="Tool policy">
            <Select
              value={draft.toolPolicy}
              onChange={(event) => setDraft({ ...draft, toolPolicy: event.target.value as PersonalAgentProfile['toolPolicy'] })}
            >
              <option value="default">Default</option>
              <option value="restricted">Restricted</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <SectionLabel>Gateways</SectionLabel>
            <span className="flex-1" />
            <TextButton onClick={addTelegramBinding}>Add Telegram</TextButton>
          </div>
          {telegramBindings.length === 0 ? (
            <p className="text-[12px] leading-5 text-secondary">Telegram is ready for a gateway extension to bind sender IDs here.</p>
          ) : (
            draft.gatewayBindings.map((binding, index) => (
              <div key={binding.id} className="space-y-2 border-t border-border-subtle pt-3">
                <Field label="Gateway">
                  <TextInput value={binding.gatewayId} onChange={(event) => updateBinding(index, { gatewayId: event.target.value })} />
                </Field>
                <Field label="Sender ID">
                  <TextInput value={binding.senderId ?? ''} onChange={(event) => updateBinding(index, { senderId: event.target.value })} />
                </Field>
                <Field label="Trust">
                  <Select
                    value={binding.trustLevel}
                    onChange={(event) => updateBinding(index, { trustLevel: event.target.value as PersonalAgentGatewayBinding['trustLevel'] })}
                  >
                    <option value="paired">Paired</option>
                    <option value="allowlisted">Allowlisted</option>
                    <option value="local">Local</option>
                    <option value="untrusted">Untrusted</option>
                  </Select>
                </Field>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <SectionLabel>Activity</SectionLabel>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-dim">Conversation</dt>
            <dd className="truncate text-secondary">{draft.defaultConversationId ?? 'Created on first open'}</dd>
            <dt className="text-dim">Updated</dt>
            <dd className="text-secondary">{formatDate(draft.updatedAt)}</dd>
          </dl>
        </section>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-border-subtle bg-surface px-4 py-3">
        <Button disabled={!dirty || Boolean(busy)} onClick={() => onSave(draft)}>
          Save
        </Button>
        <TextButton className="text-danger" disabled={Boolean(busy)} onClick={onDelete}>
          Delete
        </TextButton>
      </div>
    </aside>
  );
}
