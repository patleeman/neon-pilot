import { describe, expect, it, vi } from 'vitest';

import { eventBus } from './eventBusBackend';

vi.mock('@neon-pilot/extensions/backend/events', () => ({
  emitEvent: vi.fn(async () => ({ event: { id: 'evt-1' }, reactions: [] })),
  delayEvent: vi.fn(),
  replayEvent: vi.fn(),
  listEvents: vi.fn(async () => ({ events: [] })),
  listSubscriptions: vi.fn(async () => ({ subscriptions: [] })),
  processDueEvents: vi.fn(),
  pruneEvents: vi.fn(),
  saveSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  cancelDelayedEvent: vi.fn(),
}));

describe('eventBus backend action', () => {
  it('invalidates automation topics after event bus mutations', async () => {
    const invalidate = vi.fn();

    await eventBus({ action: 'emit', type: 'qa.event', source: 'test' }, { ui: { invalidate } });

    expect(invalidate).toHaveBeenCalledWith(['automation', 'events', 'tasks', 'runs']);
  });
});
