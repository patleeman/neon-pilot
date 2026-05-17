import { afterEach, describe, expect, it, vi } from 'vitest';

import { exaSearch } from './backend.js';

describe('system-exa-search backend', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('requires an Exa API key', async () => {
    await expect(exaSearch({ query: 'test query' }, { secrets: { get: () => undefined } } as never)).rejects.toThrow(
      'Exa API key is not configured',
    );
  });

  it('uses Exa when an API key is configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ title: 'Exa Title', url: 'https://example.org/exa', text: 'Exa snippet' }] }),
    } as unknown as Response);

    const result = await exaSearch({ query: 'test query' }, { secrets: { get: () => 'test-key' } } as never);
    expect(result.source).toBe('exa');
    expect(result.text).toContain('Exa Title');
  });
});
