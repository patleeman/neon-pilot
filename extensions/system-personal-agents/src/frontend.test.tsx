// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { parseAgentId, PersonalAgentsShell } from './frontend';

const profile = {
  id: 'agent-1',
  name: 'Archivist',
  description: 'Keeps the archive tidy',
  soul: 'Archive with care.',
  memoryScopes: [],
  skillRefs: [],
  toolPolicy: 'default' as const,
  gatewayBindings: [],
  defaultConversationId: 'conv-1',
  createdAt: '2026-06-09T00:00:00.000Z',
  updatedAt: '2026-06-09T00:00:00.000Z',
};

function renderShell(options?: { profiles?: unknown[]; pathname?: string; ensuredProfile?: typeof profile }) {
  const profiles = options?.profiles ?? [profile];
  const ensuredProfile = options?.ensuredProfile ?? profile;
  const invoke = vi.fn(async (action: string, input?: unknown) => {
    if (action === 'listProfiles') return { profiles };
    if (action === 'ensureDefaultConversation') return { profile: ensuredProfile, conversationId: 'conv-1' };
    if (action === 'createProfile') return { profile: { ...profile, id: 'agent-2', name: 'New Agent', defaultConversationId: 'conv-2' } };
    if (action === 'updateProfile') return { profile: { ...profile, ...(input as Record<string, unknown>) } };
    if (action === 'deleteProfile') return { ok: true, deleted: true };
    throw new Error(`Unexpected action ${action}`);
  });
  const execute = vi.fn(async () => true);
  const notify = vi.fn();
  const confirm = vi.fn(async () => true);
  const HostComponent = vi.fn(({ hostProps }: { hostProps?: Record<string, unknown> }) => (
    <div data-testid="host-conversation">{String(hostProps?.conversationId ?? '')}</div>
  ));

  render(
    <PersonalAgentsShell
      HostComponent={HostComponent as never}
      pa={{ extension: { invoke }, commands: { execute }, ui: { notify, confirm } } as never}
      context={{
        extensionId: 'system-personal-agents',
        surfaceId: 'agents',
        pathname: options?.pathname ?? '/agents/agent-1',
        search: '',
        hash: '',
      }}
      surface={{} as never}
      params={{}}
    />,
  );
  return { invoke, execute, notify, confirm, HostComponent };
}

describe('PersonalAgentsShell', () => {
  it('safely reads agent ids from agent routes', () => {
    expect(parseAgentId('/agents/agent%201')).toBe('agent 1');
    expect(parseAgentId('/agents')).toBeNull();
    expect(parseAgentId('/agents/%E0%A4%A')).toBeNull();
  });

  it('renders an agent list, details panel, and the standard conversation host', async () => {
    const { invoke, HostComponent } = renderShell();

    await waitFor(() => {
      expect(screen.getAllByText('Archivist').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Archive with care.')).toBeTruthy();
    expect(screen.getByTestId('host-conversation').textContent).toBe('conv-1');
    expect(HostComponent).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('ensureDefaultConversation', { id: 'agent-1' });
  });

  it('shows the ensured default conversation in the details panel', async () => {
    renderShell({
      profiles: [{ ...profile, defaultConversationId: undefined }],
      ensuredProfile: { ...profile, defaultConversationId: 'conv-1' },
    });

    await screen.findByTestId('host-conversation');
    expect(screen.getAllByText('conv-1')).toHaveLength(2);
    expect(screen.queryByText('Created on first open')).toBeNull();
  });

  it('creates an agent and navigates to its agent route', async () => {
    const { execute } = renderShell({ profiles: [], pathname: '/agents' });

    fireEvent.click(await screen.findByRole('button', { name: 'Create agent' }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith('app.navigate', { to: '/agents/agent-2' });
    });
  });

  it('redirects a stale selected route when the profile no longer exists', async () => {
    const { execute, invoke } = renderShell({ profiles: [], pathname: '/agents/missing-agent' });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith('app.navigate', { to: '/agents' });
    });
    expect(invoke).not.toHaveBeenCalledWith('ensureDefaultConversation', { id: 'missing-agent' });
  });

  it('saves edited soul document changes', async () => {
    const { invoke } = renderShell();

    const soul = (await screen.findByDisplayValue('Archive with care.')) as HTMLTextAreaElement;
    fireEvent.change(soul, { target: { value: 'Archive with taste.' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('updateProfile', expect.objectContaining({ id: 'agent-1', soul: 'Archive with taste.' }));
    });
  });
});
