import { beforeEach, describe, expect, it, vi } from 'vitest';

const appEvents = vi.hoisted(() => ({ publishAppEvent: vi.fn() }));
const logging = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('../shared/logging.js', () => logging);

import {
  getDefaultLifecycleHandlers,
  notifyLiveSessionLifecycleHandlers,
  registerLiveSessionLifecycleHandler,
  setDefaultLifecycleHandlers,
} from './liveSessionLifecycle.js';

describe('live session lifecycle handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultLifecycleHandlers([]);
  });

  it('registers default lifecycle handlers and disposes registrations', () => {
    const first = vi.fn();
    const second = vi.fn();

    const disposeFirst = registerLiveSessionLifecycleHandler(first);
    const disposeSecond = registerLiveSessionLifecycleHandler(second);
    expect(getDefaultLifecycleHandlers()).toEqual([first, second]);

    disposeFirst();
    expect(getDefaultLifecycleHandlers()).toEqual([second]);
    disposeSecond();
    expect(getDefaultLifecycleHandlers()).toEqual([]);
  });

  it('sets default lifecycle handlers by reference', () => {
    const handlers = [vi.fn()];
    setDefaultLifecycleHandlers(handlers);
    expect(getDefaultLifecycleHandlers()).toBe(handlers);
  });

  it('notifies sync and async handlers without awaiting them', async () => {
    const event = { conversationId: 'conv-1', title: 'Title', cwd: '/repo', trigger: 'turn_end' as const };
    const sync = vi.fn();
    const asyncHandler = vi.fn(async () => undefined);

    notifyLiveSessionLifecycleHandlers(event, [sync, asyncHandler]);
    expect(sync).toHaveBeenCalledWith(event);
    expect(asyncHandler).toHaveBeenCalledWith(event);
    expect(logging.logError).not.toHaveBeenCalled();
  });

  it('logs async handler failures and publishes error notifications', async () => {
    const event = {
      conversationId: 'conv-1',
      sessionFile: '/sessions/conv-1.json',
      title: 'Title',
      cwd: '/repo',
      trigger: 'auto_compaction_end' as const,
    };
    notifyLiveSessionLifecycleHandlers(event, [vi.fn(() => Promise.reject(new Error('boom')))]);

    await Promise.resolve();
    await Promise.resolve();

    expect(logging.logError).toHaveBeenCalledWith('live session lifecycle handler failed', {
      conversationId: 'conv-1',
      trigger: 'auto_compaction_end',
      message: 'boom',
    });
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'core',
      message: 'Lifecycle handler error: boom',
      severity: 'error',
    });
  });

  it('currently lets synchronous handler throws escape', () => {
    const event = { conversationId: 'conv-1', title: 'Title', cwd: '/repo', trigger: 'turn_end' as const };
    expect(() =>
      notifyLiveSessionLifecycleHandlers(event, [
        vi.fn(() => {
          throw new Error('sync boom');
        }),
      ]),
    ).toThrow('sync boom');
  });
});
