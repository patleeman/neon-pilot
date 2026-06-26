import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

vi.mock('@neon-pilot/extensions/backend/webContent', () => ({
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
      await expect(webFetch({} as never)).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Error fetching URL: URL is required' }],
      });
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

    it('rejects private network URLs before fetching', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(webFetch({ url: 'http://127.0.0.1:3000' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('Private, loopback, and link-local hosts are not allowed') }],
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        text: () => Promise.resolve(''),
      } as unknown as Response);

      await expect(webFetch({ url: 'https://example.com/404', raw: true })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('HTTP 404') }],
      });
    });

    it('returns a clear error for redirects without following them', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: new Map([['location', 'https://example.com/next']]),
        text: () => Promise.resolve(''),
      } as unknown as Response);

      await expect(webFetch({ url: 'https://example.com/redirect' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('Redirects are not followed: https://example.com/next') }],
      });
    });

    it('does not ask fetch to follow redirects', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve('ok'),
      } as unknown as Response);

      await webFetch({ url: 'https://example.com' });

      expect(fetchSpy).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual' }));
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

    it('truncates large responses with a visible truncation note', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve('a'.repeat(60 * 1024)),
      } as unknown as Response);

      const result = await webFetch({ url: 'https://example.com/large.txt' });
      expect(result.truncated).toBe(true);
      expect(result.text).toContain('[Truncated: showing');
      expect(Buffer.byteLength(result.text, 'utf8')).toBeGreaterThan(50 * 1024);
    });

    it('returns clean tool errors without extension action wrappers', async () => {
      const result = await webFetch({ url: 'http://127.0.0.1:3000' });

      expect(result).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('Private, loopback, and link-local hosts are not allowed') }],
      });
      expect(result.content[0]?.text).not.toContain('Extension "system-web-tools" action');
    });

    it('handles fetch errors gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

      await expect(webFetch({ url: 'https://example.com' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Error fetching https://example.com: Network failure' }],
      });
    });

    it('uses readable wording for refused and TLS fetch failures', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }))
        .mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } }));

      await expect(webFetch({ url: 'https://example.com/refused' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Error fetching https://example.com/refused: The host refused the connection.' }],
      });
      await expect(webFetch({ url: 'https://example.com/tls' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Error fetching https://example.com/tls: The site TLS certificate could not be verified.' }],
      });
    });
  });
});
