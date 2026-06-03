import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appendUpdate, load, resolveAnnotation, runReview, sendChat } from './backend';

function context() {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    },
  } as never;
}

describe('Writing Studio backend', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('persists Yjs update events with latest markdown', async () => {
    const ctx = context();
    await appendUpdate({ updateBase64: 'AQID', markdown: '# One', actorId: 'writer' }, ctx);

    const state = await load({}, ctx);
    expect(state.markdown).toBe('# One');
    expect(state.updateClock).toBe(1);
    expect(state.events).toEqual([
      expect.objectContaining({
        type: 'yjs_update',
        actorId: 'writer',
        payload: expect.objectContaining({ updateBase64: 'AQID', clock: 1 }),
      }),
    ]);
  });

  it('adds review annotations and replay events', async () => {
    const ctx = context();
    const result = await runReview(
      {
        markdown:
          '# Draft\n\nThis is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
      },
      ctx,
    );

    expect(result.annotations.length).toBeGreaterThan(0);
    const state = await load({}, ctx);
    expect(state.annotations.length).toBe(result.annotations.length);
    expect(state.events.some((event) => event.type === 'agent_run_started')).toBe(true);
    expect(state.events.some((event) => event.type === 'annotation_added')).toBe(true);
    expect(state.events.some((event) => event.type === 'agent_run_completed')).toBe(true);
  });

  it('stores chat messages and resolves annotations', async () => {
    const ctx = context();
    const review = await runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    const chat = await sendChat({ body: 'Can you improve this?', markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    const resolved = await resolveAnnotation({ id: review.annotations[0].id }, ctx);

    expect(chat.messages.map((message) => message.role)).toEqual(['user', 'agent']);
    expect(resolved.annotations[0].status).toBe('resolved');
  });
});
