import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionHostClient = { invokeAction: vi.fn() };
const listExtensionPromptReferenceRegistrations = vi.fn();

vi.mock('./extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionHostClient }));
vi.mock('./extensionRegistry.js', () => ({ listExtensionPromptReferenceRegistrations }));

const { resolveExtensionPromptReferences } = await import('./promptReferenceResolvers.js');

describe('resolveExtensionPromptReferences', () => {
  beforeEach(() => {
    extensionHostClient.invokeAction.mockReset();
    listExtensionPromptReferenceRegistrations.mockReset();
  });

  it('does not invoke extension resolvers when the prompt contains no mentions', async () => {
    listExtensionPromptReferenceRegistrations.mockReturnValue([{ extensionId: 'ext', handler: 'resolve' }]);

    await expect(resolveExtensionPromptReferences({ text: 'plain prompt' })).resolves.toEqual({ contextBlocks: [], references: [] });
    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
  });

  it('passes extracted mention ids to each resolver and combines normalized results', async () => {
    listExtensionPromptReferenceRegistrations.mockReturnValue([
      { extensionId: 'knowledge', handler: 'resolveMentions' },
      { extensionId: 'files', handler: 'resolveMentions' },
    ]);
    extensionHostClient.invokeAction
      .mockResolvedValueOnce({
        ok: true,
        result: {
          contextBlocks: ['Context A', { content: 'Context B' }, { content: '   ' }, 12],
          references: [{ kind: 'note', id: 'n1', path: '/knowledge/n1.md' }, { kind: 'bad' }, null],
        },
      })
      .mockResolvedValueOnce({ ok: true, result: { contextBlocks: [{ content: 'Context C' }], references: [{ kind: 'file', id: 'f1' }] } });

    await expect(resolveExtensionPromptReferences({ text: 'Use @note:n1 and @file:f1 please' })).resolves.toEqual({
      contextBlocks: ['Context A', 'Context B', 'Context C'],
      references: [
        { kind: 'note', id: 'n1', path: '/knowledge/n1.md' },
        { kind: 'file', id: 'f1' },
      ],
    });
    expect(extensionHostClient.invokeAction).toHaveBeenNthCalledWith(1, {
      extensionId: 'knowledge',
      actionId: 'resolveMentions',
      input: {
        text: 'Use @note:n1 and @file:f1 please',
        mentionIds: ['note', 'file'],
      },
    });
  });

  it('ignores failed and malformed resolver results', async () => {
    listExtensionPromptReferenceRegistrations.mockReturnValue([
      { extensionId: 'failed', handler: 'resolve' },
      { extensionId: 'malformed', handler: 'resolve' },
      { extensionId: 'valid', handler: 'resolve' },
    ]);
    extensionHostClient.invokeAction
      .mockResolvedValueOnce({ ok: false, result: { contextBlocks: ['ignored'] } })
      .mockResolvedValueOnce({ ok: true, result: 'not-an-object' })
      .mockResolvedValueOnce({ ok: true, result: { references: [{ kind: 'node', id: '123', path: 456 }] } });

    await expect(resolveExtensionPromptReferences({ text: '@node:123' })).resolves.toEqual({
      contextBlocks: [],
      references: [{ kind: 'node', id: '123' }],
    });
  });
});
