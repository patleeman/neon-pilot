import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunAgentTask = vi.hoisted(() => vi.fn());

vi.mock('@neon-pilot/extensions/backend/agent', () => ({
  runAgentTask: mockRunAgentTask,
}));

import {
  addAnnotation,
  appendUpdate,
  createDocument,
  createFolder,
  deleteDocument,
  deleteFolder,
  exportDocument,
  getCanvas,
  importDocument,
  load,
  renameDocument,
  renameFolder,
  resolveAnnotation,
  runReview,
  sendChat,
  updateCanvas,
} from './backend';

function context() {
  const store = new Map<string, unknown>();
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
    mockRunAgentTask.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          quote: 'This is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
          body: 'This is the live review note.',
          kind: 'suggestion',
        },
      ]),
    });
    const result = await runReview(
      {
        markdown:
          '# Draft\n\nThis is basically a sentence with enough substance to trigger feedback from the reviewer and show an annotation.',
      },
      ctx,
    );

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].body).toBe('This is the live review note.');
    const state = await load({}, ctx);
    expect(state.annotations.length).toBe(result.annotations.length);
    expect(state.events.some((event) => event.type === 'agent_run_started')).toBe(true);
    expect(state.events.some((event) => event.type === 'annotation_added')).toBe(true);
    expect(state.events.some((event) => event.type === 'agent_run_completed')).toBe(true);
  });

  it('can produce more than three review annotations for longer drafts', async () => {
    const ctx = context();
    mockRunAgentTask.mockResolvedValueOnce({
      text: JSON.stringify([
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
      ]),
    });
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

  it('does not top up sparse agent review output', async () => {
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

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].body).toBe('This is the sentence with a live wire in it.');
  });

  it('fails review instead of fabricating annotations when the agent fails', async () => {
    const ctx = context();

    await expect(runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx)).rejects.toThrow('Writing Studio review failed');
  });

  it('fails review instead of fabricating annotations when the agent returns invalid annotations', async () => {
    const ctx = context();
    mockRunAgentTask.mockResolvedValueOnce({ text: 'not json' });

    await expect(runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx)).rejects.toThrow('no valid annotations');
  });

  it('stores chat messages and resolves annotations', async () => {
    const ctx = context();
    mockRunAgentTask.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          quote: 'Maybe this can be clearer.',
          body: 'This is a live review note.',
          kind: 'comment',
        },
      ]),
    });
    const review = await runReview({ markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    mockRunAgentTask.mockResolvedValueOnce({ text: 'The live agent answer.' });
    const chat = await sendChat({ body: 'Can you improve this?', markdown: '# Draft\n\nMaybe this can be clearer.' }, ctx);
    const resolved = await resolveAnnotation({ id: review.annotations[0].id }, ctx);

    expect(chat.messages.map((message) => message.role)).toEqual(['user', 'agent']);
    expect(chat.messages[1].body).toBe('The live agent answer.');
    expect(mockRunAgentTask).toHaveBeenCalledWith(expect.objectContaining({ tools: 'default' }), ctx);
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
