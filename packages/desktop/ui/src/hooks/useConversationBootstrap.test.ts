import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationBootstrapState, SessionDetail, SessionMeta } from '../shared/types';

const apiMocks = vi.hoisted(() => ({
  conversationBootstrap: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import {
  buildConversationBootstrapVersionKey,
  fetchConversationBootstrapCached,
  primeConversationBootstrapCache,
} from './useConversationBootstrap';

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

function createSessionDetail(signature = 'sig-1', text = 'Cached reply', id = 'conv-1'): SessionDetail {
  return {
    meta: createSessionMeta(id),
    blocks: [{ type: 'text', id: 'assistant-1', ts: '2026-04-06T12:00:01.000Z', text }],
    blockOffset: 0,
    totalBlocks: 1,
    contextUsage: null,
    signature,
  };
}

function createBootstrapState(conversationId = 'conv-1', overrides?: Partial<ConversationBootstrapState>): ConversationBootstrapState {
  return {
    conversationId,
    sessionDetail: createSessionDetail('sig-1', 'Cached reply', conversationId),
    liveSession: { live: false },
    ...overrides,
  };
}

describe('useConversationBootstrap cache helpers', () => {
  beforeEach(() => {
    apiMocks.conversationBootstrap.mockReset();
  });

  it('reuses the in-memory bootstrap cache synchronously', async () => {
    const conversationId = 'conv-seed-hit';
    const bootstrap = createBootstrapState(conversationId, {
      sessionDetail: createSessionDetail('sig-seed', 'Warm reply', conversationId),
    });
    primeConversationBootstrapCache(conversationId, bootstrap, { tailBlocks: 120 }, '7:3');

    await expect(fetchConversationBootstrapCached(conversationId, { tailBlocks: 120 }, '7:3')).resolves.toEqual({
      ...bootstrap,
      sessionDetailSignature: 'sig-seed',
    });
    expect(apiMocks.conversationBootstrap).not.toHaveBeenCalled();
  });

  it('fetches an uncached bootstrap from the api', async () => {
    const conversationId = 'conv-cache-miss';
    const bootstrap = createBootstrapState(conversationId, {
      sessionDetail: createSessionDetail('sig-fresh', 'Fresh reply', conversationId),
    });
    apiMocks.conversationBootstrap.mockResolvedValueOnce(bootstrap);

    await expect(fetchConversationBootstrapCached(conversationId, { tailBlocks: 120 }, '1:0')).resolves.toEqual({
      ...bootstrap,
      sessionDetailSignature: 'sig-fresh',
    });
    expect(apiMocks.conversationBootstrap).toHaveBeenCalledWith(conversationId, { tailBlocks: 120 });
  });

  it('normalizes legacy bootstrap records that are missing live session state', async () => {
    const conversationId = 'conv-legacy-bootstrap';
    const bootstrap = createBootstrapState(conversationId, {
      sessionDetail: createSessionDetail('sig-legacy', 'Legacy reply', conversationId),
    });
    const legacyBootstrap = { ...bootstrap } as Partial<ConversationBootstrapState>;
    delete legacyBootstrap.liveSession;
    apiMocks.conversationBootstrap.mockResolvedValueOnce(legacyBootstrap);

    await expect(fetchConversationBootstrapCached(conversationId, { tailBlocks: 120 }, '1:0')).resolves.toEqual({
      ...bootstrap,
      liveSession: { live: false },
      sessionDetailSignature: 'sig-legacy',
    });
  });

  it('tracks both session list and session file invalidations in the version key', () => {
    expect(buildConversationBootstrapVersionKey({ sessionsVersion: 0, sessionFilesVersion: 0 })).toBe('0:0');
    expect(buildConversationBootstrapVersionKey({ sessionsVersion: 7, sessionFilesVersion: 3 })).toBe('7:3');
  });
});
