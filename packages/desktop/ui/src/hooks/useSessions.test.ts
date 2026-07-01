// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionDetail, SessionMeta } from '../shared/types';

const apiMocks = vi.hoisted(() => ({
  sessionDetail: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

vi.mock('../app/contexts', () => ({
  useAppEvents: () => ({
    versions: {
      sessionFiles: 1,
    },
  }),
}));

import { fetchSessionDetailCached, primeSessionDetailCache, useSessionDetail } from './useSessions';

function createSessionMeta(id = 'conv-1'): SessionMeta {
  return {
    id,
    file: `/tmp/${id}.jsonl`,
    timestamp: '2026-04-06T12:00:00.000Z',
    cwd: '/tmp/project',
    cwdSlug: '--tmp-project--',
    model: 'gpt-5.4',
    title: 'Cached conversation',
    messageCount: 2,
  };
}

function createSessionDetail(signature = 'sig-1', id = 'conv-1', text = 'Cached reply'): SessionDetail {
  return {
    meta: createSessionMeta(id),
    blocks: [{ type: 'text', id: 'assistant-1', ts: '2026-04-06T12:00:01.000Z', text }],
    blockOffset: 0,
    totalBlocks: 1,
    contextUsage: null,
    signature,
  };
}

describe('useSessions cache helpers', () => {
  beforeEach(() => {
    apiMocks.sessionDetail.mockReset();
  });

  it('reuses the in-memory session detail cache synchronously', async () => {
    const sessionId = 'conv-detail-seed-hit';
    const detail = createSessionDetail('sig-seed', sessionId);
    primeSessionDetailCache(sessionId, detail, { tailBlocks: 120 }, 9);

    await expect(fetchSessionDetailCached(sessionId, { tailBlocks: 120 }, 9)).resolves.toEqual(detail);
    expect(apiMocks.sessionDetail).not.toHaveBeenCalled();
  });

  it('fetches uncached session detail from the api', async () => {
    const sessionId = 'conv-detail-cache-miss';
    const detail = createSessionDetail('sig-fresh', sessionId, 'Fresh reply');
    apiMocks.sessionDetail.mockResolvedValueOnce(detail);

    await expect(fetchSessionDetailCached(sessionId, { tailBlocks: 120 }, 1)).resolves.toEqual(detail);
    expect(apiMocks.sessionDetail).toHaveBeenCalledWith(sessionId, { tailBlocks: 120 });
  });

  it('rejects delta-only session detail responses from renderer refreshes', async () => {
    const sessionId = 'conv-detail-delta-only';
    primeSessionDetailCache(sessionId, createSessionDetail('sig-1', sessionId), { tailBlocks: 120 }, 0);
    apiMocks.sessionDetail.mockResolvedValueOnce({
      appendOnly: true,
      meta: createSessionMeta(sessionId),
      blocks: [{ type: 'text', id: 'assistant-4', ts: '2026-04-06T12:00:04.000Z', text: 'Reply 4' }],
      blockOffset: 3,
      totalBlocks: 6,
      contextUsage: null,
      signature: 'sig-2',
    });

    await expect(fetchSessionDetailCached(sessionId, { tailBlocks: 120 }, 1)).rejects.toThrow(
      'Session detail response did not include an authoritative transcript payload.',
    );
    expect(apiMocks.sessionDetail).toHaveBeenCalledWith(sessionId, { tailBlocks: 120 });
  });
});

describe('useSessionDetail', () => {
  beforeEach(() => {
    apiMocks.sessionDetail.mockReset();
  });

  it('aborts the stale transcript request when the selected session changes', async () => {
    const requests: Array<{
      sessionId: string;
      signal: AbortSignal | undefined;
      resolve: (detail: SessionDetail) => void;
      reject: (error: Error) => void;
    }> = [];

    apiMocks.sessionDetail.mockImplementation(
      (sessionId: string, options?: { signal?: AbortSignal }) =>
        new Promise<SessionDetail>((resolve, reject) => {
          requests.push({ sessionId, signal: options?.signal, resolve, reject });
          options?.signal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        }),
    );

    const { result, rerender } = renderHook(({ sessionId }) => useSessionDetail(sessionId, { tailBlocks: 120 }), {
      initialProps: { sessionId: 'conv-abort-old' },
    });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.signal?.aborted).toBe(false);

    rerender({ sessionId: 'conv-abort-new' });

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(requests[1]?.signal?.aborted).toBe(false);

    requests[1]?.resolve(createSessionDetail('sig-new', 'conv-abort-new', 'New transcript'));

    await waitFor(() => expect(result.current.detail?.meta.id).toBe('conv-abort-new'));
    expect(result.current.error).toBeNull();
  });
});
