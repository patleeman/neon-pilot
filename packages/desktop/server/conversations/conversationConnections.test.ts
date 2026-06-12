import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listConversationConnections } from './conversationConnections.js';

const mocks = vi.hoisted(() => ({
  listConversationExecutions: vi.fn(),
  readConversationSessionMeta: vi.fn(),
  listQueuedPromptPreviews: vi.fn(),
  listExtensionConversationConnectionProviderRegistrations: vi.fn(),
  invokeAction: vi.fn(),
}));

vi.mock('../executions/executionService.js', () => ({
  listConversationExecutions: mocks.listConversationExecutions,
}));

vi.mock('./conversationService.js', () => ({
  readConversationSessionMeta: mocks.readConversationSessionMeta,
}));

vi.mock('./liveSessions.js', () => ({
  listQueuedPromptPreviews: mocks.listQueuedPromptPreviews,
}));

vi.mock('../extensions/extensionRegistry.js', () => ({
  listExtensionConversationConnectionProviderRegistrations: mocks.listExtensionConversationConnectionProviderRegistrations,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({ invokeAction: mocks.invokeAction }),
}));

describe('conversation connection registry', () => {
  beforeEach(() => {
    mocks.listConversationExecutions.mockReset();
    mocks.readConversationSessionMeta.mockReset();
    mocks.listQueuedPromptPreviews.mockReset();
    mocks.listExtensionConversationConnectionProviderRegistrations.mockReset();
    mocks.invokeAction.mockReset();
    mocks.listConversationExecutions.mockResolvedValue({ executions: [] });
    mocks.readConversationSessionMeta.mockReturnValue(null);
    mocks.listQueuedPromptPreviews.mockReturnValue({ steering: [], followUp: [] });
    mocks.listExtensionConversationConnectionProviderRegistrations.mockReturnValue([]);
  });

  it('combines built-in and extension connection providers', async () => {
    mocks.listConversationExecutions.mockResolvedValue({
      executions: [
        {
          id: 'run-1',
          visibility: 'primary',
          conversationId: 'conv-1',
          title: 'Worker',
          status: 'running',
          updatedAt: '2026-06-11T12:00:00.000Z',
          capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
        },
      ],
    });
    mocks.listExtensionConversationConnectionProviderRegistrations.mockReturnValue([
      { extensionId: 'system-todo', id: 'todos', action: 'listTodoConnections', priority: 50 },
    ]);
    mocks.invokeAction.mockResolvedValue({
      ok: true,
      result: {
        items: [
          {
            id: 'todos',
            conversationId: 'conv-1',
            kind: 'state',
            title: 'Todos',
            subtitle: '1 open',
            active: true,
            meaningful: true,
            visibility: 'system',
            source: { type: 'conversation-metadata', id: 'threadTodos' },
            surfaces: ['composerShelf', 'cli'],
            actions: [{ id: 'open', label: 'Open', command: 'todos.open' }],
          },
        ],
      },
    });

    await expect(listConversationConnections('conv-1')).resolves.toMatchObject({
      conversationId: 'conv-1',
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'execution:run-1', kind: 'activity', active: true }),
        expect.objectContaining({ id: 'system-todo:todos', kind: 'state', extensionId: 'system-todo', active: true }),
      ]),
      byKind: {
        activity: [expect.objectContaining({ id: 'execution:run-1' })],
        state: [expect.objectContaining({ id: 'system-todo:todos' })],
        asset: [],
        context: [],
        integration: [],
        surface: [],
      },
    });
  });

  it('filters by surface, kind, active state, and visibility after normalization', async () => {
    mocks.listExtensionConversationConnectionProviderRegistrations.mockReturnValue([
      { extensionId: 'system-scratchpad', id: 'scratchpad', action: 'listScratchpadConnections', priority: 40 },
    ]);
    mocks.invokeAction.mockResolvedValue({
      ok: true,
      result: [
        {
          id: 'scratchpad',
          kind: 'state',
          title: 'Scratchpad',
          active: false,
          meaningful: true,
          visibility: 'system',
          source: { type: 'conversation-metadata', id: 'threadScratchpad' },
          surfaces: ['rightRail', 'cli'],
          actions: [],
        },
      ],
    });

    await expect(listConversationConnections('conv-1', { kind: 'state', surface: 'rightRail', visibility: 'system' })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'system-scratchpad:scratchpad' })],
    });
    await expect(listConversationConnections('conv-1', { active: true, kind: 'state', surface: 'rightRail' })).resolves.toMatchObject({
      items: [],
    });
    await expect(listConversationConnections('conv-1', { kind: 'activity', surface: 'rightRail' })).resolves.toMatchObject({
      items: [],
    });
  });
});
