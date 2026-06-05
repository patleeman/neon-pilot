import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import * as Y from 'yjs';

const mockRunTurn = vi.hoisted(() => vi.fn());
const mockCreateConversation = vi.hoisted(() => vi.fn());
const mockRunAgentTask = vi.hoisted(() => vi.fn());

vi.mock('@neon-pilot/extensions/backend/agent', () => ({
  runAgentTask: mockRunAgentTask,
}));

import {
  addAnnotation,
  applyAnnotationEdit,
  appendUpdate,
  createDocument,
  createFolder,
  deleteDocument,
  deleteFolder,
  exportDocument,
  getCanvas,
  getAgentInstructions,
  ensureChatSession,
  importDocument,
  load,
  renameDocument,
  renameFolder,
  replayDocument,
  resolveAnnotation,
  runReview,
  clearChat,
  reviewSelection,
  updateAnnotation,
  updateAgentInstructions,
  updateCanvas,
} from './backend';

function context(options?: { conversations?: Record<string, unknown> }) {
  const store = new Map<string, unknown>();
  const conversations =
    options?.conversations ??
    ({
      create: mockCreateConversation,
      runTurn: mockRunTurn,
      ensureLive: vi.fn(),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
      appendTranscriptBlock: vi.fn(),
    } satisfies Record<string, unknown>);
  return {
    storage: {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    },
    conversations,
  } as never;
}

function mockReviewToolAnnotations(
  annotations: Array<{
    quote: string;
    body: string;
    kind?: 'comment' | 'suggestion' | 'reaction' | 'warning';
    suggestedReplacement?: string;
    emoji?: string;
  }>,
) {
  mockRunAgentTask.mockImplementationOnce(async (_input: unknown, ctx: never) => {
    for (const annotation of annotations) {
      await addAnnotation(
        {
          quote: annotation.quote,
          body: annotation.body,
          kind: annotation.kind ?? 'comment',
          suggestedReplacement: annotation.suggestedReplacement,
          emoji: annotation.emoji,
        },
        ctx,
      );
    }
    return { text: 'Reviewed with Writing Studio tools.' };
  });
}

function yjsUpdateForMarkdown(markdown: string): string {
  const doc = new Y.Doc();
  doc.getText('markdown').insert(0, markdown);
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

describe('Writing Studio backend', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockCreateConversation.mockReset();
    mockCreateConversation.mockImplementation(async () => ({ id: `review-chat-${mockCreateConversation.mock.calls.length}`, conversationId: `review-chat-${mockCreateConversation.mock.calls.length}` }));
    mockRunTurn.mockReset();
    mockRunTurn.mockRejectedValue(new Error('No model in unit test.'));
    mockRunAgentTask.mockReset();
    mockRunAgentTask.mockRejectedValue(new Error('No model in unit test.'));
  });

  it('persists Yjs update events with latest markdown', async () => {
    const ctx = context();
    await appendUpdate({ updateBase64: yjsUpdateForMarkdown('# One'), markdown: '# One', actorId: 'writer' }, ctx);

    const state = await load({}, ctx);
    expect(state.markdown).toBe('# One');
    expect(state.updateClock).toBe(1);
    expect(state.events).toEqual([
      expect.objectContaining({
        type: 'yjs_update',
        actorId: 'writer',
        payload: expect.objectContaining({ markdownSnapshot: '# One', clock: 1 }),
      }),
    ]);
  });

  it('replays a document from stored Yjs updates', async () => {
    const ctx = context();
    await appendUpdate({ updateBase64: yjsUpdateForMarkdown('# Replayed\n\nFrom CRDT'), markdown: '# Replayed\n\nFrom CRDT', actorId: 'writer' }, ctx);

    const replay = await replayDocument({}, ctx);

    expect(replay.markdown).toBe('# Replayed\n\nFrom CRDT');
    expect(replay.updateEventCount).toBe(1);
    expect(replay.matchesLatest).toBe(true);
  });

  it('adds review annotations and replay events', async () => {
    const ctx = context();
    mockReviewToolAnnotations([
      {
        quote: 'This is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
        body: 'This is the live review note.',
        kind: 'suggestion',
        suggestedReplacement: 'This sentence has enough substance to show a concrete approved edit.',
      },
    ]);
    const result = await runReview(
      {
        markdown:
          '# Draft\n\nThis is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
      },
      ctx,
    );

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].body).toBe('This is the live review note.');
    expect(result.annotations[0].anchor).toEqual(expect.objectContaining({ before: '# Draft', after: '' }));
    expect(result.annotations[0].suggestedReplacement).toBe('This sentence has enough substance to show a concrete approved edit.');
    expect(ctx.conversations.appendTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockType: 'writing_studio_review',
        title: 'Reviewed 1',
        blockId: `writing-studio-review:${result.runId}`,
        data: expect.objectContaining({
          documentId: 'default',
          runId: result.runId,
          annotationCount: 1,
        }),
      }),
    );
    const state = await load({}, ctx);
    expect(state.annotations.length).toBe(result.annotations.length);
    expect(state.events.some((event) => event.type === 'agent_run_started')).toBe(true);
    expect(state.events.some((event) => event.type === 'annotation_added')).toBe(true);
    expect(state.events.some((event) => event.type === 'agent_run_completed')).toBe(true);
  });

  it('ensures the review transcript conversation has Writing Studio tools before reviewing', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-1', conversationId: 'host-chat-1' })),
      ensureLive: vi.fn(),
      setActiveTools: vi.fn(async () => {
        throw new Error('Conversation "host-chat-1" does not support active tool updates.');
      }),
      appendCustomEntry: vi.fn(),
      appendTranscriptBlock: vi.fn(),
    };
    const ctx = context({ conversations });
    mockReviewToolAnnotations([
      {
        quote: 'This selected sentence has enough surface area for a review note.',
        body: 'This is anchored review feedback.',
        kind: 'comment',
      },
    ]);

    await expect(
      runReview({ markdown: '# Draft\n\nThis selected sentence has enough surface area for a review note.' }, ctx),
    ).resolves.toMatchObject({ annotations: [expect.objectContaining({ body: 'This is anchored review feedback.' })] });

    expect(conversations.create).toHaveBeenCalledWith(expect.objectContaining({ allowedToolNames: expect.any(Array) }));
    expect(conversations.appendTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reviewed 1' }));
  });

  it('does not churn the visible chat conversation while loading a document', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-1', conversationId: 'host-chat-1' })),
      ensureLive: vi.fn(async () => {
        throw new Error('Live control is unavailable during passive load.');
      }),
      get: vi.fn(async () => ({ toolNames: ['bash'] })),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    const first = await load({}, ctx);
    const second = await load({}, ctx);

    expect(first.chatConversationId).toBe('host-chat-1');
    expect(second.chatConversationId).toBe('host-chat-1');
    expect(conversations.create).toHaveBeenCalledTimes(1);
    expect(conversations.ensureLive).not.toHaveBeenCalled();
    expect(conversations.get).not.toHaveBeenCalled();
    expect(conversations.setActiveTools).not.toHaveBeenCalled();
  });

  it('can produce more than three review annotations for longer drafts', async () => {
    const ctx = context();
    mockReviewToolAnnotations([
      {
        quote: 'This is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
        body: 'First live note.',
        kind: 'suggestion',
      },
      {
        quote: 'Maybe this section wants a clearer promise for the person reading it.',
        body: 'Second live note.',
        kind: 'warning',
      },
      {
        quote: 'The strongest idea arrives when the draft names the actual user and the actual moment.',
        body: 'Third live note.',
        kind: 'reaction',
      },
      {
        quote:
          'This sentence keeps accumulating clauses and side roads until the original point has to fight its way back into view for the reader.',
        body: 'Fourth live note.',
        kind: 'comment',
      },
    ]);
    const result = await runReview(
      {
        markdown: [
          '# Draft',
          '',
          'This is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
          'Maybe this section wants a clearer promise for the person reading it.',
          'The strongest idea arrives when the draft names the actual user and the actual moment.',
          'This sentence keeps accumulating clauses and side roads until the original point has to fight its way back into view for the reader.',
          'There is a clean claim here that could become the spine of the whole section.',
          'This is probably softer than it needs to be if the writer already believes the argument.',
        ].join('\n\n'),
      },
      ctx,
    );

    expect(result.annotations).toHaveLength(4);
  });

  it('reviews the current document chunk instead of always sending the document head', async () => {
    const ctx = context();
    const markdown = [
      '# Sparse Agent',
      '',
      'This is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
      'A paragraph near the top has a live wire and enough detail to earn one focused margin note from the reviewer.',
      'Another early paragraph is deliberately plain so the first model pass can stay sparse without ending the review.',
      'This sentence pads the opening section with a little more material so the review chunk boundary has somewhere natural to land.',
      'The top section keeps moving with more words and more claims and more texture before the second section finally arrives.',
      'One last top-section sentence gives the first review chunk enough weight to stand apart from the rest of the draft.',
      'The opening material now has enough length to make the chunker continue into later parts of the document.',
      'A final bridge line closes the first region and lets the next paragraph become a fresh review target.',
      Array.from(
        { length: 34 },
        () =>
          'This deliberately plain bridge sentence adds length without adding an annotation target, letting the review continue downward.',
      ).join(' '),
      '',
      'Maybe this section wants a clearer promise for the person reading it.',
      'The strongest idea arrives when the draft names the actual user and the actual moment.',
      'This sentence keeps accumulating clauses and side roads until the original point has to fight its way back into view for the reader.',
      'There is a clean claim here that could become the spine of the whole section.',
      'This is probably softer than it needs to be if the writer already believes the argument.',
      'A second long sentence keeps adding context and qualifiers and momentum until the useful phrase at the center starts to disappear from view.',
      'Another strong line gives the reader a concrete image and a reason to keep going.',
    ].join('\n\n');
    mockReviewToolAnnotations([
      {
        quote: 'A paragraph near the top has a live wire and enough detail to earn one focused margin note from the reviewer.',
        body: 'This opening has enough charge to deserve a note.',
        kind: 'reaction',
      },
    ]);

    const result = await runReview({ markdown }, ctx);
    const prompt = (mockRunAgentTask.mock.calls[0]?.[0] as { prompt?: string }).prompt ?? '';

    expect(mockRunAgentTask).toHaveBeenCalledTimes(1);
    expect(prompt).toContain('Review region: 1 of');
    expect(prompt).toContain('A paragraph near the top has a live wire');
    expect(prompt).not.toContain('The strongest idea arrives when the draft names the actual user');
    expect(result.annotations.map((annotation) => annotation.body)).toEqual(
      expect.arrayContaining(['This opening has enough charge to deserve a note.']),
    );
  });

  it('advances full-document review across chunks on repeated runs', async () => {
    const ctx = context();
    const firstQuote = 'The opening section has enough concrete texture to deserve a focused first-pass annotation from the agent.';
    const laterQuote = 'The later section has enough specific language to show that the review cursor moved down the draft.';
    const markdown = [
      '# Cursor Review',
      '',
      firstQuote,
      Array.from(
        { length: 36 },
        () => 'This filler sentence keeps the first chunk large enough that the next useful sentence lands in a later chunk.',
      ).join(' '),
      '',
      laterQuote,
      'This closing sentence gives the later section a little more room and keeps the quote anchored in real text.',
    ].join('\n\n');
    mockReviewToolAnnotations([{ quote: firstQuote, body: 'First chunk note.', kind: 'suggestion' }]);
    mockReviewToolAnnotations([{ quote: laterQuote, body: 'Later chunk note.', kind: 'reaction' }]);

    const first = await runReview({ markdown }, ctx);
    const second = await runReview({ markdown }, ctx);
    const firstPrompt = (mockRunAgentTask.mock.calls[0]?.[0] as { prompt?: string }).prompt ?? '';
    const secondPrompt = (mockRunAgentTask.mock.calls[1]?.[0] as { prompt?: string }).prompt ?? '';
    const state = await load({}, ctx);

    expect(first.annotations.map((annotation) => annotation.body)).toContain('First chunk note.');
    expect(second.annotations.map((annotation) => annotation.body)).toContain('Later chunk note.');
    expect(firstPrompt).toContain('Review region: 1 of');
    expect(firstPrompt).toContain(firstQuote);
    expect(firstPrompt).not.toContain(laterQuote);
    expect(secondPrompt).toContain('Review region: 2 of');
    expect(secondPrompt).toContain(laterQuote);
    expect(state.reviewCursorChunk).toBe(0);
  });

  it('fails review instead of fabricating annotations when the agent fails', async () => {
    const ctx = context();

    await expect(runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx)).rejects.toThrow('Writing Studio review failed');
  });

  it('fails review instead of fabricating annotations when the agent returns invalid annotations', async () => {
    const ctx = context();
    mockRunAgentTask.mockResolvedValueOnce({ text: 'Reviewed without tool calls.' });

    await expect(runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx)).rejects.toThrow('did not add any annotations');
  });

  it('resolves annotations without using the private chat path', async () => {
    const ctx = context();
    mockReviewToolAnnotations([
      {
        quote: 'Maybe this can be clearer.',
        body: 'This is a live review note.',
        kind: 'comment',
      },
    ]);
    const review = await runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    const resolved = await resolveAnnotation({ id: review.annotations[0].id }, ctx);

    expect(resolved.annotations[0].status).toBe('resolved');
  });

  it('clears writing chat and starts with a fresh host conversation', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-2', conversationId: 'host-chat-2' })),
      ensureLive: vi.fn(),
      abort: vi.fn(),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });
    await ensureChatSession({}, ctx);

    const cleared = await clearChat({}, ctx);
    const state = await load({}, ctx);

    expect(cleared.messages).toEqual([]);
    expect(cleared.conversationId).toBe('host-chat-2');
    expect(state.chat).toEqual([]);
    expect(state.chatConversationId).toBe('host-chat-2');
    expect(state.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'chat_cleared', actorId: 'user' })]));
    expect(conversations.abort).toHaveBeenCalledWith('host-chat-2');
    expect(conversations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        live: true,
        title: expect.stringContaining('Writing Studio'),
        allowedToolNames: expect.arrayContaining(['writing_studio_get_canvas']),
      }),
    );
    expect(conversations.setActiveTools).not.toHaveBeenCalled();
  });

  it('ensures a host conversation for shared Writing Studio chat', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-1', conversationId: 'host-chat-1' })),
      ensureLive: vi.fn(),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    const ensured = await ensureChatSession({ modelRef: 'openai/gpt-test' }, ctx);
    const state = await load({}, ctx);

    expect(ensured.conversationId).toBe('host-chat-1');
    expect(state.chatConversationId).toBe('host-chat-1');
    expect(conversations.create).toHaveBeenCalledWith(expect.objectContaining({ live: true, model: 'openai/gpt-test' }));
    expect(conversations.appendCustomEntry).toHaveBeenCalledWith(
      'host-chat-1',
      'writing_studio_agent_context',
      expect.objectContaining({ documentId: 'default' }),
    );
  });

  it('keeps host chat session creation working when active tool selection is unsupported', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-1', conversationId: 'host-chat-1' })),
      ensureLive: vi.fn(),
      setActiveTools: vi.fn(async () => {
        throw new Error('Conversation "host-chat-1" does not support active tool updates.');
      }),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    const ensured = await ensureChatSession({}, ctx);
    const state = await load({}, ctx);

    expect(ensured.conversationId).toBe('host-chat-1');
    expect(state.chatConversationId).toBe('host-chat-1');
    expect(conversations.create).toHaveBeenCalledWith(expect.objectContaining({ allowedToolNames: expect.any(Array) }));
    expect(conversations.setActiveTools).not.toHaveBeenCalled();
  });

  it('retries host chat creation without tool selection when creation rejects active tool updates', async () => {
    const conversations = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error('Conversation "host-chat-1" does not support active tool updates.'))
        .mockResolvedValueOnce({ id: 'host-chat-1', conversationId: 'host-chat-1' }),
      ensureLive: vi.fn(),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    const ensured = await ensureChatSession({}, ctx);
    const state = await load({}, ctx);

    expect(ensured.conversationId).toBe('host-chat-1');
    expect(state.chatConversationId).toBe('host-chat-1');
    expect(conversations.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ allowedToolNames: expect.any(Array) }));
    expect(conversations.create).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ allowedToolNames: expect.any(Array) }));
  });

  it('updates the stored host chat id when ensureLive resumes to a new conversation id', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-1', conversationId: 'host-chat-1' })),
      ensureLive: vi.fn(async () => ({ id: 'host-chat-resumed', conversationId: 'host-chat-resumed' })),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    await ensureChatSession({}, ctx);
    const ensured = await ensureChatSession({}, ctx);
    const state = await load({}, ctx);

    expect(ensured.conversationId).toBe('host-chat-resumed');
    expect(state.chatConversationId).toBe('host-chat-resumed');
    expect(conversations.setActiveTools).toHaveBeenCalledWith('host-chat-resumed', expect.arrayContaining(['writing_studio_get_canvas']));
  });

  it('keeps a resumed chat session when Writing Studio tools are already active', async () => {
    const conversations = {
      create: vi.fn(async () => ({ id: 'host-chat-1', conversationId: 'host-chat-1' })),
      ensureLive: vi.fn(async () => ({ id: 'host-chat-resumed', conversationId: 'host-chat-resumed' })),
      get: vi.fn(async () => ({
        toolNames: [
          'writing_studio_get_canvas',
          'writing_studio_update_canvas',
          'writing_studio_add_annotation',
          'writing_studio_update_annotation',
          'writing_studio_resolve_annotation',
          'writing_studio_apply_annotation_edit',
          'writing_studio_get_agent_instructions',
          'writing_studio_update_agent_instructions',
        ],
      })),
      setActiveTools: vi.fn(async () => {
        throw new Error('Conversation "host-chat-resumed" does not support active tool updates.');
      }),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    await ensureChatSession({}, ctx);
    const ensured = await ensureChatSession({}, ctx);
    const state = await load({}, ctx);

    expect(ensured.conversationId).toBe('host-chat-resumed');
    expect(state.chatConversationId).toBe('host-chat-resumed');
    expect(conversations.create).toHaveBeenCalledTimes(1);
    expect(conversations.setActiveTools).not.toHaveBeenCalled();
  });

  it('replaces a resumed chat session when Writing Studio tools are provably missing and cannot be patched', async () => {
    const conversations = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: 'host-chat-1', conversationId: 'host-chat-1' })
        .mockResolvedValueOnce({ id: 'host-chat-2', conversationId: 'host-chat-2' }),
      ensureLive: vi.fn(async (conversationId: string) =>
        conversationId === 'host-chat-1'
          ? { id: 'host-chat-resumed', conversationId: 'host-chat-resumed' }
          : { id: conversationId, conversationId },
      ),
      get: vi.fn(async (conversationId: string) => ({
        toolNames:
          conversationId === 'host-chat-resumed'
            ? ['bash']
            : [
                'writing_studio_get_canvas',
                'writing_studio_update_canvas',
                'writing_studio_add_annotation',
                'writing_studio_update_annotation',
                'writing_studio_resolve_annotation',
                'writing_studio_apply_annotation_edit',
                'writing_studio_get_agent_instructions',
                'writing_studio_update_agent_instructions',
              ],
      })),
      setActiveTools: vi.fn(async () => {
        throw new Error('Conversation "host-chat-resumed" does not support active tool updates.');
      }),
      appendCustomEntry: vi.fn(),
    };
    const ctx = context({ conversations });

    await ensureChatSession({}, ctx);
    const ensured = await ensureChatSession({}, ctx);
    const state = await load({}, ctx);

    expect(ensured.conversationId).toBe('host-chat-2');
    expect(state.chatConversationId).toBe('host-chat-2');
    expect(conversations.create).toHaveBeenCalledTimes(2);
    expect(conversations.create).toHaveBeenLastCalledWith(expect.objectContaining({ allowedToolNames: expect.any(Array) }));
  });

  it('reviews only selected writing text', async () => {
    const ctx = context();
    mockReviewToolAnnotations([
      {
        quote: 'selected passage with enough words for a focused annotation',
        body: 'This selected bit wants one sharper image.',
        kind: 'suggestion',
      },
    ]);

    const result = await reviewSelection(
      {
        markdown: '# Draft\n\nHere is a selected passage with enough words for a focused annotation and then other material.',
        selectedText: 'selected passage with enough words for a focused annotation',
      },
      ctx,
    );

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].quote).toBe('selected passage with enough words for a focused annotation');
    expect(mockRunAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Do not review text outside the selected passage'),
        allowedToolNames: expect.arrayContaining(['writing_studio_add_annotation']),
      }),
      expect.anything(),
    );
  });

  it('lets the agent inspect and update its own writing instructions', async () => {
    const ctx = context();

    expect((await getAgentInstructions({}, ctx)).instructions).toContain('Keep the document in focus');

    const updated = await updateAgentInstructions({ instructions: 'Prefer punchy comments that can become edits.' }, ctx);

    expect(updated.instructions).toBe('Prefer punchy comments that can become edits.');
    expect((await getAgentInstructions({}, ctx)).instructions).toBe('Prefer punchy comments that can become edits.');
    expect((await load({}, ctx)).events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'settings_updated', actorId: 'agent' })]),
    );
  });

  it('lets agent tools inspect, update, and annotate the canvas', async () => {
    const ctx = context();
    await updateCanvas({ markdown: '# Tool Draft\n\nThis line wants a comment.' }, ctx);
    const canvas = await getCanvas({}, ctx);
    const annotated = await addAnnotation(
      { quote: 'This line wants a comment.', body: 'There is a useful spark here.', kind: 'reaction', emoji: '*' },
      ctx,
    );

    expect(canvas.title).toBe('Tool Draft');
    expect(canvas.markdown).toContain('This line wants a comment.');
    expect(annotated.annotation).toEqual(expect.objectContaining({ kind: 'reaction', quote: 'This line wants a comment.' }));
    expect(annotated.annotation.anchor).toEqual(expect.objectContaining({ before: '# Tool Draft', after: '' }));
    expect((await getCanvas({}, ctx)).annotations[0].body).toBe('There is a useful spark here.');
  });

  it('lets agent tools update existing annotations', async () => {
    const ctx = context();
    await updateCanvas({ markdown: '# Tool Draft\n\nThis line wants a comment.' }, ctx);
    const annotated = await addAnnotation(
      { quote: 'This line wants a comment.', body: 'There is a useful spark here.', kind: 'reaction', emoji: '*' },
      ctx,
    );
    const updated = await updateAnnotation(
      {
        id: annotated.annotation.id,
        quote: 'This line wants a comment.',
        body: 'Keep this, but make the point sharper.',
        kind: 'suggestion',
      },
      ctx,
    );

    expect(updated.annotation).toEqual(
      expect.objectContaining({ id: annotated.annotation.id, body: 'Keep this, but make the point sharper.', kind: 'suggestion' }),
    );
    expect(updated.annotations[0].body).toBe('Keep this, but make the point sharper.');
    expect((await load({}, ctx)).events.some((event) => event.type === 'annotation_updated')).toBe(true);
  });

  it('applies approved annotation edits and resolves the annotation', async () => {
    const ctx = context();
    await updateCanvas({ markdown: '# Tool Draft\n\nThis line wants a comment.' }, ctx);
    const annotated = await addAnnotation(
      {
        quote: 'This line wants a comment.',
        body: 'Try this sharper line.',
        kind: 'suggestion',
        suggestedReplacement: 'This line earns a sharper comment.',
      },
      ctx,
    );

    const applied = await applyAnnotationEdit({ id: annotated.annotation.id }, ctx);

    expect(applied.markdown).toBe('# Tool Draft\n\nThis line earns a sharper comment.');
    expect(applied.annotations[0]).toEqual(expect.objectContaining({ id: annotated.annotation.id, status: 'resolved' }));
    expect(applied.events.some((event) => event.type === 'yjs_update' && event.payload.appliedAnnotationEdit === true)).toBe(true);
  });

  it('replays approved annotation edits from the event log', async () => {
    const ctx = context();
    await appendUpdate({
      updateBase64: yjsUpdateForMarkdown('# Draft\n\nThis sentence wants a sharper ending.'),
      markdown: '# Draft\n\nThis sentence wants a sharper ending.',
      actorId: 'writer',
    }, ctx);
    const added = await addAnnotation(
      {
        quote: 'This sentence wants a sharper ending.',
        body: 'Make the ending more concrete.',
        suggestedReplacement: 'This sentence lands with a concrete image.',
      },
      ctx,
    );
    await applyAnnotationEdit({ id: added.annotation.id }, ctx);

    const replay = await replayDocument({}, ctx);

    expect(replay.markdown).toBe('# Draft\n\nThis sentence lands with a concrete image.');
    expect(replay.matchesLatest).toBe(true);
    expect(replay.updateEventCount).toBe(2);
  });

  it('keeps document title, file name, and folder path separate', async () => {
    const ctx = context();
    const imported = await importDocument(
      {
        title: 'Browser visible title',
        fileName: 'client-copy.md',
        folderPath: 'Clients/Acme',
        markdown: '# Draft Title\n\nThe document title comes from the draft, not the file name.',
      },
      ctx,
    );

    expect(imported.title).toBe('Draft Title');
    expect(imported.fileName).toBe('client-copy.md');
    expect(imported.folderPath).toBe('Clients/Acme');
    expect(imported.documents.find((doc) => doc.id === imported.id)).toEqual(
      expect.objectContaining({
        title: 'Draft Title',
        fileName: 'client-copy.md',
        folderPath: 'Clients/Acme',
        path: 'Clients/Acme/client-copy.md',
      }),
    );

    await updateCanvas({ documentId: imported.id, markdown: '# Retitled Draft\n\nStill the same file.', title: 'Retitled Draft' }, ctx);
    const exported = await exportDocument({ documentId: imported.id, format: 'markdown' }, ctx);

    expect((await getCanvas({ documentId: imported.id }, ctx)).title).toBe('Retitled Draft');
    expect(exported.fileName).toBe('client-copy.md');
  });

  it('exports embedded markdown images as HTML images', async () => {
    const ctx = context();
    const imported = await importDocument(
      {
        title: 'Image Draft',
        fileName: 'image-draft.md',
        markdown: '# Image Draft\n\n![Tiny chart](data:image/png;base64,aGVsbG8= "Draft image")\n\nCaption text.',
      },
      ctx,
    );

    const exported = await exportDocument({ documentId: imported.id, format: 'html' }, ctx);

    expect(exported.content).toContain('<img src="data:image/png;base64,aGVsbG8=" alt="Tiny chart" title="Draft image">');
    expect(exported.content).toContain('img{display:block;max-width:100%;height:auto');
  });

  it('creates folders and documents inside the document index', async () => {
    const ctx = context();

    const folders = await createFolder({ folderPath: 'Projects/Essay' }, ctx);
    const created = await createDocument({ title: 'Field Notes', fileName: 'field-notes.md', folderPath: 'Projects/Essay' }, ctx);

    expect(folders.folders).toContain('Projects');
    expect(folders.folders).toContain('Projects/Essay');
    expect(created.folders).toContain('Projects/Essay');
    expect(created.documents.find((doc) => doc.id === created.id)).toEqual(
      expect.objectContaining({ fileName: 'field-notes.md', folderPath: 'Projects/Essay', path: 'Projects/Essay/field-notes.md' }),
    );
  });

  it('renames and deletes documents without mixing title and file name', async () => {
    const ctx = context();
    const created = await createDocument({ title: 'Document Title', fileName: 'draft.md', folderPath: 'Drafts' }, ctx);

    const renamed = await renameDocument({ documentId: created.id, fileName: 'renamed-copy.md' }, ctx);
    const deleted = await deleteDocument({ documentId: created.id }, ctx);

    expect(renamed.title).toBe('Document Title');
    expect(renamed.fileName).toBe('renamed-copy.md');
    expect(deleted.activeDocumentId).not.toBe(created.id);
    expect(deleted.documents.some((doc) => doc.id === created.id)).toBe(false);
  });

  it('renames folders and refuses to delete non-empty folders', async () => {
    const ctx = context();
    await createDocument({ title: 'Nested Draft', fileName: 'nested.md', folderPath: 'Projects/Old' }, ctx);

    const renamed = await renameFolder({ folderPath: 'Projects/Old', nextFolderPath: 'Projects/New' }, ctx);

    expect(renamed.folders).toContain('Projects/New');
    expect(renamed.documents[0]).toEqual(expect.objectContaining({ folderPath: 'Projects/New', path: 'Projects/New/nested.md' }));
    await expect(deleteFolder({ folderPath: 'Projects/New' }, ctx)).rejects.toThrow('Folder contains documents');
  });

  it('deletes empty folders from the document index', async () => {
    const ctx = context();
    await createFolder({ folderPath: 'Empty/Child' }, ctx);

    const deleted = await deleteFolder({ folderPath: 'Empty/Child' }, ctx);

    expect(deleted.folders).not.toContain('Empty/Child');
  });

  it('keeps explicit folders after deleting their last document', async () => {
    const ctx = context();
    await createFolder({ folderPath: 'Project Archive' }, ctx);
    const created = await createDocument({ title: 'Temporary Draft', fileName: 'temporary.md', folderPath: 'Project Archive' }, ctx);

    const deleted = await deleteDocument({ documentId: created.id }, ctx);

    expect(deleted.folders).toContain('Project Archive');
    expect(deleted.documents.some((doc) => doc.folderPath === 'Project Archive')).toBe(false);
  });
});
