import { networkFetch } from '@neon-pilot/extensions/backend/network';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { webFetch } from './backend.js';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

vi.mock('@neon-pilot/extensions/backend/webContent', () => ({
  extractReadableHtml: vi.fn(async ({ html }) => ({ markdown: html.replace(/<[^>]+>/g, '').trim(), title: 'Example' })),
}));

vi.mock('@neon-pilot/extensions/backend/network', () => ({
  networkFetch: vi.fn(),
}));

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
      vi.mocked(networkFetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        text: '<html><body>raw data</body></html>',
        url: 'https://example.com',
      });

      const result = await webFetch({ url: 'https://example.com', raw: true });
      expect(result.raw).toBe(true);
      expect(result.text).toContain('raw data');
      expect(result.url).toBe('https://example.com');
    });

    it('rejects private network URLs before fetching', async () => {
      await expect(webFetch({ url: 'http://127.0.0.1:3000' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('Private, loopback, and link-local hosts are not allowed') }],
      });
      expect(networkFetch).not.toHaveBeenCalled();
    });

    it('throws on HTTP error', async () => {
      vi.mocked(networkFetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {},
        text: '',
        url: 'https://example.com/404',
      });

      await expect(webFetch({ url: 'https://example.com/404', raw: true })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('HTTP 404') }],
      });
    });

    it('returns a clear error for redirects without following them', async () => {
      vi.mocked(networkFetch).mockResolvedValue({
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: { location: 'https://example.com/next' },
        text: '',
        url: 'https://example.com/redirect',
      });

      await expect(webFetch({ url: 'https://example.com/redirect' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('Redirects are not followed: https://example.com/next') }],
      });
    });

    it('does not ask fetch to follow redirects', async () => {
      vi.mocked(networkFetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        text: 'ok',
        url: 'https://example.com',
      });

      await webFetch({ url: 'https://example.com' });

      expect(networkFetch).toHaveBeenCalledWith('https://example.com/', expect.objectContaining({ redirect: 'manual', timeoutMs: 15000 }));
    });

    it('handles non-HTML content type with raw fallback', async () => {
      vi.mocked(networkFetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        text: '{"key":"value"}',
        url: 'https://example.com/data.json',
      });

      const result = await webFetch({ url: 'https://example.com/data.json' });
      expect(result.text).toContain('{"key":"value"}');
      expect(result.contentType).toBe('application/json');
    });

    it('truncates large responses with a visible truncation note', async () => {
      vi.mocked(networkFetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        text: 'a'.repeat(60 * 1024),
        url: 'https://example.com/large.txt',
      });

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
      vi.mocked(networkFetch).mockRejectedValue(new Error('Network failure'));

      await expect(webFetch({ url: 'https://example.com' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Error fetching https://example.com: Network failure' }],
      });
    });

    it('keeps readable timeout wording for bridged fetch timeouts', async () => {
      vi.mocked(networkFetch).mockRejectedValue(new Error('The operation was aborted due to timeout'));

      await expect(webFetch({ url: 'https://example.com/slow' })).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Error fetching https://example.com/slow: The request timed out after 15 seconds.' }],
      });
    });

    it('uses readable wording for refused and TLS fetch failures', async () => {
      vi.mocked(networkFetch)
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
