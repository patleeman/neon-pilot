import { buildApiPath } from '../client/apiBase';
import { createDesktopAwareEventSource } from '../desktop/desktopEventSource';

export interface ExtensionRouteSseStreamOptions {
  eventNames?: string[];
  signal?: AbortSignal;
}

function parseExtensionRouteSseData<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

export async function* streamExtensionRouteSse<T = unknown>(
  extensionId: string,
  routePath: string,
  options: ExtensionRouteSseStreamOptions = {},
): AsyncIterable<T> {
  const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const path = buildApiPath(`/extensions/${encodeURIComponent(extensionId)}/routes${normalizedRoute}`);
  const source = createDesktopAwareEventSource(path);
  const pending: T[] = [];
  const waiters: Array<{
    resolve: (value: IteratorResult<T>) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  let closed = false;
  let failure: unknown = null;

  const flush = () => {
    while (pending.length > 0 && waiters.length > 0) {
      const waiter = waiters.shift();
      const value = pending.shift();
      if (!waiter || value === undefined) continue;
      waiter.resolve({ value, done: false });
    }
    if (failure) {
      while (waiters.length > 0) waiters.shift()?.reject(failure);
      return;
    }
    if (closed) {
      while (waiters.length > 0) waiters.shift()?.resolve({ value: undefined as never, done: true });
    }
  };

  const abort = () => {
    closed = true;
    source.close();
    flush();
  };
  const handleClose = () => {
    closed = true;
    source.close();
    flush();
  };

  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  source.addEventListener('close', handleClose);
  const eventTypes = new Set(['message', ...(options.eventNames ?? [])]);
  const handleEvent = (event: Event) => {
    const messageEvent = event as MessageEvent<string>;
    try {
      pending.push(parseExtensionRouteSseData<T>(messageEvent.data));
    } catch (err) {
      failure = err;
      closed = true;
      source.close();
    }
    flush();
  };
  for (const eventType of eventTypes) {
    source.addEventListener(eventType, handleEvent);
  }
  source.onerror = () => {
    failure = new Error('Extension route stream failed.');
    closed = true;
    source.close();
    flush();
  };

  const next = () =>
    new Promise<IteratorResult<T>>((resolve, reject) => {
      waiters.push({ resolve, reject });
      flush();
    });

  try {
    while (!closed || pending.length > 0) {
      const result = await next();
      if (result.done) break;
      yield result.value;
    }
    if (failure) throw failure;
  } finally {
    options.signal?.removeEventListener('abort', abort);
    source.removeEventListener('close', handleClose);
    for (const eventType of eventTypes) {
      source.removeEventListener(eventType, handleEvent);
    }
    closed = true;
    source.close();
    flush();
  }
}
