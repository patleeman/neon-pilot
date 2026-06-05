import { buildApiPath } from '../client/apiBase';

export interface ExtensionRouteSseStreamOptions {
  signal?: AbortSignal;
}

export async function* streamExtensionRouteSse<T = unknown>(
  extensionId: string,
  routePath: string,
  options: ExtensionRouteSseStreamOptions = {},
): AsyncIterable<T> {
  const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const path = buildApiPath(`/extensions/${encodeURIComponent(extensionId)}/routes${normalizedRoute}`);
  const response = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal: options.signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Extension route stream failed with HTTP ${response.status}.`);
  }
  if (!response.body) throw new Error('Extension route stream response did not include a body.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) yield JSON.parse(data) as T;
        boundary = buffer.indexOf('\n\n');
      }
    }
    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) {
      const data = tail
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) yield JSON.parse(data) as T;
    }
  } finally {
    reader.releaseLock();
  }
}
