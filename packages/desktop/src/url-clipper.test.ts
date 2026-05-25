import { describe, expect, it } from 'vitest';

import { type DesktopUrlClipperHost, importClipboardUrlToKnowledge, normalizeClipboardUrl } from './url-clipper.js';

// ── url-clipper — clipboard URL normalization ─────────────────────────────

describe('normalizeClipboardUrl', () => {
  it('normalizes a valid http URL', () => {
    expect(normalizeClipboardUrl('http://example.com')).toBe('http://example.com/');
  });

  it('normalizes a valid https URL', () => {
    expect(normalizeClipboardUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  it('trims whitespace', () => {
    expect(normalizeClipboardUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('takes the first non-empty line from multiline input', () => {
    expect(normalizeClipboardUrl('\n\nhttps://example.com\nignore this\n')).toBe('https://example.com/');
  });

  it('throws on empty input', () => {
    expect(() => normalizeClipboardUrl('')).toThrow('Clipboard is empty');
  });

  it('throws on whitespace-only input', () => {
    expect(() => normalizeClipboardUrl('   ')).toThrow('Clipboard is empty');
  });

  it('throws on invalid URL', () => {
    expect(() => normalizeClipboardUrl('not a url')).toThrow('valid URL');
  });

  it('throws on non-http protocol', () => {
    expect(() => normalizeClipboardUrl('ftp://example.com')).toThrow('Only http and https');
  });

  it('throws on javascript protocol', () => {
    expect(() => normalizeClipboardUrl('javascript:alert(1)')).toThrow('Only http and https');
  });
});

describe('importClipboardUrlToKnowledge', () => {
  it('imports through the knowledge extension action boundary', async () => {
    const requests: unknown[] = [];
    const host: DesktopUrlClipperHost = {
      async ensureActiveHostRunning() {},
      getActiveHostController() {
        return {
          async dispatchApiRequest(input) {
            requests.push(input);
            return {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: Buffer.from(JSON.stringify({ ok: true, result: { title: 'Example', note: { id: 'inbox/example.md' } } })),
            };
          },
        };
      },
    };

    await expect(
      importClipboardUrlToKnowledge({ host, clipboardText: 'https://example.com/page', createdAt: '2026-05-25T13:00:00.000Z' }),
    ).resolves.toEqual({ title: 'Example', note: { id: 'inbox/example.md' } });
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/extensions/system-knowledge/actions/vaultImportSharedItem',
        body: {
          kind: 'url',
          url: 'https://example.com/page',
          directoryId: 'Inbox',
          sourceApp: 'Neon Pilot Desktop',
          createdAt: '2026-05-25T13:00:00.000Z',
        },
      },
    ]);
  });
});
