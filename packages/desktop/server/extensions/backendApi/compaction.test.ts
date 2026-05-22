import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  compactConversation,
  resetExtensionCompactionDynamicImportForTests,
  setExtensionCompactionDynamicImportForTests,
} from './compaction.js';

describe('backendApi/compaction', () => {
  afterEach(() => {
    resetExtensionCompactionDynamicImportForTests();
  });

  it('loads pi compact dynamically and forwards all compaction inputs', async () => {
    const signal = new AbortController().signal;
    const compact = vi.fn().mockResolvedValue({ summary: 'Short summary', firstKeptEntryId: 'entry-1', tokensBefore: 123 });
    const importer = vi.fn().mockResolvedValue({ compact });
    setExtensionCompactionDynamicImportForTests(importer);

    await expect(
      compactConversation({
        preparation: { entries: [] },
        model: { id: 'model-1' },
        apiKey: 'secret',
        headers: { 'x-test': 'true' },
        customInstructions: 'Keep decisions',
        signal,
      }),
    ).resolves.toEqual({ summary: 'Short summary', firstKeptEntryId: 'entry-1', tokensBefore: 123 });

    expect(importer).toHaveBeenCalledWith('@earendil-works/pi-coding-agent');
    expect(compact).toHaveBeenCalledWith({ entries: [] }, { id: 'model-1' }, 'secret', { 'x-test': 'true' }, 'Keep decisions', signal);
  });
});
