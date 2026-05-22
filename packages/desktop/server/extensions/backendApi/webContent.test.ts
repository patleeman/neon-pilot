import { describe, expect, it } from 'vitest';

import { extractReadableHtml, parseDuckDuckGoHtml } from './webContent.js';

describe('backendApi webContent', () => {
  it('extracts title and readable text while removing scripts and styles', async () => {
    await expect(
      extractReadableHtml({
        url: 'https://example.com',
        html: `<!doctype html><html><head><title> Example title </title><style>.x{}</style><script>alert(1)</script></head><body><h1>Hello&nbsp;world</h1><p>A &amp; B &lt; C &quot;quote&quot; &#39;apostrophe&#39;</p></body></html>`,
      }),
    ).resolves.toEqual({ title: 'Example title', markdown: `Example title Hello world A & B < C "quote" 'apostrophe'` });
  });

  it('returns a clear fallback when no readable text can be extracted', async () => {
    await expect(extractReadableHtml({ url: 'https://example.com', html: '<script>onlyCode()</script>' })).resolves.toEqual({
      markdown: '(Could not extract readable content from page)',
    });
  });

  it('normalizes repeated whitespace and omits blank titles', async () => {
    await expect(
      extractReadableHtml({ url: 'https://example.com', html: '<title>   </title><body>One\n\n\nTwo   Three</body>' }),
    ).resolves.toEqual({
      markdown: 'One Two Three',
    });
  });

  it('parses DuckDuckGo result rows, snippets, and uddg redirect URLs', async () => {
    const html = `
      <div class="result">
        <a class="result__a" href="/l/?kh=-1&uddg=https%3A%2F%2Fexample.com%2Fone"> First result </a>
        <a class="result__snippet"> First snippet </a>
      </div>
      <table><tbody><tr>
        <td><a class="result-link" href="https://example.com/two">Second\n result</a></td>
        <td class="result-snippet">Second   snippet</td>
      </tr></tbody></table>
      <div class="result"><a href="https://duckduckgo.com/y.js?ad=1">Ad</a></div>
    `;

    await expect(parseDuckDuckGoHtml({ html, maxResults: 10 })).resolves.toEqual([
      { title: 'First result', url: 'https://example.com/one', snippet: 'First snippet' },
      { title: 'Second result', url: 'https://example.com/two', snippet: 'Second snippet' },
    ]);
  });

  it('decodes protocol-relative DuckDuckGo redirect URLs and respects maxResults', async () => {
    const html = `
      <div class="result"><a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fone">One</a></div>
      <div class="result"><a href="https://example.com/two">Two</a></div>
    `;

    await expect(parseDuckDuckGoHtml({ html, maxResults: 1 })).resolves.toEqual([
      { title: 'One', url: 'https://example.com/one', snippet: '' },
    ]);
  });
});
