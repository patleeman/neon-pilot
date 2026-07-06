import { beforeEach, describe, expect, it } from 'vitest';

import { dispatchDesktopLocalApiRequest } from './localApi.js';
import { issueDesktopControlCommand, resetDesktopControlForTests, subscribeDesktopControlCommands } from './localApiDesktopControl.js';

function readJsonBody(response: Awaited<ReturnType<typeof dispatchDesktopLocalApiRequest>>) {
  return JSON.parse(Buffer.from(response.body).toString('utf-8')) as Record<string, unknown>;
}

describe('desktop local API desktop control acknowledgement route', () => {
  beforeEach(() => {
    resetDesktopControlForTests();
  });

  it('acknowledges a pending desktop control command via POST', async () => {
    let commandId = '';
    subscribeDesktopControlCommands((command) => {
      commandId = command.id;
    });
    const pending = issueDesktopControlCommand({ action: 'focus', windowId: 'chat:draft', timeoutMs: 500 });

    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/control/ack',
      body: { commandId, ok: true },
    });

    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toEqual({
      ok: true,
      commandId,
      action: 'focus',
      status: 'completed',
    });
    await expect(pending).resolves.toMatchObject({ ok: true, commandId, status: 'completed' });
  });

  it('returns 400 when acknowledging a missing command', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/control/ack',
      body: { commandId: 'missing', ok: true },
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toContain('no longer pending');
  });
});
