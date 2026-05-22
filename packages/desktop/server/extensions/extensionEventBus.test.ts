import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishAppEvent = vi.fn();
const logError = vi.fn();

vi.mock('../shared/appEvents.js', () => ({ publishAppEvent }));
vi.mock('../shared/logging.js', () => ({ logError }));

const { listExtensionEventSubscriptions, publishExtensionEvent, subscribeExtensionEvents, unsubscribeExtensionEvents } =
  await import('./extensionEventBus.js');

describe('extensionEventBus', () => {
  beforeEach(() => {
    publishAppEvent.mockReset();
    logError.mockReset();
    for (const subscription of listExtensionEventSubscriptions()) {
      unsubscribeExtensionEvents(subscription.extensionId);
    }
  });

  it('delivers events to literal, wildcard, and prefix subscriptions', async () => {
    const literal = vi.fn();
    const prefix = vi.fn();
    const wildcard = vi.fn();
    const nonMatch = vi.fn();
    subscribeExtensionEvents('literal-ext', 'task:done', literal);
    subscribeExtensionEvents('prefix-ext', 'task:*', prefix);
    subscribeExtensionEvents('wild-ext', '*', wildcard);
    subscribeExtensionEvents('other-ext', 'tasks:*', nonMatch);

    await publishExtensionEvent('source-ext', 'task:done', { ok: true });

    for (const handler of [literal, prefix, wildcard]) {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'task:done',
          payload: { ok: true },
          sourceExtensionId: 'source-ext',
          publishedAt: expect.any(String),
        }),
      );
    }
    expect(nonMatch).not.toHaveBeenCalled();
  });

  it('unsubscribes individual subscriptions and all subscriptions for an extension', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const subscription = subscribeExtensionEvents('ext', '*', first);
    subscribeExtensionEvents('ext', '*', second);
    expect(listExtensionEventSubscriptions()).toEqual([
      { extensionId: 'ext', pattern: '*' },
      { extensionId: 'ext', pattern: '*' },
    ]);

    subscription.unsubscribe();
    await publishExtensionEvent('source', 'x', null);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();

    unsubscribeExtensionEvents('ext');
    expect(listExtensionEventSubscriptions()).toEqual([]);
  });

  it('logs failing handlers, notifies the app, and continues delivering to other subscribers', async () => {
    const failing = vi.fn(async () => {
      throw new Error('handler exploded');
    });
    const ok = vi.fn();
    subscribeExtensionEvents('bad-ext', '*', failing);
    subscribeExtensionEvents('ok-ext', '*', ok);

    await publishExtensionEvent('source', 'event:name', 123);

    expect(ok).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith('extension event handler failed', {
      extensionId: 'bad-ext',
      event: 'event:name',
      pattern: '*',
      message: 'handler exploded',
    });
    expect(publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'bad-ext',
      message: 'Event handler error: handler exploded',
      severity: 'error',
    });
  });
});
