import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const { clearCacheMock, setProxyMock, sessionProtocolHandleMock, rootProtocolHandleMock } = vi.hoisted(() => ({
  clearCacheMock: vi.fn().mockResolvedValue(undefined),
  setProxyMock: vi.fn().mockResolvedValue(undefined),
  sessionProtocolHandleMock: vi.fn(),
  rootProtocolHandleMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { name: 'Neon Pilot', isPackaged: false, getAppPath: () => '/Applications/Neon Pilot.app/Contents/Resources/app.asar' },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: rootProtocolHandleMock },
  session: {
    fromPartition: () => ({ protocol: { handle: sessionProtocolHandleMock }, setProxy: setProxyMock, clearCache: clearCacheMock }),
  },
}));

import {
  buildDesktopProtocolErrorResponse,
  ensureDesktopAppProtocolForHost,
  getDesktopAppBaseUrl,
  resetDesktopWebDistDirCacheForTests,
  resolveDesktopWebDistDirForTests,
} from './app-protocol.js';

const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;

afterEach(() => {
  if (originalRepoRoot === undefined) {
    delete process.env.NEON_PILOT_REPO_ROOT;
  } else {
    process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
  }
  resetDesktopWebDistDirCacheForTests();
});

// ── app-protocol — helper functions ──────────────────────────────────────

describe('getDesktopAppBaseUrl', () => {
  it('returns the neon-pilot://app/ base URL', () => {
    expect(getDesktopAppBaseUrl()).toBe('neon-pilot://app/');
  });
});

describe('buildDesktopProtocolErrorResponse', () => {
  it('maps missing durable runs to 404 so run polling does not retry as a server error', () => {
    const response = buildDesktopProtocolErrorResponse(new Error('Run not found'));

    expect(response.status).toBe(404);
  });
});

describe('resolveDesktopWebDistDir', () => {
  it('ignores main-process dist directories that do not contain the web app index', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-web-dist-'));
    const mainDist = join(repoRoot, 'packages', 'desktop', 'dist');
    const uiDist = join(repoRoot, 'packages', 'desktop', 'ui', 'dist');
    mkdirSync(mainDist, { recursive: true });
    mkdirSync(uiDist, { recursive: true });
    writeFileSync(join(uiDist, 'index.html'), '<!doctype html><html><body>app</body></html>');

    process.env.NEON_PILOT_REPO_ROOT = repoRoot;
    resetDesktopWebDistDirCacheForTests();

    expect(resolveDesktopWebDistDirForTests()).toBe(uiDist);
  });
});

describe('ensureDesktopAppProtocolForHost', () => {
  it('clears the local desktop shell cache so stale dynamic extension chunks do not survive updates', () => {
    vi.useFakeTimers();
    ensureDesktopAppProtocolForHost({} as never, 'local');

    expect(setProxyMock).toHaveBeenCalledWith({ mode: 'direct' });
    expect(clearCacheMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(clearCacheMock).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('tears down a late stream subscription if the protocol request aborts before subscribe resolves', async () => {
    sessionProtocolHandleMock.mockClear();
    const unsubscribe = vi.fn();
    let resolveSubscribe: ((value: () => void) => void) | null = null;
    ensureDesktopAppProtocolForHost(
      {
        getHostController: () =>
          ({
            subscribeApiStream: vi.fn(
              () =>
                new Promise<() => void>((resolve) => {
                  resolveSubscribe = resolve;
                }),
            ),
          }) as never,
      } as never,
      'late-stream-test',
    );

    const handler = sessionProtocolHandleMock.mock.calls.at(-1)?.[1] as ((request: Request) => Promise<Response>) | undefined;
    expect(handler).toBeTypeOf('function');

    const abort = new AbortController();
    const response = await handler!(
      new Request('neon-pilot://app/api/extensions/system-terminal/routes/stream', {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
        signal: abort.signal,
      }),
    );

    const reader = response.body?.getReader();
    const readPromise = reader?.read();
    abort.abort();

    resolveSubscribe?.(unsubscribe);
    await readPromise?.catch(() => undefined);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('tears down synchronous protocol stream errors without double-closing the stream controller', async () => {
    sessionProtocolHandleMock.mockClear();
    const unsubscribe = vi.fn();
    ensureDesktopAppProtocolForHost(
      {
        getHostController: () =>
          ({
            subscribeApiStream: vi.fn(async (_path, onEvent) => {
              onEvent({ type: 'error', message: 'boom' });
              return unsubscribe;
            }),
          }) as never,
      } as never,
      'sync-stream-error-test',
    );

    const handler = sessionProtocolHandleMock.mock.calls.at(-1)?.[1] as ((request: Request) => Promise<Response>) | undefined;
    expect(handler).toBeTypeOf('function');

    const response = await handler!(
      new Request('neon-pilot://app/api/extensions/system-terminal/routes/stream', {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      }),
    );

    await expect(response.body?.getReader().read()).rejects.toThrow('boom');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('tears down synchronous protocol stream closes without double-closing the stream controller', async () => {
    sessionProtocolHandleMock.mockClear();
    const unsubscribe = vi.fn();
    ensureDesktopAppProtocolForHost(
      {
        getHostController: () =>
          ({
            subscribeApiStream: vi.fn(async (_path, onEvent) => {
              onEvent({ type: 'close' });
              return unsubscribe;
            }),
          }) as never,
      } as never,
      'sync-stream-close-test',
    );

    const handler = sessionProtocolHandleMock.mock.calls.at(-1)?.[1] as ((request: Request) => Promise<Response>) | undefined;
    expect(handler).toBeTypeOf('function');

    const response = await handler!(
      new Request('neon-pilot://app/api/extensions/system-terminal/routes/stream', {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      }),
    );

    await expect(response.body?.getReader().read()).resolves.toEqual({ done: true, value: undefined });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
