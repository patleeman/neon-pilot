import { beforeEach, describe, expect, it } from 'vitest';

import { dispatchDesktopLocalApiRequest } from './localApi.js';
import { resetDesktopUserActionEventsForTests } from './localApiDesktopEvents.js';

function readJsonBody(response: Awaited<ReturnType<typeof dispatchDesktopLocalApiRequest>>) {
  return JSON.parse(Buffer.from(response.body).toString('utf-8')) as Record<string, unknown>;
}

describe('desktop local API desktop user-action event route', () => {
  beforeEach(() => {
    resetDesktopUserActionEventsForTests();
  });

  it('stores a sanitized user-action event via POST', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/events',
      body: {
        action: 'close',
        windowId: 'route:system-notes:notes',
        kind: 'route',
        title: 'Notes',
        route: '/notes',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toEqual({
      ok: true,
      event: {
        id: expect.stringMatching(/^desktop-user-action-/),
        source: 'user',
        action: 'close',
        windowId: 'route:system-notes:notes',
        kind: 'route',
        title: 'Notes',
        route: '/notes',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
    });
  });

  it('returns 400 for malformed user-action events', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/events',
      body: { action: 'close' },
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toContain('requires windowId');
  });
});
