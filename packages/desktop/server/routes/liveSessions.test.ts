import { describe, expect, it, vi } from 'vitest';

const liveSessionCapability = vi.hoisted(() => {
  class LiveSessionCapabilityInputError extends Error {}
  return { LiveSessionCapabilityInputError, submitLiveSessionPromptCapability: vi.fn() };
});
const liveSessions = vi.hoisted(() => {
  class LiveSessionControlError extends Error {}
  return { LiveSessionControlError, isLive: vi.fn(), prewarmLiveSessionLoader: vi.fn(async () => undefined), subscribe: vi.fn() };
});

vi.mock('../conversations/liveSessionCapability.js', () => liveSessionCapability);
vi.mock('../conversations/liveSessions.js', () => liveSessions);
vi.mock('../conversations/conversationCwd.js', () => ({ resolveNeutralChatCwd: vi.fn(() => '/neutral') }));
vi.mock('../conversations/conversationService.js', () => ({ parseTailBlocksQuery: vi.fn((value) => Number(value) || undefined) }));
vi.mock('../middleware/index.js', () => ({ logError: vi.fn(), logWarn: vi.fn() }));

import {
  ensureRequestControlsLocalLiveConversation,
  handleLiveSessionPrompt,
  registerLiveSessionRoutes,
  writeLiveConversationControlError,
} from './liveSessions.js';

describe('live session routes', () => {
  function res() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('submits live prompts with sanitized text, images, and surface id', async () => {
    const result = { ok: true };
    liveSessionCapability.submitLiveSessionPromptCapability.mockResolvedValueOnce(result);
    const response = res();

    await handleLiveSessionPrompt(
      {
        params: { id: 'conv-1' },
        body: {
          text: 'hello',
          behavior: 'send',
          images: [
            { data: 'abc', mimeType: 'image/png', name: 'pic.png' },
            { data: 1, mimeType: null },
          ],
          attachmentRefs: [{ id: 'att-1' }],
          contextMessages: [{ role: 'user', content: 'ctx' }],
          relatedConversationIds: ['conv-2'],
          surfaceId: ' desktop ',
        },
      } as never,
      response as never,
    );

    expect(liveSessionCapability.submitLiveSessionPromptCapability).toHaveBeenCalledWith(
      {
        conversationId: 'conv-1',
        text: 'hello',
        behavior: 'send',
        images: [
          { data: 'abc', mimeType: 'image/png', name: 'pic.png' },
          { data: '', mimeType: '' },
        ],
        attachmentRefs: [{ id: 'att-1' }],
        contextMessages: [{ role: 'user', content: 'ctx' }],
        relatedConversationIds: ['conv-2'],
        surfaceId: 'desktop',
      },
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(response.json).toHaveBeenCalledWith(result);
  });

  it('maps prompt input and live session control errors to client responses', async () => {
    const response = res();
    liveSessionCapability.submitLiveSessionPromptCapability.mockRejectedValueOnce(
      new liveSessionCapability.LiveSessionCapabilityInputError('bad prompt'),
    );
    await handleLiveSessionPrompt({ params: { id: 'conv-1' }, body: {} } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'bad prompt' });

    const conflictResponse = res();
    liveSessionCapability.submitLiveSessionPromptCapability.mockRejectedValueOnce(
      new liveSessions.LiveSessionControlError('owned elsewhere'),
    );
    await handleLiveSessionPrompt({ params: { id: 'conv-1' }, body: {} } as never, conflictResponse as never);
    expect(conflictResponse.status).toHaveBeenCalledWith(409);
    expect(conflictResponse.json).toHaveBeenCalledWith({ error: 'owned elsewhere' });
  });

  it('extracts local control surface ids and writes control errors', () => {
    expect(ensureRequestControlsLocalLiveConversation('conv-1', { surfaceId: ' mobile ' })).toBe('mobile');
    expect(ensureRequestControlsLocalLiveConversation('conv-1', { surfaceId: '' })).toBeUndefined();

    const response = res();
    expect(writeLiveConversationControlError(response as never, new liveSessions.LiveSessionControlError('conflict'))).toBe(true);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(writeLiveConversationControlError(response as never, new Error('other'))).toBe(false);
  });

  it('registers the live session event stream with tail and surface options', () => {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
    registerLiveSessionRoutes(router as never, {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getDefaultWebCwd: () => '/repo',
      buildLiveSessionResourceOptions: () => ({ additionalSkillPaths: [] }),
      buildLiveSessionExtensionFactories: () => [],
      flushLiveDeferredResumes: vi.fn(),
      listTasksForRuntimeScope: () => [],
      listMemoryDocs: () => [],
    });
    const handler = router.get.mock.calls.find(([path]) => path === '/api/live-sessions/:id/events')?.[1];
    expect(handler).toBeTypeOf('function');

    liveSessions.isLive.mockReturnValueOnce(true);
    const unsubscribe = vi.fn();
    liveSessions.subscribe.mockReturnValueOnce(unsubscribe);
    const closeHandlers: Record<string, () => void> = {};
    const req = {
      params: { id: 'live-1' },
      query: { tailBlocks: '3', surfaceId: ' phone ', surfaceType: 'mobile_web' },
      on: vi.fn((event, cb) => {
        closeHandlers[event] = cb;
      }),
    };
    const response = { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };

    handler(req, response);
    liveSessions.subscribe.mock.calls[0][1]({ type: 'entry' });
    closeHandlers.close?.();

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(liveSessions.subscribe).toHaveBeenCalledWith('live-1', expect.any(Function), {
      tailBlocks: 3,
      surface: { surfaceId: 'phone', surfaceType: 'mobile_web' },
    });
    expect(response.write).toHaveBeenCalledWith('data: {"type":"entry"}\n\n');
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('returns not-found instead of opening a blank event stream when subscription disappears', () => {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
    registerLiveSessionRoutes(router as never, {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getDefaultWebCwd: () => '/repo',
      buildLiveSessionResourceOptions: () => ({ additionalSkillPaths: [] }),
      buildLiveSessionExtensionFactories: () => [],
      flushLiveDeferredResumes: vi.fn(),
      listTasksForRuntimeScope: () => [],
      listMemoryDocs: () => [],
    });
    const handler = router.get.mock.calls.find(([path]) => path === '/api/live-sessions/:id/events')?.[1];
    expect(handler).toBeTypeOf('function');

    liveSessions.isLive.mockReturnValueOnce(true);
    liveSessions.subscribe.mockReturnValueOnce(null);
    const req = {
      params: { id: 'live-1' },
      query: {},
      on: vi.fn(),
    };
    const response = { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };

    handler(req, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: 'Not a live session' });
    expect(response.flushHeaders).not.toHaveBeenCalled();
    expect(response.write).not.toHaveBeenCalled();
    expect(req.on).not.toHaveBeenCalled();
  });
});
