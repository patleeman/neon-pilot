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

import { ensureRequestControlsLocalLiveConversation, handleLiveSessionPrompt, writeLiveConversationControlError } from './liveSessions.js';

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
});
