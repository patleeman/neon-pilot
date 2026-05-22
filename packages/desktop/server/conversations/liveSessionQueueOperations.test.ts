import { describe, expect, it, vi } from 'vitest';

import {
  cancelLiveSessionQueuedPrompt,
  clearLiveSessionQueuedPrompts,
  restoreLiveSessionQueuedMessage,
} from './liveSessionQueueOperations.js';

function host(input: { steering?: string[]; followUp?: string[]; steeringQueue?: unknown; followUpQueue?: unknown } = {}) {
  const steering = input.steering ?? [];
  const followUp = input.followUp ?? [];
  return {
    session: {
      agent: { steeringQueue: input.steeringQueue, followUpQueue: input.followUpQueue },
      getSteeringMessages: vi.fn(() => steering),
      getFollowUpMessages: vi.fn(() => followUp),
      clearQueue: vi.fn(() => ({ steering: [...steering], followUp: [...followUp] })),
      steer: vi.fn(async (_text: string) => undefined),
      followUp: vi.fn(async (_text: string) => undefined),
    },
  };
}

describe('live session queue operations', () => {
  it('restores fallback visible queued prompts by clearing and replaying remaining queues', async () => {
    const h = host({ steering: ['first', 'second'], followUp: ['later'] });

    await expect(restoreLiveSessionQueuedMessage(h as never, 'steer', 0, 'steer-visible-1')).resolves.toEqual({
      text: 'second',
      images: [],
    });

    expect(h.session.clearQueue).toHaveBeenCalledOnce();
    expect(h.session.steer).toHaveBeenCalledWith('first');
    expect(h.session.followUp).toHaveBeenCalledWith('later');
  });

  it('validates restore indices and detects stale fallback preview ids', async () => {
    const h = host({ steering: ['first'] });
    await expect(restoreLiveSessionQueuedMessage(h as never, 'steer', -1)).rejects.toThrow(
      'Queued message index must be a non-negative integer',
    );
    await expect(restoreLiveSessionQueuedMessage(h as never, 'steer', 0, 'queued-steer-fallback-99')).rejects.toThrow(
      'Queued prompt changed before it could be restored. Try again.',
    );
    await expect(restoreLiveSessionQueuedMessage(h as never, 'steer', 9)).rejects.toThrow(
      'Queued prompt changed before it could be restored. Try again.',
    );
  });

  it('restores internal queued user messages with text and images', async () => {
    const message = {
      role: 'user',
      content: [
        { type: 'text', text: 'internal text' },
        { type: 'image', data: 'YWJj', mimeType: 'image/png' },
      ],
    };
    const h = host({ steering: ['visible text'], steeringQueue: { messages: [message] } });

    const restored = await restoreLiveSessionQueuedMessage(h as never, 'steer', 0);

    expect(restored.text).toBe('internal text');
    expect(restored.images).toEqual([{ type: 'image', data: 'YWJj', mimeType: 'image/png' }]);
    expect(h.session.clearQueue).not.toHaveBeenCalled();
  });

  it('clears queues and infers authors from internal messages and continuation text', () => {
    const h = host({
      steering: ['user visible', 'Goal continuation.\n\nObjective: continue'],
      followUp: ['assistant visible'],
      steeringQueue: {
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'user text' }] },
          { role: 'assistant', content: [{ type: 'text', text: 'agent text' }] },
        ],
      },
      followUpQueue: { messages: [{ role: 'assistant', content: [{ type: 'text', text: 'assistant text' }] }] },
    });

    expect(clearLiveSessionQueuedPrompts(h as never)).toEqual([
      { behavior: 'steer', text: 'user text', images: [], author: 'user' },
      { behavior: 'steer', text: 'agent text', images: [], author: 'agent' },
      { behavior: 'followUp', text: 'assistant text', images: [], author: 'agent' },
    ]);
    expect(h.session.clearQueue).toHaveBeenCalledOnce();

    const fallback = host({ steering: ['Automated after-turn wakeup for agent self-queued continuation', 'normal user'] });
    expect(clearLiveSessionQueuedPrompts(fallback as never)).toEqual([
      { behavior: 'steer', text: 'Automated after-turn wakeup for agent self-queued continuation', images: [], author: 'agent' },
      { behavior: 'steer', text: 'normal user', images: [], author: 'user' },
    ]);
  });

  it('cancels fallback queued prompts by replaying all remaining messages', async () => {
    const h = host({ steering: ['first', 'second'], followUp: ['later'] });

    const cancelled = await cancelLiveSessionQueuedPrompt(h as never, 'steer', 'steer-visible-0');

    expect(cancelled).toMatchObject({ id: 'steer-visible-0', text: 'first' });
    expect(h.session.clearQueue).toHaveBeenCalledOnce();
    expect(h.session.steer).toHaveBeenCalledWith('second');
    expect(h.session.followUp).toHaveBeenCalledWith('later');
  });

  it('cancels internal queued prompts without clearing the whole queue', async () => {
    const message = { role: 'user', content: [{ type: 'text', text: 'internal text' }] };
    const steeringQueue = { messages: [message] };
    const h = host({ steering: ['internal text'], steeringQueue });
    const preview = await cancelLiveSessionQueuedPrompt(h as never, 'steer', 'steer-queued-1');

    expect(preview).toMatchObject({ text: 'internal text' });
    expect(steeringQueue.messages).toEqual([]);
    expect(h.session.clearQueue).not.toHaveBeenCalled();
  });

  it('validates cancel ids and stale previews', async () => {
    const h = host({ steering: ['first'] });
    await expect(cancelLiveSessionQueuedPrompt(h as never, 'steer', '   ')).rejects.toThrow('Queued prompt id is required');
    await expect(cancelLiveSessionQueuedPrompt(h as never, 'steer', 'missing')).rejects.toThrow(
      'Queued prompt changed before it could be cancelled. Try again.',
    );
  });
});
