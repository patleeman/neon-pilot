import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeSource {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  readyState: number;
  close: ReturnType<typeof vi.fn>;
}

const sources: FakeSource[] = [];
const createDesktopAwareEventSource = vi.fn((path: string) => {
  const source: FakeSource = {
    onopen: null,
    onmessage: null,
    onerror: null,
    readyState: 1,
    close: vi.fn(),
  };
  Object.assign(source, { path });
  sources.push(source);
  return source;
});

vi.mock('../desktop/desktopEventSource', () => ({ createDesktopAwareEventSource }));

describe('streamExtensionRouteSse', () => {
  beforeEach(() => {
    sources.length = 0;
    createDesktopAwareEventSource.mockClear();
  });

  it('streams extension route SSE messages through the desktop-aware EventSource', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const iter = streamExtensionRouteSse<{ type: string }>('system-terminal', '/stream?id=terminal-1')[Symbol.asyncIterator]();
    const next = iter.next();

    expect(createDesktopAwareEventSource).toHaveBeenCalledWith('/api/extensions/system-terminal/routes/stream?id=terminal-1');
    sources[0]?.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'output' }) }));

    await expect(next).resolves.toEqual({ value: { type: 'output' }, done: false });
    await iter.return?.();
    expect(sources[0]?.close).toHaveBeenCalled();
  });

  it('closes the EventSource when the caller aborts', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const abort = new AbortController();
    const iter = streamExtensionRouteSse('system-terminal', '/stream?id=terminal-1', { signal: abort.signal })[Symbol.asyncIterator]();

    const next = iter.next();
    abort.abort();

    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(sources[0]?.close).toHaveBeenCalled();
  });

  it('rejects when the SSE payload is not valid JSON', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const iter = streamExtensionRouteSse('system-terminal', '/stream?id=terminal-1')[Symbol.asyncIterator]();
    const next = iter.next();

    sources[0]?.onmessage?.(new MessageEvent('message', { data: 'not-json' }));

    await expect(next).rejects.toThrow();
    expect(sources[0]?.close).toHaveBeenCalled();
  });
});
