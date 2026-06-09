import { describe, expect, it, vi } from 'vitest';

import {
  createProfile,
  ensureDefaultConversation,
  listProfiles,
  provideAgentTurnContext,
  routeGatewayMessage,
  updateProfile,
} from './backend';

function createCtx() {
  const storage = new Map<string, unknown>();
  const metadata = new Map<string, Record<string, unknown>>();
  const sentMessages: Array<{ conversationId: string; text: string }> = [];
  let conversationCount = 0;
  const ctx = {
    storage: {
      get: vi.fn(async (key: string) => storage.get(key) ?? null),
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
        return { ok: true };
      }),
      delete: vi.fn(async (key: string) => {
        const deleted = storage.delete(key);
        return { ok: true, deleted };
      }),
      list: vi.fn(async (prefix = '') =>
        [...storage.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({ key, value })),
      ),
    },
    conversations: {
      create: vi.fn(async (input: unknown) => {
        conversationCount += 1;
        return { conversationId: `conv-${conversationCount}`, id: `conv-${conversationCount}`, input };
      }),
      sendMessage: vi.fn(async (conversationId: string, text: string) => {
        sentMessages.push({ conversationId, text });
      }),
      metadata: {
        get: vi.fn(async ({ conversationId, namespace }: { conversationId: string; namespace: string }) =>
          metadata.get(`${conversationId}:${namespace}`) ?? {},
        ),
        set: vi.fn(async ({ conversationId, namespace, values }: { conversationId: string; namespace: string; values: Record<string, unknown> }) => {
          metadata.set(`${conversationId}:${namespace}`, values);
          return values;
        }),
      },
    },
    toolContext: {},
    __sentMessages: sentMessages,
  };
  return ctx as never;
}

describe('system-personal-agents backend', () => {
  it('creates, lists, updates, and ensures a default conversation for a profile', async () => {
    const ctx = createCtx();

    const created = await createProfile({ name: 'Archivist', description: 'Keeps durable notes' }, ctx);
    expect(created.profile).toMatchObject({ name: 'Archivist', toolPolicy: 'default', gatewayBindings: [] });
    expect(created.profile.soul).toContain('Archivist Soul');

    await updateProfile({ id: created.profile.id, soul: 'Remember calmly.', toolPolicy: 'restricted', memoryScopes: ['kb:archive'] }, ctx);
    const listed = await listProfiles({}, ctx);
    expect(listed.profiles).toHaveLength(1);
    expect(listed.profiles[0]).toMatchObject({ soul: 'Remember calmly.', toolPolicy: 'restricted', memoryScopes: ['kb:archive'] });

    const ensured = await ensureDefaultConversation({ id: created.profile.id }, ctx);
    expect(ensured.conversationId).toBe('conv-1');
    expect(ensured.profile.defaultConversationId).toBe('conv-1');
    expect((ctx as unknown as { conversations: { create: ReturnType<typeof vi.fn> } }).conversations.create).toHaveBeenCalledTimes(1);

    await ensureDefaultConversation({ id: created.profile.id }, ctx);
    expect((ctx as unknown as { conversations: { create: ReturnType<typeof vi.fn> } }).conversations.create).toHaveBeenCalledTimes(1);
  });

  it('provides soul context for conversations bound to a personal agent', async () => {
    const ctx = createCtx();
    const created = await createProfile({ name: 'Operator', soul: 'Keep operations crisp.' }, ctx);
    const ensured = await ensureDefaultConversation({ id: created.profile.id }, ctx);

    const result = await provideAgentTurnContext({ conversationId: ensured.conversationId }, ctx);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]!.title).toBe('Personal agent: Operator');
    expect(result.blocks[0]!.content).toContain('Keep operations crisp.');
  });

  it('routes gateway messages to matching enabled profile bindings', async () => {
    const ctx = createCtx();
    const created = await createProfile({ name: 'Telegram Agent' }, ctx);
    await updateProfile({
      id: created.profile.id,
      gatewayBindings: [
        {
          id: 'telegram-main',
          gatewayId: 'telegram',
          senderId: 'patrick',
          displayName: 'Telegram',
          enabled: true,
          conversationPolicy: 'default',
          trustLevel: 'paired',
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    }, ctx);

    const result = await routeGatewayMessage(
      {
        gatewayId: 'telegram',
        senderId: 'patrick',
        text: 'Daily check',
        receivedAt: '2026-06-09T12:00:00.000Z',
        trustLevel: 'paired',
      },
      ctx,
    );

    expect(result).toMatchObject({ routed: true, agentProfileId: created.profile.id, conversationId: 'conv-1' });
    expect((ctx as unknown as { __sentMessages: Array<{ conversationId: string; text: string }> }).__sentMessages).toEqual([
      { conversationId: 'conv-1', text: 'Daily check' },
    ]);
  });

  it('rejects unmatched gateway messages without creating a conversation', async () => {
    const ctx = createCtx();
    await createProfile({ name: 'No Gateway' }, ctx);

    await expect(
      routeGatewayMessage(
        {
          gatewayId: 'telegram',
          senderId: 'unknown',
          text: 'Hello',
          receivedAt: '2026-06-09T12:00:00.000Z',
          trustLevel: 'untrusted',
        },
        ctx,
      ),
    ).resolves.toMatchObject({ routed: false, reason: 'no-matching-agent' });
    expect((ctx as unknown as { conversations: { create: ReturnType<typeof vi.fn> } }).conversations.create).not.toHaveBeenCalled();
  });
});
