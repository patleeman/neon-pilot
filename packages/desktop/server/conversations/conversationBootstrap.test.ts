import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildAppendOnlySessionDetailResponseMock,
  readConversationSessionSignatureWithTelemetryMock,
  readLiveSessionMock,
  readSessionDetailForRouteMock,
  toPublicLiveSessionMetaMock,
} = vi.hoisted(() => ({
  buildAppendOnlySessionDetailResponseMock: vi.fn(),
  readConversationSessionSignatureWithTelemetryMock: vi.fn(),
  readLiveSessionMock: vi.fn(),
  readSessionDetailForRouteMock: vi.fn(),
  toPublicLiveSessionMetaMock: vi.fn(),
}));

vi.mock('./conversationService.js', () => ({
  buildAppendOnlyConversationDetailResponse: buildAppendOnlySessionDetailResponseMock,
  readConversationSessionSignatureWithTelemetry: readConversationSessionSignatureWithTelemetryMock,
  readLiveSession: readLiveSessionMock,
  readSessionDetailForRoute: readSessionDetailForRouteMock,
  toPublicLiveSessionMeta: toPublicLiveSessionMetaMock,
}));

import { isMissingConversationBootstrapState, readConversationBootstrapState } from './conversationBootstrap.js';

describe('conversationBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readLiveSessionMock.mockReturnValue(null);
    readConversationSessionSignatureWithTelemetryMock.mockReturnValue({
      signature: null,
      telemetry: {
        liveLookupMs: 0,
        liveFileExistsMs: 0,
        ensureMs: 0,
        ensuredLiveLookupMs: 0,
        ensuredFileExistsMs: 0,
        snapshotLookupMs: 0,
        source: 'missing',
        signatureFileExistsMs: 0,
        signatureStatMs: 0,
      },
    });
    readSessionDetailForRouteMock.mockResolvedValue({
      sessionRead: {
        detail: null,
        telemetry: null,
      },
      remoteMirror: { status: 'missing', durationMs: 0 },
    });
    toPublicLiveSessionMetaMock.mockReturnValue({ id: 'conversation-1', title: 'Live title' });
    buildAppendOnlySessionDetailResponseMock.mockReturnValue(null);
  });

  it('does not stat the session signature before an initial bootstrap detail read', async () => {
    readSessionDetailForRouteMock.mockResolvedValueOnce({
      sessionRead: {
        detail: {
          signature: 'sig-initial',
          blocks: [{ id: 'block-1' }],
        },
        telemetry: { cache: 'miss', loader: 'fast-tail', durationMs: 4 },
      },
      remoteMirror: { status: 'deferred', durationMs: 0 },
    });

    const result = await readConversationBootstrapState({
      conversationId: 'conversation-1',
      profile: 'assistant',
      tailBlocks: 24,
    });

    expect(readConversationSessionSignatureWithTelemetryMock).not.toHaveBeenCalled();
    expect(readSessionDetailForRouteMock).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      profile: 'assistant',
      tailBlocks: 24,
    });
    expect(result.state).toMatchObject({
      conversationId: 'conversation-1',
      sessionDetailSignature: 'sig-initial',
      sessionDetail: {
        signature: 'sig-initial',
        blocks: [{ id: 'block-1' }],
      },
    });
    expect(result.telemetry).toMatchObject({
      sessionDetailReused: false,
      sessionSignature: null,
    });
  });

  it('reuses the known session signature when the transcript is unchanged', async () => {
    readConversationSessionSignatureWithTelemetryMock.mockReturnValueOnce({
      signature: 'sig-1',
      telemetry: {
        liveLookupMs: 1,
        liveFileExistsMs: 2,
        ensureMs: 0,
        ensuredLiveLookupMs: 0,
        ensuredFileExistsMs: 0,
        snapshotLookupMs: 0,
        source: 'live',
        signatureFileExistsMs: 3,
        signatureStatMs: 4,
      },
    });
    readLiveSessionMock.mockReturnValueOnce({ id: 'conversation-1', raw: true });

    const result = await readConversationBootstrapState({
      conversationId: 'conversation-1',
      profile: 'assistant',
      knownSessionSignature: 'sig-1',
    });

    expect(readSessionDetailForRouteMock).not.toHaveBeenCalled();
    expect(toPublicLiveSessionMetaMock).toHaveBeenCalledWith({ id: 'conversation-1', raw: true });
    expect(result).toEqual({
      state: {
        conversationId: 'conversation-1',
        sessionDetail: null,
        sessionDetailSignature: 'sig-1',
        sessionDetailUnchanged: true,
        liveSession: {
          live: true,
          id: 'conversation-1',
          title: 'Live title',
        },
      },
      telemetry: {
        sessionRead: null,
        sessionDetailReused: true,
        remoteMirror: { status: 'deferred', durationMs: 0 },
        sessionSignature: {
          liveLookupMs: 1,
          liveFileExistsMs: 2,
          ensureMs: 0,
          ensuredLiveLookupMs: 0,
          ensuredFileExistsMs: 0,
          snapshotLookupMs: 0,
          source: 'live',
          signatureFileExistsMs: 3,
          signatureStatMs: 4,
        },
        sessionSignatureMs: expect.any(Number),
        liveSessionLookupMs: expect.any(Number),
      },
    });
  });

  it('returns append-only state when the cached signature is stale', async () => {
    readConversationSessionSignatureWithTelemetryMock.mockReturnValueOnce({
      signature: 'sig-new',
      telemetry: {
        liveLookupMs: 0,
        liveFileExistsMs: 0,
        ensureMs: 0,
        ensuredLiveLookupMs: 0,
        ensuredFileExistsMs: 0,
        snapshotLookupMs: 0,
        source: 'snapshot',
        signatureFileExistsMs: 0,
        signatureStatMs: 0,
      },
    });
    readSessionDetailForRouteMock.mockResolvedValueOnce({
      sessionRead: {
        detail: {
          signature: 'sig-new',
          blocks: [{ id: 'block-2' }],
        },
        telemetry: { cache: 'miss', loader: 'full', durationMs: 4 },
      },
      remoteMirror: { status: 'deferred', durationMs: 0 },
    });
    buildAppendOnlySessionDetailResponseMock.mockReturnValueOnce({
      appendOnly: true,
      signature: 'sig-append',
      blocks: [{ id: 'block-2' }],
    });

    const result = await readConversationBootstrapState({
      conversationId: 'conversation-1',
      profile: 'assistant',
      knownSessionSignature: 'sig-old',
      knownBlockOffset: 3,
      knownTotalBlocks: 9,
      knownLastBlockId: 'block-1',
    });

    expect(buildAppendOnlySessionDetailResponseMock).toHaveBeenCalledWith({
      detail: {
        signature: 'sig-new',
        blocks: [{ id: 'block-2' }],
      },
      knownBlockOffset: 3,
      knownTotalBlocks: 9,
      knownLastBlockId: 'block-1',
    });
    expect(result.state).toEqual({
      conversationId: 'conversation-1',
      sessionDetail: null,
      sessionDetailSignature: 'sig-append',
      sessionDetailAppendOnly: {
        appendOnly: true,
        signature: 'sig-append',
        blocks: [{ id: 'block-2' }],
      },
      liveSession: { live: false },
    });
  });

  it('detects when the bootstrap state is missing entirely', () => {
    expect(
      isMissingConversationBootstrapState({
        conversationId: 'missing',
        sessionDetail: null,
        liveSession: { live: false },
      }),
    ).toBe(true);

    expect(
      isMissingConversationBootstrapState({
        conversationId: 'live',
        sessionDetail: null,
        liveSession: { live: true, id: 'live' },
      }),
    ).toBe(false);
  });
});
