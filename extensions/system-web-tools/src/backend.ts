import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { networkFetch } from '@neon-pilot/extensions/backend/network';
import { extractReadableHtml } from '@neon-pilot/extensions/backend/webContent';

const DEFAULT_MAX_BYTES = 50 * 1024;
const DEFAULT_MAX_LINES = 2000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCauseCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
  const source = cause && typeof cause === 'object' ? cause : error;
  const code = 'code' in source ? (source as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : undefined;
}

function friendlyFetchError(error: unknown): string {
  const message = getErrorMessage(error);
  const code = getErrorCauseCode(error);
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'The request timed out after 15 seconds.';
  }
  if (message === 'The operation was aborted due to timeout') {
    return 'The request timed out after 15 seconds.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'The host could not be resolved.';
  }
  if (code === 'ECONNREFUSED') {
    return 'The host refused the connection.';
  }
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') {
    return 'The connection closed before the page could be fetched.';
  }
  if (
    code === 'CERT_HAS_EXPIRED' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ) {
    return 'The site TLS certificate could not be verified.';
  }
  if (message === 'fetch failed') {
    return 'The page could not be fetched.';
  }
  return message;
}

function toolError(url: string, error: unknown) {
  const message = `Error fetching ${url || 'URL'}: ${friendlyFetchError(error)}`;
  return {
    content: [{ type: 'text' as const, text: message }],
    details: { url, error: message },
    isError: true,
  };
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
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
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
    if (typeof url !== 'string' || !url.trim()) throw new Error('URL is required');
    const parsedUrl = await validateFetchUrl(url);
    const result = await networkFetch(parsedUrl.toString(), {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeoutMs: 15000,
    });

    if (result.status >= 300 && result.status < 400) {
      const location = result.headers['location'];
      throw new Error(location ? `Redirects are not followed: ${location}` : `Redirects are not followed: HTTP ${result.status}`);
    }
    if (!result.ok) throw new Error(`HTTP ${result.status}: ${result.statusText}`);

    const contentType = result.headers['content-type'] || '';
    const body = result.text;

    if (!contentType.includes('html') || raw) {
      const formatted = formatTruncatedContent(body);
      return { text: formatted.text, url, contentType, raw: Boolean(raw), truncated: formatted.truncated };
    }

    const readable = await extractReadableHtml({ html: body, url: parsedUrl.toString() }, _ctx);
    const formatted = formatTruncatedContent(readable.markdown);
    return { text: formatted.text, url, title: readable.title, truncated: formatted.truncated };
  } catch (error) {
    return toolError(url, error);
  }
}
