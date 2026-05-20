import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/extensions/backend/webContent', () => ({
  parseDuckDuckGoHtml: vi.fn(async ({ html }) =>
    html.includes('result__a')
      ? [{ title: 'Example Title', url: 'https://example.org/page', snippet: 'This is a sample snippet text.' }]
      : [],
  ),
}));

import { parseDuckDuckGoHtml } from '@neon-pilot/extensions/backend/webContent';

import { duckDuckGoSearch } from './backend.js';

describe('system-duckduckgo-search backend', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('searches DuckDuckGo HTML results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><a class="result__a" href="https://example.org/page">Example Title</a></body></html>'),
    } as unknown as Response);

    const result = await duckDuckGoSearch({ query: 'test query' });
    expect(result.source).toBe('duckduckgo');
    expect(result.count).toBe(1);
  });

  it('handles DuckDuckGo fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DDG failed'));

    await expect(duckDuckGoSearch({ query: 'test' })).rejects.toThrow();
  });

  it('falls back to DuckDuckGo lite when HTML results parse empty', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body><a class="result__a" href="https://example.org/page">Example Title</a></body></html>'),
      } as unknown as Response);

    const result = await duckDuckGoSearch({ query: 'test' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toBe('https://html.duckduckgo.com/html/');
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[0])).toBe('https://lite.duckduckgo.com/lite/');
    expect(parseDuckDuckGoHtml).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(1);
  });

  it('uses sensible defaults for count and page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body></body></html>'),
    } as unknown as Response);

    const result = await duckDuckGoSearch({ query: 'test' });
    expect(result.count).toBe(0);
    expect(result.page).toBe(1);
  });

  it('normalizes invalid count and page before searching', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><a class="result__a" href="https://example.org/page">Example Title</a></body></html>'),
    } as unknown as Response);

    const result = await duckDuckGoSearch({ query: 'test', count: -1, page: -2 });
    expect(result.page).toBe(1);
    expect(result.text).toContain('Results 1-1');
    expect(parseDuckDuckGoHtml).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 1 }), undefined);
  });
});
