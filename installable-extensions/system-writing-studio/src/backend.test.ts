import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunAgentTask = vi.hoisted(() => vi.fn());

vi.mock('@neon-pilot/extensions/backend/agent', () => ({
  runAgentTask: mockRunAgentTask,
}));

import { addAnnotation, appendUpdate, exportDocument, getCanvas, importDocument, load, resolveAnnotation, runReview, sendChat, updateCanvas } from './backend';

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
    mockRunAgentTask.mockReset();
    mockRunAgentTask.mockRejectedValue(new Error('No model in unit test.'));
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

  it('can produce more than three review annotations for longer drafts', async () => {
    const ctx = context();
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

    expect(result.annotations.length).toBeGreaterThanOrEqual(6);
  });

  it('tops up sparse agent review output for longer drafts', async () => {
    const ctx = context();
    const markdown = [
      '# Sparse Agent',
      '',
      'This is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
      'Maybe this section wants a clearer promise for the person reading it.',
      'The strongest idea arrives when the draft names the actual user and the actual moment.',
      'This sentence keeps accumulating clauses and side roads until the original point has to fight its way back into view for the reader.',
      'There is a clean claim here that could become the spine of the whole section.',
      'This is probably softer than it needs to be if the writer already believes the argument.',
      'A second long sentence keeps adding context and qualifiers and momentum until the useful phrase at the center starts to disappear from view.',
      'Another strong line gives the reader a concrete image and a reason to keep going.',
    ].join('\n\n');
    mockRunAgentTask.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          quote: 'The strongest idea arrives when the draft names the actual user and the actual moment.',
          body: 'This is the sentence with a live wire in it.',
          kind: 'reaction',
        },
      ]),
    });

    const result = await runReview({ markdown }, ctx);

    expect(result.annotations.length).toBeGreaterThanOrEqual(6);
    expect(result.annotations[0].body).toBe('This is the sentence with a live wire in it.');
  });

  it('stores chat messages and resolves annotations', async () => {
    const ctx = context();
    const review = await runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    const chat = await sendChat({ body: 'Can you improve this?', markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    const resolved = await resolveAnnotation({ id: review.annotations[0].id }, ctx);

    expect(chat.messages.map((message) => message.role)).toEqual(['user', 'agent']);
    expect(resolved.annotations[0].status).toBe('resolved');
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
    expect((await getCanvas({}, ctx)).annotations[0].body).toBe('There is a useful spark here.');
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
});
