import { describe, expect, it, vi } from 'vitest';

import { startDesktopBackendWarmup } from './startup-backend-warmup.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('startDesktopBackendWarmup', () => {
  it('returns immediately instead of blocking startup on backend readiness', () => {
    const backend = deferred<boolean>();
    const onReady = vi.fn();

    startDesktopBackendWarmup({
      ensureBackend: () => backend.promise,
      onReady,
    });

    expect(onReady).not.toHaveBeenCalled();
  });

  it('reports readiness after the background warmup resolves', async () => {
    const backend = deferred<boolean>();
    const onReady = vi.fn();
    const onUnavailable = vi.fn();

    startDesktopBackendWarmup({
      ensureBackend: () => backend.promise,
      onReady,
      onUnavailable,
    });

    backend.resolve(true);
    await backend.promise;
    await Promise.resolve();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('reports unavailable when the background warmup fails', async () => {
    const backend = deferred<boolean>();
    const onError = vi.fn();
    const onUnavailable = vi.fn();

    startDesktopBackendWarmup({
      ensureBackend: () => backend.promise,
      onError,
      onUnavailable,
    });

    backend.reject(new Error('boom'));
    await backend.promise.catch(() => undefined);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });
});
