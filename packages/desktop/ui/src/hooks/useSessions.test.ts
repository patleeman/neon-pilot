import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionDetail, SessionMeta } from '../shared/types';

const apiMocks = vi.hoisted(() => ({
  sessionDetail: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import { fetchSessionDetailCached, primeSessionDetailCache } from './useSessions';

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
