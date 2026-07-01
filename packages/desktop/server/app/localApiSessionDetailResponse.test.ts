import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildAppendOnlyConversationDetailResponseMock,
  inlineConversationSessionDetailAppendOnlyAssetsCapabilityMock,
  inlineConversationSessionDetailAssetsCapabilityMock,
  readConversationSessionSignatureMock,
  readSessionDetailForRouteMock,
} = vi.hoisted(() => ({
  buildAppendOnlyConversationDetailResponseMock: vi.fn(),
  inlineConversationSessionDetailAppendOnlyAssetsCapabilityMock: vi.fn((sessionId: string, detail: unknown) => ({
    inlinedAppendOnly: true,
    sessionId,
    detail,
  })),
  inlineConversationSessionDetailAssetsCapabilityMock: vi.fn((sessionId: string, detail: unknown) => ({
    inlined: true,
    sessionId,
    detail,
  })),
  readConversationSessionSignatureMock: vi.fn(),
  readSessionDetailForRouteMock: vi.fn(),
}));

vi.mock('../conversations/conversationService.js', () => ({
  buildAppendOnlyConversationDetailResponse: buildAppendOnlyConversationDetailResponseMock,
  readConversationSessionSignature: readConversationSessionSignatureMock,
  readSessionDetailForRoute: readSessionDetailForRouteMock,
}));

vi.mock('../conversations/conversationSessionAssetCapability.js', () => ({
  inlineConversationSessionDetailAppendOnlyAssetsCapability: inlineConversationSessionDetailAppendOnlyAssetsCapabilityMock,
  inlineConversationSessionDetailAssetsCapability: inlineConversationSessionDetailAssetsCapabilityMock,
}));

describe('readSessionDetailRouteResponse', () => {
  beforeEach(() => {
    buildAppendOnlyConversationDetailResponseMock.mockReset();
    inlineConversationSessionDetailAppendOnlyAssetsCapabilityMock.mockClear();
    inlineConversationSessionDetailAssetsCapabilityMock.mockClear();
    readConversationSessionSignatureMock.mockReset();
    readSessionDetailForRouteMock.mockReset();
  });

  it('rejects aborted transcript loads before starting the read', async () => {
    const { readSessionDetailRouteResponse } = await import('./localApiSessionDetailResponse.js');
    const controller = new AbortController();
    controller.abort();

    await expect(
      readSessionDetailRouteResponse({
        sessionId: 'conversation-1',
        profile: 'shared',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(readSessionDetailForRouteMock).not.toHaveBeenCalled();
  });

  it('coalesces identical inflight transcript reads', async () => {
    const { readSessionDetailRouteResponse } = await import('./localApiSessionDetailResponse.js');
    const detail = { meta: { id: 'conversation-1' }, blocks: [], blockOffset: 0, totalBlocks: 0, signature: 'sig-1' };
    let resolveRead!: (value: unknown) => void;
    readSessionDetailForRouteMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );

    const first = readSessionDetailRouteResponse({ sessionId: 'conversation-1', profile: 'shared', tailBlocks: 40 });
    const second = readSessionDetailRouteResponse({ sessionId: 'conversation-1', profile: 'shared', tailBlocks: 40 });
    await Promise.resolve();

    expect(readSessionDetailForRouteMock).toHaveBeenCalledTimes(1);
    resolveRead({ sessionRead: { detail, telemetry: null }, remoteMirror: { status: 'deferred', durationMs: 0 } });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { inlined: true, sessionId: 'conversation-1', detail },
      { inlined: true, sessionId: 'conversation-1', detail },
    ]);
  });
});

describe('localApiSessionDetailResponse helpers', () => {
  it('builds unchanged responses', async () => {
    const { buildUnchangedSessionDetailResponse } = await import('./localApiSessionDetailResponse.js');

    expect(buildUnchangedSessionDetailResponse({ sessionId: 's1', signature: 'sig' })).toEqual({
      unchanged: true,
      sessionId: 's1',
      signature: 'sig',
    });
  });

  it('detects unchanged session details only when known and current signatures match', async () => {
    const { shouldReturnUnchangedSessionDetail } = await import('./localApiSessionDetailResponse.js');

    expect(shouldReturnUnchangedSessionDetail({ knownSessionSignature: 'a', currentSessionSignature: 'a' })).toBe(true);
    expect(shouldReturnUnchangedSessionDetail({ knownSessionSignature: 'a', currentSessionSignature: 'b' })).toBe(false);
    expect(shouldReturnUnchangedSessionDetail({ knownSessionSignature: 'a', currentSessionSignature: null })).toBe(false);
  });

  it('builds append-only details when known and next signatures differ', async () => {
    const { shouldBuildAppendOnlySessionDetail } = await import('./localApiSessionDetailResponse.js');

    expect(shouldBuildAppendOnlySessionDetail({ knownSessionSignature: 'a', nextSessionSignature: 'b' })).toBe(true);
    expect(shouldBuildAppendOnlySessionDetail({ knownSessionSignature: 'a', nextSessionSignature: 'a' })).toBe(false);
    expect(shouldBuildAppendOnlySessionDetail({ nextSessionSignature: 'b' })).toBe(false);
  });
});
