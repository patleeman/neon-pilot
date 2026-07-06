import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeDesktopScreenshotRequest,
  issueDesktopScreenshotRequest,
  resetDesktopScreenshotForTests,
  subscribeDesktopScreenshotRequests,
} from './localApiDesktopScreenshot.js';

const image = {
  mimeType: 'image/png' as const,
  data: Buffer.from('png-bytes').toString('base64'),
  width: 640,
  height: 400,
  capturedAt: '2026-07-05T00:00:00.000Z',
};

describe('localApiDesktopScreenshot', () => {
  beforeEach(() => {
    resetDesktopScreenshotForTests();
  });

  it('streams issued requests to subscribers and resolves on acknowledgement', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopScreenshotRequests(listener);

    const pending = issueDesktopScreenshotRequest({ windowId: 'chat:draft', timeoutMs: 500 });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^desktop-screenshot-/),
        windowId: 'chat:draft',
      }),
    );
    const requestId = listener.mock.calls[0]?.[0]?.id as string;

    expect(acknowledgeDesktopScreenshotRequest({ requestId, ok: true, image })).toEqual({
      ok: true,
      requestId,
      status: 'completed',
      image,
    });
    await expect(pending).resolves.toEqual({
      ok: true,
      requestId,
      status: 'completed',
      image,
    });

    unsubscribe();
  });

  it('replays pending requests to late renderer subscribers', async () => {
    const pending = issueDesktopScreenshotRequest({ windowId: 'chat:draft', timeoutMs: 500 });
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopScreenshotRequests(listener);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^desktop-screenshot-/),
        windowId: 'chat:draft',
      }),
    );
    const requestId = listener.mock.calls[0]?.[0]?.id as string;

    acknowledgeDesktopScreenshotRequest({ requestId, ok: true, image });
    await expect(pending).resolves.toMatchObject({ ok: true, requestId, status: 'completed' });

    unsubscribe();
  });

  it('rejects successful acknowledgements without a valid image', async () => {
    const listener = vi.fn();
    subscribeDesktopScreenshotRequests(listener);
    const pending = issueDesktopScreenshotRequest({ timeoutMs: 500 });
    const requestId = listener.mock.calls[0]?.[0]?.id as string;

    expect(() => acknowledgeDesktopScreenshotRequest({ requestId, ok: true })).toThrow(/image must be an object/);

    acknowledgeDesktopScreenshotRequest({ requestId, ok: false, error: 'capture failed' });
    await expect(pending).resolves.toMatchObject({ ok: false, status: 'failed', error: 'capture failed' });
  });

  it('times out when no renderer acknowledges the request', async () => {
    await expect(issueDesktopScreenshotRequest({ timeoutMs: 100 })).resolves.toMatchObject({
      ok: false,
      status: 'timeout',
    });
  });

  it('rejects acknowledgements for requests that already timed out', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopScreenshotRequests(listener);
    const pending = issueDesktopScreenshotRequest({ windowId: 'chat:draft', timeoutMs: 100 });
    const requestId = listener.mock.calls[0]?.[0]?.id as string;

    await expect(pending).resolves.toMatchObject({ ok: false, requestId, status: 'timeout' });
    expect(() => acknowledgeDesktopScreenshotRequest({ requestId, ok: true, image })).toThrow(/no longer pending/);

    unsubscribe();
  });
});
