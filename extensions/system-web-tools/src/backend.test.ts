import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@personal-agent/extensions/backend/webContent', () => ({
  extractReadableHtml: vi.fn(async ({ html }) => ({ markdown: html.replace(/<[^>]+>/g, '').trim(), title: 'Example' })),
}));

import { webFetch } from './backend.js';

describe('system-web-tools backend', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('webFetch', () => {
    it('throws when URL is missing', async () => {
      await expect(webFetch({} as never)).rejects.toThrow();
    });

    it('returns raw content when raw=true', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html; charset=utf-8']]),
        text: () => Promise.resolve('<html><body>raw data</body></html>'),
      } as unknown as Response);

      const result = await webFetch({ url: 'https://example.com', raw: true });
      expect(result.raw).toBe(true);
      expect(result.text).toContain('raw data');
      expect(result.url).toBe('https://example.com');
    });

    it('throws on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        text: () => Promise.resolve(''),
      } as unknown as Response);

      await expect(webFetch({ url: 'https://example.com/404', raw: true })).rejects.toThrow('HTTP 404');
    });

    it('handles non-HTML content type with raw fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve('{"key":"value"}'),
      } as unknown as Response);

      const result = await webFetch({ url: 'https://example.com/data.json' });
      expect(result.text).toContain('{"key":"value"}');
      expect(result.contentType).toBe('application/json');
    });

    it('handles fetch errors gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

      await expect(webFetch({ url: 'https://example.com' })).rejects.toThrow('Error fetching');
    });
  });
});
