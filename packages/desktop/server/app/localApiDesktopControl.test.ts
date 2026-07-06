import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeDesktopControlCommand,
  issueDesktopControlCommand,
  resetDesktopControlForTests,
  subscribeDesktopControlCommands,
} from './localApiDesktopControl.js';

describe('localApiDesktopControl', () => {
  beforeEach(() => {
    resetDesktopControlForTests();
  });

  it('streams issued commands to subscribers and resolves on acknowledgement', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopControlCommands(listener);

    const pending = issueDesktopControlCommand({ action: 'focus', windowId: 'chat:draft', timeoutMs: 500 });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^desktop-control-/),
        action: 'focus',
        windowId: 'chat:draft',
      }),
    );
    const commandId = listener.mock.calls[0]?.[0]?.id as string;

    expect(acknowledgeDesktopControlCommand({ commandId, ok: true })).toEqual({
      ok: true,
      commandId,
      action: 'focus',
      status: 'completed',
    });
    await expect(pending).resolves.toEqual({
      ok: true,
      commandId,
      action: 'focus',
      status: 'completed',
    });

    unsubscribe();
  });

  it('replays pending commands to late renderer subscribers', async () => {
    const pending = issueDesktopControlCommand({ action: 'focus', windowId: 'chat:draft', timeoutMs: 500 });
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopControlCommands(listener);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^desktop-control-/),
        action: 'focus',
        windowId: 'chat:draft',
      }),
    );
    const commandId = listener.mock.calls[0]?.[0]?.id as string;

    acknowledgeDesktopControlCommand({ commandId, ok: true });
    await expect(pending).resolves.toMatchObject({ ok: true, commandId, status: 'completed' });

    unsubscribe();
  });

  it('rejects malformed commands before they reach subscribers', async () => {
    const listener = vi.fn();
    subscribeDesktopControlCommands(listener);

    expect(() => issueDesktopControlCommand({ action: 'move', windowId: 'chat:draft' })).toThrow(/requires bounds/);
    expect(listener).not.toHaveBeenCalled();
  });

  it('times out when no renderer acknowledges the command', async () => {
    await expect(issueDesktopControlCommand({ action: 'focus', windowId: 'chat:draft', timeoutMs: 100 })).resolves.toMatchObject({
      ok: false,
      action: 'focus',
      status: 'timeout',
    });
  });
});
