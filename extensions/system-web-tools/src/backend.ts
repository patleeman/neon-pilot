import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { extractReadableHtml } from '@neon-pilot/extensions/backend/webContent';

const DEFAULT_MAX_BYTES = 50 * 1024;
const DEFAULT_MAX_LINES = 2000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createRequestSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

function normalizeIpHost(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function isBlockedIp(host: string): boolean {
  const normalized = normalizeIpHost(host);
  const kind = isIP(normalized);
  if (kind === 4) return isPrivateIpv4(normalized);
  if (kind === 6) return isPrivateIpv6(normalized);
  return true;
}

async function validateFetchUrl(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = normalizeIpHost(parsed.hostname);
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('Private, loopback, and link-local hosts are not allowed');
    return parsed;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address.address))) {
    throw new Error('Private, loopback, and link-local hosts are not allowed');
  }
  return parsed;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function truncateHead(content: string, options: { maxLines: number; maxBytes: number }) {
  const lines = content.split(/\r?\n/);
  let output = lines.slice(0, options.maxLines).join('\n');
  let outputBytes = Buffer.byteLength(output, 'utf8');

  if (outputBytes > options.maxBytes) {
    let end = Math.min(output.length, options.maxBytes);
    while (end > 0 && Buffer.byteLength(output.slice(0, end), 'utf8') > options.maxBytes) end -= 1;
    output = output.slice(0, end);
    outputBytes = Buffer.byteLength(output, 'utf8');
  }

  return {
    content: output,
    truncated: lines.length > options.maxLines || output.length < content.length,
    outputLines: output ? output.split(/\r?\n/).length : 0,
    totalLines: lines.length,
    outputBytes,
    totalBytes: Buffer.byteLength(content, 'utf8'),
  };
}

function formatTruncatedContent(content: string): { text: string; truncated: boolean } {
  const truncation = truncateHead(content, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  let text = truncation.content;
  if (truncation.truncated) {
    text += `\n\n[Truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(
      truncation.outputBytes,
    )} of ${formatSize(truncation.totalBytes)})]`;
  }
  return { text, truncated: truncation.truncated };
}

export async function webFetch(input: { url: string; raw?: boolean }, _ctx?: ExtensionBackendContext) {
  const { url, raw } = input;
  try {
    const parsedUrl = await validateFetchUrl(url);
    const response = await fetch(parsedUrl, {
      redirect: 'error',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createRequestSignal(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();

    if (!contentType.includes('html') || raw) {
      const formatted = formatTruncatedContent(body);
      return { text: formatted.text, url, contentType, raw: Boolean(raw), truncated: formatted.truncated };
    }

    const readable = await extractReadableHtml({ html: body, url: parsedUrl.toString() }, _ctx);
    const formatted = formatTruncatedContent(readable.markdown);
    return { text: formatted.text, url, title: readable.title, truncated: formatted.truncated };
  } catch (error) {
    throw new Error(`Error fetching ${url}: ${getErrorMessage(error)}`);
  }
}
