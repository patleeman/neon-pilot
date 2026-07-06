import { beforeEach, describe, expect, it } from 'vitest';

import { dispatchDesktopLocalApiRequest } from './localApi.js';
import {
  issueDesktopScreenshotRequest,
  resetDesktopScreenshotForTests,
  subscribeDesktopScreenshotRequests,
} from './localApiDesktopScreenshot.js';

function readJsonBody(response: Awaited<ReturnType<typeof dispatchDesktopLocalApiRequest>>) {
  return JSON.parse(Buffer.from(response.body).toString('utf-8')) as Record<string, unknown>;
}

describe('desktop local API desktop screenshot acknowledgement route', () => {
  beforeEach(() => {
    resetDesktopScreenshotForTests();
  });

  it('acknowledges a pending desktop screenshot request via POST', async () => {
    let requestId = '';
    subscribeDesktopScreenshotRequests((request) => {
      requestId = request.id;
    });
    const pending = issueDesktopScreenshotRequest({ windowId: 'chat:draft', timeoutMs: 500 });
    const image = {
      mimeType: 'image/png',
      data: Buffer.from('png-bytes').toString('base64'),
      width: 640,
      height: 400,
      capturedAt: '2026-07-05T00:00:00.000Z',
      windowId: 'chat:draft',
    };

    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/screenshot/ack',
      body: { requestId, ok: true, image },
    });

    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toEqual({
      ok: true,
      requestId,
      status: 'completed',
      image,
    });
    await expect(pending).resolves.toMatchObject({ ok: true, requestId, status: 'completed' });
  });

  it('returns 400 when acknowledging a missing request', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/desktop/screenshot/ack',
      body: { requestId: 'missing', ok: true },
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toContain('no longer pending');
  });
});
