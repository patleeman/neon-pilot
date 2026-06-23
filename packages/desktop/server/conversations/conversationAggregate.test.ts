import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listScheduledTasksCapability: vi.fn(),
  subscribeAppEvents: vi.fn(),
  listConversationActivity: vi.fn(),
  readDesktopConversationState: vi.fn(),
  subscribeLiveSession: vi.fn(),
}));

vi.mock('../automation/scheduledTaskCapability.js', () => ({
  listScheduledTasksCapability: mocks.listScheduledTasksCapability,
}));

vi.mock('../shared/appEvents.js', () => ({
  subscribeAppEvents: mocks.subscribeAppEvents,
}));

vi.mock('./conversationActivity.js', () => ({
  listConversationActivity: mocks.listConversationActivity,
}));

vi.mock('./desktopConversationState.js', () => ({
  readDesktopConversationState: mocks.readDesktopConversationState,
}));

vi.mock('./liveSessions.js', () => ({
  subscribe: mocks.subscribeLiveSession,
}));

function state(conversationId = 'conv-1') {
  return {
    conversationId,
    sessionDetail: null,
    liveSession: { live: false },
    stream: {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      hasSnapshot: true,
      isStreaming: false,
      isCompacting: false,
      error: null,
      title: null,
      tokens: null,
      cost: null,
      contextUsage: null,
      pendingQueue: { steering: [], followUp: [] },
      parallelJobs: [],
      presence: { surfaces: [], controllerSurfaceId: null, controllerSurfaceType: null, controllerAcquiredAt: null },
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      cwdChange: null,
    },
  };
}

function activity(conversationId = 'conv-1', itemIds: string[] = []) {
  const items = itemIds.map((id) => ({
    id,
    kind: 'scheduled-task',
    title: id,
    status: 'scheduled',
    active: true,
    visibility: 'system',
    conversationId,
    source: { type: 'scheduled-task', id },
    actions: [],
  }));
  return { conversationId, items, primary: [], system: items, hidden: [] };
}

describe('conversation aggregate', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const aggregate = await import('./conversationAggregate.js');
    aggregate.clearConversationAggregateStateForTests();
    mocks.readDesktopConversationState.mockResolvedValue(state());
    mocks.listConversationActivity.mockResolvedValue(activity());
    mocks.listScheduledTasksCapability.mockResolvedValue([]);
    mocks.subscribeAppEvents.mockReturnValue(vi.fn());
    mocks.subscribeLiveSession.mockReturnValue(null);
  });

  it('hydrates transcript state and activity through one aggregate snapshot', async () => {
    const { readConversationAggregateState } = await import('./conversationAggregate.js');
    mocks.listConversationActivity.mockResolvedValueOnce(activity('conv-1', ['task-1']));

    await expect(readConversationAggregateState({ conversationId: 'conv-1', profile: 'shared' })).resolves.toMatchObject({
      conversationId: 'conv-1',
      revision: 0,
      conversation: expect.objectContaining({ conversationId: 'conv-1' }),
      activity: expect.objectContaining({
        items: [expect.objectContaining({ id: 'task-1' })],
      }),
    });
  });

  it('publishes an activity delta when tasks are invalidated', async () => {
    let appListener: ((event: { type: 'invalidate'; topics: string[] }) => void) | null = null;
    mocks.subscribeAppEvents.mockImplementation((listener) => {
      appListener = listener;
      return vi.fn();
    });
    mocks.listConversationActivity.mockResolvedValueOnce(activity('conv-1', ['task-1']));
    const onDelta = vi.fn();
    const { subscribeConversationAggregate } = await import('./conversationAggregate.js');

    const unsubscribe = subscribeConversationAggregate({ conversationId: 'conv-1', profile: 'shared', onDelta });
    appListener?.({ type: 'invalidate', topics: ['tasks'] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'activity',
        conversationId: 'conv-1',
        revision: 1,
        activity: expect.objectContaining({ items: [expect.objectContaining({ id: 'task-1' })] }),
      }),
    );
    unsubscribe();
  });

  it('publishes stream deltas from the live runtime and refreshes queued activity', async () => {
    let liveListener: ((event: { type: 'queue_state'; steering: never[]; followUp: never[] }) => void) | null = null;
    mocks.subscribeLiveSession.mockImplementation((_conversationId, listener) => {
      liveListener = listener;
      return vi.fn();
    });
    mocks.listConversationActivity.mockResolvedValueOnce(activity('conv-1', ['queued-prompt:one']));
    const onDelta = vi.fn();
    const { subscribeConversationAggregate } = await import('./conversationAggregate.js');

    const unsubscribe = subscribeConversationAggregate({ conversationId: 'conv-1', profile: 'shared', onDelta });
    liveListener?.({ type: 'queue_state', steering: [], followUp: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDelta).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'stream_events',
        conversationId: 'conv-1',
        revision: 1,
        events: [expect.objectContaining({ type: 'queue_state' })],
      }),
    );
    expect(onDelta).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'activity',
        conversationId: 'conv-1',
        revision: 2,
      }),
    );
    unsubscribe();
  });
});
