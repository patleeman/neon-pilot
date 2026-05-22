import { describe, expect, it, vi } from 'vitest';

import { EventBus } from './event-bus.js';

describe('EventBus', () => {
  it('publishes events to matching and wildcard subscribers in order', async () => {
    const bus = new EventBus({ maxDepth: 10 });
    const seen: string[] = [];
    bus.subscribe('run.started', async (event) => {
      seen.push(`specific:${event.type}`);
    });
    bus.subscribe('*', (event) => {
      seen.push(`wildcard:${event.type}`);
    });

    expect(bus.publish({ type: 'run.started', runId: 'run-1' } as never)).toBe(true);
    await bus.waitForIdle();

    expect(seen).toEqual(['specific:run.started', 'wildcard:run.started']);
    expect(bus.getStatus()).toMatchObject({ maxDepth: 10, currentDepth: 0, droppedEvents: 0, processedEvents: 1 });
    expect(bus.getStatus().lastEventAt).toBeDefined();
  });

  it('drops events when the queue is full', async () => {
    const bus = new EventBus({ maxDepth: 1 });
    const releases: Array<() => void> = [];
    bus.subscribe(
      'slow',
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );

    expect(bus.publish({ type: 'slow' } as never)).toBe(true);
    expect(bus.publish({ type: 'slow' } as never)).toBe(true);
    expect(bus.publish({ type: 'slow' } as never)).toBe(false);
    expect(bus.getStatus()).toMatchObject({ droppedEvents: 1 });

    while (releases.length > 0) {
      releases.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await bus.waitForIdle();
    expect(bus.getStatus()).toMatchObject({ currentDepth: 0, processedEvents: 2, droppedEvents: 1 });
  });

  it('reports handler errors and continues processing later handlers and events', async () => {
    const onHandlerError = vi.fn();
    const bus = new EventBus({ maxDepth: 10, onHandlerError });
    const seen: string[] = [];
    bus.subscribe('event', () => {
      throw new Error('boom');
    });
    bus.subscribe('event', (event) => {
      seen.push(event.type);
    });

    bus.publish({ type: 'event' } as never);
    bus.publish({ type: 'event' } as never);
    await bus.waitForIdle();

    expect(onHandlerError).toHaveBeenCalledTimes(2);
    expect(onHandlerError.mock.calls[0][1]).toBeInstanceOf(Error);
    expect(seen).toEqual(['event', 'event']);
    expect(bus.getStatus().processedEvents).toBe(2);
  });
});
