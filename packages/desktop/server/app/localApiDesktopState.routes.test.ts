import { beforeEach, describe, expect, it } from 'vitest';

import { dispatchDesktopLocalApiRequest } from './localApi.js';
import { readDesktopStateSnapshot, resetDesktopStateSnapshotForTests } from './localApiDesktopState.js';

function readJsonBody(response: Awaited<ReturnType<typeof dispatchDesktopLocalApiRequest>>) {
  return JSON.parse(Buffer.from(response.body).toString('utf-8')) as Record<string, unknown>;
}

describe('desktop local API /api/desktop/state route', () => {
  beforeEach(() => {
    resetDesktopStateSnapshotForTests();
  });

  it('returns an empty snapshot via GET before any renderer publishes one', async () => {
    const response = await dispatchDesktopLocalApiRequest({ method: 'GET', path: '/api/desktop/state' });
    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toEqual({
      windows: [],
      focusedWindowId: null,
      theme: null,
      publishedAt: null,
      revision: null,
      publisherId: null,
    });
    expect(response.headers['X-PA-Perf']).toContain('"fastPath":"product"');
  });

  it('stores a sanitized snapshot via POST and serves it back on GET', async () => {
    const postResponse = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/state',
      body: {
        windows: [
          {
            id: 'chat:draft',
            kind: 'chat',
            title: 'New conversation',
            route: '/conversations/new',
            bounds: { x: 42, y: 34, width: 700, height: 500 },
            focused: true,
            minimized: false,
            maximized: false,
            zIndex: 10,
            workspaceCwd: null,
            routeMetadata: { sessionId: 'draft' },
          },
        ],
        focusedWindowId: 'chat:draft',
        theme: 'dark',
        publishedAt: '2026-07-05T12:34:56.000Z',
        revision: 1,
        publisherId: 'windowed-layout:test',
      },
    });

    expect(postResponse.statusCode).toBe(200);
    const postedBody = readJsonBody(postResponse);
    expect(postedBody).toMatchObject({
      ok: true,
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-05T12:34:56.000Z',
      revision: 1,
      publisherId: 'windowed-layout:test',
    });
    expect(Array.isArray(postedBody.windows)).toBe(true);
    expect((postedBody.windows as Array<{ id: string }>)[0]?.id).toBe('chat:draft');
    expect(postResponse.headers['X-PA-Perf']).toContain('"fastPath":"product"');

    const getResponse = await dispatchDesktopLocalApiRequest({ method: 'GET', path: '/api/desktop/state' });
    expect(readJsonBody(getResponse)).toEqual({
      windows: [
        expect.objectContaining({
          id: 'chat:draft',
          kind: 'chat',
          route: '/conversations/new',
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
          workspaceCwd: null,
          routeMetadata: { sessionId: 'draft' },
        }),
      ],
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-05T12:34:56.000Z',
      revision: 1,
      publisherId: 'windowed-layout:test',
    });

    expect(readDesktopStateSnapshot().windows).toHaveLength(1);
  });

  it('returns 400 with a sanitization error for malformed payloads via POST', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/state',
      body: { windows: 'nope' },
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toContain('windows must be an array');
  });
});
