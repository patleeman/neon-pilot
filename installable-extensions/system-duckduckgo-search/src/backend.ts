import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { parseDuckDuckGoHtml } from '@neon-pilot/extensions/backend/webContent';

function createRequestSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function normalizeResultCount(count: number): number {
  if (!Number.isFinite(count)) return 5;
  return Math.min(Math.max(Math.floor(count), 1), 20);
}

function normalizePage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.floor(page), 1);
}
export async function duckDuckGoSearch(input: { query: string; count?: number; page?: number }, ctx?: ExtensionBackendContext) {
  const { query } = input;
  const page = normalizePage(input.page ?? 1);
  const maxResults = normalizeResultCount(input.count ?? 5);
  const offset = (page - 1) * 20;
  const searchParams = new URLSearchParams({ q: query });
  if (offset > 0) {
    searchParams.set('s', String(offset));
    searchParams.set('dc', String(offset + 1));
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
  };
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: searchParams,
    signal: createRequestSignal(10000),
  });
  if (!response.ok) throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`);

  const html = await response.text();
  let results = await parseDuckDuckGoHtml({ html, maxResults }, ctx);

  if (results.length === 0) {
    // Lite endpoint doesn't use HTML pagination params; clone and strip them.
    const liteParams = new URLSearchParams(searchParams);
    liteParams.delete('s');
    liteParams.delete('dc');
    const liteResponse = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: liteParams,
      signal: createRequestSignal(10000),
    });
    if (!liteResponse.ok) throw new Error(`DuckDuckGo search failed: HTTP ${liteResponse.status}`);
    results = await parseDuckDuckGoHtml({ html: await liteResponse.text(), maxResults }, ctx);
  }

  if (results.length === 0) return { text: `No results found for: ${query} (page ${page})`, query, page, count: 0, source: 'duckduckgo' };

  const resultStart = offset + 1;
  const output = results
    .map((result, index) => `--- Result ${resultStart + index} ---\nTitle: ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet}`)
    .join('\n\n');
  return {
    text: `DuckDuckGo Search | Page ${page} | Results ${resultStart}-${resultStart + results.length - 1} | Use page: ${page + 1} for more results\n\n${output}`,
    query,
    page,
    count: results.length,
    source: 'duckduckgo',
  };
}
