import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeSource extends EventTarget {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  readyState: number;
  close: ReturnType<typeof vi.fn>;
  path?: string;

  constructor() {
    super();
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.readyState = 1;
    this.close = vi.fn();
  }
}

const sources: FakeSource[] = [];
const createDesktopAwareEventSource = vi.fn((path: string) => {
  const source = new FakeSource();
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
    sources[0]?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'output' }) }));

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

  it('ignores late EventSource errors after the caller aborts', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const abort = new AbortController();
    const iter = streamExtensionRouteSse('system-terminal', '/stream?id=terminal-1', { signal: abort.signal })[Symbol.asyncIterator]();

    const next = iter.next();
    abort.abort();
    sources[0]?.onerror?.(new Event('error'));

    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(sources[0]?.close).toHaveBeenCalled();
  });

  it('yields raw string payloads without rejecting the stream', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const iter = streamExtensionRouteSse<string>('system-terminal', '/stream?id=terminal-1')[Symbol.asyncIterator]();
    const next = iter.next();

    sources[0]?.dispatchEvent(new MessageEvent('message', { data: 'ready' }));

    await expect(next).resolves.toEqual({ value: 'ready', done: false });
    await iter.return?.();
    expect(sources[0]?.close).toHaveBeenCalled();
  });

  it('completes when the desktop-aware EventSource reports a clean close', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const iter = streamExtensionRouteSse<string>('system-terminal', '/stream?id=terminal-1')[Symbol.asyncIterator]();
    const next = iter.next();

    sources[0]?.dispatchEvent(new Event('close'));

    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(sources[0]?.close).toHaveBeenCalled();
  });

  it('yields named SSE events when the caller opts into them', async () => {
    const { streamExtensionRouteSse } = await import('./extensionRouteStream');
    const iter = streamExtensionRouteSse<{ type: string }>('system-terminal', '/stream?id=terminal-1', {
      eventNames: ['update'],
    })[Symbol.asyncIterator]();
    const next = iter.next();

    sources[0]?.dispatchEvent(new MessageEvent('update', { data: JSON.stringify({ type: 'output' }) }));

    await expect(next).resolves.toEqual({ value: { type: 'output' }, done: false });
    await iter.return?.();
    expect(sources[0]?.close).toHaveBeenCalled();
  });
});
