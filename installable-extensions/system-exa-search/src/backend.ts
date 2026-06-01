import type { ExtensionBackendContext } from '@neon-pilot/extensions';

interface ExaSearchResult {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
  summary?: string;
}

interface ExaSearchResponse {
  results?: ExaSearchResult[];
}

function createRequestSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function getExaApiKey(ctx?: ExtensionBackendContext): Promise<string | undefined> {
  const secret = ctx?.secrets.get('exaApiKey');
  return Promise.resolve(secret);
}

function normalizeResultCount(count: number): number {
  if (!Number.isFinite(count)) return 5;
  return Math.min(Math.max(Math.floor(count), 1), 20);
}

function normalizePage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.floor(page), 1);
}
export async function exaSearch(input: { query: string; count?: number; page?: number }, ctx?: ExtensionBackendContext) {
  const { query } = input;
  const page = normalizePage(input.page ?? 1);
  const maxResults = normalizeResultCount(input.count ?? 5);
  const offset = (page - 1) * 20;
  const exaApiKey = await getExaApiKey(ctx);
  if (!exaApiKey) throw new Error('Exa API key is not configured. Set Exa Search → Exa API key or EXA_API_KEY.');

  const requestedResults = Math.min(offset + maxResults, 100);
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${exaApiKey}` },
    body: JSON.stringify({ query, numResults: requestedResults, contents: { text: true, highlights: true } }),
    signal: createRequestSignal(10000),
  });
  if (!response.ok) throw new Error(`Exa search failed: HTTP ${response.status}`);

  const data = (await response.json()) as ExaSearchResponse;
  const results = (data.results ?? []).slice(offset, offset + maxResults);
  if (results.length === 0) return { text: `No results found for: ${query}`, query, page, count: 0, source: 'exa' };

  const resultStart = offset + 1;
  const output = results
    .map((result, index) => {
      let snippet = result.text || result.highlights?.[0] || result.summary || '';
      if (snippet.length > 500) snippet = `${snippet.slice(0, 500)}...`;
      return `--- Result ${resultStart + index} ---\nTitle: ${result.title || '(no title)'}\nURL: ${result.url}\nSnippet: ${
        snippet || '(no snippet available)'
      }`;
    })
    .join('\n\n');
  return {
    text: `Exa Search | Page ${page} | Results ${resultStart}-${resultStart + results.length - 1} | Use page: ${page + 1} for more results\n\n${output}`,
    query,
    page,
    count: results.length,
    source: 'exa',
  };
}
